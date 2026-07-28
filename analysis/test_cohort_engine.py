#!/usr/bin/env python3
"""Checks on the invariants that matter in the cohort engine.

Run: python test_cohort_engine.py <export.csv>

Covers the properties that are easy to break silently -- including the two
defects found while building it: thin-cell accounts scored against the wrong
reference population, and unbounded lever steps extrapolating off a near-zero
base.
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

import cohort_engine as ce

FAILURES: list[str] = []


def check(condition: bool, label: str, detail: str = "") -> None:
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}" + (f" -- {detail}" if detail else ""))
        FAILURES.append(label)


def main(path: str) -> int:
    raw = ce.load_raw(path)
    df = ce.canonicalize(raw)
    eligible, funnel = ce.screen_eligibility(df)
    cohorts = ce.assign_cohorts(eligible)
    bm = ce.benchmark(cohorts)
    model_df = ce.build_model_frame(bm)
    fit = ce.fit_lever_model(model_df)

    print("\nCanonicalization")
    # The sector label must come from the code letter, so every mapped sector
    # is one of the 10 NTEE major groups and never NTEE's "unclassified".
    sectors = set(df["sector"].dropna())
    check(
        sectors <= set(ce.NTEE_MAJOR_GROUPS.values()),
        "sectors are all NTEE major groups",
        f"unexpected: {sectors - set(ce.NTEE_MAJOR_GROUPS.values())}",
    )
    check(
        not any("Unknown" in s or "Unclassified" in s for s in sectors),
        "NTEE 'Z - Unclassified' never becomes a sector",
    )
    check(
        (df["org_revenue"].dropna() > 0).all(),
        "org_revenue is strictly positive where present",
    )
    check(
        ce.UNRELIABLE_REVENUE_FIELD not in {**ce.LEVERS, **ce.CONTEXT}
        and not any(
            spec["source"] == ce.UNRELIABLE_REVENUE_FIELD
            for spec in {**ce.LEVERS, **ce.CONTEXT}.values()
        ),
        "contaminated CRM revenue field never enters the model",
    )

    # avg_gift is lifetime-derived; the outcome is trailing-365. Verify they are
    # genuinely different windows rather than one restating the other.
    both = df[(df["raised_365"] > 0) & (df["raised_lifetime"] > 0)]
    ratio = (both["raised_lifetime"] / both["raised_365"]).median()
    check(ratio > 1.5, "lifetime raised exceeds trailing-365", f"ratio {ratio:.2f}")

    print("\nEligibility")
    check(len(eligible) > 0, "some accounts survive screening")
    check(
        all(eligible[f].notna().all() for f in ce.REQUIRED_FIELDS),
        "no nulls remain in required fields",
    )
    check(
        (eligible["raised_365"] >= ce.MIN_RAISED_365).all(),
        "activity floor enforced",
    )
    check(
        int(funnel.iloc[-1]["remaining"]) == len(eligible),
        "funnel final count matches returned frame",
    )
    check(
        int(funnel["removed"].sum()) == len(df) - len(eligible),
        "funnel removals reconcile with total drop",
    )

    print("\nCohort assignment")
    counts = cohorts["cohort"].value_counts()
    check(
        (cohorts["cohort_level"] != "none").all(),
        "every eligible account is benchmarkable",
        f"{(cohorts['cohort_level'] == 'none').sum()} stranded",
    )
    sector_cohorts = cohorts[cohorts["cohort_level"] == "sector x size"]["cohort"]
    check(
        counts[sector_cohorts.unique()].min() >= ce.MIN_COHORT_SIZE,
        "no sector x size cohort is below the minimum",
    )

    # The regression bug: a backed-off account must be scored against its whole
    # size band, not just the other thin-cell accounts sharing its label.
    backed_off = cohorts[cohorts["ref_dimension"] == "size_band"]
    if len(backed_off):
        band_sizes = cohorts["size_band"].value_counts()
        expected = backed_off["size_band"].map(band_sizes)
        check(
            (backed_off["cohort_size"].values == expected.values).all(),
            "backed-off cohort_size equals full size-band population",
        )
        check(
            (backed_off["cohort_size"] > len(backed_off)).any(),
            "backed-off accounts are scored against more than their own subset",
        )

    print("\nBenchmarking")
    pctl = bm[f"pctl_{ce.OUTCOME_METRIC}"]
    check(pctl.notna().all(), "every account has an outcome percentile")
    check(
        pctl.between(0, 100).all(),
        "percentiles are within 0-100",
        f"range {pctl.min():.2f}-{pctl.max():.2f}",
    )
    check(
        (bm.loc[pctl < ce.UNDERPERFORM_PCTL, "status"] == "Underperforming").all(),
        "status bands agree with percentiles",
    )
    # Percentile must be computed within the reference population, not globally:
    # the top account of a small cell should reach ~100 even if it is mid-pack
    # overall. Checked on cell-scored accounts only -- a backed-off account is
    # ranked against its whole size band, so its *label* group is not its
    # reference population and need not contain the band leader.
    cell_scored = bm[bm["ref_dimension"] == "cell"]
    per_cell_max = cell_scored.groupby("cell")[f"pctl_{ce.OUTCOME_METRIC}"].max()
    check(
        (per_cell_max > 99).all(),
        "each sector x size cell contains its own 100th percentile",
        f"{(per_cell_max <= 99).sum()} cells short",
    )

    # And the fix itself: a backed-off account's percentile must reproduce its
    # rank within the entire size band, computed here from scratch.
    backed = bm[bm["ref_dimension"] == "size_band"]
    if len(backed):
        mismatches = 0
        for band, group in backed.groupby("size_band", observed=True):
            band_values = bm.loc[
                bm["size_band"] == band, ce.OUTCOME_METRIC
            ].dropna()
            for _, account in group.iterrows():
                expected = (
                    band_values.rank(pct=True, method="average")[account.name] * 100
                )
                if abs(expected - account[f"pctl_{ce.OUTCOME_METRIC}"]) > 0.01:
                    mismatches += 1
        check(
            mismatches == 0,
            "backed-off percentiles reproduce full size-band ranking",
            f"{mismatches} of {len(backed)} mismatched",
        )

    print("\nActivation / optimization split")
    activation = bm["diagnosis"].str.startswith("Minimal platform adoption")
    check(
        (bm.loc[activation, "adoption_ratio"] < ce.MINIMAL_ADOPTION_RATIO).all(),
        "activation cases are all below the adoption floor",
    )
    check(
        (bm.loc[activation, "status"] == "Underperforming").all(),
        "activation cases are a subset of underperformers",
    )
    check(activation.sum() > 0, "the split actually separates some accounts")

    print("\nLever model")
    check(
        "raised_lifetime" not in fit.params.index
        and "gifts_lifetime" not in fit.params.index,
        "lifetime totals are excluded from predictors",
    )
    for lever in ce.LEVERS:
        check(lever in fit.params.index, f"lever present in fit: {lever}")
    effects = ce.lever_elasticities(fit, model_df)
    check(
        (effects["coefficient"] > 0).all(),
        "all lever effects point the expected direction",
    )
    check((effects["p_value"] < 0.05).all(), "all lever effects are significant")

    print("\nRecommendations")
    optimization = bm[bm["diagnosis"].str.startswith("Underperforming at scale")]
    name = optimization.nlargest(1, "gap_to_cohort_median")["Account Name"].iloc[0]
    row = model_df[model_df["Account Name"] == name].iloc[0]
    recs = ce.recommend(row, fit, model_df)
    check(not recs.empty, "an optimization case yields recommendations")
    check(
        (recs["projected_lift"] > 0).all(),
        "recommendations only ever propose gains",
    )
    check(
        recs["projected_lift"].is_monotonic_decreasing,
        "recommendations are ranked by projected lift",
    )
    # The extrapolation bug: bounded steps keep proposed moves plausible.
    check(
        (recs["target_pctl"] - recs["current_pctl"] <= ce.MAX_LEVER_STEP_PCTL + 1e-6).all(),
        "no recommendation exceeds the max percentile step",
    )
    check(
        (recs["lift_low"] <= recs["projected_lift"]).all()
        and (recs["projected_lift"] <= recs["lift_high"]).all(),
        "projected lift sits inside its confidence bounds",
    )

    # Activation cases must get no lever advice at all.
    act = bm[activation]
    if len(act):
        act_name = act.nlargest(1, "gap_to_cohort_median")["Account Name"].iloc[0]
        act_rows = model_df[model_df["Account Name"] == act_name]
        if not act_rows.empty:
            check(
                ce.recommend(act_rows.iloc[0], fit, model_df).empty,
                "activation cases receive no lever advice",
            )

    print("\nValidation")
    v = ce.validate_model(model_df)
    check(v["cv_r2_mean"] > 0.5, "cross-validated R2 is materially positive")
    check(
        v["in_sample_r2"] - v["cv_r2_mean"] < 0.05,
        "in-sample and CV R2 are close (no gross overfit)",
        f"{v['in_sample_r2']:.3f} vs {v['cv_r2_mean']:.3f}",
    )
    check(
        abs(v["cv_mae_log_points"] - ce.CV_MAE_LOG_POINTS) < 0.1,
        "documented CV MAE constant still matches reality",
        f"measured {v['cv_mae_log_points']:.3f} vs documented {ce.CV_MAE_LOG_POINTS}",
    )

    print()
    if FAILURES:
        print(f"{len(FAILURES)} CHECK(S) FAILED:")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
