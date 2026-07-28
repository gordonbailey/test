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
    #
    # These MUST come from the reference population, not from the set of accounts
    # carrying the cohort label. For a backed-off cohort the two differ: 61
    # accounts wear the "All sectors | Over $25M" label while the population they
    # are actually scored against is all 509 accounts in that size band. Reading
    # the label group instead reported a wrong peer count and a wrong cohort
    # median for all 216 backed-off accounts.
    cohorts = {}
    for name, group in bm.groupby("cohort"):
        if group["ref_dimension"].iloc[0] == "cell":
            pop = bm[bm["cell"] == group["cell"].iloc[0]]
            ref_dim, ref_sector = "cell", group["sector"].iloc[0]
        else:
            pop = bm[bm["size_band"] == group["size_band"].iloc[0]]
            ref_dim, ref_sector = "band", None

        # The engine already recorded the reference population size per account;
        # if this disagrees, one of the two is wrong and the numbers downstream
        # cannot be trusted.
        expected = int(group["cohort_size"].iloc[0])
        assert len(pop) == expected, (
            f"{name}: population {len(pop)} != engine cohort_size {expected}"
        )

        cohorts[name] = {
            "n": int(len(pop)),
            "lvl": group["cohort_level"].iloc[0],
            "labelled": int(len(group)),
            "refDim": ref_dim,
            "sector": ref_sector,
            "band": str(group["size_band"].iloc[0]),
            "med": r(pop["raised_365"].median()),
            "p25": r(pop["raised_365"].quantile(0.25)),
            "p75": r(pop["raised_365"].quantile(0.75)),
            "p90": r(pop["raised_365"].quantile(0.90)),
            "mg": r(pop["avg_gift"].median(), 2),
            "mr": r(pop["recurring_donors"].median(), 1),
            "mc": r(pop["channel_breadth"].median(), 1),
            "mk": r(pop["active_campaigns"].median(), 1),
            "ml": r(pop["gifts_lifetime"].median()),
            "exc": int(pop["is_exceptional"].sum()),
            "st": {k: int(v) for k, v in pop["status"].value_counts().items()},
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

        # Verdict drivers: which component metrics the account is furthest behind
        # on. Computed here so the copy the UI renders picks the same drivers the
        # CLI does; the sentence templates themselves are mirrored in JS.
        drivers = [
            [dr["metric"], round(dr["percentile"], 1), dr["value_text"],
             dr["median_text"]]
            for dr in ce.gap_drivers(row)
        ]

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
                "cr": r(row.get("cohort_ratio"), 3),
                "x": int(row.get("is_exceptional", 0)),
                "gap": r(row["gap_to_cohort_median"]),
                "m": metrics,
                "r": recs,
                "dv": drivers,
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
        # Shipped so the UI never hardcodes its own copy of the band list. An
        # earlier version did, and silently dropped four of eight bands from the
        # filter when the bands were resplit.
        "sizeBands": list(ce.SIZE_BAND_LABELS),
        "driverLabels": {k: v[0] for k, v in ce.DRIVER_PHRASING.items()},
        "leverUnits": {
            spec["label"]: spec.get("unit", "count") for spec in ce.LEVERS.values()
        },
        "maxStepPctl": ce.MAX_LEVER_STEP_PCTL,
        "minAdoption": ce.MINIMAL_ADOPTION_RATIO,
        "exceptionalMultiple": ce.EXCEPTIONAL_MULTIPLE,
        "cvMultiplier": r(ce.validate_model(model_df)["cv_mae_as_multiplier"], 2),
    }

    with open(args.out, "w") as fh:
        json.dump(payload, fh, separators=(",", ":"), default=str)

    owners = {a["o"] for a in accounts}
    with_recs = sum(1 for a in accounts if a["r"])
    exceptional = sum(1 for a in accounts if a["x"])
    print(f"exceptional (>={ce.EXCEPTIONAL_MULTIPLE:g}x cohort median): {exceptional}")
    backed = [c for c in cohorts.values() if c["refDim"] == "band"]
    print(f"backed-off cohorts: {len(backed)} "
          f"(labelled {sum(c['labelled'] for c in backed)} accounts, "
          f"scored against populations of {[c['n'] for c in backed]})")
    print(f"accounts:      {len(accounts)}")
    print(f"owners:        {len(owners)}")
    print(f"with lever advice: {with_recs}")
    print(f"cohorts:       {len(cohorts)}")
    print(f"bytes:         {len(json.dumps(payload, separators=(',', ':'), default=str)):,}")


if __name__ == "__main__":
    main()
