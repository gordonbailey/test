/* Corporate strategy deck — consulting format.
 *
 * Conventions borrowed from the firms: action titles that state the finding
 * rather than the topic, the answer up front, one message per slide, every
 * exhibit sourced, and a limits slide so the argument is not oversold.
 *
 * Every figure traces to an Amplitude query against GFM v2 Prod (project
 * 530253) over a trailing 12-month window, or to the 6-month funnel where
 * marked. Numbers match the portfolio site exactly.
 */
const pptx = require('pptxgenjs');
const p = new pptx();

p.layout = 'LAYOUT_WIDE';           // 13.3 x 7.5 — set BEFORE any slide
p.author = 'Gordon Bailey';
p.company = 'GoFundMe';
p.title = 'Growing GDV Through Repeat Generosity';

/* ---- palette: GoFundMe green, one dominant dark, one warm accent ---- */
const DARK = '0B2E1F';   // deep forest — title/section/close slides
const DARK2 = '123F2C';  // card on dark
const GRN = '02A95C';    // vivid green — accent on dark
const GRN_D = '028046';  // deep green — marks on light
const WARM = 'C4531F';   // warm accent, tension/limits only
const INK = '111110';
const INK2 = '55524D';
const INK3 = '8A867F';
const TINT = 'E8F5EE';
const LINE = 'E6E2DC';
const W = 'FFFFFF';
const F = 'Arial';

const SRC = 'Source: Amplitude, GFM v2 Prod (530253). Donation events, trailing 12 months unless noted. GDV = sum of donation_amount.';

/* ---- helpers. Fresh option objects every call: pptxgenjs mutates them. ---- */
function titleSlide(s, kicker, title, sub) {
  s.background = { color: DARK };
  s.addText(kicker, { x: 0.7, y: 0.62, w: 11.9, h: 0.3, fontFace: F, fontSize: 12,
    bold: true, color: GRN, charSpacing: 2 });
  s.addText(title, { x: 0.7, y: 1.05, w: 11.0, h: 1.5, fontFace: F, fontSize: 40,
    bold: true, color: W, lineSpacing: 44 });
  if (sub) s.addText(sub, { x: 0.7, y: 2.7, w: 10.4, h: 1.0, fontFace: F, fontSize: 15,
    color: 'C9D8CF', lineSpacing: 22 });
}
/* Action title + optional deck (the one-line "so what"). */
function head(s, kicker, title, deck) {
  s.addText(kicker, { x: 0.6, y: 0.36, w: 11.5, h: 0.26, fontFace: F, fontSize: 10.5,
    bold: true, color: GRN_D, charSpacing: 1.6, margin: 0 });
  s.addText(title, { x: 0.6, y: 0.66, w: 12.1, h: 0.72, fontFace: F, fontSize: 26,
    bold: true, color: INK, margin: 0, lineSpacing: 30 });
  if (deck) s.addText(deck, { x: 0.6, y: 1.42, w: 12.1, h: 0.42, fontFace: F,
    fontSize: 13.5, color: INK2, margin: 0 });
}
function src(s, text) {
  s.addText(text || SRC, { x: 0.6, y: 6.95, w: 12.1, h: 0.3, fontFace: F,
    fontSize: 8.5, color: INK3, margin: 0 });
}
/* Big number + label. The consulting stat callout. */
function stat(s, x, y, w, num, label, col) {
  s.addText(num, { x: x, y: y, w: w, h: 0.78, fontFace: F, fontSize: 40, bold: true,
    color: col || GRN_D, margin: 0 });
  s.addText(label, { x: x, y: y + 0.78, w: w, h: 0.6, fontFace: F, fontSize: 11.5,
    color: INK2, margin: 0, lineSpacing: 15 });
}
function card(s, x, y, w, h, fill) {
  s.addShape(p.ShapeType.roundRect, { x: x, y: y, w: w, h: h, rectRadius: 0.09,
    fill: { color: fill || 'F7F6F3' }, line: { color: LINE, width: 0.75 } });
}
/* Numbered disc — the deck's one repeated motif. */
function disc(s, x, y, n, bg, fg) {
  s.addShape(p.ShapeType.ellipse, { x: x, y: y, w: 0.4, h: 0.4,
    fill: { color: bg || GRN_D } });
  s.addText(String(n), { x: x, y: y, w: 0.4, h: 0.4, fontFace: F, fontSize: 14,
    bold: true, color: fg || W, align: 'center', valign: 'middle', margin: 0 });
}
const CHART_FRAME = () => ({
  chartColors: [GRN_D],
  showLegend: false, showTitle: false,
  catAxisLabelColor: INK2, catAxisLabelFontFace: F, catAxisLabelFontSize: 10.5,
  valAxisLabelColor: INK3, valAxisLabelFontFace: F, valAxisLabelFontSize: 9.5,
  valGridLine: { color: LINE, size: 0.75 },
  catGridLine: { style: 'none' },
  showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: INK,
  dataLabelFontFace: F, dataLabelFontSize: 10.5, dataLabelFontBold: true,
  barGapWidthPct: 55,
});

/* ══════════════════ 1 · TITLE ══════════════════ */
let s = p.addSlide();
titleSlide(s, 'CORPORATE STRATEGY  ·  JULY 2026',
  'Growing GDV through repeat generosity',
  'Super donors produce 39% of GDV from 20% of donors — and receive the same experience as a first-time donor.\nThis deck sizes the opportunity, locates it in the frequency curve, and proposes four programmes.');
