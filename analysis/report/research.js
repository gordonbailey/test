/* ==========================================================================
   Research targets. Turns the benchmark into a sampling frame for qualitative
   research: within one peer group, who is furthest ahead and who is furthest
   behind, so marketing can interview matched pairs for a thought leadership
   report.

   Two exclusions carry the analytical weight, and both are the same idea —
   a low percentile has more than one cause, and only one of them is worth
   interviewing about:

     - Partial-platform accounts are held out of the bottom list. Roughly half
       their measured gap is fundraising we never record, so "why are you
       behind your peers" is a question built on a number that is partly an
       artifact of scope.
     - Activation cases are held out too, and surfaced separately. An
       organization that has barely launched is not underperforming; asking it
       about fundraising practice answers a question nobody asked.
   ========================================================================== */
const rsCohortEl = document.getElementById('rs-cohort'),
      rsNEl = document.getElementById('rs-n'),
      rsSummaryEl = document.getElementById('rs-summary'),
      rsHypEl = document.getElementById('rs-hypothesis'),
      rsTopEl = document.getElementById('rs-top'), rsBotEl = document.getElementById('rs-bot'),
      rsTopNote = document.getElementById('rs-top-note'), rsBotNote = document.getElementById('rs-bot-note'),
      rsOnboardWrap = document.getElementById('rs-onboard-wrap'),
      rsOnboardEl = document.getElementById('rs-onboard'), rsOnboardNote = document.getElementById('rs-onboard-note');

/* Groups worth sampling from need enough members to have a real top and
   bottom. Below ~12 the two ends are the same handful of organizations. */
const RS_MIN_GROUP = 12;

const rsGroups = (() => {
  const byCohort = new Map();
  L.accounts.forEach((a, i) => {
    if (!byCohort.has(a.c)) byCohort.set(a.c, []);
    byCohort.get(a.c).push({a, i});
  });
  return [...byCohort.entries()]
    .filter(([, rows]) => rows.length >= RS_MIN_GROUP)
    .map(([c, rows]) => ({c, rows, n: rows.length, label: L.cohortNames[c]}))
    .sort((p, q) => q.n - p.n);
})();

rsCohortEl.innerHTML = rsGroups
  .map(g => `<option value="${g.c}">${esc(g.label)} — ${g.n} orgs</option>`).join('');

const rsPctl = r => r.a.m[0][1];
const rsIsActivation = r => r.a.dg.startsWith(ACT_PREFIX);
const rsIsPartial = r => !!r.a.fp;

/* The 5x line decides which list an organization lands in, so a value just
   under it must not print as "5.0x" next to a note saying everything at 5x or
   more was moved elsewhere. Near the boundary, show the second decimal. */
const rsRatio = cr => (cr >= 4.9 && cr < 5 ? cr.toFixed(2) : cr.toFixed(1)) + '× median';

function rsRow(r, {tone, tags}){
  const a = r.a;
  const chips = tags.map(t => `<span class="pill ${t.k}" style="font-size:.68rem">${t.t}</span>`).join(' ');
  return `<button class="pr rs" data-i="${r.i}">
    <div><div class="n2">${esc(a.n)}</div><div class="s2">${esc(a.s)} · ${esc(a.b)}</div></div>
    <div class="v2">${chips || '<span class="tsub">—</span>'}</div>
    <div class="v2">${money(a.m[0][0])}<small>raised</small></div>
    <div class="v2"><span style="color:${tone}">${ordinal(rsPctl(r))}</span><small>in group</small></div>
  </button>`;
}

/* What separates the two ends. Compares the median percentile of each driver
   between the top and bottom sets and reports the widest gaps — the questions
   most likely to be worth asking, stated as a hypothesis rather than a
   finding, because n is a handful a side. */
