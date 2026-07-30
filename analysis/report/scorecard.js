/* ==========================================================================
   Performance scorecard PDF.

   Written by hand, one object at a time, for the same reason the client PNG is
   drawn on a canvas: the page has no network access, so a PDF library is not an
   option, and hand-building guarantees no peer name reaches a client-facing
   file. The output is a single-page US Letter PDF with selectable vector text
   rather than a rasterised screenshot, so it survives being printed, emailed
   and pasted into a deck.

   Text widths come from a canvas 2d context measuring the same family the PDF
   asks for. That is an approximation of Helvetica's real AFM metrics — close
   enough for right-aligning numbers and wrapping paragraphs, and it avoids
   embedding a 224-entry width table for two standard fonts.
   ========================================================================== */

const PDF_PAGE = {w: 612, h: 792};             // US Letter, points
const PDF_M = 46;                              // page margin

/* GoFundMe Pro brand values, as 0-1 RGB triples for PDF operators. */
const PDF_COL = {
  dark:  [0.043, 0.180, 0.122],
  brand: [0.008, 0.502, 0.275],
  good:  [0.016, 0.412, 0.016],
  warn:  [0.541, 0.361, 0.000],
  ink:   [0.067, 0.067, 0.063],
  ink2:  [0.333, 0.322, 0.302],
  ink3:  [0.541, 0.525, 0.498],
  line:  [0.902, 0.886, 0.863],
  wash:  [0.973, 0.965, 0.953],
  white: [1, 1, 1],
};

const pdfMeasureCtx = document.createElement('canvas').getContext('2d');
function pdfWidth(text, size, bold){
  pdfMeasureCtx.font = `${bold ? 700 : 400} ${size}px Helvetica, Arial, sans-serif`;
  return pdfMeasureCtx.measureText(text).width;
}

/* PDF string literals are latin-1 with (, ) and \ escaped. Rather than embed a
   WinAnsi table, fold the handful of typographic characters this document can
   contain down to ASCII — a scorecard that renders "-" where the app shows "—"
   is fine; one that renders a broken glyph is not. */
const PDF_FOLD = [[/[—–−]/g, '-'], [/[‘’]/g, "'"],
                  [/[“”]/g, '"'], [/·/g, '-'], [/×/g, 'x'],
                  [/→/g, '->'], [/≥/g, '>='], [/≤/g, '<='], [/…/g, '...'],
                  [/ /g, ' ']];
function pdfText(s){
  let t = String(s == null ? '' : s);
  PDF_FOLD.forEach(([re, to]) => { t = t.replace(re, to); });
  return t.replace(/[^\x20-\x7e]/g, '')
          .replace(/([\\()])/g, '\\$1');
}

function pdfWrap(text, size, bold, maxW){
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  words.forEach(w => {
    const t = line ? line + ' ' + w : w;
    if (line && pdfWidth(t, size, bold) > maxW){ lines.push(line); line = w; }
    else line = t;
  });
  if (line) lines.push(line);
  return lines;
}

/* A tiny content-stream builder. y is measured from the top of the page and
   flipped on the way out, because every layout number in this file reads more
   naturally downward. */
