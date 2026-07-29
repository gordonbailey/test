/* ==========================================================================
   Account tab. One decision at a time: search, then a scorecard, then
   recommendations, with peers and full wording behind disclosures. Presentation
   mode strips every other customer's name from the screen.
   ========================================================================== */
const OPT_PREFIX = 'Underperforming at scale', ACT_PREFIX = 'Minimal platform adoption';

const qEl = document.getElementById('q'), sgEl = document.getElementById('suggest'),
      clearEl = document.getElementById('qclear'), chipsEl = document.getElementById('chips'),
      emptyEl = document.getElementById('acct-empty'), acctEl = document.getElementById('acct'),
      heroEl = document.getElementById('a-hero'), metricsEl = document.getElementById('a-metrics'),
      actionsEl = document.getElementById('a-actions'), actionsWrapEl = document.getElementById('a-actions-wrap'),
      actionsNoteEl = document.getElementById('a-actions-note'), scaleNoteEl = document.getElementById('a-scale-note'),
      ttEl = document.getElementById('a-tt'), peersEl = document.getElementById('a-peers'),
      peersNoteEl = document.getElementById('a-peers-note'), peersCountEl = document.getElementById('a-peers-count'),
      rMetEl = document.getElementById('r-metric'), rOnlyEl = document.getElementById('r-only'),
      presentEl = document.getElementById('present-toggle');
let sel = null, sgRows = [], sgCursor = -1;

rMetEl.innerHTML = L.metricOrder.map((k,i) => `<option value="${i}">${esc(L.metricLabels[i])}</option>`).join('');

const SHORT = {raised_365:'Annual raised', avg_gift:'Average gift', gifts_lifetime:'Lifetime gifts',
  recurring_donors:'Recurring donors', channel_breadth:'Channels used', active_campaigns:'Active campaigns'};
const statusTone = s => s === 'Overperforming' ? 'good' : s === 'Underperforming' ? 'warn' : 'info';
const statusColor = s => s === 'Overperforming' ? 'var(--good)' : s === 'Underperforming' ? 'var(--warn)' : 'var(--s2)';
const leverUnit = label => (L.leverUnits || {})[label] || 'count';
const leverVal = (label,v) => leverUnit(label) === 'money'
  ? '$' + Math.round(v).toLocaleString('en-US') : Math.round(v).toLocaleString('en-US');
const named = a => a.r.map(x => ({l:L.levers[x[0]].label, act:L.levers[x[0]].action,
  cv:x[1], tv:x[2], cp:x[3], tp:x[4], lift:x[5], pct:x[6]}));
function describeMove(r){
  if (leverUnit(r.l) === 'boolean') return 'connect one (none integrated today)';
  return `${leverVal(r.l,r.cv)} → ${leverVal(r.l,r.tv)} (${ordinal(r.tp)} percentile of peers)`;
}

/* ---- search --------------------------------------------------------------- */
const SUGGEST_MAX = 8;
function matches(q){
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const starts = [], contains = [];
  for (let i = 0; i < L.accounts.length; i++){
    const n = L.accounts[i].n.toLowerCase();
    const at = n.indexOf(s);
    if (at === 0) starts.push(i); else if (at > 0) contains.push(i);
    if (starts.length >= SUGGEST_MAX) break;
  }
  // Prefix matches first — typing "red cross" should not bury the obvious answer.
  return starts.concat(contains).slice(0, SUGGEST_MAX);
}
function renderSuggest(){
  const q = qEl.value;
  clearEl.classList.toggle('on', q.length > 0);
  if (!q.trim()){ sgEl.hidden = true; qEl.setAttribute('aria-expanded','false'); return; }
  sgRows = matches(q); sgCursor = -1;
  sgEl.hidden = false; qEl.setAttribute('aria-expanded','true');
  sgEl.innerHTML = sgRows.length ? sgRows.map((i,k) => {
    const a = L.accounts[i], C = L.cohorts[a.c];
    return `<button class="sg" role="option" data-i="${i}" data-k="${k}">
      <div><div class="nm">${esc(a.n)}</div><div class="mt">${esc(a.s)} · ${esc(C.band)}</div></div>
      <div class="rt">${money(a.m[0][0])}</div></button>`;
  }).join('') : `<div class="sgnone">No organization matches “${esc(q)}”.</div>`;
  sgEl.querySelectorAll('.sg').forEach(el => el.addEventListener('click', () => pick(+el.dataset.i)));
}
function moveCursor(d){
  if (sgEl.hidden || !sgRows.length) return;
  sgCursor = (sgCursor + d + sgRows.length) % sgRows.length;
  sgEl.querySelectorAll('.sg').forEach(el => el.classList.toggle('cursor', +el.dataset.k === sgCursor));
  sgEl.querySelector('.sg.cursor')?.scrollIntoView({block:'nearest'});
}
qEl.addEventListener('input', renderSuggest);
qEl.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown'){ e.preventDefault(); moveCursor(1); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); moveCursor(-1); }
  else if (e.key === 'Enter'){
    e.preventDefault();
    if (sgCursor >= 0) pick(sgRows[sgCursor]);
    else if (sgRows.length) pick(sgRows[0]);
  } else if (e.key === 'Escape'){ sgEl.hidden = true; qEl.setAttribute('aria-expanded','false'); }
});
clearEl.addEventListener('click', () => { qEl.value = ''; renderSuggest(); qEl.focus(); });
document.addEventListener('click', e => {
  if (!e.target.closest('.searchwrap')){ sgEl.hidden = true; qEl.setAttribute('aria-expanded','false'); }
});
function pick(i){ sgEl.hidden = true; qEl.setAttribute('aria-expanded','false'); qEl.value = L.accounts[i].n; renderSuggest(); select(i); }

