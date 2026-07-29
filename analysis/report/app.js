/* ==========================================================================
   Bootstrapping, formatting, shared chart helpers
   ========================================================================== */
const D = __RD__;                                    // report-level aggregates
const X = __EXTRA__;                                 // extra findings series
const L = JSON.parse(document.getElementById('lookup-data').textContent);

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const num = n => Number(n).toLocaleString('en-US', {maximumFractionDigits: 0});
const money = n => {
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + Math.round(n/1e3) + 'K';
  return '$' + Math.round(n);
};
const moneyFull = n => '$' + Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ordinal = n => {
  const i = Math.round(n);
  if (i % 100 >= 10 && i % 100 <= 20) return i + 'th';
  return i + ({1:'st',2:'nd',3:'rd'}[i % 10] || 'th');
};
function quantile(sorted, q){
  const n = sorted.length; if (!n) return null;
  const pos = (n-1)*q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi]-sorted[lo])*(pos-lo);
}

/* Bars render at width 0 and are grown once visible, so a chart animates when
   the reader arrives at it rather than while it is off-screen. */
function barRows(rows, opts = {}){
  const max = opts.max ?? Math.max(...rows.map(r => r.value ?? 0), 1);
  return rows.map(r => `
    <div class="bar">
      <div class="l">${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</div>
      <div class="trk"><div class="fil" data-w="${Math.max((r.value/max)*100, r.value > 0 ? 1.2 : 0)}"
        style="background:${r.color || 'var(--s1)'}"></div></div>
      <div class="v">${r.vtext}${r.vsub ? `<small>${r.vsub}</small>` : ''}</div>
    </div>`).join('');
}
function growBars(root){
  root.querySelectorAll('.fil[data-w]').forEach(el => {
    const w = el.dataset.w + '%';
    if (REDUCED) { el.style.width = w; return; }
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = w; }));
  });
}
const revealIO = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); growBars(e.target); revealIO.unobserve(e.target); } });
}, {rootMargin: '0px 0px -8% 0px', threshold: 0.05});
function observeReveals(scope){
  scope.querySelectorAll('.reveal:not(.in)').forEach(el => revealIO.observe(el));
  // Anything not wrapped in .reveal still needs its bars grown.
  growBars(scope);
}

/* ==========================================================================
   Tabs
   ========================================================================== */
const tabs = [...document.querySelectorAll('.tab')];
function selectTab(id, {scroll = true} = {}){
  tabs.forEach(t => {
    const on = t.id === id;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    const panel = document.getElementById(t.getAttribute('aria-controls'));
    panel.hidden = !on;
    if (on) { panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = ''; observeReveals(panel); }
  });
  if (scroll && window.scrollY > 220) window.scrollTo({top: 0, behavior: REDUCED ? 'auto' : 'smooth'});
}
tabs.forEach(t => {
  t.addEventListener('click', () => selectTab(t.id));
  t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabs.indexOf(t);
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); selectTab(n.id);
  });
});

