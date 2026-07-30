/* Geometry QA for the deck.
 *
 * LibreOffice cannot convert anything in this sandbox (it fails on a plain .txt
 * too), so the skill's render-and-look path is unavailable. This substitutes a
 * deterministic check: it intercepts every add* call the generator makes,
 * records the box, and flags the defect classes that matter — elements off the
 * slide, elements inside the margin, overlapping text, and text estimated to
 * overflow its own box.
 *
 * Text height is estimated, not measured, so treat overflow hits as "look at
 * this" rather than proof. Bounds and overlap are exact.
 */
const path = require('path');
const pptxPath = require.resolve('pptxgenjs');
const pptx = require(pptxPath);

const SLIDE_W = 13.333, SLIDE_H = 7.5, MARGIN = 0.5;
const slides = [];
let cur = null;

const origAddSlide = pptx.prototype.addSlide;
pptx.prototype.addSlide = function (...a) {
  const s = origAddSlide.apply(this, a);
  cur = { n: slides.length + 1, texts: [], shapes: [], charts: [], bg: null };
  slides.push(cur);
  // titleSlide() assigns s.background; capture it so the preview does not have
  // to infer a dark slide from shape fills (it inferred wrong: a full-width
  // dark callout on a light slide painted the whole slide dark).
  const rec = cur;
  let _bg;
  Object.defineProperty(s, 'background', {
    configurable: true,
    get() { return _bg; },
    set(v) { _bg = v; rec.bg = v && v.color; },
  });
  ['addText', 'addShape', 'addChart', 'addImage', 'addTable'].forEach(m => {
    const orig = s[m].bind(s);
    s[m] = function (...args) {
      const o = args[args.length - 1] || {};
      const rec = { m, x: o.x, y: o.y, w: o.w, h: o.h, opts: o, arg0: args[0] };
      if (m === 'addText') cur.texts.push(rec);
      else if (m === 'addChart') cur.charts.push(rec);
      else cur.shapes.push(rec);
      return orig(...args);
    };
  });
  return s;
};

process.env.OUT = '/tmp/qa_throwaway.pptx';
require(path.join(__dirname, 'build_deck.js'));

/* ---- checks ---- */
const issues = [];
const plain = t => Array.isArray(t)
  ? t.map(r => (r && r.text) || '').join(' ')
  : String(t == null ? '' : t);

/* Arial averages ~0.50 em per char over mixed case; bold ~0.53. Conservative. */
function estLines(text, fontSize, boxW, bold) {
  if (!boxW || !fontSize) return 1;
  const perChar = (bold ? 0.53 : 0.50) * (fontSize / 72);
  const usable = Math.max(boxW - 0.2, 0.3);          // text-box internal padding
  const explicit = (text.match(/\n/g) || []).length;
  const segs = text.split('\n');
  return segs.reduce((n, seg) => n + Math.max(1, Math.ceil((seg.length * perChar) / usable)), 0)
    + (explicit ? 0 : 0);
}

slides.forEach(s => {
  const boxes = [];
  const add = (rec, kind) => {
    const { x, y, w, h } = rec;
    if ([x, y, w, h].some(v => typeof v !== 'number')) return;
    boxes.push({ kind, x, y, w, h, rec });
    if (x < 0 || y < 0 || x + w > SLIDE_W + 0.01 || y + h > SLIDE_H + 0.01)
      issues.push(`slide ${s.n}: ${kind} OFF-SLIDE  x=${x} y=${y} w=${w} h=${h} — "${plain(rec.arg0).slice(0, 40)}"`);
    else if (x < MARGIN - 0.01 || y < MARGIN - 0.4 || x + w > SLIDE_W - MARGIN + 0.11 || y + h > SLIDE_H - 0.2)
      issues.push(`slide ${s.n}: ${kind} INSIDE MARGIN  x=${x.toFixed(2)} y=${y.toFixed(2)} r=${(x + w).toFixed(2)} b=${(y + h).toFixed(2)} — "${plain(rec.arg0).slice(0, 40)}"`);
  };
  s.shapes.forEach(r => add(r, 'shape'));
  s.charts.forEach(r => add(r, 'chart'));
  s.texts.forEach(r => add(r, 'text'));

  /* estimated text overflow */
  s.texts.forEach(r => {
    const txt = plain(r.arg0);
    const fs = r.opts.fontSize || 14;
    const bold = !!r.opts.bold;
    const lines = estLines(txt, fs, r.w, bold);
    const lh = (r.opts.lineSpacing || fs * 1.22) / 72;
    const need = lines * lh + (r.opts.paraSpaceAfter ? (lines - 1) * r.opts.paraSpaceAfter / 72 : 0);
    if (r.h && need > r.h + 0.09)
      issues.push(`slide ${s.n}: TEXT MAY OVERFLOW  h=${r.h} needs ~${need.toFixed(2)} (${lines} lines @${fs}pt) — "${txt.slice(0, 56)}"`);
  });

  /* text-on-text overlap (shapes deliberately sit under text) */
  const T = boxes.filter(b => b.kind === 'text');
  for (let i = 0; i < T.length; i++)
    for (let j = i + 1; j < T.length; j++) {
      const a = T[i], b = T[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 0.12 && oy > 0.12)
        issues.push(`slide ${s.n}: TEXT OVERLAP ${ox.toFixed(2)}x${oy.toFixed(2)}" — "${plain(a.rec.arg0).slice(0, 26)}" / "${plain(b.rec.arg0).slice(0, 26)}"`);
    }
});

