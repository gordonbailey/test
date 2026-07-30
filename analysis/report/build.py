#!/usr/bin/env python3
"""Inline every asset into a single self-contained page.

A published artifact has no network access, so all CSS, JS and data must be
embedded. Paths resolve relative to this file, not the working directory.

The page is a shell holding one view per project. Navigation, breadcrumbs,
home cards and the router all read `projects.json` — adding a project means
adding a node there, and optionally a `projects/<id>.html` body. No navigation
markup is written by hand.

Usage:  python report/build.py            # from anywhere
Env:    ANALYSIS_DIR (default: parent of this file), OUT (default: report.html)
"""
import base64
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.environ.get('ANALYSIS_DIR', os.path.join(HERE, '..')).rstrip('/') + '/'
here = lambda f: open(os.path.join(HERE, f)).read()
esc = html.escape

missing = [f for f in ('report_data_compact.json', 'findings_extra.json', 'lookup_data.json')
           if not os.path.exists(A + f)]
if missing:
    sys.exit('Missing generated input(s): ' + ', '.join(missing) +
             '\nRun:  python build_report_data.py <export.csv>'
             '\n      python build_lookup.py <export.csv> -o lookup_data.json')

head   = here('head.html')
shcss  = here('shell_css.html')
acss   = here('account_css.html')
body   = here('body.html')
method = here('method.html')
app    = here('app.js')
acct   = here('account.js')
shell  = here('shell.js')
reg    = json.loads(here('projects.json'))
rd     = open(A + 'report_data_compact.json').read()
extra  = open(A + 'findings_extra.json').read()
lookup = open(A + 'lookup_data.json').read()

SITE = reg['site']
NODES = sorted(reg['nodes'], key=lambda n: (n.get('parent') or '', n.get('order', 0)))
BY_ID = {n['id']: n for n in NODES}
KIDS = {}
for n in NODES:
    KIDS.setdefault(n.get('parent'), []).append(n)
for v in KIDS.values():
    v.sort(key=lambda n: n.get('order', 0))

dupes = [i for i in BY_ID if sum(n['id'] == i for n in NODES) > 1]
if dupes:
    sys.exit('projects.json: duplicate node id(s): ' + ', '.join(dupes))
orphans = [n['id'] for n in NODES if n.get('parent') and n['parent'] not in BY_ID]
if orphans:
    sys.exit('projects.json: node(s) with unknown parent: ' + ', '.join(orphans))

STATUS_LABEL = {'live': 'Live', 'drafting': 'In progress', 'awaiting': 'Awaiting content'}

# One byline, used on the home hero, in the rail and in the footer, so a change
# of name or term is a single edit in projects.json.
BYLINE = ' · '.join(x for x in (SITE.get('owner'), SITE['term']) if x)

CARET = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>')
ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')
HEART = ('<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.7-7.5-10.1A4.4 4.4 0 0 1 '
         '12 7.9a4.4 4.4 0 0 1 7.5 3c0 5.4-7.5 10.1-7.5 10.1Z" fill="#fff"/></svg>')


def depth(node):
    d = 0
    while node.get('parent'):
        node = BY_ID[node['parent']]
        d += 1
    return d


def descendants(node):
    out = []
    for k in KIDS.get(node['id'], []):
        out.append(k)
        out.extend(descendants(k))
    return out


def trail(node):
    """Ancestors, outermost first, excluding the node itself."""
    chain = []
    while node.get('parent'):
        node = BY_ID[node['parent']]
        chain.append(node)
    return list(reversed(chain))


# ---------------------------------------------------------------- rail
def rail_rows(parent, lvl):
    out = []
    for n in KIDS.get(parent, []):
        kids = KIDS.get(n['id'], [])
        st = n.get('status', 'awaiting')
        twist = (f'<button class="ntwist" data-for="{n["id"]}" aria-expanded="false" '
                 f'aria-controls="kids-{n["id"]}" '
                 f'aria-label="Show sections under {esc(n["title"])}">{CARET}</button>'
                 if kids else '')
        out.append(
            f'<div class="nrow nlvl{lvl}" data-node="{n["id"]}">'
            f'{twist}'
            f'<a class="nlink" href="#/{n["id"]}" data-go="{n["id"]}">'
            f'<span class="ndot {st}" aria-hidden="true"></span>'
            f'<span class="lbl">{esc(n.get("short", n["title"]))}</span></a>'
            f'</div>')
        if kids:
            out.append(f'<div class="nkids" id="kids-{n["id"]}" hidden>'
                       + ''.join(rail_rows(n['id'], lvl + 1)) + '</div>')
    return out