s.addText('Gordon Bailey  ·  GoFundMe Pro  ·  Proprietary & confidential',
  { x: 0.7, y: 6.5, w: 11.9, h: 0.3, fontFace: F, fontSize: 11, color: '8FA79A' });
s.addNotes('All figures queried from Amplitude GFM v2 Prod. The argument is deliberately front-loaded: slide 2 carries the whole answer, everything after it is evidence.');

/* ══════════════════ 2 · EXECUTIVE SUMMARY ══════════════════ */
s = p.addSlide();
head(s, 'EXECUTIVE SUMMARY',
  'The opportunity is not the loyal tail — it is the second gift',
  'Five findings, in the order they change the decision.');
const EX = [
  ['Super donors are 20% of donors and 39% of GDV', '$1,775M of $4,536M. A 1.9× over-index. The "40% of GDV" figure needs its denominator to be an argument.'],
  ['Half of that sits in the 2-gift band', '$871M from 4.9M people. The entire 6+ tail is $303M from ~403K — the smallest pot on the chart.'],
  ['The decision to give again is made in 23 days', 'Median time from a gift to the next. Baseline repeat rate 12.3% at 90 days.'],
  ['Interpersonal channels retain 2× better than broadcast', 'Chat and copy-link referrals return at 27–28%. Organic social returns at 10.6% — below platform average.'],
  ['One point of repeat-rate lift is worth ~$36M a year', 'Converting 5% of one-time donors to a second gift is worth ~$123M.'],
];
EX.forEach(([t, d], i) => {
  const y = 2.02 + i * 0.94;
  disc(s, 0.62, y + 0.04, i + 1);
  s.addText(t, { x: 1.2, y: y, w: 11.4, h: 0.34, fontFace: F, fontSize: 15,
    bold: true, color: INK, margin: 0 });
  s.addText(d, { x: 1.2, y: y + 0.34, w: 11.4, h: 0.46, fontFace: F, fontSize: 12,
    color: INK2, margin: 0, lineSpacing: 15 });
});
src(s);
s.addNotes('If the room only reads one slide, this is it. Finding 2 is the one that changes where money goes.');

/* ══════════════════ 3 · SITUATION ══════════════════ */
s = p.addSlide();
head(s, 'SITUATION',
  'Growth is getting narrower, not bigger',
  'The platform is monetising moments of generosity more efficiently. It is not producing more generous people.');
card(s, 0.6, 2.1, 5.85, 2.5);
s.addText('What is going up', { x: 0.95, y: 2.32, w: 5.2, h: 0.3, fontFace: F,
  fontSize: 12, bold: true, color: GRN_D, margin: 0 });
s.addText([
  { text: 'Average donation size, ~28% since 2024', options: { bullet: true, breakLine: true } },
  { text: 'GDV per donor at every frequency band', options: { bullet: true, breakLine: true } },
  { text: 'Revenue per moment of generosity', options: { bullet: true } },
], { x: 0.95, y: 2.7, w: 5.2, h: 1.7, fontFace: F, fontSize: 13, color: INK2,
  paraSpaceAfter: 8 });
card(s, 6.85, 2.1, 5.85, 2.5);
s.addText('What is flat to down', { x: 7.2, y: 2.32, w: 5.2, h: 0.3, fontFace: F,
  fontSize: 12, bold: true, color: WARM, margin: 0 });
s.addText([
  { text: 'Donor counts', options: { bullet: true, breakLine: true } },
  { text: 'Repeat giving as a share of the base', options: { bullet: true, breakLine: true } },
  { text: 'Any measure of giving as a habit', options: { bullet: true } },
], { x: 7.2, y: 2.7, w: 5.2, h: 1.7, fontFace: F, fontSize: 13, color: INK2,
  paraSpaceAfter: 8 });
s.addShape(p.ShapeType.roundRect, { x: 0.6, y: 4.95, w: 12.1, h: 1.35,
  rectRadius: 0.09, fill: { color: DARK } });
s.addText('We monetise moments of generosity. We do not build generous people.',
  { x: 1.0, y: 5.18, w: 11.3, h: 0.4, fontFace: F, fontSize: 17, bold: true, color: W, margin: 0 });
s.addText('Both strategic gaps — "giving isn’t cool" and "we under-invest in super donors" — are versions of this one sentence.',
  { x: 1.0, y: 5.66, w: 11.3, h: 0.4, fontFace: F, fontSize: 12, color: 'C9D8CF', margin: 0 });
src(s, 'Source: Amplitude, GFM v2 Prod. Donation-size trend per Corporate Strategy deck, July 2026.');

/* ══════════════════ 4 · CONCENTRATION ══════════════════ */
s = p.addSlide();
head(s, 'FINDING 1 OF 5',
  'Super donors are 20% of donors and 39% of GDV',
  'A 1.9× over-index on value. This is the fact the strategy rests on — and it only works with both numbers.');
