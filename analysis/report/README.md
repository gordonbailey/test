# Report UI

The published page. Four tabs: **How it works** (plain-language walkthrough),
**Findings** (high-level insights plus the cohort explorer), **Account**
(per-organization scorecard, seller talk track, client PNG export), and
**Methodology** (technical review for the data team, including an honest
account of what was done poorly).

## Build

```bash
python build_lookup.py <export.csv> -o lookup_data.json   # from analysis/
python report/build.py                                    # writes report/report.html
```

`build.py` inlines everything — the page has no network access once published,
so all CSS, JS and data are embedded.

| File | Contents |
|---|---|
| `head.html` | Palette, layout, animation |
| `account_css.html` | Account-tab styles, including presentation mode |
| `body.html` | Markup for all four tabs |
| `method.html` | Methodology tab copy |
| `app.js` | Charts, cohort explorer, tab machinery |
| `account.js` | Search, scorecard, talk track, peers, canvas PNG |

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
