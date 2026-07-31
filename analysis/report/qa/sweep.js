/* Layout sweep: every view at every width, checking four things.
 *
 *   node analysis/report/qa/sweep.js
 *
 * 1. nothing overflows the viewport horizontally
 * 2. the visible view is inside .wrap (a stray </div> once pushed two tabs out)
 * 3. exactly one view is visible
 * 4. no text spills its own box — a nowrap label in a fixed grid track keeps
 *    its box while the glyphs overrun it, so bounding-box checks are blind and
 *    scrollWidth is the only tell
 *
 * Pages are discovered from the rail rather than listed here, so a new project
 * is covered the moment it appears in projects.json. It reads report.html
 * directly and counts the checks it actually ran: an earlier version of this
 * script read a copy in /tmp and reported a hardcoded count, so it went on
 * passing after the copy went stale.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  let n = 0;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const bad = [], errors = [];
  const widths = [1600, 1440, 1280, 1100, 980, 900, 768, 560, 420];
  for (const w of widths) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(w + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(w + ' console: ' + m.text()); });
    await p.goto('file:///home/user/test/analysis/report/report.html');
    await p.waitForTimeout(350);
    const ids = await p.$$eval('.nlink[data-go]', e => [...new Set(e.map(x => x.dataset.go))]);
    for (const id of ids) {
      await p.evaluate(i => { location.hash = '#/' + (i === 'home' ? '' : i); }, id);
      await p.waitForTimeout(140);
      // benchmarking has five sub-tabs; check each
      const subs = id === 'benchmarking'
        ? ['guide', 'findings', 'cohorts', 'account', 'methodology'] : [null];
      for (const s of subs) {
        if (s) { await p.evaluate(s => { location.hash = '#/benchmarking/' + s; }, s); await p.waitForTimeout(160); }
        const r = await p.evaluate(() => {
          const de = document.documentElement;
          const v = document.querySelector('.view:not([hidden])');
          const wrap = document.querySelector('.wrap');
          const out = { hScroll: de.scrollWidth - de.clientWidth, inWrap: !!(v && wrap.contains(v)),
                        shown: v && v.dataset.view, count: document.querySelectorAll('.view:not([hidden])').length,
                        over: [] };
          const scope = v ? v.querySelectorAll('*') : [];
          scope.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.left < -2 || r.right > de.clientWidth + 2)) {
              let a = el, s = false;
              while (a) { const st = getComputedStyle(a);
                if (st.overflowX === 'auto' || st.overflowX === 'scroll' || st.position === 'fixed') { s = true; break; }
                a = a.parentElement; }
              if (!s) out.over.push(el.tagName + '.' + String(el.className).slice(0, 34));
            }
          });
          // Text spilling out of its own box into the next column. A nowrap
          // label in a fixed grid track keeps its 96px box while the glyphs
          // overrun it, so getBoundingClientRect sees nothing wrong and the
          // viewport-overflow scan above is blind. scrollWidth is the tell.
          out.collide = [];
          (v ? v.querySelectorAll('.tli > *, .lnk > *, .rung > *, .mrow > *, .bar > *, .pcard .nm, .stat .v') : []).forEach(el => {
            const st = getComputedStyle(el);
            if (st.overflow !== 'visible' || st.textOverflow === 'ellipsis') return;
            if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
              out.collide.push((el.parentElement.className || '?') + ' > ' + (el.className || el.tagName) +
                               ' text spills ' + (el.scrollWidth - el.clientWidth) + 'px');
          });
          return out;
        });
        n++;
        const key = `${w} ${id}${s ? '/' + s : ''}`;
        if (r.hScroll > 0 || !r.inWrap || r.count !== 1 || r.over.length || (r.collide||[]).length)
          bad.push({ key, ...r, over: r.over.slice(0, 3), collide: (r.collide||[]).slice(0, 3) });
      }
    }
    await ctx.close();
  }
  console.log(JSON.stringify({ widths, checked: n,
                               failures: bad, errors }, null, 1));
  await b.close();
})();