s.addChart(p.ChartType.bar, [
  { name: 'Share of donors', labels: ['Super donors (2+ gifts)', 'One-time donors'], values: [20.2, 79.8] },
  { name: 'Share of GDV', labels: ['Super donors (2+ gifts)', 'One-time donors'], values: [39.1, 60.9] },
], Object.assign(CHART_FRAME(), {
  x: 0.6, y: 2.0, w: 7.5, h: 4.2, barDir: 'col',
  chartColors: [INK3, GRN_D], showLegend: true, legendPos: 'b',
  legendColor: INK2, legendFontFace: F, legendFontSize: 11,
  valAxisMaxVal: 100, dataLabelFormatCode: '0.0"%"',
}));
card(s, 8.4, 2.0, 4.3, 4.2, TINT);
stat(s, 8.8, 2.32, 3.5, '1.9×', 'Super donors over-index on GDV relative to their share of the donor base.');
s.addText('7.1M', { x: 8.8, y: 3.9, w: 3.5, h: 0.5, fontFace: F, fontSize: 24, bold: true, color: INK, margin: 0 });
s.addText('People in the cohort — 2+ gifts in a rolling 365 days.', { x: 8.8, y: 4.42, w: 3.5, h: 0.5, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, lineSpacing: 15 });
s.addText('$1,775M', { x: 8.8, y: 5.06, w: 3.5, h: 0.5, fontFace: F, fontSize: 24, bold: true, color: INK, margin: 0 });
s.addText('Their GDV, trailing 12 months, of $4,536M total.', { x: 8.8, y: 5.58, w: 3.5, h: 0.5, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, lineSpacing: 15 });
src(s, SRC + ' Donor counts derived as gifts ÷ N per band; cross-checked against the cohort at 7.12M (3.7% apart).');
s.addNotes('Watch the denominator. A uniques query returns a monthly average of active donors, on which super donors look like 37% of donors and the concentration argument disappears. The annual basis is the correct one.');

/* ══════════════════ 5 · SHALLOW END ══════════════════ */
s = p.addSlide();
head(s, 'FINDING 2 OF 5',
  'Half of super donor GDV sits in the 2-gift band',
  'The programme mechanics on the table are aimed at the loyal tail. The tail is the smallest pot on the chart.');
s.addChart(p.ChartType.bar, [{
  name: 'GDV ($M)',
  labels: ['1 gift', '2 gifts', '3 gifts', '4 gifts', '5 gifts', '6+ gifts'],
  values: [2760.7, 870.9, 344.1, 166.0, 91.3, 302.6],
}], Object.assign(CHART_FRAME(), {
  x: 0.6, y: 2.0, w: 7.6, h: 4.2, barDir: 'col',
  chartColors: [INK3, GRN_D, GRN_D, GRN_D, GRN_D, GRN_D], varyColors: true,
  dataLabelFormatCode: '#,##0',
}));
card(s, 8.5, 2.0, 4.2, 1.95, TINT);
s.addText('$871M', { x: 8.85, y: 2.22, w: 3.5, h: 0.55, fontFace: F, fontSize: 30, bold: true, color: GRN_D, margin: 0 });
s.addText('The 2-gift band — 49% of all super donor GDV, from 4.9M people.', { x: 8.85, y: 2.85, w: 3.5, h: 0.9, fontFace: F, fontSize: 12, color: INK2, margin: 0, lineSpacing: 16 });
card(s, 8.5, 4.25, 4.2, 1.95);
s.addText('$303M', { x: 8.85, y: 4.47, w: 3.5, h: 0.55, fontFace: F, fontSize: 30, bold: true, color: WARM, margin: 0 });
s.addText('The entire 6+ tail — 17%, from ~403K people. Where awards and tiers point.', { x: 8.85, y: 5.1, w: 3.5, h: 0.9, fontFace: F, fontSize: 12, color: INK2, margin: 0, lineSpacing: 16 });
src(s, SRC);
s.addNotes('Grey is the one-time band, included deliberately: the $2,761M vs $1,775M comparison is the argument. Cutting it off flatters the super donor story.');

/* ══════════════════ 6 · VALUE PER DONOR ══════════════════ */
s = p.addSlide();
head(s, 'FINDING 2 OF 5  ·  SUPPORTING',
  'The first extra gift nearly doubles a donor’s value',
  'Deliberately a second chart, not a second axis: plotted against GDV these bars invert the conclusion.');
s.addChart(p.ChartType.bar, [{
  name: 'Annual GDV per donor ($)',
  labels: ['1 gift', '2 gifts', '3 gifts', '4 gifts', '5 gifts', '6+ gifts'],
  values: [94.63, 179.00, 253.16, 323.70, 386.36, 751.00],
}], Object.assign(CHART_FRAME(), {
  x: 0.6, y: 2.0, w: 7.6, h: 4.2, barDir: 'col',
  chartColors: ['2A78D6'], dataLabelFormatCode: '$#,##0',
}));
card(s, 8.5, 2.0, 4.2, 4.2);
s.addText('The step that matters', { x: 8.85, y: 2.22, w: 3.5, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: GRN_D, margin: 0 });
s.addText('+$84', { x: 8.85, y: 2.58, w: 3.5, h: 0.6, fontFace: F, fontSize: 34, bold: true, color: INK, margin: 0 });
s.addText('Annual GDV added by moving one donor from one gift to two — $94.63 to $179.00.', { x: 8.85, y: 3.2, w: 3.5, h: 0.85, fontFace: F, fontSize: 12, color: INK2, margin: 0, lineSpacing: 16 });
s.addText('29.2M', { x: 8.85, y: 4.2, w: 3.5, h: 0.5, fontFace: F, fontSize: 28, bold: true, color: INK, margin: 0 });
s.addText('One-time donors sitting exactly one gift away from that step.', { x: 8.85, y: 4.78, w: 3.5, h: 0.8, fontFace: F, fontSize: 12, color: INK2, margin: 0, lineSpacing: 16 });
src(s, SRC);

/* ══════════════════ 7 · THE TENSION ══════════════════ */
s = p.addSlide();
head(s, 'FINDING 3 OF 5',
  'Average gift size falls as frequency rises — plan for it',
  'Super donors give more in total and less per gift. A successful frequency programme will make one KPI look worse.');