function rsDivergence(top, bot){
  const med = (rows, mi) => {
    const v = rows.map(r => r.a.m[mi][1]).sort((x, y) => x - y);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  return L.metricOrder.map((k, mi) => {
    const t = med(top, mi), b = med(bot, mi);
    return (t == null || b == null) ? null
      : {k, mi, label: L.metricLabels[mi], top: t, bot: b, spread: t - b};
  }).filter(Boolean).filter(d => d.mi !== 0)   // metric 0 is the ranking itself
    .sort((p, q) => Math.abs(q.spread) - Math.abs(p.spread));
}

/* One partition, used by both the rendered lists and the copied shortlist —
   they drifted apart when each computed its own, and the copied text quietly
   stopped matching the screen. */
function rsPartition(g, want){
  const ranked = [...g.rows].sort((p, q) => rsPctl(q) - rsPctl(p));
  const activation = ranked.filter(rsIsActivation);

  /* Structural outliers are separated rather than ranked in. Taking the raw
     top 3 of a large group returns organizations beating their peers by 20-47x,
     which they do by running a different model — mass-market with a small
     average gift, or one very large campaign. They are interesting, and they
     are the worst possible source of advice another organization could copy.
     The detail view's shortlist is the best performers whose margin is large
     but ordinary. The list view ranks straight, because hiding them there hid
     every account anyone would recognise. */
  const started = ranked.filter(r => !rsIsActivation(r));
  const outliers = started.filter(r => r.a.x);
  const topPool = started.filter(r => !r.a.x);
  const botPool = started.filter(r => !rsIsPartial(r) && !r.a.x);

  /* A top 5 and a bottom 5 drawn from eight organizations overlap, and the
     overlap is not a display bug — there are no two ends to sample. The list
     shrinks to whatever the pool can actually support, and says so. */
  const room = Math.min(topPool.length, botPool.length);
  const per = Math.max(1, Math.min(want, Math.floor(room / 2)));

  const top = topPool.slice(0, per);
  const taken = new Set(top.map(r => r.i));
  const bot = botPool.filter(r => !taken.has(r.i)).slice(-per).reverse();

  /* The straight ranking, outliers and all. Filtering standouts out of a list
     headed "ahead of their peers" removes every account anyone at GoFundMe
     would name: all 38 groups have a standout at number one, and the 374
     standouts are 12% of accounts but 76% of the money. The list shows them
     with their multiple visible; only the sampling frame in the detail view
     holds them out. */
  const topRaw = started.slice(0, want);

  return {
    ranked, activation, outliers: outliers.slice(0, want), nOutliers: outliers.length,
    top, topRaw, bot, per, room,
    capped: per < want,
    heldPartial: started.filter(rsIsPartial).length,
  };
}

function renderResearch(){
  const g = rsGroups.find(x => String(x.c) === rsCohortEl.value) || rsGroups[0];
  if (!g) return;
  const want = +rsNEl.value || 3;
  const C = L.cohorts[g.c];
  const {activation, outliers, nOutliers, top, bot, per, room, capped, heldPartial} = rsPartition(g, want);

  rsSummaryEl.innerHTML = [
    ['Organizations in group', num(g.n), 'the sampling frame'],
    ['Peer median raised', money(C.med), 'last 12 months'],
    ['Interview shortlist', num(top.length + bot.length), `${top.length} ahead · ${bot.length} behind`],
    ['Held out', num(heldPartial + activation.length), `${heldPartial} partial scope · ${activation.length} not started`],
  ].map(([k, v, d], i) => `<div class="stat${i === 2 ? ' accent' : ''}"><div class="k">${k}</div>
      <div class="v">${v}</div><div class="d">${d}</div></div>`).join('');

  document.getElementById('rs-capped').hidden = !capped;
  if (capped) document.getElementById('rs-capped').innerHTML =
    `<b>Shortened to ${per} a side.</b> Only ${room} organizations here survive the exclusions,
     so a top ${want} and a bottom ${want} would name some of the same ones twice. Pick a
     larger group for a ${want}-a-side sample.`;

  /* Hypothesis */
  const div = rsDivergence(top, bot);
  const lead = div[0];
  rsHypEl.innerHTML = !lead ? '' : `<div class="note good" style="margin-top:18px">
    <b>What to probe in this group.</b> The widest separation between the two ends is
    <b>${esc(lead.label.toLowerCase())}</b>: the organizations ahead sit around the
    <b>${ordinal(lead.top)}</b> percentile on it, the ones behind around the
    <b>${ordinal(lead.bot)}</b>. ${div[1] ? `Next widest is ${esc(div[1].label.toLowerCase())}
    (${ordinal(div[1].top)} against ${ordinal(div[1].bot)}).` : ''}
    That is a hypothesis to ask about, not a finding — ${top.length + bot.length} organizations
    cannot establish a cause.</div>`;

  /* Lists */
  rsTopNote.textContent = top.length
    ? `Furthest ahead of their peers without being a structural outlier — the margin is large but ordinary, so the practice behind it is more likely to transfer. ${nOutliers} organization${nOutliers === 1 ? '' : 's'} in this group beat it by 5× or more; the ${outliers.length === 1 ? 'largest is' : `largest ${outliers.length} are`} listed separately below.`
    : 'No eligible organizations in this group.';
  rsTopEl.innerHTML = top.map(r => rsRow(r, {
    tone: 'var(--good-ink)',
    tags: [
      ...(rsIsPartial(r) ? [{k: '', t: 'Partial scope'}] : []),
      ...(r.a.cr >= 1.5 ? [{k: 'good', t: rsRatio(r.a.cr)}] : []),
    ],
  })).join('');

  const outWrap = document.getElementById('rs-outlier-wrap');
  outWrap.hidden = outliers.length === 0;
  if (outliers.length){
    document.getElementById('rs-outlier-note').textContent =
      `Beating the group by 5× or more, which is a different business model rather than a better version of the same one — mass-market programs with small average gifts, or a single very large campaign. Worth interviewing for contrast; do not build the report's advice on them.`;
    document.getElementById('rs-outlier').innerHTML = outliers.map(r => rsRow(r, {
      tone: 'var(--good-ink)',
      tags: [
        {k: 'warn', t: 'Different model'},
        ...(rsIsPartial(r) ? [{k: '', t: 'Partial scope'}] : []),
        {k: 'good', t: rsRatio(r.a.cr)},
      ],
    })).join('');
  }

  rsBotNote.textContent = bot.length
    ? `Furthest behind, after holding out ${heldPartial} partial-scope account${heldPartial === 1 ? '' : 's'} and ${activation.length} that have not launched.`
    : 'No eligible organizations after exclusions — this group has no clean bottom end to sample.';
  rsBotEl.innerHTML = bot.map(r => rsRow(r, {
    tone: 'var(--warn-ink)',
    tags: [
      ...(r.a.gap > 0 ? [{k: 'warn', t: `${money(r.a.gap)} below median`}] : []),
    ],
  })).join('');

  rsOnboardWrap.hidden = activation.length === 0;
  if (activation.length){
    const show = activation.slice(0, per);
    rsOnboardNote.textContent = `${activation.length} organization${activation.length === 1 ? ' has' : 's have'} barely started using the platform. Different interview, different question: what stopped them.`;
    rsOnboardEl.innerHTML = show.map(r => rsRow(r, {
      tone: 'var(--ink-3)', tags: [{k: 'info', t: 'Not started'}],
    })).join('');
  }

  /* Rows open the full account view, so an interviewer can read the profile
     before the call. */
  [rsTopEl, rsBotEl, rsOnboardEl, document.getElementById('rs-outlier')].forEach(el =>
    el.querySelectorAll('.pr').forEach(b =>
      b.addEventListener('click', () => openAccount(+b.dataset.i))));
}

function rsShortlistText(){
  const g = rsGroups.find(x => String(x.c) === rsCohortEl.value) || rsGroups[0];
  const C = L.cohorts[g.c];
  const {top, bot} = rsPartition(g, +rsNEl.value || 3);
  const div = rsDivergence(top, bot);
  const line = r => `  - ${r.a.n} (${r.a.s}, ${r.a.b}) — ${money(r.a.m[0][0])} raised, ${ordinal(rsPctl(r))} percentile`;
  return [
    `Interview shortlist — ${g.label}`,
    `Peer group of ${g.n} organizations; median raised ${money(C.med)} in the last 12 months.`,
    '',
    'AHEAD OF THEIR PEERS — ask what is working:',
    ...top.map(line),
    '',
    'BEHIND THEIR PEERS — ask what is getting in the way:',
    ...bot.map(line),
    '',
    div[0] ? `Hypothesis to probe: ${div[0].label.toLowerCase()} (${ordinal(div[0].top)} percentile among those ahead, ${ordinal(div[0].bot)} among those behind).` : '',
    '',
    'Ask both sides the same questions. Do not read percentiles out to participants,',
    'and publish the pattern rather than the ranking.',
  ].filter(x => x !== null).join('\n');
}

/* ── The list ───────────────────────────────────────────────────────────────
   Every peer group on one screen, three names either side. The deep dive
   answers "what should I ask this group?"; this answers "who do I call?",
   which is the question someone actually opens the tab with. */
/* Beating your peer group is normal at the top: 109 of the 114 names in this
   table clear 5x, so the engine's standout flag marks almost everything here
   and separates nothing. 25x is where the multiple stops being a performance
   fact -- 43 of 114 -- and starts being a different model or a bad size band. */
const RS_EXTREME = 25;

const rsSectorEl = document.getElementById('rs-sector'),
      rsTbodyEl = document.getElementById('rs-tbody'),
      rsTableNote = document.getElementById('rs-table-note');

/* Sector comes off the cohort, not off a member account: where the cause cell
   was too thin the group falls back to size-only, and every member still
   carries its own sector while the group has none. */
const rsSector = g => L.cohorts[g.c].sector || 'Matched on size only';
rsSectorEl.innerHTML += [...new Set(rsGroups.map(rsSector))].sort()
  .map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

const rsTableRows = () => rsGroups
  .filter(g => !rsSectorEl.value || rsSector(g) === rsSectorEl.value)
  .map(g => ({g, ...rsPartition(g, 3)}));

function renderTable(){
  const rows = rsTableRows();
  const cell = (list, mark, tone) => list.length
    ? `<div class="rsl">${list.map(r => `<button data-i="${r.i}" title="${esc(r.a.n)}">
        <span class="nm">${esc(r.a.n)}</span>
        <span class="mk" style="color:${tone(r)}">${mark(r)}</span></button>`).join('')}</div>`
    : '<div class="none">— none eligible</div>';

  rsTbodyEl.innerHTML = rows.map(({g, topRaw, bot}) => `<tr>
    <td><div class="gname">${esc(rsSector(g))}</div>
        <div class="gmeta">${esc(L.cohorts[g.c].band)} · ${g.n} orgs</div></td>
    <td>${cell(topRaw, r => rsRatio(r.a.cr),
               r => r.a.cr >= RS_EXTREME ? 'var(--warn-ink)' : 'var(--good-ink)')}</td>
    <td>${cell(bot, r => `${money(r.a.gap)} behind`, () => 'var(--warn-ink)')}</td>
  </tr>`).join('');

  const listed = rows.reduce((n, r) => n + r.topRaw.length + r.bot.length, 0);
  const extreme = rows.reduce((n, r) => n + r.topRaw.filter(x => x.a.cr >= RS_EXTREME).length, 0);
  rsTableNote.innerHTML = `${listed} organizations across ${rows.length} peer groups. `
    + 'Click any name to open its full profile. Groups smaller than 12 are not shown — '
    + 'their top and bottom are the same handful of organizations. '
    + `The <b>${extreme} multiples in amber</b> are ${RS_EXTREME}× or more: at that distance the `
    + 'organization is running a different model, or its size band is wrong. Read those as a '
    + 'story to tell, not a playbook to copy.';

  rsTbodyEl.querySelectorAll('button[data-i]').forEach(b =>
    b.addEventListener('click', () => openAccount(+b.dataset.i)));
}

function rsTableText(){
  return rsTableRows().flatMap(({g, topRaw, bot}) => [
    `${g.label} (${g.n} orgs, median ${money(L.cohorts[g.c].med)})`,
    '  Ahead — ask what is working:',
    ...(topRaw.length ? topRaw.map(r => `    - ${r.a.n} (${rsRatio(r.a.cr)}${r.a.x ? ', different model' : ''})`) : ['    - none eligible']),
    '  Behind — ask what is getting in the way:',
    ...(bot.length ? bot.map(r => `    - ${r.a.n} (${money(r.a.gap)} behind median)`) : ['    - none eligible']),
    '',
  ]).concat([
    'Ask both sides the same questions. Do not read percentiles out to participants,',
    'and publish the pattern rather than the ranking.',
  ]).join('\n');
}

/* ── wiring ─────────────────────────────────────────────────────────────── */
function rsCopy(btn, text){
  const label = btn.querySelector('svg').nextSibling, prev = label.textContent;
  navigator.clipboard.writeText(text)
    .then(() => { label.textContent = ' Copied'; })
    .catch(() => { label.textContent = ' Press Ctrl+C'; })
    .finally(() => setTimeout(() => { label.textContent = prev; }, 1600));
}
document.getElementById('rs-copy').addEventListener('click',
  e => rsCopy(e.currentTarget, rsShortlistText()));
document.getElementById('rs-copy-all').addEventListener('click',
  e => rsCopy(e.currentTarget, rsTableText()));

document.getElementById('rs-mode').addEventListener('click', e => {
  const b = e.target.closest('.segbtn');
  if (!b) return;
  document.querySelectorAll('#rs-mode .segbtn').forEach(x => {
    const on = x === b;
    x.classList.toggle('on', on);
    x.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.getElementById('rs-view-table').hidden = b.dataset.mode !== 'table';
  document.getElementById('rs-view-detail').hidden = b.dataset.mode !== 'detail';
});

rsSectorEl.addEventListener('change', renderTable);
[rsCohortEl, rsNEl].forEach(el => el.addEventListener('change', renderResearch));
renderResearch();
renderTable();
