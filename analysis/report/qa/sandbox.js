/* Whole-shell regression inside a sandboxed iframe, the way the published
 * artifact runs it.
 *
 *   node analysis/report/qa/serve.js &
 *   node analysis/report/qa/sandbox.js
 *
 * history.pushState throws without allow-same-origin, canvas export behaves
 * differently, and downloads need an explicit permission -- none of which
 * reproduce from file://. Covers routing, the seller book, presentation mode
 * and the PNG export.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://127.0.0.1:8199/');
  await p.waitForTimeout(900);
  const f = p.frames()[1];
  const out = {};
  // routing inside a sandbox without a writable history
  out.railRows = await f.$$eval('.nrow', e => e.length);
  await f.click('.nlink[data-go="utm"]'); await p.waitForTimeout(300);
  out.afterNav = await f.evaluate(() => document.querySelector('.view:not([hidden])').dataset.view);
  await f.click('.nlink[data-go="ci"]'); await p.waitForTimeout(250);
  await f.click('.ntwist[data-for="ci"]').catch(() => {});
  await p.waitForTimeout(200);
  await f.click('.nlink[data-go="benchmarking"]'); await p.waitForTimeout(400);
  out.bench = await f.evaluate(() => document.querySelector('.view:not([hidden])').dataset.view);
  await f.click('#tab-acct'); await p.waitForTimeout(300);
  await f.fill('#q', 'Baptist Health'); await p.waitForTimeout(350);
  await f.click('.sg'); await p.waitForTimeout(600);
  out.acct = await f.evaluate(() => (document.querySelector('.heroname')||{}).textContent);
  // seller book
  const owners = await f.$$eval('#owner option', o => o.map(x => x.textContent));
  out.owners = owners.slice(0, 3);
  await f.selectOption('#owner', { label: owners.find(o => /Blake/.test(o)) || owners[2] });
  await p.waitForTimeout(500);
  out.book = await f.evaluate(() => ({
    heading: (document.querySelector('#book-h')||{}).textContent,
    rows: document.querySelectorAll('#book-list .pr').length,
  }));
  await f.selectOption('#owner', '');
  await p.waitForTimeout(300);
  // present mode + PNG modal
  await f.click('.nlink[data-go="benchmarking"]').catch(()=>{});
  await p.waitForTimeout(200);
  await f.click('#tab-acct'); await p.waitForTimeout(250);
  await f.fill('#q', 'Baptist Health'); await p.waitForTimeout(300);
  await f.click('.sg'); await p.waitForTimeout(500);
  await f.evaluate(() => { const t = document.getElementById('present-toggle'); t.checked = true; t.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(500);
  out.present = await f.evaluate(() => ({
    on: document.body.classList.contains('present'),
    railVisible: getComputedStyle(document.getElementById('rail')).display !== 'none',
    tabsVisible: getComputedStyle(document.querySelector('.tabs')).display !== 'none',
    crumbVisible: getComputedStyle(document.querySelector('.phead .crumb')).display !== 'none',
    pillVisible: !!document.querySelector('.phead .sp') && getComputedStyle(document.querySelector('.phead .sp')).display !== 'none',
  }));
  await f.click('#exit-present'); await p.waitForTimeout(450);
  out.exited = await f.evaluate(() => !document.body.classList.contains('present'));
  await f.click('#dl-png'); await p.waitForTimeout(1200);
  out.png = await f.evaluate(() => {
    const m = document.getElementById('png-modal'), i = m && m.querySelector('img');
    const a = m && m.querySelector('a[download]');
    return { open: m && !m.hidden, loaded: !!(i && i.complete && i.naturalWidth),
             dims: i && i.naturalWidth + 'x' + i.naturalHeight,
             bytes: i && i.src.length, dl: a && a.getAttribute('download') };
  });
  out.errors = errs;
  console.log(JSON.stringify(out, null, 1));
  await ctx.close(); await b.close();
})();