s.addChart(p.ChartType.bar, [{
  name: 'Average gift ($)',
  labels: ['1 gift', '2 gifts', '3 gifts', '4 gifts', '5 gifts', '6+ gifts'],
  values: [94.63, 89.50, 84.39, 80.92, 77.27, 77.37],
}], Object.assign(CHART_FRAME(), {
  x: 0.6, y: 2.0, w: 7.6, h: 4.2, barDir: 'col',
  chartColors: [WARM], dataLabelFormatCode: '$#,##0.00',
  valAxisMinVal: 60, valAxisMaxVal: 100,
}));
card(s, 8.5, 2.0, 4.2, 4.2, 'FBF3EE');
s.addText('Two consequences', { x: 8.85, y: 2.22, w: 3.5, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: WARM, margin: 0 });
s.addText([
  { text: 'Anyone tracking average donation size will read a successful programme as a regression. Agree this before launch, not after.', options: { bullet: true, breakLine: true } },
  { text: '"Sizes up 28% while counts are flat" may be partly composition — the mix shifting toward one-time donors, who give the largest single gifts.', options: { bullet: true } },
], { x: 8.85, y: 2.66, w: 3.5, h: 3.3, fontFace: F, fontSize: 12, color: INK2,
  paraSpaceAfter: 12, lineSpacing: 16 });
src(s, SRC + ' Y-axis truncated at $60 to show the gradient.');

/* ══════════════════ 8 · THE WINDOW ══════════════════ */
s = p.addSlide();
head(s, 'FINDING 4 OF 5',
  'The decision to give again is made in the first three weeks',
  'Which retires the annual recap as a conversion tool and makes the post-gift moment the primary lever.');
card(s, 0.6, 2.1, 3.85, 2.3, DARK);
s.addText('23', { x: 0.95, y: 2.32, w: 3.2, h: 0.95, fontFace: F, fontSize: 58, bold: true, color: GRN, margin: 0 });
s.addText('Median days from a gift to the next gift. Mean 29 days.', { x: 0.95, y: 3.36, w: 3.2, h: 0.8, fontFace: F, fontSize: 12.5, color: 'C9D8CF', margin: 0, lineSpacing: 16 });
card(s, 4.72, 2.1, 3.85, 2.3);
stat(s, 5.07, 2.36, 3.2, '12.3%', 'Give again within 90 days — 2.49M of 20.2M donors. The baseline to beat.');
card(s, 8.85, 2.1, 3.85, 2.3);
stat(s, 9.2, 2.36, 3.2, '~$36M', 'Annual GDV per one percentage point of repeat-rate lift.', GRN_D);
s.addShape(p.ShapeType.roundRect, { x: 0.6, y: 4.75, w: 12.1, h: 1.55, rectRadius: 0.09,
  fill: { color: 'FBF3EE' }, line: { color: 'EED9CC', width: 0.75 } });
s.addText('Implication: Giving Wrapped is not a conversion lever', { x: 1.0, y: 4.97, w: 11.3, h: 0.34, fontFace: F, fontSize: 15, bold: true, color: WARM, margin: 0 });
s.addText('An annual recap lands in December for a decision made in February. It is a strong identity and retention play for donors who already returned — and it should be funded and measured as one. The conversion lever is a three-week, in-product, lifecycle-messaged window.',
  { x: 1.0, y: 5.36, w: 11.3, h: 0.8, fontFace: F, fontSize: 12.5, color: INK2, margin: 0, lineSpacing: 17 });
src(s, 'Source: Amplitude funnel, eCommerce - Purchase → eCommerce - Purchase, 90-day conversion window, last 6 months. n = 20.2M donors at step 1.');

/* ══════════════════ 9 · INTERPERSONAL VS BROADCAST ══════════════════ */
s = p.addSlide();
head(s, 'FINDING 5 OF 5',
  'Interpersonal channels retain twice as well as broadcast',
  'The split that predicts repeat giving is interpersonal versus broadcast — not social versus non-social.');
s.addChart(p.ChartType.bar, [{
  name: '90-day repeat rate (%)',
  labels: ['chat', 'copy_link_all', 'copy_link', 'email', 'referral', 'social', 'partner', 'customer', '(none)', 'organic_social'],
  values: [28.3, 27.4, 24.1, 20.4, 19.2, 16.9, 14.6, 12.8, 11.5, 10.6],
}], Object.assign(CHART_FRAME(), {
  x: 0.6, y: 1.98, w: 7.9, h: 4.3, barDir: 'bar',
  chartColors: [GRN_D, GRN_D, GRN_D, GRN_D, GRN_D, INK3, INK3, INK3, INK3, WARM],
  varyColors: true, dataLabelFormatCode: '0.0"%"',
}));
card(s, 8.8, 1.98, 3.9, 2.05, TINT);
s.addText('2.2×', { x: 9.15, y: 2.2, w: 3.2, h: 0.6, fontFace: F, fontSize: 32, bold: true, color: GRN_D, margin: 0 });
s.addText('Copy-link referrals versus the 12.3% platform baseline. A person handed you the link.', { x: 9.15, y: 2.85, w: 3.2, h: 1.0, fontFace: F, fontSize: 12, color: INK2, margin: 0, lineSpacing: 16 });
card(s, 8.8, 4.24, 3.9, 2.05, 'FBF3EE');
s.addText('10.6%', { x: 9.15, y: 4.46, w: 3.2, h: 0.6, fontFace: F, fontSize: 32, bold: true, color: WARM, margin: 0 });
s.addText('Organic social — below the platform average. The channel a celebrity strategy buys.', { x: 9.15, y: 5.11, w: 3.2, h: 1.0, fontFace: F, fontSize: 12, color: INK2, margin: 0, lineSpacing: 16 });
src(s, 'Source: Amplitude funnel by campaign_medium on the first gift, 90-day window, last 6 months. Green = interpersonal, grey = broadcast, orange = below baseline. Smallest cells: chat n=699, organic_social n=1,053.');
s.addNotes('Selection, not causation — someone who receives a link from a friend is already closer to the cause. The correlation is strong; the causal arrow needs an experiment. Say this in the room.');

