/* ==========================================================================
   Shell router.

   One page, many projects. Views are all in the DOM; the rail shows one at a
   time. Routes are hashes (#/benchmarking/account) so the back button works
   and a section can be linked to from a doc — but note that inside a published
   artifact the address bar belongs to the host page, so the hash is a
   within-session convenience, not a shareable deep link.

   NODES is emitted by build.py from projects.json — the rail, the home cards,
   the breadcrumbs and this router all read that one list, so adding a project
   never means touching navigation markup.
   ========================================================================== */
const NODES = __NODES__;
const BY_ID = Object.fromEntries(NODES.map(n => [n.id, n]));
const SUBTABS = {guide:'tab-guide', findings:'tab-find', cohorts:'tab-cohorts',
                 account:'tab-acct', methodology:'tab-method'};
const SUBSLUG = Object.fromEntries(Object.entries(SUBTABS).map(([k, v]) => [v, k]));

const railEl   = document.getElementById('rail');
const scrimEl  = document.getElementById('scrim');
const toggleEl = document.getElementById('rail-toggle');
const views    = Object.fromEntries(
  [...document.querySelectorAll('.view')].map(v => [v.dataset.view, v]));

let current = null;

function ancestors(id){
  const out = [];
  for (let n = BY_ID[id]; n && n.parent; n = BY_ID[n.parent]) out.push(n.parent);
  return out;
}

/* The rail only auto-opens the branch you are in. Anything you opened by hand
   stays open — collapsing a group the reader just expanded is infuriating. */
function syncRail(id){
  const chain = new Set([id, ...ancestors(id)]);
  railEl.querySelectorAll('.nrow').forEach(r =>
    r.classList.toggle('on', r.dataset.node === id));
  ancestors(id).forEach(a => {
    const t = railEl.querySelector(`.ntwist[data-for="${a}"]`);
    if (t && t.getAttribute('aria-expanded') === 'false') setTwist(t, true);
  });
  const on = railEl.querySelector('.nrow.on');
  if (on) on.scrollIntoView({block: 'nearest'});
  return chain;
}
function setTwist(btn, open){
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.getElementById('kids-' + btn.dataset.for).hidden = !open;
}

function closeRail(){ document.body.classList.remove('railopen'); }

function go(id, sub, {push = true, scroll = true} = {}){
  if (!views[id]) id = 'home';
  Object.entries(views).forEach(([k, v]) => {
    const on = k === id;
    v.hidden = !on;
    if (on){
      v.style.animation = 'none'; void v.offsetWidth; v.style.animation = '';
      observeReveals(v);
    }
  });
  syncRail(id);
  const node = BY_ID[id];
  document.title = node && id !== 'home'
    ? node.title + ' — ' + SITE.wordmark : SITE.title;

  // A project may own sub-tabs. Only the benchmarking view does today.
  if (sub && SUBTABS[sub] && document.getElementById(SUBTABS[sub])) {
    selectTab(SUBTABS[sub], {scroll: false});
  }
  if (push) {
    const h = '#/' + (id === 'home' ? '' : id + (sub ? '/' + sub : ''));
    try { if (location.hash !== h) history.pushState(null, '', h); }
    catch (_) { /* sandboxed without same-origin: keep routing in memory */ }
  }
  current = id;
  closeRail();
  if (scroll) window.scrollTo({top: 0, behavior: REDUCED ? 'auto' : 'smooth'});
}

function routeFromHash({push = false} = {}){
  let h = '';
  try { h = location.hash || ''; } catch (_) {}
  const [, id, sub] = h.replace(/^#\/?/, '/').split('/');
  go(id || 'home', sub, {push, scroll: false});
}

/* Rail wiring. Links carry a real href so they read as links and can be
   opened in a new tab; the click handler keeps it a single-page move. */
railEl.addEventListener('click', e => {
  const twist = e.target.closest('.ntwist');
  if (twist) {
    setTwist(twist, twist.getAttribute('aria-expanded') === 'false');
    return;
  }
  const link = e.target.closest('.nlink');
  if (!link) return;
  e.preventDefault();
  go(link.dataset.go, link.dataset.sub);
});

/* Home cards and any in-page cross-link. */
document.addEventListener('click', e => {
  const j = e.target.closest('[data-jump]');
  if (!j) return;
  e.preventDefault();
  go(j.dataset.jump, j.dataset.sub);
});

toggleEl.addEventListener('click', () => document.body.classList.toggle('railopen'));
scrimEl.addEventListener('click', closeRail);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('railopen')) closeRail();
});
window.addEventListener('hashchange', () => routeFromHash());

/* ---- theme ---- */
const themeEl = document.getElementById('theme-btn');
function systemDark(){ return matchMedia('(prefers-color-scheme:dark)').matches; }
themeEl.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark' : systemDark();
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  paintTheme();
});
function paintTheme(){
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark' : systemDark();
  themeEl.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  themeEl.innerHTML = dark
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
}
paintTheme();
/* Charts read their colours from CSS custom properties at draw time, so a
   theme flip has to redraw whatever is on screen. */
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', paintTheme);

routeFromHash();
