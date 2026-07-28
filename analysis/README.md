# Peer Cohort Benchmarking Engine

Scores a nonprofit's fundraising performance against a peer cohort of
comparable organizations, then ranks the operating levers most likely to close
the gap.

The problem: raw fundraising totals are not comparable across organizations. A
children's hospital foundation and an animal rescue are not competing on the
same terms, so "raised $400k last year" means nothing on its own. This engine
builds the reference group, scores each account inside it, and turns the
shortfall into a ranked list of actions.

## Running it

```bash
pip install pandas numpy scipy scikit-learn statsmodels
python run_analysis.py <export.csv> --outdir out
python run_analysis.py <export.csv> --account "Heifer International"
```

Outputs land in `--outdir`:

| File | Contents |
|---|---|
| `eligibility_funnel.csv` | How many accounts each data-quality gate removes |
| `cohorts.csv` | Cohort roster with sizes and match level |
| `benchmarks.csv` | Per-account percentiles, status, diagnosis, cohort medians |
| `lever_effects.csv` | Regression elasticities with confidence intervals |
| `model_validation.json` | In-sample vs cross-validated fit |
| `examples.json` | Worked scorecards with ranked recommendations |
| `summary.json` | Headline counts |

## Stage 1 — Unified definitions

The export carries several fields that mean nearly the same thing and disagree.
Each concept is resolved to exactly one definition.

**Sector.** The shipped `NTEE Category` label is inconsistent: letters R–V read
"Public, Societal Benefit" while W reads "Public **&** Societal Benefit" for the
same rollup. The letter in `NTEE Code` is authoritative (it agrees with the
category letter on 100% of rows), so sector is rebuilt from that letter via the
standard 10 NTEE major groups. NTEE's own `Z – Unknown, Unclassified` is
deliberately not mapped, so it drops out at the eligibility gate rather than
forming a fake peer group.

**Organization size.** Three revenue fields exist. `Annual Revenue` is a CRM
free-text field and is **excluded entirely** — 86 accounts report exactly
$10,000,000, 29 report exactly $1,000,000,000, and 12 report exactly $1. Size
uses IRS-filed figures instead: `IRS Annual Revenue` where positive, falling
back to `990 Value`. Zero is treated as "no usable filing," not as "this
organization has no revenue."

**Time windows.** This mattered more than expected. The seven channel dollar
columns (`Donation Page`, `Crowdfunding`, …) sum to `Txn - Online` to the dollar
on 95% of rows — $11.38B against $11.37B — which makes them **lifetime**
figures. Only `Txn - Last 365` ($2.67B) is a trailing-twelve-month number. So:

- the performance outcome is `raised_365`, trailing 12 months, and nothing else;
- every lifetime quantity is suffixed `_lifetime`;
- `avg_gift` is lifetime dollars ÷ lifetime gift count, treated as a stable
  donor-behaviour trait used to *explain* the annual outcome, never mixed into
  it.

## Stage 2 — Eligibility

Four fields are required, plus two activity floors:

| Gate | Removed | Remaining |
|---|---|---|
| All accounts in export | — | 6,759 |
| Sector resolvable | 1,589 | 5,170 |
| IRS-filed revenue positive | 901 | 4,269 |
| Trailing-365 raised reported | 0 | 4,269 |
| Average gift computable | 794 | 3,475 |
| Raised ≥ $1,000 in trailing year | 231 | 3,244 |
| ≥ 25 lifetime gifts | 83 | **3,161** |

**3,161 accounts (46.8% of the book) are benchmarkable.** The two binding
constraints are missing NTEE codes and missing IRS revenue.

The required set is kept deliberately short. `Paid Fundraising Staff` and
`# Individual Donors` are survey-style fields present on only 29% and 36% of
rows; requiring them would have cut the population to a few hundred. They are
carried as optional enrichment instead of hard gates. The funnel is a
first-class output so the cost of the completeness rule stays visible rather
than silently shrinking the population.

## Stage 3 — Cohort assignment

Cohort = **sector × size band**, with size bands cut on order-of-magnitude
boundaries because fundraising capacity scales multiplicatively:
under $100k, $100k–$250k, $250k–$1M, $1M–$5M, $5M–$25M, $25M–$100M,
$100M–$1B, over $1B.

**The top and bottom bands were originally open-ended, and that was a defect.**
"Over $25M" ran from $25M to $8.1B — a 322× span against 4–5× for each middle
band — so NewYork-Presbyterian at $6.71B of revenue was grouped with $26M
foundations, 33× smaller than its cohort's median peer. Residual size barely
distorted the *ranking* (revenue correlates with annual raised at only +0.10
inside that band, the weakest of any band), but it badly inflated
`cohort_ratio`: NewYork-Presbyterian measured 23.3× its "cohort median" against
6.2× its true size peers, which also drove a false reading of how exceptional it
was. Splitting both ends holds every band to ≤1.8 dex (mean 0.83, down from
1.34) and costs about 5 points of sector matching — worth paying, given size
explains 16.7% of the variance in annual raised and cause area 0.8%.
`MAX_BAND_SPAN_DEX` and a test now guard against an open-ended band returning.