function pdfCanvas(){
  const ops = [];
  const Y = y => PDF_PAGE.h - y;
  const col = c => c.map(n => n.toFixed(3)).join(' ');
  return {
    ops,
    // Deepest y any op touched. A one-page layout built from variable-length
    // content (account names wrap, lever counts vary) can silently run off the
    // bottom, and a PDF gives no error when it does — so the tests assert on it.
    maxY: 0,
    _touch(y){ if (y > this.maxY) this.maxY = y; },
    rect(x, y, w, h, c){ this._touch(y + h); ops.push(`${col(c)} rg`, `${x} ${Y(y + h)} ${w} ${h} re f`); },
    line(x1, y1, x2, y2, c, lw = 0.8){
      this._touch(Math.max(y1, y2));
      ops.push(`${col(c)} RG`, `${lw} w`, `${x1} ${Y(y1)} m ${x2} ${Y(y2)} l S`);
    },
    text(x, y, s, {size = 10, bold = false, c = PDF_COL.ink, align = 'left'} = {}){
      const str = pdfText(s);
      if (!str) return;
      this._touch(y);
      let tx = x;
      if (align === 'right') tx = x - pdfWidth(String(s), size, bold);
      if (align === 'center') tx = x - pdfWidth(String(s), size, bold) / 2;
      ops.push('BT', `${col(c)} rg`, `/${bold ? 'F2' : 'F1'} ${size} Tf`,
               `1 0 0 1 ${tx.toFixed(2)} ${(Y(y)).toFixed(2)} Tm`, `(${str}) Tj`, 'ET');
    },
    para(x, y, s, {size = 9.5, bold = false, c = PDF_COL.ink2, maxW = 300, lh = 13} = {}){
      const lines = pdfWrap(s, size, bold, maxW);
      lines.forEach((ln, i) => this.text(x, y + i * lh, ln, {size, bold, c}));
      return lines.length * lh;
    },
    build(){ return ops.join('\n'); },
  };
}

/* Assemble the file. Six objects, no compression, no embedded fonts — the two
   Helvetica variants are PDF base-14 and always available to the viewer. */
