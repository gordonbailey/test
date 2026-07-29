# Written project pages

Drop `<node-id>.html` here to replace a page's generated skeleton, then set that
node's `status` to `live` in `../projects.json`.

The file is inlined into the page's view, immediately after the generated
breadcrumb and title block — so start at `<h2>`, not `<h1>`, and do not open a
container of your own. Every class in `head.html` is available: `.card`,
`.stats`/`.stat`, `.bars`/`.bar`, `.note`, `.pill`, `.tw` for a scrollable
table, `.reveal` to fade a block in on scroll, `.grid2`/`.grid3`.

Two rules the build enforces: `<div>`s must balance, and there is no network
access on the published page — no CDN links, no remote images. Embed images as
`data:` URIs.
