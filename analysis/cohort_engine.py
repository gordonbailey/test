"""Peer cohort benchmarking engine for nonprofit fundraising performance.

The problem this solves: raw fundraising totals are not comparable across
organizations. A $2M children's hospital foundation and a $50k animal rescue
are not competing on the same terms, so "raised $400k last year" means nothing
without a reference group. This module builds that reference group -- a peer
cohort of organizations matched on cause area and financial scale -- then
scores each account against its own peers and identifies which operating
levers are most likely to close the gap.

Pipeline:
    load_raw -> canonicalize -> screen_eligibility -> assign_cohorts
             -> benchmark -> fit_lever_model -> recommend

Every stage is independently callable so the cohort definitions can be tuned
without rerunning the models.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------
# Canonical definitions
# --------------------------------------------------------------------------

# NTEE major groups. The source export carries a "NTEE Category" label that is
# inconsistent for the same rollup (letters R-V read "Public, Societal Benefit"
# while W reads "Public & Societal Benefit"), so the letter from "NTEE Code" is
# treated as authoritative and the label is regenerated from this map.
NTEE_MAJOR_GROUPS = {
    "A": "Arts, Culture & Humanities",
    "B": "Education",
    "C": "Environment & Animals",
    "D": "Environment & Animals",
    "E": "Health",
    "F": "Health",
    "G": "Health",
    "H": "Health",
    "I": "Human Services",
    "J": "Human Services",
    "K": "Human Services",
    "L": "Human Services",
    "M": "Human Services",
    "N": "Human Services",
    "O": "Human Services",
    "P": "Human Services",
    "Q": "International & Foreign Affairs",
    "R": "Public & Societal Benefit",
    "S": "Public & Societal Benefit",
    "T": "Public & Societal Benefit",
    "U": "Public & Societal Benefit",
    "V": "Public & Societal Benefit",
    "W": "Public & Societal Benefit",
    "X": "Religion Related",
    "Y": "Mutual/Membership Benefit",
    # "Z" is NTEE's own "Unknown, Unclassified" -- deliberately absent so it
    # falls out at the eligibility gate rather than forming a fake peer group.
}

# Size bands on IRS-filed total revenue. Cut on order-of-magnitude boundaries
# because fundraising capacity scales multiplicatively, not linearly.
SIZE_BAND_EDGES = [0, 250_000, 1_000_000, 5_000_000, 25_000_000, np.inf]
SIZE_BAND_LABELS = [
    "Under $250k",
    "$250k-$1M",
    "$1M-$5M",
    "$5M-$25M",
    "Over $25M",
]

# Lifetime online channel components. These sum to "Txn - Online" (verified on
# 95% of rows to the dollar), which is a LIFETIME figure -- not trailing year.
CHANNEL_COLUMNS = [
    "Donation Page",
    "Crowdfunding",
    "Campaign Studio",
    "Peer to Peer",
    "Registration",
    "RwF",
    "Ticketed",
]

# Ordinal buckets are stored as free text in the export. Mapped to the midpoint
# of each bucket so they can enter a regression, with the open-ended top bucket
# held just above its floor rather than extrapolated.
FUNDRAISING_STAFF_MIDPOINTS = {
    "0": 0.0,
    "Less than 2": 1.0,
    "Between 2-5": 3.5,
    "Between 5-10": 7.5,
    "More than 10": 12.0,
}

# Values in the CRM's free-text revenue field that are obvious placeholders
# rather than measurements, and the field's overall reliability verdict:
# 86 accounts report exactly $10,000,000, 29 report exactly $1,000,000,000 and
# 12 report exactly $1. The field is excluded from all sizing as a result --
# IRS-filed figures are used instead.
UNRELIABLE_REVENUE_FIELD = "Annual Revenue"


def load_raw(path: str) -> pd.DataFrame:
    """Read the book-of-business export.

    The file is cp1252-encoded (it contains accented org names that are not
    valid UTF-8), so the encoding is pinned rather than guessed.
    """
    return pd.read_csv(path, encoding="cp1252")


def _to_numeric(series: pd.Series) -> pd.Series:
    """Coerce a possibly comma-formatted, possibly text column to float."""
    if series.dtype.kind in "if":
        return series.astype(float)
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False).str.strip(),
        errors="coerce",
    )


def canonicalize(raw: pd.DataFrame) -> pd.DataFrame:
    """Derive one unified definition per concept from the raw export.

    Resolves three specific ambiguities in the source data:

    1. Sector -- rebuilt from the NTEE code letter, since the shipped label is
       inconsistent across letters that share a rollup.
    2. Org size -- taken from IRS-filed revenue ("IRS Annual Revenue", falling
       back to "990 Value"), never from the CRM's free-text revenue field.
    3. Time window -- annual outcome comes only from "Txn - Last 365"; every
       channel and count column is lifetime and is labelled `_lifetime`.
    """
    df = raw.copy()

    numeric_cols = [
        "990 Value",
        "IRS Annual Revenue",
        "Annual Revenue",
        "MRR in Contract",
        "ARR up for Renewal",
        "Employees",
        "# Recurring Donors",
        "# Active Admins",
        "Txn - Last 365",
        "Txn - Online",
        "Txn - Count Online",
        "# of Active Campaigns",
        "Total # Campaigns (Last 365)",
        *CHANNEL_COLUMNS,
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = _to_numeric(df[col])

    # -- Sector ------------------------------------------------------------
    code_letter = df["NTEE Code"].astype(str).str.strip().str[0].str.upper()
    df["ntee_letter"] = code_letter.where(code_letter.str.match(r"^[A-Z]$"))
    df["sector"] = df["ntee_letter"].map(NTEE_MAJOR_GROUPS)

    # -- Org size ----------------------------------------------------------
    # Positive values only: a filed revenue of 0 means "no usable filing here",
    # not "this organization has no revenue".
    irs = df["IRS Annual Revenue"].where(df["IRS Annual Revenue"] > 0)
    val990 = df["990 Value"].where(df["990 Value"] > 0)
    df["org_revenue"] = irs.fillna(val990)
    df["org_revenue_source"] = np.select(
        [irs.notna(), val990.notna()],
        ["IRS Annual Revenue", "990 Value"],
        default=None,
    )
    df["size_band"] = pd.cut(
        df["org_revenue"],
        bins=SIZE_BAND_EDGES,
        labels=SIZE_BAND_LABELS,
        right=False,
    )

    # -- Fundraising outcome (trailing 12 months) --------------------------
    df["raised_365"] = df["Txn - Last 365"]

    # -- Lifetime figures --------------------------------------------------
    df["raised_lifetime"] = df["Txn - Online"]
    df["gifts_lifetime"] = df["Txn - Count Online"]

    # Average gift is a lifetime donor-behaviour trait. Used as an explanatory
    # lever for the annual outcome, never mixed into the outcome itself.
    df["avg_gift"] = np.where(
        (df["gifts_lifetime"] > 0) & (df["raised_lifetime"] > 0),
        df["raised_lifetime"] / df["gifts_lifetime"].replace(0, np.nan),
        np.nan,
    )

    # -- Channel mix -------------------------------------------------------
    present_channels = [c for c in CHANNEL_COLUMNS if c in df.columns]
    channel_dollars = df[present_channels].fillna(0)
    df["channel_breadth"] = (channel_dollars > 0).sum(axis=1)
    df["channels_lifetime_sum"] = channel_dollars.sum(axis=1)

    # Share of lifetime dollars from the single largest channel. High values
    # mean concentration risk; it is a diversification lever, not an outcome.
    with np.errstate(invalid="ignore", divide="ignore"):
        df["top_channel_share"] = np.where(
            df["channels_lifetime_sum"] > 0,
            channel_dollars.max(axis=1) / df["channels_lifetime_sum"],
            np.nan,
        )

    # -- Operating capability levers ---------------------------------------
    crm = df["CRM Provider"]
    df["has_crm"] = (
        crm.notna() & ~crm.isin(["We don't use a CRM", "N/A"])
    ).astype(int)

    df["recurring_donors"] = df["# Recurring Donors"]
    df["active_campaigns"] = df["# of Active Campaigns"]
    df["campaigns_365"] = df["Total # Campaigns (Last 365)"]
    df["active_admins"] = df["# Active Admins"]
    df["employees"] = df["Employees"].where(df["Employees"] > 0)
    df["fundraising_staff"] = df["Paid Fundraising Staff"].map(
        FUNDRAISING_STAFF_MIDPOINTS
    )

    return df


# --------------------------------------------------------------------------
# Eligibility
# --------------------------------------------------------------------------

# Fields without which an account cannot be fairly benchmarked at all. Kept
# deliberately short: each additional gate costs sample size, and the sparse
# survey-style fields would eliminate most of the book if required.
REQUIRED_FIELDS = {
    "sector": "Cause area (NTEE major group) resolvable and not 'Unclassified'",
    "org_revenue": "IRS-filed total revenue available and positive",
    "raised_365": "Trailing-365-day funds raised reported",
    "avg_gift": "Average gift size computable from lifetime dollars and count",
}

# Below this, a trailing year of activity is too thin to read as performance --
# a single gift does not evidence a fundraising program.
MIN_RAISED_365 = 1_000.0
MIN_LIFETIME_GIFTS = 25


def screen_eligibility(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Apply the eligibility gates, returning (eligible, funnel).

    The funnel is a first-class output: it records how many accounts each gate
    removes so the cost of the "complete data only" rule stays visible instead
    of silently shrinking the population.
    """
    rows = []
    working = df.copy()
    rows.append({"gate": "All accounts in export", "removed": 0, "remaining": len(working)})

    for field, description in REQUIRED_FIELDS.items():
        before = len(working)
        working = working[working[field].notna()]
        rows.append(
            {
                "gate": f"Has {field}",
                "detail": description,
                "removed": before - len(working),
                "remaining": len(working),
            }
        )

    before = len(working)
    working = working[working["raised_365"] >= MIN_RAISED_365]
    rows.append(
        {
            "gate": f"Raised >= ${MIN_RAISED_365:,.0f} in trailing year",
            "detail": "Excludes dormant and trial accounts",
            "removed": before - len(working),
            "remaining": len(working),
        }
    )

    before = len(working)
    working = working[working["gifts_lifetime"] >= MIN_LIFETIME_GIFTS]
    rows.append(
        {
            "gate": f"At least {MIN_LIFETIME_GIFTS} lifetime gifts",
            "detail": "Average gift size is unstable on very few transactions",
            "removed": before - len(working),
            "remaining": len(working),
        }
    )

    return working.copy(), pd.DataFrame(rows)