console.log(`slides: ${slides.length}`);
console.log(`elements: ${slides.reduce((n, s) => n + s.texts.length + s.shapes.length + s.charts.length, 0)}`);
console.log(`charts: ${slides.reduce((n, s) => n + s.charts.length, 0)}`);
if (!issues.length) console.log('\nNo geometry issues found.');
else { console.log(`\n${issues.length} issue(s):`); issues.forEach(i => console.log('  ' + i)); }

/* ---- HTML preview, since LibreOffice cannot render here ----
   Re-draws the recorded boxes at 13.333x7.5in scale so layout can actually be
   looked at. Not a PowerPoint render — text metrics differ — but it catches
   collisions, empty gaps and bad proportions, which is what the eyeball pass
   is for. Charts are drawn as labelled placeholders with their series values. */
const fs = require('fs');
const esc = t => String(t == null ? '' : t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const PX = 96;
let html = `<style>body{background:#333;margin:0;font-family:Arial,Helvetica,sans-serif}
.sl{position:relative;width:${13.333 * PX}px;height:${7.5 * PX}px;background:#fff;margin:14px auto;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.5)}
.el{position:absolute;overflow:hidden}
.lbl{position:absolute;left:6px;top:4px;font:11px Arial;color:#888;z-index:99}
.ch{border:1px dashed #999;background:#fafafa;display:flex;align-items:center;justify-content:center;
 text-align:center;font:10px Arial;color:#666;padding:6px}</style>`;
slides.forEach(s => {
  html += `<div class="sl"><span class="lbl">${s.n}</span>`;
  if (s.bg) html += `<div class="el" style="left:0;top:0;width:100%;height:100%;background:#${s.bg}"></div>`;
  s.shapes.forEach(r => {
    if (typeof r.x !== 'number') return;
    const f = (r.opts.fill && r.opts.fill.color) || 'transparent';
    const ln = r.opts.line ? `border:1px solid #${r.opts.line.color};` : '';
    const rad = r.opts.rectRadius ? `border-radius:${r.opts.rectRadius * PX}px;` : (r.m === 'addShape' && String(r.arg0).includes('ellipse') ? 'border-radius:50%;' : '');
    html += `<div class="el" style="left:${r.x * PX}px;top:${r.y * PX}px;width:${r.w * PX}px;height:${r.h * PX}px;background:#${f};${ln}${rad}"></div>`;
  });
  s.charts.forEach(r => {
    const series = (Array.isArray(r.arg0) ? [] : []);
    html += `<div class="el ch" style="left:${r.x * PX}px;top:${r.y * PX}px;width:${r.w * PX}px;height:${r.h * PX}px;">CHART</div>`;
  });
  s.texts.forEach(r => {
    if (typeof r.x !== 'number') return;
    const o = r.opts, fs2 = (o.fontSize || 14);
    const txt = Array.isArray(r.arg0)
      ? r.arg0.map(x => esc(x.text)).join('<br>')
      : esc(r.arg0).replace(/\n/g, '<br>');
    html += `<div class="el" style="left:${r.x * PX}px;top:${r.y * PX}px;width:${r.w * PX}px;height:${r.h * PX}px;`
      + `font-size:${fs2 * PX / 72}px;color:#${o.color || '111110'};`
      + `${o.bold ? 'font-weight:700;' : ''}${o.italic ? 'font-style:italic;' : ''}`
      + `line-height:${(o.lineSpacing || fs2 * 1.22) * PX / 72}px;`
      + `text-align:${o.align || 'left'};${o.valign === 'middle' ? 'display:flex;align-items:center;justify-content:center;' : ''}`
      + `padding:${o.margin === 0 ? '0' : '4px 6px'};box-sizing:border-box;">${txt}</div>`;
  });
  html += `</div>`;
});
fs.writeFileSync('/tmp/deck_preview.html', html);
console.log('preview: /tmp/deck_preview.html');
