#!/usr/bin/env python3
"""Emit the aggregate JSON the report page inlines.

Two files, both derived — neither is committed:

    report_data_compact.json   funnel, lever effects, variance, model, examples
    findings_extra.json        the extra findings series plus the methodology
                               tables (band stats, model terms with VIFs)

Usage: python build_report_data.py <export.csv>
"""

from __future__ import annotations

import argparse
import json

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats
from statsmodels.stats.outliers_influence import variance_inflation_factor

import cohort_engine as ce


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("csv")
    args = ap.parse_args()

    raw = ce.load_raw(args.csv)
    df = ce.canonicalize(raw)
    eligible, funnel = ce.screen_eligibility(df)
    bm = ce.benchmark(ce.assign_cohorts(eligible))
    model_df = ce.build_model_frame(bm)
    fit = ce.fit_lever_model(model_df)
    effects = ce.lever_elasticities(fit, model_df)
    validation = ce.validate_model(model_df)

    # ---- compact report payload ------------------------------------------
    opt = bm[bm["diagnosis"].str.startswith("Underperforming at scale")]
    examples = []
    for _, row in pd.concat(
        [opt.nlargest(1, "gap_to_cohort_median"), bm.nlargest(1, "raised_365")]
    ).iterrows():
        mrow = model_df[model_df["Account Name"] == row["Account Name"]]
        recs = ce.recommend(mrow.iloc[0], fit, model_df) if not mrow.empty else pd.DataFrame()
        card = ce.scorecard(row)
        card["recommendations"] = recs.to_dict("records") if not recs.empty else []
        examples.append(card)

    y = np.log(bm["raised_365"])
    tss = ((y - y.mean()) ** 2).sum()

    def eta(col):
        gm = y.groupby(bm[col].astype(str)).transform("mean")
        return float(((gm - y.mean()) ** 2).sum() / tss)

    compact = {
        "funnel": [
            {"g": r["gate"], "r": int(r["removed"]), "n": int(r["remaining"]),
             # NaN is truthy in Python, so `or ""` does not catch a missing
             # detail — it would emit a bare NaN into the inlined payload.
             "d": "" if pd.isna(r.get("detail")) else str(r["detail"])}
            for _, r in funnel.iterrows()
        ],
        "effects": [
            {"l": e["label"], "a": e["action"], "t": e["transform"],
             "c": e["coefficient"], "p": e["p_value"],
             "lo": e["ci_low"], "hi": e["ci_high"]}
            for e in effects.to_dict("records")
        ],
        "diagnosis": bm["diagnosis"].value_counts().to_dict(),
        "variance": {"cohort": eta("cohort"), "sector": eta("sector"),
                     "size_band": eta("size_band")},
        "model": validation,
        "totals": {
            "export": int(len(df)), "eligible": int(len(bm)),
            "cohorts": int(bm["cohort"].nunique()),
            "opt_gap": float(opt["gap_to_cohort_median"].sum()),
            "exceptional": int(bm["is_exceptional"].sum()),
        },
        "examples": [
            {"name": e["account"], "sector": e["sector"], "band": e["size_band"],
             "cohort": e["cohort"], "cn": e["cohort_size"], "status": e["status"],
             "diag": e["diagnosis"], "exc": bool(e.get("is_exceptional")),
             "ratio": e.get("cohort_ratio"), "raised": e["raised_365"],
             "cmed": e["cohort_median_raised"],
             "metrics": {k: {"v": v["value"], "p": v["percentile"], "m": v["cohort_median"]}
                         for k, v in e["metrics"].items()},
             "recs": [{"l": r["lever"], "a": r["action"], "cv": r["current_value"],
                       "tv": r["cohort_target_value"], "cp": r["current_pctl"],
                       "tp": r["target_pctl"], "lift": r["projected_lift"],
                       "pct": r["projected_lift_pct"], "lo": r["lift_low"],
                       "hi": r["lift_high"]} for r in e["recommendations"]]}
            for e in examples
        ],
    }
    with open("report_data_compact.json", "w") as fh:
        json.dump(compact, fh, separators=(",", ":"), default=str)

    # ---- extra findings + methodology tables -----------------------------
    extra = {}

    extra["channels"] = sorted(
        [{"name": c, "dollars": float(df[c].fillna(0).sum()),
          "accounts": int((df[c] > 0).sum())} for c in ce.CHANNEL_COLUMNS],
        key=lambda r: -r["dollars"],
    )

    s = bm["raised_365"].sort_values(ascending=False)
    total = s.sum()
    extra["concentration"] = [
        {"pct": p, "share": float(s.iloc[: max(1, int(len(s) * p / 100))].sum() / total)}
        for p in (1, 5, 10, 25, 50)
    ]

    # Standouts by sector: within-cohort, so not a size effect.
    extra["bysector"] = sorted(
        [{"sector": sec, "n": int(len(g)), "exc": int(g["is_exceptional"].sum()),
          "share": float(g["is_exceptional"].mean()),
          "med": float(g["raised_365"].median())}
         for sec, g in bm.groupby("sector") if len(g) >= 60],
        key=lambda r: -r["share"],
    )

    # How the top decile got there: gift size, volume, both, or neither.
    top = bm[bm["raised_365"] >= bm["raised_365"].quantile(0.9)]
    hi_gift = top["pctl_avg_gift"] >= 60
    hi_vol = top["pctl_gifts_lifetime"] >= 60
    extra["paths"] = {
        "n_top": int(len(top)),
        "gift_led": int((hi_gift & ~hi_vol).sum()),
        "volume_led": int((hi_vol & ~hi_gift).sum()),
        "both": int((hi_gift & hi_vol).sum()),
        "neither": int((~hi_gift & ~hi_vol).sum()),
    }

    extra["spread"] = sorted(
        [{"cohort": c, "n": int(len(g)), "p10": float(g["raised_365"].quantile(0.1)),
          "p50": float(g["raised_365"].median()),
          "p90": float(g["raised_365"].quantile(0.9))}
         for c, g in bm.groupby("cohort") if len(g) >= 80],
        key=lambda r: -r["n"],
    )[:8]

    extra["bandstats"] = []
    for band in ce.SIZE_BAND_LABELS:
        g = bm[bm["size_band"] == band]
        if len(g) < 2:
            continue
        extra["bandstats"].append({
            "band": band, "n": int(len(g)),
            "dex": float(np.log10(g["org_revenue"].max() / g["org_revenue"].min())),
            "corr": float(stats.spearmanr(g["org_revenue"], g["raised_365"])[0])
                    if len(g) >= 30 else float("nan"),
        })

    terms = list(ce.LEVERS) + list(ce.CONTEXT)
    Xv = sm.add_constant(model_df[terms].astype(float))
    vifs = {c: variance_inflation_factor(Xv.values, i)
            for i, c in enumerate(Xv.columns) if c != "const"}
    roles = {**{k: "lever" for k in ce.LEVERS}, **{
        "log_org_revenue": "control — scale",
        "log_employees": "control — scale (n.s.)",
        "log_prior_run_rate": "control — history",
        "is_new_account": "control — history",
        "log_tenure": "control — history",
        "top_channel_share": "control — channel concentration",
        "log_individual_donors": "control — donor base",
    }}
    extra["terms"] = [
        {"term": t, "coef": float(fit.params[t]), "p": float(fit.pvalues[t]),
         "vif": float(vifs[t]), "role": roles.get(t, "")} for t in terms
    ]

    with open("findings_extra.json", "w") as fh:
        json.dump(extra, fh, indent=1, default=str)

    print("wrote report_data_compact.json and findings_extra.json")
    print(f"  paths: {extra['paths']}")
    print(f"  concentration top1%: {extra['concentration'][0]['share']:.1%}")


if __name__ == "__main__":
    main()