A cell needs 30 accounts to be usable — in a cohort of four, one outlier moves
everyone. Thin cells back off to a size-band cohort.

**Cohort identity and cohort reference population are separate ideas here, on
purpose.** When 16 religious organizations in the $5M–$25M band fall below the
minimum, they are scored against *all 805 accounts in that band*, not against
the handful of other thin-cell accounts. Collapsing the two would have labelled
them "All sectors" while quietly comparing them only to each other — the first
version of this code did exactly that, and stranded 63 accounts as
unbenchmarkable.

Result: **38 cohorts**, 2,773 accounts matched on sector × size, 388 on size
only, none unbenchmarkable.

## Stage 4 — Benchmarking

Each account is percentile-ranked against its reference population on the
outcome and five component metrics. Because the cohort is already matched on
size, a raw percentile on `raised_365` *is* the size-adjusted comparison — no
ratio-to-revenue metric, which explodes for platform-native organizations.

Status from the outcome percentile: `<25` Underperforming, `25–75` On track,
`≥75` Overperforming.

### The activation / optimization split

A raw percentile alone produced bad advice. The largest dollar shortfalls belong
to accounts that have barely onboarded — one $25M+ organization raised $2,090
against a $587k cohort median. That is not a fundraising performance problem and
a donor-upgrade strategy is the wrong response.

So accounts raising **under 10% of their cohort median** are diagnosed
`Minimal platform adoption — activation, not optimization`, and lever advice is
suppressed for them. Of 772 underperformers:

- **484** are genuine optimization opportunities ($60.0M combined gap to median)
- **268** are activation cases needing onboarding, not lever tuning

### Exceptional performers

A separate cut on the same quantity, at the other end: an account raising
**≥ 5× its cohort median** (`EXCEPTIONAL_MULTIPLE`). **374 accounts** qualify.

The threshold is a *multiple*, not a top-percentile cut, and that choice is
load-bearing. A within-cohort percentile cannot rank cohorts against each other
— the top decile of every cohort is exactly 10% of it, however tightly or
loosely bunched it is. The multiple varies genuinely: Health · Over $25M has
26.1% of its accounts above 5× median, while most cohorts sit near 8%. Those
high-dispersion cohorts are where the leaders are worth studying as playbooks.

One consequence worth knowing: exceptional is *almost* but not exactly a subset
of "Overperforming". In a cohort skewed enough that p75/median exceeds 5, an
account at 5× the median still lands below the 75th percentile. Exactly one
cohort here does that (Health · Over $25M, p75/median = 5.50×), so one account
is exceptional-by-multiple and "On track" by percentile. The two measures
answer different questions on purpose, and the test suite asserts high overlap
rather than containment.

## Stage 5 — Lever model

```
log(raised_365) ~ levers + org scale + cohort fixed effects
```

Cohort fixed effects absorb everything constant within a peer group, so lever
coefficients describe variation *within* a peer set. Standard errors are HC3-robust
(Breusch–Pagan p ≈ 1e-50 — fundraising residuals fan out with scale).

Lifetime dollars raised and lifetime gift count are **deliberately excluded** as
predictors. They are near-arithmetic restatements of the outcome and would have
produced a model with a high R² and no advice in it.

| Lever | Effect | p |
|---|---|---|
| Average gift size | +1% → **+0.64%** raised | 5e-103 |
| Recurring donors | +1% → **+0.47%** raised | 9e-267 |
| Active campaigns | +1% → **+0.26%** raised | 1e-27 |
| CRM integrated | **×1.27** raised | 3e-9 |
| Channels in use | **×1.12** per channel | 7e-15 |

All VIFs below 2.0, so the levers are not proxies for each other. Coefficients
stay stable when the strongest lever is dropped (R² 0.658 → 0.588), so no single
lever is carrying the model.

Organization headcount is retained as a control but is **not significant**
(p = 0.46) — consistent with the exploratory finding that staff size barely
predicts fundraising outcomes.

## Stage 6 — Recommendations

For an account, each lever is moved toward its cohort's 75th percentile and the
model converts that into an expected change in annual raised. Levers where the
account already leads are dropped rather than shown as negative advice.

Advice is withheld at **both tails**, for one reason: the fitted elasticities
describe variation among accounts near their cohort, and multiplying them onto a
base far outside that range produces a number with no support behind it.

- **Bottom tail** — activation cases, below 10% of cohort median. Unsuppressed,
  moving a lever from zero to a peer benchmark produced "+2,560% lift" off a
  near-zero denominator.
- **Top tail** — exceptional performers, at or above 5×. The book's largest
  raiser sits 903× its cohort median with a deliberately small $26 average gift
  (a mass-market model); unsuppressed, the engine advised raising that gift for a
  projected **+$413M** — implausible, and advice to abandon exactly what works.
  The model carries cohort fixed effects but no interaction term, so it applies
  one elasticity to a cohort's median member and to an outlier 903× above it
  alike.