# --------------------------------------------------------------------------
# Cohort assignment
# --------------------------------------------------------------------------

MIN_COHORT_SIZE = 30


def assign_cohorts(
    df: pd.DataFrame, min_cohort_size: int = MIN_COHORT_SIZE
) -> pd.DataFrame:
    """Assign each account a peer cohort of sector x size band.

    Cohort *identity* and cohort *reference population* are deliberately kept
    as separate ideas. Thin cells would produce unstable percentiles (in a
    cohort of four, one outlier moves everyone), so any cell below
    `min_cohort_size` backs off to a size-band cohort -- and the population it
    is then scored against is the *entire* size band, not merely the other
    thin-cell accounts inside it. Collapsing those two ideas would compare, say,
    16 religious organizations only to each other under a label claiming they
    were measured against all sectors.

    Adds:
        cell           -- the sector x size cell, regardless of viability
        cohort         -- the label shown to the organization
        cohort_level   -- which matching dimensions actually applied
        ref_dimension  -- "cell" or "size_band": which column defines the
                          population `benchmark` scores this account against
        cohort_size    -- size of that reference population
    """
    out = df.copy()
    out["cell"] = out["sector"].astype(str) + " | " + out["size_band"].astype(str)

    counts = out["cell"].value_counts()
    thin = counts[counts < min_cohort_size].index
    is_thin = out["cell"].isin(thin)

    out["cohort"] = np.where(
        is_thin, "All sectors | " + out["size_band"].astype(str), out["cell"]
    )
    out["cohort_level"] = np.where(
        is_thin, "size only (sector cell too thin)", "sector x size"
    )
    out["ref_dimension"] = np.where(is_thin, "size_band", "cell")

    cell_sizes = out["cell"].map(counts)
    band_sizes = out["size_band"].map(out["size_band"].value_counts())
    out["cohort_size"] = np.where(is_thin, band_sizes, cell_sizes)

    # Only if an entire size band is too thin is an account unbenchmarkable.
    still_thin = out["cohort_size"] < min_cohort_size
    out.loc[still_thin, "cohort"] = "Unbenchmarkable (no cohort reaches minimum size)"
    out.loc[still_thin, "cohort_level"] = "none"

    return out