def render_rail():
    total = len(NODES)
    live = sum(1 for n in NODES if n.get('status') == 'live')
    return f'''
<button class="railtoggle" id="rail-toggle" aria-label="Show project navigation" aria-controls="rail">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
</button>
<div class="scrim" id="scrim" aria-hidden="true"></div>
<div class="app">
<aside class="rail" id="rail" aria-label="Projects">
  <a class="railhead nlink" href="#/" data-go="home" style="border-radius:0">
    <span class="mark" aria-hidden="true">{HEART}</span>
    <span class="wm">{esc(SITE["wordmark"])}<span>{esc(SITE["wordmarkSub"])}</span></span>
  </a>
  <div class="railterm"><div class="t">{esc(BYLINE)}</div></div>
  <nav class="railnav">{''.join(rail_rows(None, 0))}</nav>
  <div class="railfoot">
    <span class="cnt">{live} of {total} pages written</span>
    <button class="themebtn" id="theme-btn" aria-label="Switch theme"></button>
  </div>
</aside>
<main class="main"><div class="wrap">'''


# ---------------------------------------------------------------- home
def card(n):
    st = n.get('status', 'awaiting')
    kids = KIDS.get(n['id'], [])
    if n.get('blurb'):
        blurb = f'<div class="bl">{esc(n["blurb"])}</div>'
    else:
        blurb = f'<div class="bl need"><b>Needs:</b> {esc(n.get("needs", ""))}</div>'
    chips = ('<div class="kids">' +
             ''.join(f'<span class="kidchip">{esc(k.get("short", k["title"]))}</span>'
                     for k in kids) + '</div>') if kids else ''
    # The card uses the short label: several titles are full questions, and a
    # three-line title beside a status pill reads as a cramped mess.
    #
    # The pill sits above the title rather than opposite it. Beside the title it
    # wrapped onto its own line for the longer names and stayed inline for the
    # short ones, so a row of cards disagreed with itself about its own layout.
    return (f'<a class="pcard" href="#/{n["id"]}" data-jump="{n["id"]}">'
            f'<span class="sp {st}"><i aria-hidden="true"></i>{STATUS_LABEL[st]}</span>'
            f'<div class="nm">{esc(n.get("short", n["title"]))}</div>'
            f'{blurb}{chips}'
            f'<div class="go">Open{ARROW}</div></a>')


def render_home():
    tops = KIDS.get(None, [])
    written = sum(1 for n in NODES if n.get('status') == 'live')
    return f'''
<div class="view" data-view="home">
  <div class="hometop">
    <p class="eyebrow-lg">{esc(BYLINE)}</p>
    <h1 class="homeh1">{esc(SITE["h1"])}</h1>
    <p class="homelede">{esc(SITE["lede"])}</p>
  </div>

  <div class="stats reveal" style="margin-top:34px">
    <div class="stat"><div class="k">Projects</div><div class="v" data-count="{len(tops)}">{len(tops)}</div><div class="d">workstreams</div></div>
    <div class="stat"><div class="k">Pages</div><div class="v" data-count="{len(NODES)}">{len(NODES)}</div><div class="d">including sub-questions</div></div>
    <div class="stat accent"><div class="k">Written up</div><div class="v" data-count="{written}">{written}</div><div class="d">the rest are scaffolded</div></div>
    <div class="stat"><div class="k">Accounts analysed</div><div class="v" data-count="3161">3,161</div><div class="d">in the benchmarking engine</div></div>
  </div>

  <h2>Projects</h2>
  <p class="sub">Each page follows the same five headings, so you can skim any project the same way. A page marked <b>Awaiting content</b> is a real page with its questions already laid out — it just has not been filled in yet.</p>
  <div class="cardgrid reveal">{''.join(card(n) for n in tops)}</div>

  <h2>How to keep this going</h2>
  <div class="card reveal">
    <p class="sub tight">Nothing here is hand-wired. The navigation, the cards above, the breadcrumbs and the router all read one file.</p>
    <div class="tw"><table>
      <thead><tr><th style="width:32%">To do this</th><th>Edit this</th></tr></thead>
      <tbody>
        <tr><td><b>Add a project</b></td><td>Append a node to <code>analysis/report/projects.json</code>. Set <code>parent</code> to nest it. It appears in the rail, on this page, and gets its own page with the standard headings.</td></tr>
        <tr><td><b>Write a page</b></td><td>Drop <code>analysis/report/projects/&lt;id&gt;.html</code> and set the node's <code>status</code> to <code>live</code>. The skeleton is replaced by your markup.</td></tr>
        <tr><td><b>Reorder</b></td><td>Change <code>order</code> on the node. Sorting is per parent.</td></tr>
        <tr><td><b>Rebuild</b></td><td><code>python analysis/report/build.py</code>. It refuses to write a page with unbalanced markup or an unknown parent.</td></tr>
      </tbody>
    </table></div>
  </div>
</div>'''