/* Example chips: one of each case, so the three different conversations are
   discoverable without knowing an account name to type. */
(function buildChips(){
  const find = pred => { const k = L.accounts.findIndex(pred); return k < 0 ? null : k; };
  const picks = [
    ['Coachable gap', find(a => a.dg.startsWith(OPT_PREFIX) && a.gap > 4e5)],
    ['Needs onboarding', find(a => a.dg.startsWith(ACT_PREFIX) && a.m[0][0] > 1e4)],
    ['Standout performer', find(a => a.x && a.cr > 100)],
    ['On track', find(a => !a.x && a.st === 'On track' && a.r.length >= 2)],
  ].filter(([,i]) => i != null);
  chipsEl.innerHTML = picks.map(([lbl,i]) =>
    `<button class="chip" data-i="${i}">${lbl} — ${esc(L.accounts[i].n)}</button>`).join('');
  chipsEl.querySelectorAll('.chip').forEach(el => el.addEventListener('click', () => pick(+el.dataset.i)));
})();

/* ---- render -------------------------------------------------------------- */
function select(i){
  sel = i;
  const a = L.accounts[i], C = L.cohorts[a.c];
  emptyEl.hidden = true; acctEl.hidden = false;

  const pctl = a.m[0][1], tone = statusTone(a.st), col = statusColor(a.st);
  const circ = 2 * Math.PI * 44;
  // Two labels: one a client can read on a shared screen, one internal. Showing
  // a customer the word "Underperforming" is not the conversation to have, so the
  // client label leads and the internal status is dropped in presentation mode --
  // and omitted entirely when it would just repeat the client label.
  const clientLabel = a.dg.startsWith(ACT_PREFIX) ? 'Getting started'
    : a.dg.startsWith(OPT_PREFIX) ? 'Room to grow'
    : a.x ? 'Standout performer' : 'On track';
  const clientTone = a.dg.startsWith(ACT_PREFIX) ? 'warn'
    : a.dg.startsWith(OPT_PREFIX) ? 'warn' : a.x ? 'good' : 'info';

  heroEl.innerHTML = `
    <div class="herotop">
      <div style="min-width:0">
        <h3 class="heroname">${esc(a.n)}</h3>
        <p class="herometa">${esc(a.s)} · ${esc(C.band)} revenue · benchmarked against
          <b>${num(C.n - 1)} similar organizations</b></p>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="pill ${clientTone}">${clientLabel}</span>
          ${a.st !== clientLabel ? `<span class="pill hide-in-present">${a.st} · internal</span>` : ''}
        </div>
      </div>
      <div class="dial" title="${ordinal(pctl)} percentile of its peer group">
        <svg width="104" height="104" viewBox="0 0 104 104">
          <circle class="ring" cx="52" cy="52" r="44"/>
          <circle class="val" cx="52" cy="52" r="44" stroke="${col}"
            stroke-dasharray="${circ}" stroke-dashoffset="${circ}" data-off="${circ*(1-pctl/100)}"/>
        </svg>
        <div class="lbl"><div><b>${Math.round(pctl)}</b><span>percentile</span></div></div>
      </div>
    </div>
    <div class="heronums">
      <div class="hn"><div class="k">Raised, last 12 months</div>
        <div class="v">${money(a.m[0][0])}</div>
        <div class="d">${moneyFull(a.m[0][0])}</div></div>
      <div class="hn"><div class="k">Typical peer raises</div>
        <div class="v" style="color:var(--ink-2)">${money(C.med)}</div>
        <div class="d">${a.gap > 0 ? money(a.gap) + ' below' : money(-a.gap) + ' above'} the middle of the group</div></div>
      <div class="hn"><div class="k">Average gift</div>
        <div class="v" style="color:var(--ink-2)">$${Math.round(a.m[1][0])}</div>
        <div class="d">${ordinal(a.m[1][1])} percentile</div></div>
    </div>`;
  const dial = heroEl.querySelector('.val');
  if (REDUCED) dial.style.strokeDashoffset = dial.dataset.off;
  else requestAnimationFrame(() => requestAnimationFrame(() => { dial.style.strokeDashoffset = dial.dataset.off; }));

  // Scope warning before any comparison is read. A narrow-footprint account's
  // shortfall is partly money we never see, and a seller needs that on screen
  // before quoting a gap -- including in front of the customer.
  const scopeEl = document.getElementById('a-scope');
  if (a.fp){
    const nCh = L.nChannels || 7;
    scopeEl.hidden = false;
    scopeEl.innerHTML = `<b>Scope: we only see part of this organization's fundraising.</b>
      It runs <b>${a.ch} of ${nCh}</b> campaign types through the platform${
        a.tcs >= (L.narrowConcentration||0.9) ? `, with ${Math.round(a.tcs*100)}% of its dollars in one` : ''
      }. If it runs direct giving or peer-to-peer elsewhere, that money is invisible here.
      Across accounts with this footprint, about <b>half</b> the measured gap is channels we never
      record rather than weaker fundraising — confirm what they run elsewhere before treating any
      shortfall as real.`;
  } else {
    scopeEl.hidden = true;
  }

  // metric scorecard
  scaleNoteEl.innerHTML = `Each bar places this organization within its peer group. The middle mark is the typical peer; further right is better.`;
  metricsEl.innerHTML = L.metricOrder.map((k,mi) => {
    const [v,p] = a.m[mi];
    const c = p >= 75 ? 'var(--good)' : p < 25 ? 'var(--warn)' : 'var(--s2)';
    return `<div class="mrow">
      <div class="ml">${SHORT[k]}</div>
      <div class="mscale">
        <div class="band"></div><div class="mid"></div>
        <div class="pin" style="background:${c}" data-left="${Math.min(Math.max(p,1),99)}"></div>
      </div>
      <div class="mv">${mfmt(k,v)}<small>${ordinal(p)} pctl</small></div>
    </div>`;
  }).join('');
  metricsEl.querySelectorAll('.pin').forEach(el => {
    if (REDUCED) el.style.left = el.dataset.left + '%';
    else requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = el.dataset.left + '%'; }));
  });

  // recommendations
  const recs = named(a);
  if (recs.length){
    actionsWrapEl.hidden = false;
    actionsNoteEl.innerHTML = `In order of expected impact. Figures are modelled estimates carrying about ±${(L.cvMultiplier||1.9).toFixed(1)}× uncertainty — use the order to decide where to start.`;
    actionsEl.innerHTML = recs.map((r,k) => `
      <div class="act">
        <div class="num">${k+1}</div>
        <div><div class="t">${esc(r.act)}</div><div class="m">${esc(describeMove(r))}</div></div>
        <div class="lift"><b>+${money(r.lift)}</b><small>a year</small></div>
      </div>`).join('');
  } else {
    actionsWrapEl.hidden = false;
    actionsNoteEl.textContent = '';
    const why = a.dg.startsWith(ACT_PREFIX)
      ? `<b>This is an onboarding conversation, not a coaching one.</b> The organization raises under a tenth of what its peers do, which means there is no running program to tune yet. Get a first campaign live and a donation page configured, then revisit the comparison after a quarter of activity.`
      : `<b>Nothing to recommend — this organization is ahead of its peer group${a.x ? `, at ${a.cr.toFixed(1)}× the typical peer` : ''}.</b> Where it looks low on a measure above, that is usually how it wins rather than a weakness: a very small average gift is what a mass-market model looks like. Worth asking what it does differently.`;
    actionsEl.innerHTML = `<div class="card flat" style="font-size:.93rem;color:var(--ink-2)">${why}</div>`;
  }

  renderTalkTrack(a, C, recs);
  renderPeers();
}

