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

## Campaign types, not report columns

The seven channel dollar columns are **not** seven parallel channels. `Donation
Page` is where direct-giving traffic lands; `Campaign Studio` is one way to build
such a page. The pair is a destination and a builder for the same campaign type,
and the reporting attributes a dollar to whichever surface it came through.

The columns do **partition** online dollars exactly (verified on 6,418 of 6,759
rows), so there is no double counting — but counting distinct columns overstates
how many genuinely different things an organization runs.

Evidence, and the effect of fixing it:

| | |
|---|---|
| Accounts with both Donation Page and Campaign Studio | 1,892 (60%) |
| Studio share of their direct-giving dollars | 13% median |
| CV R² with 7-channel breadth | 0.7325 |
| CV R² with 3-campaign-type breadth | **0.7365** |
| Both breadths in one model | type **+0.276** (p 3e-26), channel +0.063 (p 0.005) |
| Accounts "broad" on channels but running one campaign type | 60 |

So the rollup improves the fit with a coarser variable, campaign-type breadth
absorbs nearly all of what the channel term was measuring, and the "diversify"
lever now means *run a campaign type you do not run with us* rather than *use a
second page builder*.

`CAMPAIGN_TYPES` holds the mapping:

```python
"Direct giving": ["Donation Page", "Campaign Studio", "Crowdfunding"]
"Peer to peer":  ["Peer to Peer", "RwF"]
"Hosted event":  ["Ticketed", "Registration"]
```

**This mapping is inferred, not documented.** It comes from the column names and
the stated product taxonomy (direct giving, peer-to-peer, hosted event), not from
product documentation. `RwF` sits under peer-to-peer on the assumption that
"Registration with Fundraising" carries a fundraising component, and
`Crowdfunding` under direct giving; those two are the likeliest to be wrong.
A test asserts every column maps exactly once and that type totals reconcile with
channel totals, so a correction is a one-line change that cannot silently drop or
duplicate dollars.

## Scope: what is measured and what is not

The outcome is dollars raised **through this platform**, not the organization's
total fundraising. An organization running only its peer-to-peer with GoFundMe
Pro and its direct giving elsewhere shows a small number here and is *not*
underperforming — most of its programme is invisible. There is no wallet-share
field in the export, so this cannot be corrected, only flagged.

**Measured, not assumed.** Accounts running one campaign type raise 2.414 log
points less in lifetime dollars than accounts running all three. Because
`log(total) = log(types) + log(dollars per type)`, that splits exactly:

| Component | Log points | Share | Reading |
|---|---|---|---|
| Campaign-type count | 1.099 | **46%** | Measurement artifact — fewer types, fewer dollars recorded |
| Dollars per type | 1.315 | **54%** | Genuine — narrow accounts are smaller per type too |

So roughly half the apparent shortfall of a narrow-footprint account is an
artifact. Per-channel like-for-like comparisons within size band corroborate it:
donation pages 0.27–0.53× (p 6.6e-14), peer-to-peer 0.19–0.72× (p 3.9e-06),
ticketed 0.16–1.53× (p 3.1e-10) — but Campaign Studio is **not significant**
(p 0.063) and reverses in three bands. The per-channel component is real but
uneven, so no per-account correction is defensible.

`NARROW_FOOTPRINT_TYPES = 1` and `NARROW_FOOTPRINT_CONCENTRATION = 0.90` flag
**1,149 of 3,161 accounts (36%)**, including **195 of the 484 coachable-gap
accounts (40%, $22.5M of the $60.0M aggregate gap)**. Every narrow-footprint
verdict carries a scope warning ahead of any gap figure, asserted in the tests,
and it appears on the account scorecard, in the talk track and in the client PNG
footer.

Deliberately **not** a model term: adding it would let the regression absorb a
measurement problem as if it were behavioural, and `campaign_type_breadth` is
already a lever — which makes "add a channel" advice for a broad-footprint account and
possibly a request to move an existing programme for a narrow one. Closing this
needs a wallet-share input (self-reported total fundraising, or 990 contributions
revenue), which would let the benchmark run on platform *share* rather than
platform *dollars*.

### Also out of scope

| Not accounted for | Would need |
|---|---|
| Individual campaigns | Per-campaign records |
| Momentum (week-over-week vs cohort) | A weekly time series |
| Donation growth/decay curves | A weekly time series |
| Marketing spend, staff quality, donor demographics | Fields absent from the export |
| Offline and cheque giving | The channel columns are online only |
| Cause and effect | A holdout experiment on one lever |
| Change over time | A second snapshot |

## Stage 5 — Lever model

```
log(raised_365) ~ levers + org scale + cohort fixed effects
```

Cohort fixed effects absorb everything constant within a peer group, so lever
coefficients describe variation *within* a peer set. Standard errors are HC3-robust
(Breusch–Pagan p ≈ 1e-50 — fundraising residuals fan out with scale).

**Cross-validated R² is 0.733** (in-sample 0.744), with cross-validated MAE of
0.65 log points — about ×1.9 per organization.

### Getting from 0.645 to 0.733

The first version reached CV R² 0.645. Most of the gap was one missing idea:
what the organization raised in *prior years*.

| Specification | CV R² |
|---|---|
| Levers + org scale only | 0.645 |
| + prior-period annual run rate | 0.712 |
| + contract tenure | 0.730 |
| + channel concentration, donor base | **0.733** (shipped) |
| Gradient boosting, same features | 0.786 (ceiling) |

The prior-period figure is legitimate rather than leakage, and that had to be
verified first: `raised_lifetime` fully contains `raised_365` — the inequality
holds on 100% of eligible rows with zero violations — so the difference is
genuinely the years *before* the outcome window. Spread over contract tenure it
becomes a historical annual run rate, the strongest single predictor available.

