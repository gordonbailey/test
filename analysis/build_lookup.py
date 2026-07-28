#!/usr/bin/env python3
"""Precompute per-account scorecards and recommendations for the lookup UI.

Runs the real engine for every eligible account so the embedded figures match
`run_analysis.py` exactly -- the browser only renders, it never re-derives.

Encoding is positional to keep the payload small enough to inline in a
self-contained page: metrics and recommendations are arrays, and lever names
are indices into a shared table.

Usage: python build_lookup.py <export.csv> [-o lookup_data.json]
"""

from __future__ import annotations

import argparse
import json
import math

import numpy as np
import pandas as pd

import cohort_engine as ce

METRIC_ORDER = list(ce.BENCHMARK_METRICS)
LEVER_ORDER = list(ce.LEVERS)


def r(value, digits=0):
    """Round for transport, preserving None and guarding non-finite values."""
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(f):
        return None
    return round(f, digits) if digits else round(f)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("csv")
    ap.add_argument("-o", "--out", default="lookup_data.json")
    args = ap.parse_args()

    raw = ce.load_raw(args.csv)
    df = ce.canonicalize(raw)
    eligible, _ = ce.screen_eligibility(df)
    bm = ce.benchmark(ce.assign_cohorts(eligible))
    model_df = ce.build_model_frame(bm)
    fit = ce.fit_lever_model(model_df)

    # Index model rows by account name for the recommendation pass. Duplicate
    # names keep their first row, matching run_analysis.py's behaviour.
    model_by_name = {}
    for _, row in model_df.iterrows():
        model_by_name.setdefault(row["Account Name"], row)

    # Cohort-level reference stats, sent once instead of repeated per account.
    cohorts = {}
    for name, group in bm.groupby("cohort"):
        cohorts[name] = {
            "n": int(len(group)),
            "lvl": group["cohort_level"].iloc[0],
            "med": r(group["raised_365"].median()),
            "p25": r(group["raised_365"].quantile(0.25)),
            "p75": r(group["raised_365"].quantile(0.75)),
            "mg": r(group["avg_gift"].median()),
            "mr": r(group["recurring_donors"].median()),
            "mc": r(group["channel_breadth"].median(), 1),
        }
    cohort_ids = {name: i for i, name in enumerate(sorted(cohorts))}

    accounts = []
    for _, row in bm.iterrows():
        name = row["Account Name"]

        metrics = []
        for metric in METRIC_ORDER:
            digits = 2 if metric == "avg_gift" else 0
            metrics.append(
                [r(row.get(metric), digits), r(row.get(f"pctl_{metric}"), 1)]
            )

        recs = []
        model_row = model_by_name.get(name)
        if model_row is not None:
            table = ce.recommend(model_row, fit, model_df)
            for _, rec in table.iterrows():
                lever_idx = next(
                    i
                    for i, key in enumerate(LEVER_ORDER)
                    if ce.LEVERS[key]["label"] == rec["lever"]
                )
                recs.append(
                    [
                        lever_idx,
                        r(rec["current_value"], 2),
                        r(rec["cohort_target_value"], 2),
                        r(rec["current_pctl"], 1),
                        r(rec["target_pctl"], 1),
                        r(rec["projected_lift"]),
                        r(rec["projected_lift_pct"], 1),
                        r(rec["lift_low"]),
                        r(rec["lift_high"]),
                    ]
                )

        accounts.append(
            {
                "n": name,
                "o": row["Account Owner"],
                "s": row["sector"],
                "b": str(row["size_band"]),
                "c": cohort_ids[row["cohort"]],
                "rev": r(row["org_revenue"]),
                "st": row["status"],
                "dg": row["diagnosis"],
                "ar": r(row.get("adoption_ratio"), 3),
                "gap": r(row["gap_to_cohort_median"]),
                "m": metrics,
                "r": recs,
            }
        )

    payload = {
        "metricOrder": METRIC_ORDER,
        "metricLabels": [ce.BENCHMARK_METRICS[m] for m in METRIC_ORDER],
        "levers": [
            {"label": ce.LEVERS[k]["label"], "action": ce.LEVERS[k]["action"]}
            for k in LEVER_ORDER
        ],
        "cohortNames": sorted(cohorts),
        "cohorts": [cohorts[n] for n in sorted(cohorts)],
        "accounts": accounts,
        "maxStepPctl": ce.MAX_LEVER_STEP_PCTL,
        "minAdoption": ce.MINIMAL_ADOPTION_RATIO,
        "cvMultiplier": r(ce.validate_model(model_df)["cv_mae_as_multiplier"], 2),
    }

    with open(args.out, "w") as fh:
        json.dump(payload, fh, separators=(",", ":"), default=str)

    owners = {a["o"] for a in accounts}
    with_recs = sum(1 for a in accounts if a["r"])
    print(f"accounts:      {len(accounts)}")
    print(f"owners:        {len(owners)}")
    print(f"with lever advice: {with_recs}")
    print(f"cohorts:       {len(cohorts)}")
    print(f"bytes:         {len(json.dumps(payload, separators=(',', ':'), default=str)):,}")


if __name__ == "__main__":
    main()