# ---------------------------------------------------------------- project pages
def render_phead(n):
    st = n.get('status', 'awaiting')
    crumbs = ['<a href="#/" data-jump="home">Home</a>']
    for a in trail(n):
        crumbs.append('<span class="sep">/</span>')
        crumbs.append(f'<a href="#/{a["id"]}" data-jump="{a["id"]}">{esc(a.get("short", a["title"]))}</a>')
    crumbs.append('<span class="sep">/</span>')
    crumbs.append(f'<span class="cur">{esc(n.get("short", n["title"]))}</span>')
    lede = (f'<p class="lede">{esc(n["lede"])}</p>' if n.get('lede')
            else (f'<p class="lede">{esc(n["blurb"])}</p>' if n.get('blurb') else ''))
    return (f'<div class="phead"><div class="crumb">{"".join(crumbs)}</div>'
            f'<div class="ptitle"><h1>{esc(n.get("h1", n["title"]))}</h1>'
            f'<span class="sp {st}"><i aria-hidden="true"></i>{STATUS_LABEL[st]}</span></div>'
            f'{lede}</div>')


def render_skeleton(n):
    kids = KIDS.get(n['id'], [])
    out = []
    if n.get('needs'):
        out.append('<div class="needbox"><div class="k">What this page needs</div>'
                   f'<p>{esc(n["needs"])}</p></div>')
    if kids:
        out.append('<h2>Inside this</h2>')
        out.append(f'<div class="cardgrid">{"".join(card(k) for k in kids)}</div>')
    # Every page answers the same five questions, whether or not it is written
    # yet. An empty heading is honest; an invented paragraph is not.
    out.append('<h2>The write-up</h2>')
    out.append('<p class="sub">These are the headings this page will use. They are '
               'deliberately visible while empty — a reader can tell at a glance what is '
               'missing rather than assuming the page is complete.</p>')
    out.append('<div class="card">' + ''.join(
        f'<div class="sk"><h3>{esc(t)}</h3><p>{esc(d)}</p></div>'
        for t, d in reg['sections']) + '</div>')
    return ''.join(out)


# Guides that are themselves standalone HTML apps get embedded rather than
# linked. Each one is base64'd into its own <script> payload and hydrated into a
# srcdoc iframe on first navigation (see shell.js). Two reasons for base64
# rather than inlining the markup: the guides contain their own </script> tags,
# which would terminate the payload early, and an iframe keeps their global CSS
# and JS from colliding with the shell's. Verified that inline script inside a
# srcdoc iframe still executes under the artifact's sandbox, which has
# allow-scripts but not allow-same-origin.
GUIDE_PAYLOADS = []


def guide_payload(n):
    f = n.get('embed')
    if not f:
        return
    p = os.path.join(HERE, 'guides', f)
    if not os.path.exists(p):
        sys.exit(f'projects.json: node {n["id"]} names missing guide file guides/{f}')
    raw = open(p, encoding='utf8').read()
    if 'googleapis' in raw or 'gstatic' in raw:
        sys.exit(f'guides/{f}: external font link would be blocked by the artifact CSP')
    b64 = base64.b64encode(raw.encode('utf8')).decode('ascii')
    GUIDE_PAYLOADS.append(
        f'<script type="application/x-guide" id="gsrc-{n["id"]}">{b64}</script>')
    return len(raw)


def render_view(n):
    inner = n.get('body')
    if inner == '__BENCHMARKING__':
        inner = body
    elif inner:
        p = os.path.join(HERE, 'projects', inner)
        if not os.path.exists(p):
            sys.exit(f'projects.json: node {n["id"]} names missing body file projects/{inner}')
        inner = open(p).read()
    else:
        cand = os.path.join(HERE, 'projects', n['id'] + '.html')
        inner = open(cand).read() if os.path.exists(cand) else render_skeleton(n)
    return (f'<div class="view" data-view="{n["id"]}" hidden>'
            + render_phead(n) + inner + '</div>')