# --------------------------------------------------------------------------
# Benchmarking
# --------------------------------------------------------------------------

# Metrics each account is scored on against its cohort. The outcome carries the
# headline status; the components explain where the outcome comes from and map
# onto distinct operating interventions.
BENCHMARK_METRICS = {
    "raised_365": "Funds raised, trailing 12 months",
    "avg_gift": "Average gift size (lifetime)",
    "gifts_lifetime": "Lifetime gift count",
    "recurring_donors": "Recurring donors",
    "channel_breadth": "Number of channels used",
    "active_campaigns": "Active campaigns",
}

OUTCOME_METRIC = "raised_365"

UNDERPERFORM_PCTL = 25.0
OVERPERFORM_PCTL = 75.0

# An account raising less than this fraction of its cohort median is treated as
# not-yet-activated rather than underperforming. Lever advice is suppressed for
# them: moving a lever from zero to the cohort's 75th percentile is an
# extrapolation the model has no support for, and the resulting "+2,500% lift"
# is an artifact of a near-zero denominator, not a finding.
MINIMAL_ADOPTION_RATIO = 0.10

# Largest percentile jump a single recommendation may propose. Advice to move a
# lever from the 5th to the 75th percentile in one step is not actionable and
# sits outside the range of comparable peers; recommendations are capped to an
# incremental move up the cohort distribution instead.
MAX_LEVER_STEP_PCTL = 25.0

