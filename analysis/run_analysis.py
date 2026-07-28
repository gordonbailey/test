#!/usr/bin/env python3
"""Run the peer cohort analysis end to end and write outputs.

Usage:
    python run_analysis.py <export.csv> [--outdir out] [--account "Name"]

Writes:
    eligibility_funnel.csv   how many accounts each data-quality gate removes
    cohorts.csv              cohort roster with sizes and match level
    benchmarks.csv           per-account percentiles, status, and cohort medians
    lever_effects.csv        regression elasticities with confidence intervals
    model_validation.json    in-sample vs cross-validated fit
    summary.json             headline counts for the report layer
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

import cohort_engine as ce


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", help="Path to the book-of-business export")
    parser.add_argument("--outdir", default="out", help="Directory for outputs")
    parser.add_argument(
        "--account",
        action="append",
        default=[],
        help="Account name to print a scorecard for (repeatable)",
    )
    args = parser.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    print("Loading and canonicalizing...")
    raw = ce.load_raw(args.csv)
    df = ce.canonicalize(raw)

    print("Screening eligibility...")
    eligible, funnel = ce.screen_eligibility(df)
    funnel.to_csv(outdir / "eligibility_funnel.csv", index=False)
    print(funnel.to_string(index=False))

    print("\nAssigning cohorts...")
    cohorts = ce.assign_cohorts(eligible)
    roster = (
        cohorts.groupby(["cohort", "cohort_level"])
        .size()
        .reset_index(name="n")
        .sort_values("n", ascending=False)
    )
    roster.to_csv(outdir / "cohorts.csv", index=False)
    print(f"  {cohorts['cohort'].nunique()} cohorts")
    print(cohorts["cohort_level"].value_counts().to_string())

    print("\nBenchmarking...")
    bm = ce.benchmark(cohorts)
    print(bm["status"].value_counts().to_string())
    print("\nDiagnosis split:")
    print(bm["diagnosis"].value_counts().to_string())

    print("\nFitting lever model...")
    model_df = ce.build_model_frame(bm)
    fit = ce.fit_lever_model(model_df)
    effects = ce.lever_elasticities(fit, model_df)
    effects.to_csv(outdir / "lever_effects.csv", index=False)
    print(
        effects[["label", "coefficient", "p_value", "interpretation"]].to_string(
            index=False
        )
    )

    print("\nValidating...")
    validation = ce.validate_model(model_df)
    validation["note"] = (
        "cv_mae_as_multiplier is the median factor by which a single "
        "organization's predicted annual raised may be wrong. Use lever "
        "rankings, not point dollar forecasts."
    )
    (outdir / "model_validation.json").write_text(json.dumps(validation, indent=2))
    for key, value in validation.items():
        print(f"  {key}: {value}")

    # Persist the account-level table, keeping the columns a downstream report
    # or product surface would actually consume.
    keep = [
        "Account Name",
        "Account Owner",
        "sector",
        "size_band",
        "org_revenue",
        "org_revenue_source",
        "cohort",
        "cohort_level",
        "cohort_size",
        "status",
        "diagnosis",
        "adoption_ratio",
        "raised_365",
        "gap_to_cohort_median",
        *[f"pctl_{m}" for m in ce.BENCHMARK_METRICS],
        *[f"cohort_median_{m}" for m in ce.BENCHMARK_METRICS],
        *ce.BENCHMARK_METRICS,
        "has_crm",
        "top_channel_share",
    ]
    keep = [c for c in dict.fromkeys(keep) if c in bm.columns]
    bm[keep].to_csv(outdir / "benchmarks.csv", index=False)

    summary = {
        "accounts_in_export": int(len(df)),
        "accounts_eligible": int(len(bm)),
        "eligible_share": float(len(bm) / len(df)),
        "cohorts": int(cohorts["cohort"].nunique()),
        "matched_sector_and_size": int((bm["cohort_level"] == "sector x size").sum()),
        "matched_size_only": int(
            (bm["cohort_level"] == "size only (sector cell too thin)").sum()
        ),
        "status_counts": bm["status"].value_counts().to_dict(),
        "diagnosis_counts": bm["diagnosis"].value_counts().to_dict(),
        "underperforming_gap_total": float(
            bm.loc[bm["status"] == "Underperforming", "gap_to_cohort_median"].sum()
        ),
        "optimization_gap_total": float(
            bm.loc[
                bm["diagnosis"].str.startswith("Underperforming at scale"),
                "gap_to_cohort_median",
            ].sum()
        ),
        "model": validation,
    }
    (outdir / "summary.json").write_text(json.dumps(summary, indent=2, default=str))

    # Worked examples drawn from the genuine optimization group -- the accounts
    # actually using the platform and trailing their peers. Ranking on raw gap
    # instead would surface barely-onboarded accounts, whose shortfall is real
    # but is an activation problem the lever model is not built to answer.
    optimization = bm[bm["diagnosis"].str.startswith("Underperforming at scale")]
    targets = args.account or (
        optimization.nlargest(3, "gap_to_cohort_median")["Account Name"].tolist()
    )

    examples = []
    for name in targets:
        match = bm[bm["Account Name"] == name]
        if match.empty:
            print(f"\n[skip] no eligible account named {name!r}")
            continue
        row = match.iloc[0]
        model_row = model_df[model_df["Account Name"] == name]
        if model_row.empty:
            continue

        card = ce.scorecard(row)
        recs = ce.recommend(model_row.iloc[0], fit, model_df)
        card["recommendations"] = recs.to_dict("records") if not recs.empty else []
        examples.append(card)

        print(f"\n=== {name} ===")
        print(
            f"  {card['sector']} | {card['size_band']} | cohort n={card['cohort_size']}"
            f" | {card['diagnosis']}"
        )
        print(
            f"  raised ${card['raised_365']:,.0f} vs cohort median "
            f"${card['cohort_median_raised']:,.0f} "
            f"(gap ${card['gap_to_median']:,.0f}, "
            f"p{card['metrics']['raised_365']['percentile']:.0f} of cohort)"
        )
        if recs.empty:
            print("    no lever advice (activation case or already leads cohort)")
        for _, r in recs.iterrows():
            print(
                f"    {r['lever']:20s} {r['current_value']:>10,.1f} -> "
                f"{r['cohort_target_value']:>10,.1f} "
                f"(p{r['current_pctl']:.0f}->p{r['target_pctl']:.0f})  "
                f"lift ${r['projected_lift']:>10,.0f} "
                f"({r['projected_lift_pct']:+.0f}%)"
            )

    (outdir / "examples.json").write_text(json.dumps(examples, indent=2, default=str))
    print(f"\nWrote outputs to {outdir.resolve()}")


if __name__ == "__main__":
    main()