/* Count-up on the hero stat tiles. */
function countUp(){
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    if (REDUCED) { el.textContent = num(target); return; }
    const t0 = performance.now(), dur = 900;
    const step = t => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = num(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ==========================================================================
   Guide tab charts
   ========================================================================== */
const STEPS = [
  ['Agree what the words mean', 'one definition per idea'],
  ['Decide who can be measured', 'complete data, real activity'],
  ['Build the peer groups', 'cause × size, minimum 30'],
  ['Score against the group', 'percentile, plus a three-way split'],
  ['Rank what to do next', 'levers, bounded to a realistic step'],
];
document.getElementById('g-steps').innerHTML = STEPS.map(([t, s], i) => `
  <div class="bar" style="grid-template-columns:34px 1fr;min-height:38px">
    <div class="l" style="text-align:center;color:var(--brand);font-weight:700">${i+1}</div>
    <div><div style="font-weight:650;font-size:.93rem">${t}</div>
      <div style="font-size:.82rem;color:var(--ink-3)">${s}</div></div>
  </div>`).join('');

const F = D.funnel;
document.getElementById('g-funnel').innerHTML = barRows([
  {label:'Accounts in the export', value:F[0].n, vtext:num(F[0].n)},
  {label:'Have an IRS cause code', value:F[1].n, vtext:num(F[1].n), vsub:`−${num(F[1].r)}`},
  {label:'Have filed revenue', value:F[2].n, vtext:num(F[2].n), vsub:`−${num(F[2].r)}`},
  {label:'Average gift computable', value:F[4].n, vtext:num(F[4].n), vsub:`−${num(F[4].r)}`},
  {label:'Enough activity to judge', value:F[6].n, vtext:num(F[6].n), vsub:`−${num(F[5].r+F[6].r)}`, color:'var(--brand)'},
], {max:F[0].n});

const BANDS = [['Under $100k',121],['$100k–$250k',193],['$250k–$1M',566],['$1M–$5M',967],
               ['$5M–$25M',805],['$25M–$100M',334],['$100M–$1B',144],['Over $1B',31]];
document.getElementById('g-bands').innerHTML = barRows(
  BANDS.map(([l,n]) => ({label:l, value:n, vtext:num(n), vsub:'orgs'})));

const DG = D.diagnosis;
document.getElementById('g-status').innerHTML = barRows([
  {label:'Overperforming', sub:'top quarter', value:DG['Overperforming'], vtext:num(DG['Overperforming']), color:'var(--good)'},
  {label:'On track', sub:'middle half', value:DG['On track'], vtext:num(DG['On track']), color:'var(--s2)'},
  {label:'Behind — coachable', sub:'real opportunity', value:DG['Underperforming at scale - optimization opportunity'], vtext:num(DG['Underperforming at scale - optimization opportunity']), color:'var(--warn)'},
  {label:'Barely started', sub:'needs onboarding', value:DG['Minimal platform adoption - activation, not optimization'], vtext:num(DG['Minimal platform adoption - activation, not optimization']), color:'var(--crit)'},
]);

const LEV_PLAIN = [['Grow monthly / recurring giving','strongest'],['Raise the average gift','strong'],
  ['Connect a donor CRM','moderate'],['Add a fundraising channel','moderate'],['Run more campaigns','weak']];
const LEV_W = [100,88,58,44,15];
document.getElementById('g-levers').innerHTML = LEV_PLAIN.map(([l,s],i) => `
  <div class="bar">
    <div class="l">${l}</div>
    <div class="trk"><div class="fil" data-w="${LEV_W[i]}" style="background:${i<2?'var(--brand)':i<4?'var(--s2)':'var(--s3)'}"></div></div>
    <div class="v" style="font-variant-numeric:normal;font-weight:600;color:var(--ink-2)">${s}</div>
  </div>`).join('');

/* Scope table: what the analysis covers, what it does not, and what data would
   close each gap. Kept as data rather than prose so nothing silently drops. */
const SCOPE = [
  ['Cause area and organization size', 'in', 'Cohorts are matched on both. IRS-filed revenue, IRS cause code.'],
  ['Money raised through this platform', 'in', 'Trailing 12 months, all seven campaign types combined.'],
  ['Prior fundraising history', 'in', 'Years before the outcome window, spread over contract tenure.'],
  ['Donor base and gift size', 'in', 'Recurring donors, lifetime gift count, average gift.'],
  ['Campaign-type mix and volume', 'in', 'Which of the three campaign types are live (direct giving, P2P, hosted event), how concentrated, how many campaigns.'],
  ['CRM integration and platform admins', 'in', 'Carried as operating-capability controls.'],
  ['Fundraising the organization does elsewhere', 'out',
   'THE BIG ONE. No wallet-share field exists. An organization running only its P2P with us looks small here. Flagged per account, not corrected. Would need self-reported total fundraising, or 990 contributions revenue.'],
  ['Individual campaigns', 'out',
   'The export has counts and channel totals, no campaign records. So no per-campaign success, no campaign-type comparison.'],
  ['Momentum and donation curves', 'out',
   'No weekly or monthly series — annual and lifetime totals only. Week-over-week versus cohort, and growth/decay curves, both need a time series.'],
  ['Marketing spend, staff quality, donor demographics', 'out',
   'Not in the data at all. Part of why a percentile band beats a goal-completion figure: these are exactly the things that make raw comparison unfair.'],
  ['Offline and cheque giving', 'out',
   'The reconciled channel columns are online only. Any offline programme is invisible.'],
  ['Cause and effect', 'out',
   'Everything here is measured across organizations at one point in time. A holdout test on one lever is the only way to turn these associations into effects.'],
  ['Change over time', 'out',
   'A single snapshot. No test of whether moving a lever in one year is followed by more raised the next.'],
];
document.getElementById('scope-table').innerHTML = SCOPE.map(([d,st,txt]) => `
  <tr><td><b>${d}</b></td>
    <td><span class="pill ${st==='in'?'good':'bad'}">${st==='in'?'Accounted for':'Not accounted for'}</span></td>
    <td style="color:var(--ink-2)">${txt}</td></tr>`).join('');

// Footprint gap decomposition, from build_report_data.py.
document.getElementById('g-footprint').innerHTML = barRows([
  {label:'Total gap, narrow vs broad footprint', sub:'lifetime dollars, log points',
   value:X.footprint.gap_total, vtext:'×' + Math.exp(X.footprint.gap_total).toFixed(1), color:'var(--ink-3)'},
  {label:'…from channels we never see', sub:'measurement artifact',
   value:X.footprint.gap_channels, vtext:(X.footprint.gap_channels/X.footprint.gap_total*100).toFixed(0)+'%', color:'var(--s3)'},
  {label:'…from lower activity per channel', sub:'genuine difference',
   value:X.footprint.gap_per_channel, vtext:(X.footprint.gap_per_channel/X.footprint.gap_total*100).toFixed(0)+'%', color:'var(--s2)'},
], {max:X.footprint.gap_total});

/* ==========================================================================
   Findings tab charts
   ========================================================================== */
document.getElementById('f-conc').innerHTML = barRows(
  X.concentration.map(c => ({label:`Top ${c.pct}% of accounts`, value:c.share,
    vtext:(c.share*100).toFixed(0)+'%', color: c.pct<=5 ? 'var(--brand)' : 'var(--s2)'})), {max:1});

const P = X.paths;
document.getElementById('f-paths').innerHTML = barRows([
  {label:'Volume-led', sub:'more gifts, gift size mid or low', value:P.volume_led, vtext:num(P.volume_led), color:'var(--brand)'},
  {label:'Both', sub:'high on gift size and volume', value:P.both, vtext:num(P.both), color:'var(--s2)'},
  {label:'Gift-size-led', sub:'bigger gifts, volume mid or low', value:P.gift_led, vtext:num(P.gift_led), color:'var(--s3)'},
  {label:'Neither', sub:'reached the top another way', value:P.neither, vtext:num(P.neither), color:'var(--s4)'},
]);

// Campaign types first, then the columns beneath each — the reporting splits a
// direct-giving dollar by which surface built the page, which is why a raw
// column list reads as more "channels" than an organization actually runs.
document.getElementById('f-chan').innerHTML =
  X.types.map(t => `
    <div class="bar" style="min-height:36px">
      <div class="l" style="font-weight:650;color:var(--ink)">${esc(t.name)}<small>${num(t.accounts)} orgs</small></div>
      <div class="trk"><div class="fil" data-w="${(t.dollars/X.types[0].dollars)*100}" style="background:var(--brand)"></div></div>
      <div class="v">${money(t.dollars)}<small>${(t.dollars/X.types.reduce((s,y)=>s+y.dollars,0)*100).toFixed(0)}%</small></div>
    </div>` + t.members.map(m => `
    <div class="bar" style="min-height:26px">
      <div class="l" style="font-size:.78rem;color:var(--ink-3)">↳ ${esc(m.name)}</div>
      <div class="trk" style="height:11px"><div class="fil" data-w="${(m.dollars/X.types[0].dollars)*100}" style="background:var(--s2);opacity:.65"></div></div>
      <div class="v" style="font-size:.78rem;font-weight:400;color:var(--ink-2)">${money(m.dollars)}<small>${num(m.accounts)} orgs</small></div>
    </div>`).join('')).join('');

document.getElementById('f-spread').innerHTML = X.spread.map(s => {
  const max = Math.max(...X.spread.map(y => y.p90));
  const l = (s.p10/max)*100, w = Math.max(((s.p90-s.p10)/max)*100, 1), m = (s.p50/max)*100;
  return `<div class="bar" style="--lw:196px">
    <div class="l">${esc(s.cohort).replace(' | ',' · ')}<small>n=${s.n}</small></div>
    <div class="mscale" style="height:24px">
      <div class="band" style="left:${l}%;right:${100-l-w}%;top:8px;height:9px"></div>
      <div class="mid" style="left:${m}%;top:4px;height:17px"></div>
    </div>
    <div class="v">${money(s.p50)}<small>${money(s.p10)}–${money(s.p90)}</small></div>
  </div>`;
}).join('');

document.getElementById('f-sector').innerHTML = barRows(
  X.bysector.map((s,i) => ({label:esc(s.sector), sub:`n=${s.n}`, value:s.share,
    vtext:(s.share*100).toFixed(1)+'%', vsub:`${s.exc} orgs`,
    color: i===0 ? 'var(--s3)' : 'var(--s2)'})));

const EFF = [...D.effects].sort((a,b) => b.c - a.c);
document.getElementById('f-levers').innerHTML = EFF.map(e => {
  const max = Math.max(...EFF.map(x => x.hi));
  const w = (e.c/max)*100, lo = (e.lo/max)*100, hi = (e.hi/max)*100;
  const txt = e.t === 'none' ? '×' + Math.exp(e.c).toFixed(2) : '+' + e.c.toFixed(2) + '%';
  return `<div class="bar" style="min-height:40px">
    <div class="l">${esc(e.l)}<small>${esc(e.a)}</small></div>
    <div class="trk" style="background:none;overflow:visible">
      <div style="position:absolute;inset:0;background:var(--track);border-radius:999px"></div>
      <div class="fil" data-w="${w}" style="background:var(--brand)"></div>
      <div style="position:absolute;left:${lo}%;width:${hi-lo}%;top:6px;height:5px;
        background:var(--ink-3);opacity:.5;border-radius:999px"></div>
    </div>
    <div class="v">${txt}<small>${e.t === 'none' ? 'per unit' : 'per +1%'}</small></div>
  </div>`;
}).join('');

/* ==========================================================================
   Methodology tab (built here so its charts share the same helpers)
   ========================================================================== */
document.getElementById('method-body').innerHTML = __METHOD__;

document.getElementById('m-funnel').innerHTML = barRows(
  D.funnel.map((f,i) => ({label:esc(f.g), sub:f.d ? esc(f.d) : '', value:f.n,
    vtext:num(f.n), vsub: f.r > 0 ? `−${num(f.r)}` : '', color: i===D.funnel.length-1 ? 'var(--brand)' : 'var(--s2)'})),
  {max:D.funnel[0].n});

document.getElementById('m-bands').innerHTML = X.bandstats.map(b => `
  <tr><td>${esc(b.band)}</td><td class="n">${num(b.n)}</td><td class="n">${b.dex.toFixed(2)}</td>
  <td class="n">${b.corr >= 0 ? '+' : ''}${b.corr.toFixed(3)}</td></tr>`).join('');

document.getElementById('m-terms').innerHTML = X.terms.map(t => `
  <tr><td><code>${esc(t.term)}</code></td><td class="n">${t.coef >= 0 ? '+' : ''}${t.coef.toFixed(4)}</td>
  <td class="n">${t.p < 1e-4 ? t.p.toExponential(0) : t.p.toFixed(3)}</td>
  <td class="n">${t.vif.toFixed(1)}</td><td>${t.role}</td></tr>`).join('');

const LADDER = [
  ['Levers + org scale only', 0.645, 'baseline'],
  ['+ prior-period run rate', 0.712, '+0.067'],
  ['+ contract tenure', 0.730, '+0.018'],
  ['+ channel concentration, donor base', 0.7325, 'shipped'],
  ['Gradient boosting, same features', 0.786, 'ceiling'],
];
document.getElementById('m-ladder').innerHTML = LADDER.map(([l,v,s],i) => `
  <div class="bar">
    <div class="l">${l}</div>
    <div class="trk"><div class="fil" data-w="${(v/0.85)*100}"
      style="background:${i===3?'var(--brand)':i===4?'var(--ink-3)':'var(--s2)'}"></div></div>
    <div class="v">${v.toFixed(3)}<small>${s}</small></div>
  </div>`).join('');

/* ==========================================================================
   Cohort explorer (Findings tab)
   ========================================================================== */
const CN = L.cohortNames, CO = L.cohorts;
const secEl = document.getElementById('c-sector'), bandEl = document.getElementById('c-band'),
      metEl = document.getElementById('c-metric'), csortEl = document.getElementById('c-sort'),
      cListEl = document.getElementById('cohorts'), cHintEl = document.getElementById('c-hint'),
      cDetEl = document.getElementById('c-detail');
let selectedCohort = null;

/* Reference populations, resolved exactly as the engine resolves them: a cell
   cohort's population is its sector × size cell, a backed-off cohort's is the
   whole size band. */
const POP = CO.map(c => {
  const idx = [];
  L.accounts.forEach((a,i) => {
    if (c.refDim === 'cell' ? (a.s === c.sector && a.b === c.band) : (a.b === c.band)) idx.push(i);
  });
  return idx;
});
const metricValues = (ci, mi) => POP[ci].map(i => L.accounts[i].m[mi][0])
  .filter(v => v != null).sort((a,b) => a-b);

const MFMT = {
  raised_365: v => money(v), avg_gift: v => '$' + Number(v).toFixed(0),
  gifts_lifetime: v => num(v), recurring_donors: v => num(v),
  campaign_type_breadth: v => Number(v).toFixed(1), active_campaigns: v => num(v),
};
const mfmt = (k,v) => v == null ? '—' : (MFMT[k] || num)(v);

const sectors = [...new Set(CO.filter(c => c.refDim === 'cell').map(c => c.sector))].sort();
secEl.innerHTML = '<option value="">All sectors</option>' + sectors.map(s => `<option>${esc(s)}</option>`).join('');
// Band order comes from the engine, never a local copy.
bandEl.innerHTML = '<option value="">All size bands</option>' +
  (L.sizeBands || []).filter(b => CO.some(c => c.band === b)).map(b => `<option>${esc(b)}</option>`).join('');
metEl.innerHTML = L.metricOrder.map((k,i) => `<option value="${i}">${esc(L.metricLabels[i])}</option>`).join('');

const curMetric = () => ({i:+metEl.value, key:L.metricOrder[+metEl.value], label:L.metricLabels[+metEl.value]});

function cohortRows(){
  const sec = secEl.value, band = bandEl.value, mi = curMetric().i;
  const rows = CO.map((c,idx) => ({c,idx}))
    .filter(({c}) => (!band || c.band === band) && (!sec || c.sector === sec))
    .map(({c,idx}) => {
      const v = metricValues(idx, mi);
      return {c, idx, p25:quantile(v,.25), med:quantile(v,.5), p75:quantile(v,.75),
              excShare: c.n ? c.exc/c.n : 0};
    });
  const cmp = {
    n:(x,y)=>y.c.n-x.c.n,
    med:(x,y)=>(y.med??-1)-(x.med??-1),
    exc:(x,y)=>y.c.exc-x.c.exc || y.c.n-x.c.n,
    excshare:(x,y)=>y.excShare-x.excShare || y.c.exc-x.c.exc,
    spread:(x,y)=>((y.p75/y.med)||0)-((x.p75/x.med)||0),
    name:(x,y)=>CN[x.idx].localeCompare(CN[y.idx]),
  }[csortEl.value];
  return rows.sort(cmp);
}

function renderCohorts(){
  const rows = cohortRows(), m = curMetric();
  const scale = Math.max(...rows.map(r => r.p75 || 0), 1);
  const maxExc = Math.max(...rows.map(r => r.c.exc), 1);
  const distinct = new Set(); rows.forEach(r => POP[r.idx].forEach(i => distinct.add(i)));
  cHintEl.textContent = rows.length
    ? `${rows.length} group${rows.length===1?'':'s'} · ${m.label.toLowerCase()} · ${num(distinct.size)} distinct accounts`
    : 'No groups match these filters.';
  cListEl.innerHTML = rows.length ? rows.map(r => {
    const l = (r.p25/scale)*100, w = Math.max(((r.p75-r.p25)/scale)*100, .8), mm = (r.med/scale)*100;
    return `<button class="pr" data-i="${r.idx}" style="grid-template-columns:200px 1fr 96px 66px;padding:6px 8px${r.idx===selectedCohort?';background:var(--brand-tint);box-shadow:inset 0 0 0 1px var(--brand)':''}"
      title="${esc(CN[r.idx])} — n=${r.c.n}, median ${mfmt(m.key,r.med)}, ${r.c.exc} standouts">
      <div><div class="n2">${esc(CN[r.idx]).replace(' | ',' · ')}</div></div>
      <div class="mscale" style="height:22px">
        <div class="band" style="left:${l}%;right:${Math.max(100-l-w,0)}%;top:7px;height:8px"></div>
        <div class="mid" style="left:${mm}%;top:3px;height:16px"></div>
      </div>
      <div class="v2">${mfmt(m.key,r.med)}<small>n=${r.c.n}</small></div>
      <div class="v2"><div class="trk" style="height:7px"><div class="fil" data-w="${(r.c.exc/maxExc)*100}" style="background:var(--s3)"></div></div><small>${r.c.exc}</small></div>
    </button>`;
  }).join('') : '<div class="sgnone">No groups match. Clear a filter.</div>';
  growBars(cListEl);
  cListEl.querySelectorAll('.pr').forEach(el =>
    el.addEventListener('click', () => selectCohort(+el.dataset.i)));
}

function selectCohort(idx){
  selectedCohort = idx; renderCohorts();
  const c = CO[idx], m = curMetric(), pop = POP[idx].map(i => ({a:L.accounts[i], i}));
  const vals = metricValues(idx, m.i);
  const deciles = [...Array(9)].map((_,k) => quantile(vals, (k+1)/10));
  const st = c.st || {};
  const order = [['Overperforming','var(--good)'],['On track','var(--s2)'],['Underperforming','var(--warn)']];
  const tot = order.reduce((s,[k]) => s + (st[k]||0), 0) || 1;
  const leaders = [...pop].filter(({a}) => a.m[m.i][0] != null)
    .sort((x,y) => y.a.m[m.i][0]-x.a.m[m.i][0]).slice(0,6);
  const laggards = [...pop].filter(({a}) => a.dg.startsWith(OPT_PREFIX))
    .sort((x,y) => y.a.gap-x.a.gap).slice(0,6);
  const list = (rows, gap) => rows.length ? rows.map(({a,i}) => `
    <button class="pr" data-acct="${i}" style="grid-template-columns:1fr auto">
      <div class="n2">${esc(a.n)}</div>
      <div class="v2">${gap ? `<span style="color:var(--warn-ink)">−${money(a.gap)}</span>`
        : mfmt(m.key, a.m[m.i][0]) + (a.x ? ` <span style="color:var(--s3);font-weight:700">${a.cr.toFixed(1)}×</span>` : '')}</div>
    </button>`).join('') : '<div class="sgnone">None.</div>';

  cDetEl.innerHTML = `<div class="card">
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;margin-bottom:4px">
      <div style="font-size:1.1rem;font-weight:700;letter-spacing:-.02em">${esc(CN[idx]).replace(' | ',' · ')}</div>
      <span class="pill ${c.refDim==='cell'?'info':''}">${c.refDim==='cell'?'cause × size':'size band only'}</span>
    </div>
    <p class="sub tight">${c.refDim==='cell'
      ? `${c.n} organizations matched on cause area and size.`
      : `${c.labelled} organization${c.labelled===1?'':'s'} whose own cause cell was too small, scored against all ${c.n} accounts in the ${esc(c.band)} band.`}</p>
    <div class="stats" style="margin:16px 0 20px">
      <div class="stat flat"><div class="k">Organizations</div><div class="v">${num(c.n)}</div></div>
      <div class="stat flat"><div class="k">Median ${esc(m.label.toLowerCase())}</div><div class="v">${mfmt(m.key,quantile(vals,.5))}</div><div class="d">p25 ${mfmt(m.key,quantile(vals,.25))} · p75 ${mfmt(m.key,quantile(vals,.75))}</div></div>
      <div class="stat flat"><div class="k">Standouts</div><div class="v">${num(c.exc)}</div><div class="d">${(c.exc/c.n*100).toFixed(1)}% at ≥5× median</div></div>
      <div class="stat flat"><div class="k">Spread</div><div class="v">${(quantile(vals,.75)/quantile(vals,.5)||0).toFixed(1)}×</div><div class="d">p75 ÷ median</div></div>
    </div>
    <div class="grid2">
      <div>
        <h3 style="margin-top:0">Distribution</h3>
        <div class="bars" style="--lw:38px;--vw:96px;--lwm:32px">${barRows(deciles.map((v,k) =>
          ({label:'p'+((k+1)*10), value:v, vtext:mfmt(m.key,v)})))}</div>
      </div>
      <div>
        <h3 style="margin-top:0">Peer benchmarks</h3>
        <div class="tw"><table><tbody>${L.metricOrder.map((k,i) =>
          `<tr><td>${esc(L.metricLabels[i])}</td><td class="n">${mfmt(k,quantile(metricValues(idx,i),.5))}</td></tr>`).join('')}</tbody></table></div>
        <h3>Status mix</h3>
        <div style="display:flex;height:19px;border-radius:999px;overflow:hidden;gap:2px;margin:6px 0 8px">
          ${order.map(([k,col]) => (st[k]||0) ? `<div style="width:${(st[k]/tot)*100}%;background:${col}" title="${k}: ${st[k]}"></div>` : '').join('')}
        </div>
        <div class="legend" style="margin:0">${order.map(([k,col]) => `<span><i style="background:${col}"></i>${k} ${st[k]||0}</span>`).join('')}</div>
      </div>
    </div>
    <div class="grid2" style="margin-top:20px">
      <div><h3 style="margin-top:0">Leaders</h3><div class="peers">${list(leaders,false)}</div></div>
      <div><h3 style="margin-top:0">Largest coachable gaps</h3><div class="peers">${list(laggards,true)}</div></div>
    </div>
    <p class="sub" style="margin:14px 0 0;font-size:.83rem">Select any organization to open its scorecard.</p>
  </div>`;
  growBars(cDetEl);
  cDetEl.querySelectorAll('[data-acct]').forEach(el =>
    el.addEventListener('click', () => openAccount(+el.dataset.acct)));
  cDetEl.scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block:'nearest'});
}
[secEl,bandEl,metEl,csortEl].forEach(el => el.addEventListener('change', () => {
  if (selectedCohort !== null && !cohortRows().some(r => r.idx === selectedCohort)) {
    selectedCohort = null; cDetEl.innerHTML = '';
  }
  renderCohorts();
  if (selectedCohort !== null) selectCohort(selectedCohort);
}));