Scorecard percentiles still render for both groups: knowing an organization sits
at p6 on average gift is useful, a dollar projection built on it is not. That is
268 + 374 = 642 accounts (20% of eligible) receiving a scorecard but no ranking;
the middle 80% is where recommendations apply.

Two further guards, both added after the first version produced nonsense:

- **Bounded steps.** A move is capped at 25 percentile points from where the
  account already sits. Advice to go from the 5th to the 75th percentile in one
  step is not actionable and sits outside the range of comparable peers; the
  unbounded version generated a "+2,560% lift" from a near-zero denominator.
- **No advice for activation cases**, per Stage 4.

## Honest limits

**This export is organization-level, not campaign-level.** There are no
per-campaign rows — only campaign counts and per-channel dollar rollups. The
engine therefore benchmarks an organization's fundraising performance and
channel mix. It cannot say "campaign X outperformed campaign Y." Campaign-level
data would slot into the same cohort structure without redesign.

**Cause area barely matters.** Cohort membership explains only **18.1%** of the
variance in log annual raised — and size band alone accounts for 16.2% of that,
while sector alone accounts for **0.8%**. Cohorting narrows the comparison
spread by about 15% (IQR of log raised, 2.23 → 1.89). Sector is worth keeping
because it makes the comparison *credible* to an organization, but the
statistical work is done almost entirely by scale. If tighter cohorts are the
goal, the next dimension to add is operating profile (channel mix, donor-base
scale), not a finer cause taxonomy.

**Roughly 80% of the variance is still within cohort.** Even well-matched peers
differ enormously, which is the honest version of the original problem
statement. Percentile bands are a fair reading of the data; a claim that an
organization "should" be at its cohort median is not.

**Individual predictions are wide.** 5-fold CV R² is 0.645 against an in-sample
0.656, so the model generalizes — but cross-validated MAE is 0.78 log points,
a median error of about **×2.2** on any single organization's predicted annual
raised. Use lever *rankings*; do not quote the dollar figures as forecasts.
`recommend()` returns `lift_low`/`lift_high` from the coefficient confidence
interval, which bounds the estimated average effect and is narrower than the
per-organization spread.

**These are associations, not causal effects.** Nothing here is a randomized
intervention. Organizations that already fundraise well are likelier to have
adopted a CRM in the first place, so each coefficient blends "doing this helps"
with "the kind of organization that does this was already ahead." The CRM
coefficient (×1.28) is the one to treat most cautiously: it is a capability
marker as much as a cause. Validating any of these properly means a holdout
test — move the lever for a random subset and measure what happens.

## Account lookup UI

`build_lookup.py` precomputes a scorecard and ranked recommendations for every
eligible account and emits a single JSON payload for embedding in a
self-contained page:

```bash
python build_lookup.py <export.csv> -o lookup_data.json
```

The published report consumes that payload in two places.

**Account lookup tab** — search by organization name, filter by account owner
(a seller's book) or by status, sort by gap / raised / percentile / outperformance
multiple, and select an account for the same cohort placement, percentile
scorecard, and ranked lever table shown in the worked examples.

**Cohort explorer (section 4)** — filter cohorts by sector and size band, switch
the displayed metric across all six benchmark measures, and sort by size,
median, exceptional-performer count or share, or spread (p75 ÷ median).
Selecting a cohort opens its decile distribution, per-metric peer benchmarks,
status mix, and two complementary rosters: leaders (playbook candidates) and
optimization candidates ranked by gap. Any account in either roster links
through to its full scorecard.

Cohort distributions and quantiles for the non-default metrics are computed in
the browser rather than shipped per cohort per metric, which would have
multiplied the payload. The JS quantile routine reproduces numpy's default
linear interpolation, and a `__verifyQuantiles()` self-check compares its output
against the Python-computed quartiles for annual raised (worst relative
disagreement: 2e-5, which is the transport rounding).

Recommendations are computed in Python by the engine, not recomputed in the
browser — the page only renders. That is deliberate: a JavaScript
reimplementation of the quantile and elasticity logic would be free to drift
from the model that was actually validated. The payload is ~1.25 MB for 3,161
accounts, encoded positionally with lever names as indices into a shared table.

`lookup_data.json` is gitignored along with the other outputs — it contains
named account-level customer data.

## Files

- `cohort_engine.py` — the library: canonicalize → screen → cohort → benchmark
  → model → recommend. Each stage is independently callable.
- `run_analysis.py` — CLI that runs the pipeline and writes all outputs.
- `build_lookup.py` — emits the per-account and per-cohort payload for the
  interactive UI. Cohort stats are derived from each cohort's *reference
  population* (asserted equal to the engine's `cohort_size`), not from the set
  of accounts wearing the cohort label — for a backed-off cohort those differ,
  and reading the label group reported a wrong peer count and cohort median for
  all 216 of them.
- `test_cohort_engine.py` — checks on the invariants that matter.
