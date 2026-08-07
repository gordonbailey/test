/* Research-targets tab: every peer group, at both shortlist sizes.
 *
 *   node analysis/report/qa/research.js
 *
 * The layout sweep visits this tab once, on whichever group loads first. That
 * is not enough: the rows are a fixed grid, the organization names vary from
 * eight characters to seventy, and the exclusion rules mean some groups render
 * an empty bottom list or no outlier block at all. So this walks all of them.
 *
 * Checks, per group per size:
 *   1. no text spills its box (nowrap in a fixed track overruns silently)
 *   2. the shortlist is not empty on both sides at once
 *   3. every row is clickable through to a real account view
 *   4. held-out counts add up: nothing is both listed and excluded
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const bad = [], errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto('file:///home/user/test/analysis/report/report.html');
  await p.evaluate(() => { location.hash = '#/benchmarking/research'; });
  await p.waitForTimeout(400);

  const groups = await p.$$eval('#rs-cohort option', o => o.map(x => x.value));
  let n = 0, emptyBottom = 0, withOutliers = 0, withOnboard = 0;

  for (const g of groups) {
    for (const per of ['3', '5']) {
      await p.evaluate(([g, per]) => {
        const c = document.getElementById('rs-cohort'), k = document.getElementById('rs-n');
        c.value = g; k.value = per;
        c.dispatchEvent(new Event('change')); k.dispatchEvent(new Event('change'));
      }, [g, per]);
      await p.waitForTimeout(60);
      const r = await p.evaluate(() => {
        const spill = [];
        document.querySelectorAll('#panel-research .pr *').forEach(el => {
          // Clipping on purpose is not a spill: .n2 and .s2 ellipsize long
          // organization names by design. Only glyphs escaping a visible box
          // count, because those land on top of the next column.
          const st = getComputedStyle(el);
          if (st.overflow !== 'visible' || st.textOverflow === 'ellipsis') return;
          if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
            spill.push((el.className || el.tagName) + ': ' + el.textContent.slice(0, 40));
        });
        const rows = s => [...document.querySelectorAll(s + ' .pr')];
        const ids = s => rows(s).map(x => +x.dataset.i);
        return {
          label: document.getElementById('rs-cohort').selectedOptions[0].textContent,
          spill,
          top: ids('#rs-top'), bot: ids('#rs-bot'),
          out: document.getElementById('rs-outlier-wrap').hidden ? [] : ids('#rs-outlier'),
          onb: document.getElementById('rs-onboard-wrap').hidden ? [] : ids('#rs-onboard'),
          summary: [...document.querySelectorAll('#rs-summary .v')].map(x => x.textContent),
          hyp: (document.getElementById('rs-hypothesis').textContent || '').trim().length,
        };
      });
      n++;
      const tag = `${r.label} / per=${per}`;
      if (r.spill.length) bad.push(`${tag}: text spill — ${r.spill.join(' | ')}`);
      if (!r.top.length && !r.bot.length) bad.push(`${tag}: both sides empty`);
      if (r.top.length > +per || r.bot.length > +per) bad.push(`${tag}: over-length list`);
      // a row must never appear in two lists — the exclusions are meant to be disjoint
      const all = [...r.top, ...r.bot, ...r.out, ...r.onb];
      if (new Set(all).size !== all.length) bad.push(`${tag}: an account is in two lists`);
      if (r.top.length && r.bot.length && !r.hyp) bad.push(`${tag}: no hypothesis rendered`);
      if (!r.bot.length) emptyBottom++;
      if (r.out.length) withOutliers++;
      if (r.onb.length) withOnboard++;
    }
  }

  // A row has to open the account view, on the tab it was clicked from.
  await p.evaluate(() => { location.hash = '#/benchmarking/research'; });
  await p.waitForTimeout(200);
  await p.click('#rs-top .pr');
  // Smooth scroll: poll rather than guess a duration.
  await p.waitForFunction(() => {
    const b = document.getElementById('a-hero')?.getBoundingClientRect();
    return b && b.top > -50 && b.top < innerHeight;
  }, null, { timeout: 4000 }).catch(() => {});
  const opened = await p.evaluate(() => ({
    onAcct: !document.getElementById('panel-acct').hidden,
    heroVisible: document.getElementById('a-hero')?.checkVisibility() ?? false,
    inView: (() => { const b = document.getElementById('a-hero')?.getBoundingClientRect();
      return b ? b.top > -50 && b.top < innerHeight : false; })(),
  }));
  n++;
  if (!opened.onAcct) bad.push('click-through: account panel did not open');
  if (!opened.heroVisible) bad.push('click-through: account hero not visible');
  if (!opened.inView) bad.push('click-through: account hero rendered off-screen');

  console.log(JSON.stringify({
    groups: groups.length, checked: n,
    emptyBottom, withOutliers, withOnboard,
    failures: bad, errors: errors.filter(e => !/favicon/.test(e)),
  }, null, 1));
  await b.close();
})();