/* ══════════════════ 10 · THE MISALIGNMENT ══════════════════ */
s = p.addSlide();
head(s, 'SYNTHESIS',
  'Every proposed mechanic points at the smallest pot',
  'The gap is not that we under-invest in valuable donors. It is that we under-invest in the moment a donor becomes valuable.');
const MIS = [
  ['Give it an owner', 'Whole cohort', 'Keep as-is', GRN_D, 'Cheapest item on the list and independent of where GDV sits.'],
  ['Lifecycle nudges', 'Mixed', 'Split it', GRN_D, 'Move the nudges into the 23-day window. That is where the decision happens.'],
  ['Giving Awards', 'The 6+ tail', 'Re-scope', WARM, '~403K people, $303M. Fund it as brand and research, not as a GDV lever.'],
  ['Tiers & status', 'The 6+ tail', 'Invert', WARM, 'Build the FIRST tier — the threshold 4.9M people cross at gift two.'],
];
s.addText('Mechanic', { x: 0.7, y: 2.0, w: 2.3, h: 0.26, fontFace: F, fontSize: 10, bold: true, color: INK3, margin: 0 });
s.addText('Aimed at', { x: 3.1, y: 2.0, w: 1.7, h: 0.26, fontFace: F, fontSize: 10, bold: true, color: INK3, margin: 0 });
s.addText('Verdict', { x: 4.9, y: 2.0, w: 1.4, h: 0.26, fontFace: F, fontSize: 10, bold: true, color: INK3, margin: 0 });
s.addText('Why', { x: 6.4, y: 2.0, w: 6.2, h: 0.26, fontFace: F, fontSize: 10, bold: true, color: INK3, margin: 0 });
MIS.forEach(([m, a, v, c, why], i) => {
  const y = 2.36 + i * 1.06;
  card(s, 0.6, y, 12.1, 0.92, i % 2 ? 'FAF9F7' : W);
  s.addText(m, { x: 0.8, y: y + 0.17, w: 2.2, h: 0.3, fontFace: F, fontSize: 13.5, bold: true, color: INK, margin: 0 });
  s.addText(a, { x: 3.1, y: y + 0.19, w: 1.7, h: 0.3, fontFace: F, fontSize: 11.5, color: INK2, margin: 0 });
  s.addShape(p.ShapeType.roundRect, { x: 4.9, y: y + 0.16, w: 1.32, h: 0.34, rectRadius: 0.16, fill: { color: c } });
  s.addText(v, { x: 4.9, y: y + 0.16, w: 1.32, h: 0.34, fontFace: F, fontSize: 10.5, bold: true, color: W, align: 'center', valign: 'middle', margin: 0 });
  s.addText(why, { x: 6.4, y: y + 0.14, w: 6.15, h: 0.65, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, lineSpacing: 15 });
});
src(s, 'Source: proposed mechanics per Corporate Strategy deck, July 2026, assessed against the GDV distribution above.');

/* ══════════════════ 11 · RECOMMENDATION 1 — OWNER + BRAZE ══════════════════ */
s = p.addSlide();
head(s, 'RECOMMENDATION 1 OF 4',
  'Give the cohort an owner, then nudge it in Braze',
  'The cohort already exists in Amplitude. Nothing blocks a lifecycle campaign starting this quarter.');
card(s, 0.6, 2.0, 6.0, 4.3);
s.addText('Own it', { x: 0.95, y: 2.22, w: 5.3, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: GRN_D, margin: 0 });
s.addText([
  { text: 'A named lead with a P&L-style mandate: super donor GDV share, retention, and frequency.', options: { bullet: true, breakLine: true } },
  { text: 'Today nobody is accountable for a cohort worth $1.78B — which is why share drift goes unnoticed.', options: { bullet: true, breakLine: true } },
  { text: 'First job: instrument super donor GDV share monthly, so drift is caught in weeks rather than quarters.', options: { bullet: true } },
], { x: 0.95, y: 2.62, w: 5.3, h: 3.4, fontFace: F, fontSize: 12.5, color: INK2, paraSpaceAfter: 11, lineSpacing: 17 });
card(s, 6.85, 2.0, 5.85, 4.3, TINT);
s.addText('Activate it in Braze', { x: 7.2, y: 2.22, w: 5.15, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: GRN_D, margin: 0 });
s.addText([
  { text: 'Target the existing Amplitude cohort — 2+ donations in 365 days, 7.1M people, already computed.', options: { bullet: true, breakLine: true } },
  { text: 'Sequence inside the 23-day window: a thank-you that lands the identity, a second-cause suggestion matched to giving history, a milestone moment.', options: { bullet: true, breakLine: true } },
  { text: 'Hold out a control from day one. It is the only way the $36M-per-point figure becomes defensible.', options: { bullet: true } },
], { x: 7.2, y: 2.62, w: 5.15, h: 3.0, fontFace: F, fontSize: 12.5, color: INK2, paraSpaceAfter: 11, lineSpacing: 17 });
s.addText([
  { text: 'Cohort: ', options: { bold: true, color: INK } },
  { text: 'Super Donors — 2+ Donations in Past 365 Days', options: { color: GRN_D, underline: true, hyperlink: { url: 'https://app.amplitude.com/analytics/gfm/cohort/1godrkur/details' } } },
], { x: 7.2, y: 5.72, w: 5.15, h: 0.4, fontFace: F, fontSize: 11.5, margin: 0 });
src(s, 'Cohort last computed 7,116,695 users. Amplitude → Braze cohort sync is an existing integration pattern; confirm destination availability with the data team.');