/* ---- talk track ---------------------------------------------------------- */
function buildVerdict(a){
  const C = L.cohorts[a.c], peers = C.n - 1;
  const raised = a.m[0][0], pctl = a.m[0][1], median = C.med, gap = Math.max(a.gap, 0);
  const peerGroup = C.refDim === 'cell'
    ? `${peers} other ${a.s} organizations in the ${C.band} revenue band`
    : `${peers} other organizations in the ${C.band} revenue band, across all sectors (too few ${a.s} peers at this size to compare within the sector)`;
  const recs = named(a);
  const acts = recs.map(r => `${r.act} — ${leverUnit(r.l)==='boolean'
    ? 'connect one (this account has no CRM integrated today)'
    : `move ${r.l.toLowerCase()} from ${leverVal(r.l,r.cv)} toward ${leverVal(r.l,r.tv)} (${ordinal(r.tp)} percentile of peers)`}. Modelled effect: roughly +${moneyFull(r.lift)} a year.`);
  const scope = a.fp
    ? `Scope warning: this organization runs ${a.ch} of ${L.nChannels||7} campaign types through `
      + 'the platform, so these figures cover only the part of its fundraising we can see. It may '
      + 'raise substantially more elsewhere. Roughly half the measured gap for accounts with this '
      + 'footprint is the channels we never record rather than weaker fundraising — confirm what '
      + 'they run elsewhere before treating any shortfall as real.'
    : null;
  let headline, reading, actions;
  if (a.dg.startsWith(ACT_PREFIX)){
    headline = `Compared with ${peerGroup}, ${a.n} raised ${money(raised)} in the last 12 months against a peer median of ${money(median)} — under a tenth of it.`;
    reading = 'At this level the gap is an adoption gap, not a fundraising-performance gap. Peer benchmarks assume a running program; this account does not have one yet, so lever comparisons would mislead.';
    actions = ['Get a first campaign live and a donation page configured.',
               'Confirm the account is set up on the channels its plan includes.',
               'Revisit the peer comparison once a full quarter of activity exists.'];
  } else if (a.dg.startsWith(OPT_PREFIX)){
    headline = `Compared with ${peerGroup}, ${a.n} raised ${money(raised)} in the last 12 months — the ${ordinal(pctl)} percentile of that group, and ${money(gap)} below the peer median of ${money(median)}.`;
    reading = (a.dv && a.dv.length)
      ? 'Most of the gap traces to: ' + a.dv.map(([m,p,vt,mt]) =>
          `${(L.driverLabels||{})[m]||m} sits at the ${ordinal(p)} percentile (${vt}${mt?` against a peer median of ${mt}`:''})`).join('; ') + '.'
      : "No single component metric stands out as the cause — the shortfall is spread across the account's whole profile.";
    actions = acts;
  } else if (a.x){
    headline = `Compared with ${peerGroup}, ${a.n} raised ${money(raised)} in the last 12 months — ${a.cr.toFixed(1)}× the peer median of ${money(median)}, in the ${ordinal(pctl)} percentile.`;
    reading = 'This account is far enough ahead of its peer group that peer benchmarks no longer describe it. Where it looks low on a component metric, that is usually how it wins rather than a weakness — a very small average gift, for instance, is what a mass-market model looks like. No lever recommendations are offered.';
    actions = ['Ask what it does differently and write it up as a playbook for peers.',
               'Protect the renewal — this is a reference account, not a coaching case.'];
  } else {
    headline = `Compared with ${peerGroup}, ${a.n} raised ${money(raised)} in the last 12 months — the ${ordinal(pctl)} percentile of that group, against a peer median of ${money(median)}.`;
    reading = 'That is inside the normal range for this peer group, so there is no performance problem to raise. The upside below is optional.';
    actions = acts.slice(0,2);
  }
  const confidence = `Benchmarks come from ${C.n} comparable organizations. Modelled effects carry about ±${(L.cvMultiplier||1.9).toFixed(1)}× uncertainty per organization and are associations, not proven cause and effect — use the ordering of the actions to decide where to start, and do not present the dollar figures as targets.`;
  return {peerGroup, headline, reading, actions, confidence, scope};
}
function renderTalkTrack(a, C, recs){
  const v = buildVerdict(a);
  ttEl.innerHTML = `
    ${v.scope ? `<div class="ttb"><div class="k">Scope</div><div class="ttconf" style="border-left-color:var(--warn)">${esc(v.scope)}</div></div>` : ''}
    <div class="ttb"><div class="k">Peer group</div><div class="t">${esc(v.peerGroup)}</div></div>
    <div class="ttb"><div class="k">Where they stand</div><div class="t">${esc(v.headline)}</div></div>
    <div class="ttb"><div class="k">What it means</div><div class="t">${esc(v.reading)}</div></div>
    <div class="ttb"><div class="k">Recommended actions</div>
      ${v.actions.length ? `<ol>${v.actions.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`
        : '<div class="t">None — nothing to raise with this organization.</div>'}</div>
    <div class="ttb"><div class="k">Confidence</div><div class="ttconf">${esc(v.confidence)}</div></div>`;
}
document.getElementById('copy-tt').addEventListener('click', async e => {
  if (sel === null) return;
  const v = buildVerdict(L.accounts[sel]);
  const txt = [...(v.scope ? [`SCOPE\n${v.scope}`] : []), `PEER GROUP\n${v.peerGroup}`, `WHERE THEY STAND\n${v.headline}`,
    `WHAT IT MEANS\n${v.reading}`,
    'RECOMMENDED ACTIONS\n' + (v.actions.length ? v.actions.map((a,i) => `${i+1}. ${a}`).join('\n') : 'None.'),
    `CONFIDENCE\n${v.confidence}`].join('\n\n');
  const btn = e.currentTarget, label = btn.querySelector('svg').nextSibling;
  try { await navigator.clipboard.writeText(txt); label.textContent = ' Copied'; }
  catch { label.textContent = ' Copy blocked'; }
  setTimeout(() => { label.textContent = ' Copy talk track'; }, 1800);
});

/* ---- peer roster --------------------------------------------------------- */
function cohortPeers(a){
  const C = L.cohorts[a.c];
  return L.accounts.map((x,i) => ({a:x,i}))
    .filter(({a:x}) => C.refDim === 'cell' ? (x.s === C.sector && x.b === C.band) : (x.b === C.band));
}
function renderPeers(){
  if (sel === null) return;
  const a = L.accounts[sel], C = L.cohorts[a.c], mi = +rMetEl.value, mKey = L.metricOrder[mi];
  let rows = cohortPeers(a); const total = rows.length;
  if (rOnlyEl.value === 'exc') rows = rows.filter(({a:x}) => x.x);
  else if (rOnlyEl.value === 'near'){
    const v = a.m[mi][0];
    rows = rows.filter(({a:x}) => x.m[mi][0] != null)
      .sort((p,q) => Math.abs(p.a.m[mi][0]-v) - Math.abs(q.a.m[mi][0]-v)).slice(0,15);
  } else rows.sort((p,q) => (q.a.m[mi][0]??-1) - (p.a.m[mi][0]??-1));

  const rank = rows.findIndex(x => x.i === sel) + 1;
  const CAP = 60;
  let shown = rows.slice(0, CAP);
  // Pin the account into view: sorted by value it can fall past the cap, and a
  // roster missing the account it belongs to answers the wrong question.
  if (!shown.some(x => x.i === sel)){
    const self = rows.find(x => x.i === sel);
    if (self) shown = shown.slice(0, CAP-1).concat([self]);
  }
  peersCountEl.textContent = `· ${num(total)} organizations`;
  peersNoteEl.innerHTML = C.refDim === 'cell'
    ? `Every organization ${esc(a.n)} is scored against — same cause area and size band.${rank ? ` It ranks <b>#${rank} of ${num(rows.length)}</b> on this measure.` : ''}`
    : `Its own cause cell was too small to benchmark, so the peer set is all ${num(total)} organizations in the <b>${esc(C.band)}</b> band, across every sector.${rank ? ` It ranks <b>#${rank} of ${num(rows.length)}</b> here.` : ''}`;
  peersEl.innerHTML = shown.length ? shown.map(({a:x,i}) => `
    <button class="pr ${i===sel?'self':''}" data-i="${i}">
      <div><div class="n2">${esc(x.n)}${i===sel?' <span style="color:var(--brand-strong);font-size:.72rem;font-weight:700">— this account</span>':''}</div>
        <div class="s2">${esc(x.s)} · ${esc(x.b)}</div></div>
      <div class="v2">${mfmt(mKey,x.m[mi][0])}</div>
      <div class="v2">${x.x?`<span style="color:var(--s3);font-weight:700">${x.cr.toFixed(1)}×</span>`:ordinal(x.m[mi][1])}<small>${x.x?'vs median':'pctl'}</small></div>
    </button>`).join('') : '<div class="sgnone">No peers match this filter.</div>';
  peersEl.querySelectorAll('.pr').forEach(el => el.addEventListener('click', () => {
    const i = +el.dataset.i; if (i !== sel) openAccount(i);
  }));
}
[rMetEl,rOnlyEl].forEach(el => el.addEventListener('change', renderPeers));

/* Cross-tab entry point used by the cohort explorer. */
function openAccount(i){
  selectTab('tab-acct', {scroll:false});
  qEl.value = L.accounts[i].n; clearEl.classList.add('on'); sgEl.hidden = true;
  select(i);
  document.getElementById('a-hero').scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block:'start'});
}