footer = f'''
<footer>
  {esc(SITE["term"])} internship work by {esc(SITE["owner"])} · {esc(SITE["wordmark"])}.
  Benchmarking figures come from the book-of-business export snapshot of 2026-07-28
  (6,759 rows, 57 fields; 3,161 accounts eligible after screening).
  Engine, tests, methodology and this page: <code>analysis/</code> on
  <code>claude/advanced-statistical-analysis-jg1h09</code>.
</footer>
</div></main></div>'''

_embedded = {n['id']: guide_payload(n) for n in NODES if n.get('embed')}
markup = render_rail() + render_home() + ''.join(render_view(n) for n in NODES) + footer

# Every declared embed needs its placeholder on the page, and every placeholder
# needs a payload. Either half alone renders an empty panel.
for _id in _embedded:
    if f'data-guide="{_id}"' not in markup:
        sys.exit(f'markup: node {_id} declares an embed but its page has no '
                 f'<div class="gembed" data-guide="{_id}"> placeholder')
for _m in re.finditer(r'data-guide="([\w-]+)"', markup):
    if _m.group(1) not in _embedded:
        sys.exit(f'markup: gembed placeholder {_m.group(1)} has no embed in projects.json')

# Inject data. The methodology markup goes in as a JS string literal so it is
# rendered by the same code path as the charts it contains.
app = (app.replace('__RD__', rd)
          .replace('__EXTRA__', extra)
          .replace('__METHOD__', json.dumps(method)))
nav = [{'id': n['id'], 'title': n['title'], 'short': n.get('short', n['title']),
        'parent': n.get('parent'), 'status': n.get('status', 'awaiting')} for n in NODES]
nav.append({'id': 'home', 'title': SITE['title'], 'short': 'Home', 'parent': None,
            'status': 'live'})
shell = (shell.replace('__NODES__', json.dumps(nav, ensure_ascii=False))
              .replace('const NODES =', 'const SITE = ' +
                       json.dumps({'title': SITE['title'], 'wordmark': SITE['wordmark']},
                                  ensure_ascii=False) + ';\nconst NODES ='))

safe = lookup.replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
assert '</script>' not in safe

# A stray </div> once closed .wrap early and pushed two whole tabs outside the
# centered container. Nothing overflowed, so a scrollWidth check could not see
# it; only the nesting was wrong. Fail the build instead. Checked on the whole
# assembled markup now that build.py generates most of it.
_depth = 0
for _i, _line in enumerate(markup.split('\n'), 1):
    _depth += len(re.findall(r'<div\b', _line)) - len(re.findall(r'</div>', _line))
    if _depth < 0:
        sys.exit(f'markup: unbalanced </div> at line {_i} — content would escape .wrap')
if _depth != 0:
    sys.exit(f'markup: {_depth} unclosed <div> — check view nesting')

_wrap_at = markup.index('<div class="wrap">')
for _m in re.finditer(r'<div class="view" data-view="([\w-]+)"', markup):
    if _m.start() < _wrap_at:
        sys.exit(f'markup: view {_m.group(1)} sits before .wrap opens')
_views = re.findall(r'<div class="view" data-view="([\w-]+)"', markup)
if sorted(_views) != sorted([n['id'] for n in NODES] + ['home']):
    sys.exit(f'markup: view set does not match projects.json ({len(_views)} views, '
             f'{len(NODES) + 1} nodes)')
for _m in re.finditer(r'<div class="panel" id="(panel-[\w-]+)"', markup):
    if _m.start() < markup.index('<div class="view" data-view="benchmarking"'):
        sys.exit(f'markup: {_m.group(1)} sits outside the benchmarking view')

head = head.replace('__TITLE__', esc(SITE['title']))

out = (head + shcss + acss + markup
       + '<script type="application/json" id="lookup-data">' + safe + '</script>\n'
       + '\n'.join(GUIDE_PAYLOADS) + '\n'
       + '<script>\n' + app + '\n' + acct + '\n' + shell + '\n</script>\n')
out_path = os.environ.get('OUT', os.path.join(HERE, 'report.html'))
open(out_path, 'w').write(out)
print('wrote', out_path)
print('bytes:', len(out))
print(f'views: {len(_views)}  live: {sum(1 for n in NODES if n.get("status") == "live")}'
      f'  awaiting: {sum(1 for n in NODES if n.get("status") == "awaiting")}')
for _id, _n in _embedded.items():
    print(f'embedded guide: {_id} ({_n:,} bytes of HTML)')