/* ══════════════════ 12 · RECOMMENDATION 2 — EVENTS ══════════════════ */
s = p.addSlide();
head(s, 'RECOMMENDATION 2 OF 4',
  'Build community events — and take donations in the room',
  'The highest-retaining channels are all interpersonal. An event is the most interpersonal channel there is.');
s.addText('Three universal truths', { x: 0.6, y: 1.92, w: 12.1, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: GRN_D, margin: 0 });
const TRUTHS = [
  ['People want to spend time together, in person', 'Not on a feed. Giving is currently a solitary act performed on a phone — the least social version of a fundamentally social impulse.'],
  ['People want to have fun', 'A run, a dinner, a show, a match. The event carries the enjoyment; the giving rides along with it rather than being the ask.'],
  ['People want meaning and purpose', 'This is the one GoFundMe already owns. No other events business starts with it — which is the unfair advantage.'],
];
TRUTHS.forEach(([t, d], i) => {
  const x = 0.6 + i * 4.07;
  card(s, x, 2.3, 3.87, 2.35);
  disc(s, x + 0.32, 2.55, i + 1);
  s.addText(t, { x: x + 0.32, y: 3.05, w: 3.25, h: 0.62, fontFace: F, fontSize: 13.5, bold: true, color: INK, margin: 0, lineSpacing: 17 });
  s.addText(d, { x: x + 0.32, y: 3.72, w: 3.25, h: 0.85, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, lineSpacing: 15 });
});
s.addShape(p.ShapeType.roundRect, { x: 0.6, y: 4.85, w: 12.1, h: 1.45, rectRadius: 0.09, fill: { color: DARK } });
s.addText('Frame them as community events, not fundraisers — and capture the donation in person', { x: 1.0, y: 5.05, w: 11.3, h: 0.34, fontFace: F, fontSize: 15, bold: true, color: W, margin: 0 });
s.addText('Tap to Donate is the enabling capability and it is already built: the most-requested feature in the book (204+ customers), two sprints from shipping, no hardware needed. The Salvation Army’s ~$100M offline year-end campaign is the named wedge. Events give the capability a reason to exist; the capability makes the events measurable.',
  { x: 1.0, y: 5.44, w: 11.3, h: 0.75, fontFace: F, fontSize: 12, color: 'C9D8CF', margin: 0, lineSpacing: 16 });
src(s, 'Source: channel retention per Amplitude funnel; Tap to Donate scope and estimate per GoFundMe Pro Hackathon Roadmap Recommendations 2026 (v2).');
s.addNotes('This is the slide where two projects meet: the strategy work says interpersonal wins, and the hackathon work already built the in-person payment rail. Nobody had connected them.');

/* ══════════════════ 13 · RECOMMENDATION 3 — CONFERENCE ══════════════════ */
s = p.addSlide();
head(s, 'RECOMMENDATION 3 OF 4',
  'Run a Giving Conference — as research, not recognition',
  'Bring super donors together and ask why they give. That answer is the input every other programme is missing.');
card(s, 0.6, 2.0, 6.0, 2.05, TINT);
s.addText('The feedback loop', { x: 0.95, y: 2.2, w: 5.3, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: GRN_D, margin: 0 });
s.addText('Invite the people who already give repeatedly. Ask why. Feed what they say into product, lifecycle messaging and acquisition creative — then measure whether the next cohort behaves differently.',
  { x: 0.95, y: 2.58, w: 5.3, h: 1.3, fontFace: F, fontSize: 12.5, color: INK2, margin: 0, lineSpacing: 17 });