/* ---- presentation mode --------------------------------------------------- */
function setPresent(on){
  document.body.classList.toggle('present', on);
  presentEl.checked = on;
  // Peer names are the thing a client must not see, so the disclosures holding
  // them are force-closed rather than merely hidden.
  if (on){ document.getElementById('a-peers-disc').open = false; document.getElementById('a-tt-disc').open = false; }
}
presentEl.addEventListener('change', () => setPresent(presentEl.checked));
document.getElementById('exit-present').addEventListener('click', () => {
  setPresent(false);
  document.getElementById('a-hero').scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block:'start'});
});
addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('present')) setPresent(false); });

/* ==========================================================================
   Client PNG. Drawn on a canvas rather than rasterising the DOM: the page has
   no network access, so an external screenshot library is not an option, and
   hand-drawing also guarantees no peer name can leak into a client-facing file.
   ========================================================================== */
function drawPNG(){
  if (sel === null) return;
  const a = L.accounts[sel], C = L.cohorts[a.c], recs = named(a);
  const S = 2;                                   // retina scale
  const W = 1500;
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');

  // Height is measured, not fixed: a fixed canvas left a third of the image
  // empty for short accounts and would clip a long name or a fifth action.
  const fontProbe = (w,s) => `${w} ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const SPLIT_ = 880, RIGHT_ = W-56, LEFT_ = 56;
  const nameLines = lineBreak(g, a.n, SPLIT_-LEFT_-30, fontProbe(700,30)).length;
  const leftH = 128 + nameLines*34 + 4 + 24 + 40 + 92 + 52 + 30
              + L.metricOrder.length*38 + 26;
  const rightH = 128 + 30 + (recs.length
      ? 16 + 34 + recs.reduce((t,r) =>
          t + 34 + lineBreak(g, r.act, RIGHT_-SPLIT_-70, fontProbe(650,14.5)).length*19 + 22 + 10, 0)
      : 6*22);
  const H = Math.max(leftH, rightH) + (a.fp ? 112 : 96);

  cv.width = W*S; cv.height = H*S;
  g.scale(S,S);

  const INK='#111110', INK2='#55524d', INK3='#8a867f', LINE='#e6e2dc',
        BRAND='#028046', TINT='#e8f5ee', TRACK='#ece8e2',
        GOOD='#0ca30c', WARN='#c98a06', BLUE='#2a78d6';
  const font = (w,s) => `${w} ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`;

  g.fillStyle = '#fbfaf8'; g.fillRect(0,0,W,H);
  const LEFT = LEFT_, RIGHT = RIGHT_, SPLIT = SPLIT_;

  // header
  g.fillStyle = BRAND; roundRect(g, LEFT, 44, 30, 30, 8); g.fill();
  g.fillStyle = '#fff'; g.font = font(700,17); g.textBaseline = 'middle';
  g.fillText('♥', LEFT+9, 60);
  g.fillStyle = INK; g.font = font(700,15);
  g.fillText('GoFundMe Pro', LEFT+42, 53);
  g.fillStyle = INK3; g.font = font(500,13);
  g.fillText('Fundraising Benchmark', LEFT+42, 70);
  g.textAlign = 'right'; g.fillStyle = INK3; g.font = font(500,12.5);
  g.fillText('Snapshot 28 July 2026', RIGHT, 61);
  g.textAlign = 'left';
  g.strokeStyle = LINE; g.lineWidth = 1;
  g.beginPath(); g.moveTo(LEFT,98); g.lineTo(RIGHT,98); g.stroke();

  // org name + peer framing (peer group described, never named)
  g.fillStyle = INK; g.textBaseline = 'top';
  let y = 128;
  y = wrap(g, a.n, LEFT, y, SPLIT-LEFT-30, 34, font(700,30)) + 4;
  g.fillStyle = INK2; g.font = font(500,15);
  g.fillText(`${a.s}  ·  ${C.band} annual revenue`, LEFT, y); y += 24;
  g.fillStyle = INK3; g.font = font(500,14);
  g.fillText(`Benchmarked against ${num(C.n-1)} comparable organizations`, LEFT, y);
  y += 40;

  // headline figures
  const stat = (x,k,v,d,col) => {
    g.fillStyle = INK3; g.font = font(650,11.5);
    g.fillText(k.toUpperCase(), x, y);
    g.fillStyle = col || INK; g.font = font(700,31);
    g.fillText(v, x, y+19);
    if (d){ g.fillStyle = INK3; g.font = font(500,12.5); g.fillText(d, x, y+56); }
  };
  stat(LEFT, 'Raised, last 12 months', money(a.m[0][0]), moneyFull(a.m[0][0]), BRAND);
  stat(LEFT+250, 'Typical peer raises', money(C.med), 'middle of the group', INK2);
  stat(LEFT+480, 'Percentile', ordinal(a.m[0][1]), 'among peers', INK2);
  y += 92;

  // status chip
  const chipText = a.dg.startsWith(ACT_PREFIX) ? 'Getting started'
    : a.dg.startsWith(OPT_PREFIX) ? 'Room to grow'
    : a.x ? 'Standout performer' : 'On track';
  const chipCol = a.dg.startsWith(ACT_PREFIX) ? WARN
    : a.dg.startsWith(OPT_PREFIX) ? WARN : a.x ? GOOD : BLUE;
  g.font = font(650,13);
  const cw = g.measureText(chipText).width + 26;
  g.fillStyle = TINT; roundRect(g, LEFT, y, cw, 28, 14); g.fill();
  g.fillStyle = chipCol; g.fillText(chipText, LEFT+13, y+8);
  y += 52;

  // scorecard
  g.fillStyle = INK; g.font = font(700,16);
  g.fillText('How this compares to similar organizations', LEFT, y); y += 30;
  const BW = 300, BX = LEFT+186;
  L.metricOrder.forEach((k,mi) => {
    const [v,p] = a.m[mi];
    g.fillStyle = INK2; g.font = font(500,13.5); g.textAlign = 'right';
    g.fillText(SHORT[k], BX-16, y+4); g.textAlign = 'left';
    g.fillStyle = TRACK; roundRect(g, BX, y+6, BW, 8, 4); g.fill();
    g.fillStyle = '#c9c4bb'; g.fillRect(BX+BW/2-1, y+2, 2, 16);
    const px = BX + Math.min(Math.max(p,1),99)/100*BW;
    g.fillStyle = p >= 75 ? GOOD : p < 25 ? WARN : BLUE;
    roundRect(g, px-2.5, y, 5, 20, 2.5); g.fill();
    g.fillStyle = INK; g.font = font(650,13.5);
    g.fillText(mfmt(k,v), BX+BW+22, y+4);
    g.fillStyle = INK3; g.font = font(500,11.5);
    g.fillText(ordinal(p), BX+BW+22, y+20);
    y += 38;
  });
  g.fillStyle = INK3; g.font = font(500,11.5);
  g.fillText('Further right is stronger. The centre mark is the typical peer.', BX, y+2);

  // right column — recommendations
  g.strokeStyle = LINE; g.beginPath(); g.moveTo(SPLIT-34,128); g.lineTo(SPLIT-34,H-96); g.stroke();
  let ry = 128;
  g.fillStyle = INK; g.font = font(700,19);
  g.fillText(recs.length ? 'What we recommend' : 'Our read', SPLIT, ry); ry += 30;
  if (recs.length){
    g.fillStyle = INK3; g.font = font(500,12.5);
    ry = wrap(g, 'In order of expected impact. Estimates from comparable organizations — use the order, not the exact figures.', SPLIT, ry, RIGHT-SPLIT, 17, font(500,12.5)) + 16;
    const TW = RIGHT-SPLIT-70;
    recs.forEach((r,i) => {
      // Height follows the title's real line count so a two-line action cannot
      // collide with the detail line under it.
      const titleLines = lineBreak(g, r.act, TW, font(650,14.5)).length;
      const h = 34 + titleLines*19 + 22;
      g.fillStyle = '#fff'; g.strokeStyle = LINE;
      roundRect(g, SPLIT, ry, RIGHT-SPLIT, h, 12); g.fill(); g.stroke();
      g.fillStyle = TINT; g.beginPath(); g.arc(SPLIT+26, ry+27, 13, 0, 7); g.fill();
      g.fillStyle = BRAND; g.font = font(700,13); g.textAlign = 'center';
      g.fillText(String(i+1), SPLIT+26, ry+21); g.textAlign = 'left';
      g.fillStyle = INK;
      const after = wrap(g, r.act, SPLIT+50, ry+14, TW, 19, font(650,14.5));
      g.fillStyle = INK2; g.font = font(500,12.5);
      g.fillText(describeMove(r), SPLIT+50, after+2);
      g.fillStyle = BRAND; g.font = font(700,15);
      g.textAlign = 'right'; g.fillText('+' + money(r.lift) + ' / yr', RIGHT-16, after+1);
      g.textAlign = 'left';
      ry += h + 10;
    });
  } else {
    const txt = a.dg.startsWith(ACT_PREFIX)
      ? 'This organization is still getting started on the platform, so peer comparisons do not yet describe a running programme. The next step is launching a first campaign and configuring a donation page — we can help set both up.'
      : `This organization is well ahead of comparable peers${a.x?`, raising ${a.cr.toFixed(1)}× what a typical peer does`:''}. Where a measure looks low, it usually reflects how this programme is built rather than a weakness. Nothing to change — we would love to understand what works.`;
    g.fillStyle = INK2; g.font = font(500,14.5);
    wrap(g, txt, SPLIT, ry, RIGHT-SPLIT, 22, font(500,14.5));
  }

  // footer
  g.strokeStyle = LINE; g.beginPath(); g.moveTo(LEFT,H-72); g.lineTo(RIGHT,H-72); g.stroke();
  g.fillStyle = INK3; g.font = font(500,11.5);
  const foot = (a.fp
      ? `These figures cover the ${a.ch} of ${L.nChannels||7} campaign types this organization runs on GoFundMe Pro, so fundraising run elsewhere is not included. `
      : '')
    + 'Peer benchmarks are drawn from organizations of comparable cause area and annual revenue. '
    + 'Projected effects are modelled estimates, not guarantees, and are best used to decide which '
    + 'action to try first. Prepared by GoFundMe Pro.';
  wrap(g, foot, LEFT, H-58, RIGHT-LEFT, 16, font(500,11.5));

  cv.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.n.replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').slice(0,60) + '-benchmark.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
function roundRect(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
}
function lineBreak(g,text,maxW,f){
  if (f) g.font = f;
  const words = String(text).split(' ');
  const lines = []; let line = '';
  for (const w of words){
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line){ lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
/* Returns the next available y, not the last line's baseline. Returning the
   latter made every caller draw its following element on top of the text. */
function wrap(g,text,x,y,maxW,lh,f){
  const lines = lineBreak(g,text,maxW,f);
  lines.forEach((l,i) => g.fillText(l, x, y + i*lh));
  return y + lines.length*lh;
}
document.getElementById('dl-png').addEventListener('click', drawPNG);

/* ==========================================================================
   Boot
   ========================================================================== */
renderCohorts();
observeReveals(document);
countUp();
window.__verify = () => {
  // Self-check: client-side quantiles must reproduce the Python-computed ones.
  let worst = 0;
  CO.forEach((c,i) => {
    const v = metricValues(i,0);
    [['med',.5],['p25',.25],['p75',.75],['p90',.9]].forEach(([k,q]) => {
      const js = quantile(v,q); if (js == null || c[k] == null) return;
      worst = Math.max(worst, Math.abs(js-c[k])/Math.max(Math.abs(c[k]),1));
    });
    if (v.length !== c.n) worst = Infinity;
  });
  return worst;
};
