# Report UI

One published page holding every internship project. A left rail lists the
projects; each gets its own view. The benchmarking project is the one written
in full, and keeps its five sub-tabs: **How it works** (plain-language
walkthrough), **Findings** (high-level insights), **Cohorts** (peer-group
explorer), **Account** (per-organization scorecard, seller talk track, client
PNG export), and **Methodology** (technical review for the data team, including
an honest account of what was done poorly).

## Build

```bash
python build_lookup.py <export.csv> -o lookup_data.json   # from analysis/
python report/build.py                                    # writes report/report.html
```

`build.py` inlines everything — the page has no network access once published,
so all CSS, JS and data are embedded.

| File | Contents |
|---|---|
| `projects.json` | The project tree. Drives rail, home cards, breadcrumbs, router |
| `head.html` | Palette, layout, animation |
| `shell_css.html` | Rail, views, home cards, skeleton pages, mobile drawer |
| `account_css.html` | Account-tab styles, including presentation mode |
| `body.html` | The benchmarking view's five sub-tabs |
| `method.html` | Methodology tab copy |
| `projects/<id>.html` | Optional written body for a project page |
| `app.js` | Charts, cohort explorer, sub-tab machinery |
| `account.js` | Search, scorecard, talk track, peers, canvas PNG |
| `shell.js` | Hash router, rail behaviour, theme toggle |

## Adding a project

Append a node to `projects.json` — that is the whole task. The rail entry, the
home card, the breadcrumb trail, the route and a page with the five standard
headings are all generated from it. Set `parent` to nest it and `order` to
place it among its siblings.

To write the page, drop `projects/<id>.html` and flip `status` to `live`; the
skeleton is replaced by that markup. Until then the page shows its `needs`
text, so a reader can tell an empty page from a finished one at a glance —
which is the point. Never fill a skeleton with plausible-sounding filler.

`build.py` refuses to write the page if a node names an unknown parent, two
nodes share an id, the view set drifts from the node list, or the markup has an
unbalanced `</div>`.

## Palette

Categorical slots are validated with the dataviz validator in both modes rather
than eyeballed. Slot 1 is GoFundMe green, stepped per mode so it stays inside
the lightness band and clears 3:1 contrast on its own surface:

| | Light (`#fbfaf8`) | Dark (`#14120f`) |
|---|---|---|
| Brand / slot 1 | `#028046` | `#02a95c` |
| Slot 2 | `#2a78d6` | `#3987e5` |
| Slot 3 | `#eb6834` | `#d95926` |
| Slot 4 | `#4a3aa7` | `#9085e9` |

Worst adjacent CVD ΔE 21.9 light / 23.2 dark; normal-vision 23.4 / 25.2; all
slots ≥ 3:1 against their surface. Raw GoFundMe green `#02a95c` measures 2.99:1
on the light surface, which is why light mode uses the darker `#028046` step.

## Two things worth knowing before editing

**Presentation mode is a client-safety feature, not a display tweak.** Anything
carrying another customer's name is marked `.hide-in-present`, and the
disclosures holding the peer roster are force-closed rather than merely hidden.
The hero also swaps internal status wording ("Underperforming") for client
wording ("Room to grow"). If you add a surface that shows peer data, mark it.

**The PNG is drawn on a canvas, not rasterised from the DOM.** A published page
has no network access, so an external screenshot library is not an option — and
hand-drawing guarantees no peer name can leak into a file a seller emails to a
client. Canvas height is measured from content; a fixed height either left a
third of the image empty or clipped a long name.

**The PNG hands off through a modal, not `a.download`.** A published artifact
runs inside a sandboxed iframe, and when that sandbox omits `allow-downloads` a
programmatic `a.download` click is dropped with no error and no download — the
seller sees a button that does nothing. `canvas.toBlob` compounds it: the
callback fires after the click's user-activation window has closed, so even a
permissive sandbox may refuse the download. Both are avoided by generating the
image synchronously with `toDataURL` and showing it in a modal that offers three
independent paths — Save PNG (works when downloads are allowed), Copy image
(clipboard, works when they are not), and right-click / long-press on the
rendered `<img>` (always works). Verified in a sandbox with downloads denied.

**The rail is hidden in presentation mode.** It lists the internal project tree
— hackathon, corporate strategy, unfinished guides — which is not something to
put on a customer's screen during a screen-share. The shell's present-mode rules
drop the rail, the mobile toggle, the breadcrumb and the page's status pill, and
collapse the grid to a single column so the account view runs full width.

**`.railhead` needs a two-class selector.** It is both the brand block and a
`.nlink`, and `.nlink` carries `flex:1`. At equal specificity the later rule
wins, so a plain `.railhead{flex:none}` lost — and the brand block stretched
down the entire rail, parking the logo halfway down the page. Hence
`.railhead.nlink`.