**A first attempt overfitted in a way cross-validation did not catch.** Including
prior dollars, the run rate *and* tenure together posted CV R² 0.742 — but
run rate ≈ prior ÷ tenure, so the three are near-linearly dependent. VIFs reached
**728** and the coefficients (−1.08, +1.52, +5.00) were large values cancelling
out. Predictions survive that; interpretation and stability do not. The shipped
model keeps run rate and tenure but not prior dollars, and holds the run rate at
its established-account mean where there is no history so the new-account
indicator is not encoding the same fact twice. Same fit, **max VIF 4.1**.

`EXCLUDED_PREDICTORS` records what stays out and why: lifetime totals (contain
the outcome), MRR and committed GDV (priced off expected fundraising, so
circular, and worth only +0.010), and trailing-year campaign count (overlaps the
active-campaigns lever and degraded its identification for no gain).

**The honest cost: every lever shrank.** Average gift +0.64 → +0.43, recurring
donors +0.47 → +0.34, active campaigns **+0.26 → +0.06**. Nothing about
fundraising changed — the earlier coefficients were absorbing "this organization
was already a big fundraiser" and crediting it to the levers. Controlling for
history strips that out, so recommendations are smaller and better identified.
Campaign cadence in particular was largely proxying for scale and should now be
read as a weak lever.

Lever × history interactions reach CV 0.764 but double the fold-to-fold variance
and entangle main effects with their interactions — recorded as available
headroom, not shipped. Beyond the 0.79 boosting ceiling sits irreducible noise: a
viral campaign or disaster response is not predictable from firmographics, which
is why 0.9 is not a realistic target on this data.

| Lever | Effect | p |
|---|---|---|
| Average gift size | +1% → **+0.43%** raised | 5e-39 |
| Recurring donors | +1% → **+0.34%** raised | 1e-78 |
| Active campaigns | +1% → **+0.06%** raised | 5e-3 |
| CRM integrated | **×1.32** raised | 1e-15 |
| Channels in use | **×1.19** per channel | 6e-21 |

All VIFs below 4.1, so no term is a proxy for another.

Organization headcount is retained as a control but is **not significant**
(p = 0.10) — consistent with the exploratory finding that staff size barely
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

**Individual predictions are still wide.** 5-fold CV R² is 0.733 against an
in-sample 0.744, so the model generalizes — but cross-validated MAE is 0.65 log
points, a median error of about **×1.9** on any single organization's predicted
annual raised. Improved from ×2.2, still not small. Use lever *rankings*; do not quote the dollar figures as forecasts.
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

## Stage 7 — Seller verdict

`seller_verdict()` produces a copy-ready talk track per account, and
`render_verdict()` prints it. `run_analysis.py --account "<name>"` emits it for
one organization.

Four cases, because the same percentile means different things at different
points of the range and reading the wrong one to a customer is worse than saying
nothing:

| Case | Trigger | What it says |
|---|---|---|
| `optimization` | bottom quartile, above the adoption floor | Peer group, percentile, dollar gap, the component metrics driving it, ranked lever actions |
| `activation` | below 10% of cohort median | Adoption gap, not a performance gap. Onboarding steps, no lever advice |
| `exceptional` | ≥5× cohort median | Peer benchmarks no longer describe it. Study it as a playbook; protect the renewal |
| `on_track` | 25th–75th percentile | Inside the normal range; nothing to raise. Two optional upsides |

Every verdict ends with the uncertainty caveat (±1.9× per organization,
associations not causation) so the ordering gets used and the dollar figures do
not get quoted as targets.

The wording lives here rather than in the report so the CLI and the page cannot
drift into telling a customer two different stories. The report mirrors these
templates in JavaScript for rendering — the non-trivial parts (which gap drivers
get named, the ranked actions) are computed in Python and shipped in the
payload, so only sentence assembly is duplicated. **Edit one side, edit the
other.** The test suite renders a verdict for all 3,161 accounts and asserts the
copy is clean: correct ordinals (an earlier version printed "23th"), no leaked
cohort label (`sector` must come from the account, not from the
"All sectors | <band>" cohort name), no driver named that is actually a strength,
and no modelled lever effects at either tail.

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

Selecting an account also lists **the other organizations in its cohort** —
the actual reference population, resolved the same way the engine resolves it
(the sector × size cell where viable, otherwise the whole size band), so the
roster never shows 61 peers for an account ranked against 509. It can be
compared on any of the six metrics, filtered to exceptional performers,
optimization candidates or nearest neighbours, and the selected account is
pinned into view with its rank even when the list is truncated.

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

## Report page

`report/` holds the published UI — four tabs: a plain-language guide, high-level
findings, per-account scorecards with a client PNG export, and a technical
methodology review written for the data team. See `report/README.md`.

```bash
python build_report_data.py <export.csv>                 # aggregate series
python build_lookup.py <export.csv> -o lookup_data.json  # per-account payload
python report/build.py                                   # single self-contained page
```

All three outputs are gitignored: two are derived aggregates, and
`lookup_data.json` carries named account-level customer data.

## Files

- `cohort_engine.py` — the library: canonicalize → screen → cohort → benchmark
  → model → recommend. Each stage is independently callable.
- `run_analysis.py` — CLI that runs the pipeline and writes all outputs.
- `build_report_data.py` — emits the aggregate series and methodology tables
  the report page inlines.
- `build_lookup.py` — emits the per-account and per-cohort payload for the
  interactive UI. Cohort stats are derived from each cohort's *reference
  population* (asserted equal to the engine's `cohort_size`), not from the set
  of accounts wearing the cohort label — for a backed-off cohort those differ,
  and reading the label group reported a wrong peer count and cohort median for
  all 216 of them.
- `test_cohort_engine.py` — checks on the invariants that matter.