function pdfDocument(content, title){
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE.w} ${PDF_PAGE.h}] ` +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${pdfText(title)}) /Producer (GoFundMe Pro benchmarking) >>`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(o => { out += String(o).padStart(10, '0') + ' 00000 n \n'; });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 7 0 R >>\n` +
         `startxref\n${xref}\n%%EOF`;
  return out;
}

/* ---- the scorecard itself ------------------------------------------------- */
function buildScorecard(){
  if (sel === null) return null;
  const a = L.accounts[sel], C = L.cohorts[a.c], recs = named(a);
  const p = pdfCanvas();
  const W = PDF_PAGE.w, right = W - PDF_M, inner = right - PDF_M;
  const clientLabel = a.dg.startsWith(ACT_PREFIX) ? 'Getting started'
    : a.dg.startsWith(OPT_PREFIX) ? 'Room to grow'
    : a.x ? 'Standout performer' : 'On track';
  const labelCol = a.dg.startsWith(ACT_PREFIX) || a.dg.startsWith(OPT_PREFIX)
    ? PDF_COL.warn : a.x ? PDF_COL.good : PDF_COL.brand;

  /* Header band */
  p.rect(0, 0, W, 74, PDF_COL.dark);
  p.rect(PDF_M, 26, 9, 9, PDF_COL.brand);
  p.text(PDF_M + 17, 34, 'GoFundMe Pro', {size: 13, bold: true, c: PDF_COL.white});
  p.text(PDF_M + 17, 50, 'Fundraising performance scorecard',
         {size: 9, c: [0.75, 0.82, 0.78]});
  p.text(right, 34, new Date().toLocaleDateString('en-US',
         {year: 'numeric', month: 'long', day: 'numeric'}),
         {size: 9, c: [0.75, 0.82, 0.78], align: 'right'});
  p.text(right, 50, 'Prepared for internal review', {size: 8.5, c: [0.62, 0.70, 0.66], align: 'right'});

  let y = 108;

  /* Account identity */
  const nameLines = pdfWrap(a.n, 21, true, inner - 130);
  nameLines.forEach((ln, i) => p.text(PDF_M, y + i * 25, ln, {size: 21, bold: true}));
  y += nameLines.length * 25;
  p.text(PDF_M, y + 4, `${a.s} · ${a.b} billing tier`, {size: 9.5, c: PDF_COL.ink2});

  /* Status chip, right-aligned to the name block */
  const chipW = pdfWidth(clientLabel, 9.5, true) + 20;
  p.rect(right - chipW, 104, chipW, 21, PDF_COL.wash);
  p.rect(right - chipW, 104, 2.5, 21, labelCol);
  p.text(right - chipW + 10, 118, clientLabel, {size: 9.5, bold: true, c: labelCol});

  y += 30;
  p.line(PDF_M, y, right, y, PDF_COL.line);
  y += 26;

  /* Four figures across */
  const med = C.med, raised = a.m[0][0], pctl = a.m[0][1];
  const aboveMed = raised - med;
  const figures = [
    ['Raised, last 12 months', '$' + Math.round(raised).toLocaleString('en-US'), PDF_COL.ink],
    ['Peer median', '$' + Math.round(med).toLocaleString('en-US'), PDF_COL.ink2],
    ['Percentile in peer group', ordinal(pctl), PDF_COL.brand],
    [aboveMed < 0 ? 'Below peer median' : 'Above peer median',
     (aboveMed < 0 ? '-$' : '+$') + Math.round(Math.abs(aboveMed)).toLocaleString('en-US'),
     aboveMed < 0 ? PDF_COL.warn : PDF_COL.good],
  ];
  const colW = inner / 4;
  figures.forEach(([k, v, c], i) => {
    const x = PDF_M + i * colW;
    p.text(x, y, k, {size: 8, c: PDF_COL.ink3});
    p.text(x, y + 20, v, {size: 15, bold: true, c});
  });
  y += 44;

  /* Percentile bar. The median marker sits at 50 by definition, which is the
     reference a customer actually asks about. */
  const barW = inner, barY = y, barH = 9;
  p.rect(PDF_M, barY, barW, barH, PDF_COL.line);
  p.rect(PDF_M, barY, Math.max(2, barW * Math.min(pctl, 100) / 100), barH, PDF_COL.brand);
  p.rect(PDF_M + barW * 0.5 - 1, barY - 3, 2, barH + 6, PDF_COL.ink2);
  p.text(PDF_M, barY + 24, '0th', {size: 7.5, c: PDF_COL.ink3});
  p.text(PDF_M + barW * 0.5, barY + 24, 'peer median', {size: 7.5, c: PDF_COL.ink2, align: 'center'});
  p.text(right, barY + 24, '100th', {size: 7.5, c: PDF_COL.ink3, align: 'right'});
  y += 44;

  /* Peer group context */
  p.text(PDF_M, y, 'HOW THIS COMPARES', {size: 8.5, bold: true, c: PDF_COL.brand});
  y += 16;
  const peerDesc = C.sector
    ? `${C.sector} organizations in the ${C.band} billing tier`
    : `organizations in the ${C.band} billing tier, across all sectors`;
  // Only the widened cohorts carry the caveat. `lvl` is either "sector x size"
  // (a genuine cause-and-size match) or "size only (sector cell too thin)".
  y += p.para(PDF_M, y, `Compared with ${C.n} ${peerDesc}. ` +
    (C.sector
      ? ''
      : 'There were too few organizations in this cause area at this size to compare ' +
        'within, so the peer group widens to all sectors at the same size. ') +
    `Half of this group raised more than $${Math.round(med).toLocaleString('en-US')} ` +
    `in the last 12 months, and a quarter raised more than ` +
    `$${Math.round(C.p75).toLocaleString('en-US')}.`,
    {maxW: inner, lh: 13});
  y += 20;

  /* Metric detail */
  p.text(PDF_M, y, 'THE UNDERLYING NUMBERS', {size: 8.5, bold: true, c: PDF_COL.brand});
  y += 14;
  p.rect(PDF_M, y, inner, 18, PDF_COL.wash);
  p.text(PDF_M + 8, y + 12.5, 'Measure', {size: 8, bold: true, c: PDF_COL.ink3});
  p.text(right - 150, y + 12.5, 'This organization', {size: 8, bold: true, c: PDF_COL.ink3, align: 'right'});
  p.text(right - 8, y + 12.5, 'Percentile', {size: 8, bold: true, c: PDF_COL.ink3, align: 'right'});
  y += 18;
  L.metricOrder.forEach((mk, mi) => {
    const [v, pc] = a.m[mi];
    const isMoney = mi === 0 || mk === 'avg_gift';
    const vt = isMoney ? '$' + Math.round(v).toLocaleString('en-US')
                       : Math.round(v).toLocaleString('en-US');
    p.text(PDF_M + 8, y + 13, L.metricLabels[mi], {size: 9, c: PDF_COL.ink});
    p.text(right - 150, y + 13, vt, {size: 9, bold: true, align: 'right'});
    p.text(right - 8, y + 13, ordinal(pc), {size: 9, c: PDF_COL.ink2, align: 'right'});
    y += 19;
    p.line(PDF_M, y, right, y, PDF_COL.line, 0.5);
  });
  y += 22;

  /* Ranked levers */
  p.text(PDF_M, y, 'WHERE THE OPPORTUNITY IS', {size: 8.5, bold: true, c: PDF_COL.brand});
  y += 16;
  if (!recs.length){
    y += p.para(PDF_M, y, 'This organization is at or above its peer group on every ' +
      'measured driver, so the model has no ranked lever to recommend. The ' +
      'conversation here is about protecting performance rather than closing a gap.',
      {maxW: inner, lh: 13});
  } else {
    recs.slice(0, 3).forEach((r, i) => {
      p.rect(PDF_M, y, 20, 20, PDF_COL.wash);
      p.text(PDF_M + 10, y + 14, String(i + 1), {size: 10, bold: true, c: PDF_COL.brand, align: 'center'});
      p.text(PDF_M + 30, y + 13, r.l, {size: 10.5, bold: true});
      p.text(right, y + 13, '+$' + Math.round(r.lift).toLocaleString('en-US'),
             {size: 10.5, bold: true, c: PDF_COL.good, align: 'right'});
      const h = p.para(PDF_M + 30, y + 28, `${r.act} Move ${describeMove(r)}.`,
                       {maxW: inner - 130, lh: 12, size: 9});
      y += Math.max(34, h + 24);
    });
  }

  /* Body is done; snapshot its depth before the footer adds its own fixed-position
     text, so the tests can tell "content ran into the footer" from "the footer is
     where it always is". */
  const bodyMaxY = p.maxY;

  /* Footer */
  const fy = PDF_PAGE.h - 66;
  p.line(PDF_M, fy, right, fy, PDF_COL.line);
  p.para(PDF_M, fy + 12,
    'Peer groups match on cause area and billing tier; percentiles are computed inside the ' +
    'matched group. Expected lift is modelled from a regression with cohort fixed effects and ' +
    'describes an association, not a guaranteed outcome. Figures are from the book-of-business ' +
    'snapshot and reflect activity on GoFundMe Pro only.',
    {maxW: inner, lh: 9.5, size: 7, c: PDF_COL.ink3});
  p.text(right, PDF_PAGE.h - 20, 'Proprietary and confidential',
         {size: 7, c: PDF_COL.ink3, align: 'right'});

  return {pdf: pdfDocument(p.build(), a.n + ' - performance scorecard'),
          account: a, maxY: Math.round(p.maxY), bodyMaxY: Math.round(bodyMaxY),
          footerTop: PDF_PAGE.h - 66};
}

/* ---- wiring -------------------------------------------------------------- */
function downloadScorecard(){
  const built = buildScorecard();
  if (!built) return;
  const {pdf, account} = built;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  // A data: URL rather than a blob: URL, for the same reason the PNG export
  // uses one: inside a sandboxed frame with an opaque origin, blob: URLs are
  // not reliably fetchable by a download anchor.
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  const url = 'data:application/pdf;base64,' + btoa(bin);
  const name = account.n.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60)
             + '-scorecard.pdf';
  const link = document.createElement('a');
  link.href = url; link.download = name; link.rel = 'noopener';
  document.body.appendChild(link); link.click(); link.remove();
  return {name, bytes: bytes.length};
}

document.getElementById('dl-pdf')?.addEventListener('click', downloadScorecard);