# Out-of-sample error of the lever model, from 5-fold cross-validation on the
# eligible population (see `validate_model`). In log points, so it reads as a
# multiplicative error: exp(0.78) is roughly a factor of 2.2 either way on any
# single organization's predicted annual raised. Recorded here because it is
# the honest bound on how a recommendation may be presented.
CV_MAE_LOG_POINTS = 0.78


def _pct_rank(series: pd.Series) -> pd.Series:
    """Percentile rank within a group, 0-100, averaging ties."""
    return series.rank(pct=True, method="average") * 100.0


def benchmark(df: pd.DataFrame) -> pd.DataFrame:
    """Percentile-rank every account against its reference population.

    Because the cohort is already matched on size, a raw percentile on
    `raised_365` *is* the size-adjusted comparison -- no further normalisation
    (and no ratio-to-revenue metric, which explodes for platform-native orgs)
    is needed.

    Each account is scored against the population named by `ref_dimension`:
    its sector x size cell where that cell is viable, otherwise its whole size
    band. Both are computed and then selected per account, so a backed-off
    account is genuinely measured against every peer of its scale.
    """
    out = df.copy()
    benchmarkable = out["cohort_level"] != "none"
    use_cell = out["ref_dimension"] == "cell"

    for metric in BENCHMARK_METRICS:
        valid = benchmarkable & out[metric].notna()
        sub = out.loc[valid]

        by_cell = sub.groupby("cell")[metric]
        by_band = sub.groupby("size_band", observed=True)[metric]

        pctl = np.where(
            use_cell.loc[valid],
            by_cell.transform(_pct_rank),
            by_band.transform(_pct_rank),
        )
        median = np.where(
            use_cell.loc[valid],
            by_cell.transform("median"),
            by_band.transform("median"),
        )
        p75 = np.where(
            use_cell.loc[valid],
            by_cell.transform(lambda s: s.quantile(0.75)),
            by_band.transform(lambda s: s.quantile(0.75)),
        )

        for col, values in (
            (f"pctl_{metric}", pctl),
            (f"cohort_median_{metric}", median),
            (f"cohort_p75_{metric}", p75),
        ):
            out[col] = np.nan
            out.loc[valid, col] = values

    pctl = out[f"pctl_{OUTCOME_METRIC}"]
    out["status"] = np.select(
        [
            pctl.isna(),
            pctl < UNDERPERFORM_PCTL,
            pctl >= OVERPERFORM_PCTL,
        ],
        ["Not benchmarkable", "Underperforming", "Overperforming"],
        default="On track",
    )

    out["gap_to_cohort_median"] = (
        out[f"cohort_median_{OUTCOME_METRIC}"] - out[OUTCOME_METRIC]
    )

    # Separate "barely on the platform" from "using the platform and trailing".
    # Both land in the bottom quartile, but they call for opposite conversations:
    # an organization raising $2k against a $590k cohort median does not need a
    # donor-upgrade strategy, it needs onboarding. Lumping them together is how
    # a benchmarking product ends up recommending an ask-ladder redesign to
    # someone who has not launched a campaign yet.
    adoption_ratio = out[OUTCOME_METRIC] / out[f"cohort_median_{OUTCOME_METRIC}"]
    out["adoption_ratio"] = adoption_ratio
    out["diagnosis"] = np.select(
        [
            out["status"] == "Not benchmarkable",
            adoption_ratio < MINIMAL_ADOPTION_RATIO,
            out["status"] == "Underperforming",
            out["status"] == "On track",
        ],
        [
            "Not benchmarkable",
            "Minimal platform adoption - activation, not optimization",
            "Underperforming at scale - optimization opportunity",
            "On track",
        ],
        default="Overperforming",
    )

    return out