card(s, 6.85, 2.0, 5.85, 2.05);
s.addText('Why this survives the distribution critique', { x: 7.2, y: 2.2, w: 5.15, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
s.addText('As a GDV lever a conference reaches the smallest pot. As a research instrument it is the cheapest way to learn why 7.1M people came back — and there is currently no qualitative evidence on that at all.',
  { x: 7.2, y: 2.58, w: 5.15, h: 1.3, fontFace: F, fontSize: 12.5, color: INK2, margin: 0, lineSpacing: 17 });
const LOOP = [
  ['Convene', 'Super donors, in person, at modest scale.'],
  ['Listen', 'Structured interviews, not a stage show. Why they give, what would make them give again.'],
  ['Feed it in', 'Into lifecycle copy, cause matching, and the acquisition channels that already retain.'],
  ['Measure', 'Whether the cohort informed by it converts better than the holdout.'],
];
LOOP.forEach(([t, d], i) => {
  const x = 0.6 + i * 3.07;
  card(s, x, 4.3, 2.87, 2.0, i === 3 ? TINT : W);
  disc(s, x + 0.26, 4.53, i + 1);
  s.addText(t, { x: x + 0.26, y: 5.02, w: 2.35, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: INK, margin: 0 });
  s.addText(d, { x: x + 0.26, y: 5.36, w: 2.35, h: 0.85, fontFace: F, fontSize: 11, color: INK2, margin: 0, lineSpacing: 14 });
  if (i < 3) s.addText('→', { x: x + 2.83, y: 5.05, w: 0.3, h: 0.3, fontFace: F, fontSize: 16, bold: true, color: GRN_D, align: 'center', margin: 0 });
});
src(s, 'Source: no existing qualitative research on consumer donor motivation was found in the customer intelligence corpus — the 39-interview study covers nonprofit admins, not donors.');

/* ══════════════════ 14 · RECOMMENDATION 4 — GIVING WRAPPED ══════════════════ */
s = p.addSlide();
head(s, 'RECOMMENDATION 4 OF 4',
  'Ship Giving Wrapped — identity and sharing, not conversion',
  'Spotify Wrapped works because it is a status object people want to post. Apply the same mechanic to generosity.');
card(s, 0.6, 2.0, 5.5, 4.3, DARK);
s.addText('What the donor sees', { x: 0.95, y: 2.2, w: 4.8, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: GRN, margin: 0 });
s.addText([
  { text: '"You gave to 5 causes this year."', options: { breakLine: true } },
  { text: '"You were in the top 3% of donors to animal welfare."', options: { breakLine: true } },
  { text: '"You showed up for 4 emergencies within 48 hours."', options: { breakLine: true } },
  { text: '"You and 812 others funded Maria’s surgery."', options: {} },
], { x: 0.95, y: 2.66, w: 4.8, h: 2.6, fontFace: F, fontSize: 15, color: W, italic: true, paraSpaceAfter: 14, lineSpacing: 21 });
s.addText('Status is the cheapest durable reward available, and a shareable card is an interpersonal channel by construction — the category that already retains 2× baseline.',
  { x: 0.95, y: 5.42, w: 4.8, h: 0.75, fontFace: F, fontSize: 11.5, color: 'C9D8CF', margin: 0, lineSpacing: 15 });
card(s, 6.35, 2.0, 6.35, 2.05, TINT);
s.addText('Measure it as identity, not conversion', { x: 6.7, y: 2.2, w: 5.65, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: GRN_D, margin: 0 });
s.addText('The 23-day window means an annual recap cannot be the conversion mechanic. Its KPIs are share rate, opt-in to a visible tier, and next-year retention of the donors who received it — not second gifts in December.',
  { x: 6.7, y: 2.58, w: 5.65, h: 1.35, fontFace: F, fontSize: 12.5, color: INK2, margin: 0, lineSpacing: 17 });
card(s, 6.35, 4.3, 6.35, 2.0);
s.addText('Two design constraints', { x: 6.7, y: 4.5, w: 5.65, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: WARM, margin: 0 });
s.addText([
  { text: 'Opt-out for private givers. Anonymity is a real preference in giving, unlike in music.', options: { bullet: true, breakLine: true } },
  { text: 'Comparative framing needs care — "top 3%" must not read as a leaderboard on someone else’s tragedy.', options: { bullet: true } },
], { x: 6.7, y: 4.88, w: 5.65, h: 1.3, fontFace: F, fontSize: 11.5, color: INK2, paraSpaceAfter: 9, lineSpacing: 15 });
src(s, 'Source: window and channel figures per Amplitude, as above. Wrapped mechanic is an analogy, not a benchmarked comparison.');

/* ══════════════════ 15 · THE PRIZE ══════════════════ */
s = p.addSlide();
head(s, 'THE PRIZE',
  'Converting 5% of one-time donors is worth ~$123M a year',
  'Sensitivity on the one behaviour every recommendation is aimed at: the second gift.');
[['1%', '$24.6M', '291,735 donors'], ['5%', '$123M', '1.46M donors'], ['10%', '$246M', '2.92M donors']].forEach(([pct, val, n], i) => {
  const x = 0.6 + i * 4.07;
  card(s, x, 2.05, 3.87, 2.25, i === 1 ? TINT : W);
  s.addText(pct + ' convert', { x: x + 0.35, y: 2.28, w: 3.2, h: 0.3, fontFace: F, fontSize: 12.5, bold: true, color: INK2, margin: 0 });
  s.addText(val, { x: x + 0.35, y: 2.62, w: 3.2, h: 0.8, fontFace: F, fontSize: 40, bold: true, color: i === 1 ? GRN_D : INK, margin: 0 });
  s.addText('Annual GDV added — ' + n + ' moving from one gift to two.', { x: x + 0.35, y: 3.48, w: 3.2, h: 0.7, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, lineSpacing: 15 });
});
s.addShape(p.ShapeType.roundRect, { x: 0.6, y: 4.5, w: 12.1, h: 1.8, rectRadius: 0.09, fill: { color: 'FBF3EE' }, line: { color: 'EED9CC', width: 0.75 } });
s.addText('Read these as orders of magnitude, not a forecast', { x: 1.0, y: 4.72, w: 11.3, h: 0.32, fontFace: F, fontSize: 14.5, bold: true, color: WARM, margin: 0 });
s.addText('Each figure is the value of an observed gap between donor populations, not a measured treatment effect. Donors in the 2-gift band may simply be different people from one-time donors, in which case moving someone between bands does not deliver $84. A holdout on the 23-day intervention is what converts this slide from a size-of-prize into a business case — and it is the first thing to build.',
  { x: 1.0, y: 5.1, w: 11.3, h: 1.1, fontFace: F, fontSize: 12.5, color: INK2, margin: 0, lineSpacing: 17 });
src(s, SRC + ' Lift per converted donor = $179.00 − $94.63 = $84.37.');

/* ══════════════════ 16 · WHAT WE DON'T KNOW ══════════════════ */
s = p.addSlide();
head(s, 'LIMITS',
  'What this analysis does not establish',
  'Stated up front so the recommendations are not oversold, and so the gaps become the workplan.');
const LIM = [
  ['Nothing here is causal', 'Every figure describes what different donor populations already do. None demonstrates that an intervention moves a donor between bands.'],
  ['The strongest cells are the smallest', 'Chat referral is n=699 against a 20.2M baseline. Directional colour, not a forecastable rate.'],
  ['41% of donors cannot be attributed', '8.3M carry no referral medium, and the field is polluted with Meta ad-set IDs and case duplicates. Channel comparisons describe instrumented traffic only.'],
  ['Three GDV totals are in circulation', '$1.55B in the working model, $1.74B in the strategy deck, $1.775B from Amplitude. Shares are stable; absolute dollars need one source of truth.'],
  ['90 days is a tool ceiling, not a behavioural one', 'Roughly a third of eventual repeat giving happens outside the window the funnel can see.'],
  ['Consumer only', 'All figures are GFM v2 Prod. Nothing accounts for donors giving through GoFundMe Pro nonprofits, who reasonably consider those relationships theirs.'],
];
LIM.forEach(([t, d], i) => {
  const x = 0.6 + (i % 2) * 6.15;
  const y = 2.0 + Math.floor(i / 2) * 1.5;
  card(s, x, y, 5.95, 1.35);
  s.addText(t, { x: x + 0.3, y: y + 0.16, w: 5.35, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: WARM, margin: 0 });
  s.addText(d, { x: x + 0.3, y: y + 0.5, w: 5.35, h: 0.75, fontFace: F, fontSize: 11, color: INK2, margin: 0, lineSpacing: 14 });
});
src(s, 'Each limit is written up in full on the portfolio site, with the query that produced it.');

/* ══════════════════ 17 · NEXT STEPS ══════════════════ */
s = p.addSlide();
head(s, 'NEXT STEPS',
  'Four moves, in dependency order',
  'The first two need no further analysis. The third is what makes the numbers on this deck defensible.');
const NEXT = [
  ['Name the owner', 'This week', 'Cheapest item on the list, needs no analysis, and every later decision improves once somebody owns the number.'],
  ['Reconcile to one GDV figure', 'This week', 'Pick the window and the revenue field. Re-cut the model, the deck and the site from the same source.'],
  ['Launch the 23-day Braze sequence with a holdout', 'This quarter', 'The cohort exists and the window is known. The holdout is what turns $36M-per-point into a measured effect.'],
  ['Pilot one community event with in-person capture', 'Next quarter', 'Tap to Donate is two sprints from ready. One event, instrumented, tells you whether the interpersonal finding productises.'],
];
NEXT.forEach(([t, when, d], i) => {
  const y = 2.05 + i * 1.14;
  card(s, 0.6, y, 12.1, 1.0, i < 2 ? TINT : W);
  disc(s, 0.85, y + 0.3, i + 1);
  s.addText(t, { x: 1.42, y: y + 0.16, w: 7.0, h: 0.32, fontFace: F, fontSize: 14, bold: true, color: INK, margin: 0 });
  s.addText(d, { x: 1.42, y: y + 0.52, w: 8.9, h: 0.42, fontFace: F, fontSize: 11.5, color: INK2, margin: 0, lineSpacing: 15 });
  s.addShape(p.ShapeType.roundRect, { x: 10.9, y: y + 0.3, w: 1.6, h: 0.38, rectRadius: 0.18, fill: { color: i < 2 ? GRN_D : INK3 } });
  s.addText(when, { x: 10.9, y: y + 0.3, w: 1.6, h: 0.38, fontFace: F, fontSize: 10.5, bold: true, color: W, align: 'center', valign: 'middle', margin: 0 });
});
src(s, 'Full analysis, queries and limits: the Corporate Strategy section of the internship portfolio.');

/* ══════════════════ 18 · CLOSE ══════════════════ */
s = p.addSlide();
titleSlide(s, 'THE ARGUMENT IN ONE LINE', 'We under-invest in the moment a donor becomes valuable.',
  'That moment is the second gift. It happens a median of 23 days after the first. 29.2 million people are sitting one gift away from it — and nobody owns the number.');
s.addShape(p.ShapeType.roundRect, { x: 0.7, y: 4.15, w: 11.9, h: 1.5, rectRadius: 0.09, fill: { color: DARK2 } });
s.addText('Backing analysis, every query, and the limits in full', { x: 1.1, y: 4.38, w: 11.1, h: 0.32, fontFace: F, fontSize: 12.5, bold: true, color: GRN, margin: 0 });
s.addText([
  { text: 'Amplitude cohort: ', options: { color: 'C9D8CF' } },
  { text: 'Super Donors — 2+ Donations in Past 365 Days', options: { color: W, underline: true, hyperlink: { url: 'https://app.amplitude.com/analytics/gfm/cohort/1godrkur/details' } } },
], { x: 1.1, y: 4.78, w: 11.1, h: 0.3, fontFace: F, fontSize: 12, margin: 0 });
s.addText([
  { text: 'Donor frequency chart: ', options: { color: 'C9D8CF' } },
  { text: 'Donor Frequency Breakdown — 2x to 10x Donors', options: { color: W, underline: true, hyperlink: { url: 'https://app.amplitude.com/analytics/gfm/chart/urxobg8z' } } },
], { x: 1.1, y: 5.12, w: 11.1, h: 0.3, fontFace: F, fontSize: 12, margin: 0 });
s.addText('Gordon Bailey  ·  Summer 2026  ·  Proprietary & confidential', { x: 0.7, y: 6.5, w: 11.9, h: 0.3, fontFace: F, fontSize: 11, color: '8FA79A' });

const out = process.env.OUT || 'GoFundMe_Super_Donor_Strategy.pptx';
p.writeFile({ fileName: out }).then(() => console.log('wrote', out));