# --------------------------------------------------------------------------
# Lever model
# --------------------------------------------------------------------------

# Levers an organization can actually act on, and the direction of the action.
# Deliberately EXCLUDES lifetime dollars raised and lifetime gift count: those
# are near-arithmetic restatements of the outcome and would produce a model
# with high R-squared and no advice in it.
LEVERS = {
    "log_avg_gift": {
        "source": "avg_gift",
        "transform": "log",
        "label": "Average gift size",
        "action": "Donor upgrade and ask-ladder strategy",
    },
    "log_recurring_donors": {
        "source": "recurring_donors",
        "transform": "log1p",
        "label": "Recurring donors",
        "action": "Launch or grow a monthly giving program",
    },
    "channel_breadth": {
        "source": "channel_breadth",
        "transform": "none",
        "label": "Channels in use",
        "action": "Add a fundraising channel (events, P2P, crowdfunding)",
    },
    "log_active_campaigns": {
        "source": "active_campaigns",
        "transform": "log1p",
        "label": "Active campaigns",
        "action": "Increase campaign cadence",
    },
    "has_crm": {
        "source": "has_crm",
        "transform": "none",
        "label": "CRM integrated",
        "action": "Integrate a donor CRM",
    },
}

# Context variables: held constant so lever effects are not confounded by org
# scale, but never recommended -- an organization cannot decide to have more
# employees this quarter in order to fundraise better.
CONTEXT = {
    "log_org_revenue": {"source": "org_revenue", "transform": "log"},
    "log_employees": {"source": "employees", "transform": "log1p"},
}


def _apply_transform(series: pd.Series, transform: str) -> pd.Series:
    if transform == "log":
        return np.log(series.where(series > 0))
    if transform == "log1p":
        return np.log1p(series.clip(lower=0))
    return series


def build_model_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Assemble the regression design matrix.

    Missing lever values are filled with the cohort median (not the global
    median) so an imputed account is compared against its own peers, and an
    indicator column records the imputation.
    """
    out = df[df["cohort_level"] != "none"].copy()
    out["log_raised_365"] = np.log(out["raised_365"].where(out["raised_365"] > 0))

    specs = {**LEVERS, **CONTEXT}
    for name, spec in specs.items():
        raw = out[spec["source"]]
        transformed = _apply_transform(raw, spec["transform"])
        missing = transformed.isna()
        if missing.any():
            cohort_median = transformed.groupby(out["cohort"]).transform("median")
            transformed = transformed.fillna(cohort_median)
            # A cohort with no observed values at all still needs a number.
            transformed = transformed.fillna(transformed.median())
        out[name] = transformed
        out[f"{name}_imputed"] = missing.astype(int)

    return out.dropna(subset=["log_raised_365"])


def fit_lever_model(model_df: pd.DataFrame, cohort_fixed_effects: bool = True):
    """Fit log(annual raised) on levers, controlling for cohort and scale.

    Cohort fixed effects absorb every fixed cohort characteristic -- cause
    area, size band, and anything else constant within a peer group -- so the
    lever coefficients describe variation *within* a peer set, which is the
    comparison an organization actually cares about. Standard errors are
    heteroskedasticity-robust (HC3): fundraising residuals fan out with scale.
    """
    import statsmodels.api as sm

    terms = list(LEVERS) + list(CONTEXT)
    X = model_df[terms].copy()

    if cohort_fixed_effects:
        dummies = pd.get_dummies(
            model_df["cohort"], prefix="cohort", drop_first=True, dtype=float
        )
        X = pd.concat([X, dummies], axis=1)

    X = sm.add_constant(X)
    y = model_df["log_raised_365"]
    return sm.OLS(y, X.astype(float)).fit(cov_type="HC3")


def lever_elasticities(fit, model_df: pd.DataFrame) -> pd.DataFrame:
    """Extract the lever coefficients as an interpretable table.

    For log-transformed levers the coefficient is an elasticity: a 1% increase
    in the lever moves annual raised by `coef`%. For level terms it is a
    log-point effect, reported as a multiplier.
    """
    rows = []
    for name, spec in LEVERS.items():
        if name not in fit.params.index:
            continue
        coef = fit.params[name]
        rows.append(
            {
                "lever": name,
                "label": spec["label"],
                "action": spec["action"],
                "transform": spec["transform"],
                "coefficient": coef,
                "std_err": fit.bse[name],
                "p_value": fit.pvalues[name],
                "ci_low": fit.conf_int().loc[name, 0],
                "ci_high": fit.conf_int().loc[name, 1],
                "interpretation": (
                    f"+1% lever -> {coef:+.2f}% raised"
                    if spec["transform"] in ("log", "log1p")
                    else f"+1 unit -> x{np.exp(coef):.2f} raised"
                ),
            }
        )
    return pd.DataFrame(rows).sort_values("p_value")


def validate_model(model_df: pd.DataFrame, n_splits: int = 5, seed: int = 42) -> dict:
    """Cross-validate the lever model.

    Reported because a fixed-effects model with 30-odd cohort dummies can post
    a comfortable in-sample R-squared while generalising poorly; the gap
    between the two numbers is the thing worth knowing.
    """
    import statsmodels.api as sm
    from sklearn.model_selection import KFold

    terms = list(LEVERS) + list(CONTEXT)
    dummies = pd.get_dummies(
        model_df["cohort"], prefix="cohort", drop_first=True, dtype=float
    )
    X = sm.add_constant(
        pd.concat([model_df[terms].astype(float), dummies], axis=1)
    ).reset_index(drop=True)
    y = model_df["log_raised_365"].reset_index(drop=True).values

    r2s, maes = [], []
    for train_idx, test_idx in KFold(
        n_splits=n_splits, shuffle=True, random_state=seed
    ).split(X):
        model = sm.OLS(y[train_idx], X.iloc[train_idx]).fit()
        pred = model.predict(X.iloc[test_idx])
        actual = y[test_idx]
        ss_res = ((actual - pred) ** 2).sum()
        ss_tot = ((actual - actual.mean()) ** 2).sum()
        r2s.append(1 - ss_res / ss_tot)
        maes.append(np.abs(actual - pred).mean())

    in_sample = sm.OLS(y, X).fit()
    return {
        "n": int(len(y)),
        "in_sample_r2": float(in_sample.rsquared),
        "cv_r2_mean": float(np.mean(r2s)),
        "cv_r2_std": float(np.std(r2s)),
        "cv_mae_log_points": float(np.mean(maes)),
        "cv_mae_as_multiplier": float(np.exp(np.mean(maes))),
    }


# --------------------------------------------------------------------------
# Recommendations
# --------------------------------------------------------------------------


def recommend(
    account_row: pd.Series,
    fit,
    model_df: pd.DataFrame,
    target_pctl: float = 75.0,
) -> pd.DataFrame:
    """Rank levers by projected dollar lift for one account.

    Each lever is moved from the account's current value to its cohort's
    `target_pctl` value, holding the others fixed, and the fitted model
    converts that move into an expected change in annual raised. Levers the
    account already leads its cohort on are dropped rather than shown as
    negative advice.

    Read the output as a *ranking*, not a forecast. Two separate caveats:

    1. Effect uncertainty -- `lift_low`/`lift_high` propagate the coefficient's
       95% confidence interval, so they bound the estimated average effect.
    2. Residual spread -- individual organizations scatter far more widely than
       that (see `CV_MAE_LOG_POINTS`); the model explains roughly two thirds of
       the variance in annual raised, and no per-account dollar figure derived
       from it should be quoted as a promise.

    And the standing caveat on all of it: these coefficients are associations
    measured across organizations, not effects measured by intervention. Orgs
    that already fundraise well are likelier to have adopted a CRM in the first
    place, so a lever's coefficient blends "doing this helps" with "the kind of
    org that does this was already ahead."
    """
    cohort_peers = model_df[model_df["cohort"] == account_row["cohort"]]
    if cohort_peers.empty:
        return pd.DataFrame()

    # Not-yet-activated accounts get no lever advice. See MINIMAL_ADOPTION_RATIO.
    if account_row.get("adoption_ratio", np.inf) < MINIMAL_ADOPTION_RATIO:
        return pd.DataFrame()

    current_raised = account_row["raised_365"]
    conf = fit.conf_int()
    rows = []

    for name, spec in LEVERS.items():
        if name not in fit.params.index:
            continue

        current = account_row.get(name)
        if pd.isna(current):
            continue

        # Cap the proposed move at an incremental climb from where the account
        # already sits, so the target stays among peers it can be compared to.
        peer_values = cohort_peers[name].dropna()
        if peer_values.empty:
            continue
        current_pctl = (peer_values <= current).mean() * 100
        capped_pctl = min(target_pctl, current_pctl + MAX_LEVER_STEP_PCTL)

        target = peer_values.quantile(capped_pctl / 100.0)
        if pd.isna(target) or target <= current:
            continue

        # Model is in logs, so a lever delta in log space maps to a
        # multiplicative change in dollars.
        step = target - current
        projected = current_raised * np.exp(fit.params[name] * step)
        low = current_raised * np.exp(conf.loc[name, 0] * step)
        high = current_raised * np.exp(conf.loc[name, 1] * step)

        rows.append(
            {
                "lever": spec["label"],
                "action": spec["action"],
                "current_value": account_row.get(spec["source"]),
                "current_pctl": current_pctl,
                "target_pctl": capped_pctl,
                "cohort_target_value": cohort_peers[spec["source"]]
                .dropna()
                .quantile(capped_pctl / 100.0),
                "projected_raised": projected,
                "projected_lift": projected - current_raised,
                "projected_lift_pct": (projected / current_raised - 1) * 100,
                "lift_low": low - current_raised,
                "lift_high": high - current_raised,
                "significant": fit.pvalues[name] < 0.05,
            }
        )

    if not rows:
        return pd.DataFrame()

    return (
        pd.DataFrame(rows)
        .sort_values("projected_lift", ascending=False)
        .reset_index(drop=True)
    )


def scorecard(account_row: pd.Series) -> dict:
    """Flatten one account's benchmark results into a report-ready dict."""
    card = {
        "account": account_row["Account Name"],
        "sector": account_row["sector"],
        "size_band": str(account_row["size_band"]),
        "org_revenue": account_row["org_revenue"],
        "cohort": account_row["cohort"],
        "cohort_size": int(account_row["cohort_size"]),
        "cohort_level": account_row["cohort_level"],
        "status": account_row["status"],
        "diagnosis": account_row["diagnosis"],
        "adoption_ratio": account_row.get("adoption_ratio"),
        "raised_365": account_row["raised_365"],
        "cohort_median_raised": account_row["cohort_median_raised_365"],
        "gap_to_median": account_row["gap_to_cohort_median"],
        "metrics": {},
    }
    for metric, label in BENCHMARK_METRICS.items():
        card["metrics"][metric] = {
            "label": label,
            "value": account_row.get(metric),
            "percentile": account_row.get(f"pctl_{metric}"),
            "cohort_median": account_row.get(f"cohort_median_{metric}"),
            "cohort_p75": account_row.get(f"cohort_p75_{metric}"),
        }
    return card
