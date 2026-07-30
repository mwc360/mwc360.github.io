---
name: concept-playground-authoring
description: "Author or update self-contained Concept Playground interactive HTML pages for the mwc360.github.io blog, including the hidden detail page, playground catalog card, and optional article embed. Use when creating a browser-based simulator, explainer, visualization, or interactive learning tool for this blog."
---

# Concept Playground Authoring

Create accessible, responsive, self-contained HTML artifacts for this repository. Do not add frameworks, dependencies, remote assets, analytics, or unrelated setup.

Inspect these files before editing:

- `_includes/interactive.html`
- `assets/js/code-blocks.js`
- An existing playground HTML file in `assets/playgrounds/`
- Its hidden `pages/*.md` detail page
- `pages/concept-playground.md`

## Deliverables

1. Put the standalone artifact in `assets/playgrounds/` as `<slug>.html`.
2. Add `pages/<slug>.md` with `layout: page`, `hide: true`, and permalink `/playground/<slug>/`.
3. Add a matching gallery card to `pages/concept-playground.md`.
4. Optionally embed the same artifact in a related article.

The HTML file must contain all required CSS and JavaScript and work standalone and in the sandboxed iframe.

## Required document head

Place this exact theme detection script before any other JavaScript:

```html
<script>
  (() => {
    const param = new URLSearchParams(window.location.search).get("scoutTheme");
    const theme =
      param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();
</script>
```

Enable embedded mode before first paint:

```html
<script>
  if (new URLSearchParams(window.location.search).get("embedded") === "1") {
    document.documentElement.classList.add("is-embedded");
  }
</script>
```

Support live theme changes:

```html
<script>
  window.addEventListener("message", (event) => {
    if (event.data?.type === "scout-theme" && ["light", "dark"].includes(event.data.theme)) {
      document.documentElement.setAttribute("data-theme", event.data.theme);
    }
  });
</script>
```

## Mandatory theme variables

These mirror `_sass/base/_variables.scss` so the artifact reads as part of the blog, not as an
embedded stranger. Copy this block exactly and change nothing:

```css
:root {
  color-scheme: light;
  --cp-font: "Source Sans 3", "Segoe UI", Helvetica, Arial, sans-serif;
  --cp-mono: Consolas, Menlo, Monaco, "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Courier New", monospace;
  --cp-bg: #ffffff;
  --cp-bg-elevated: #f6f8fa;
  --cp-surface: #ffffff;
  --cp-surface-soft: #f6f8fa;
  --cp-border: rgba(0, 0, 0, 0.2);
  --cp-border-strong: #afb8c1;
  --cp-text: #262626;
  --cp-text-muted: #595959;
  --cp-text-soft: #6e7781;
  --cp-accent: #0969da;
  --cp-accent-hover: #0550ae;
  --cp-accent-soft: rgba(9, 105, 218, 0.08);
  --cp-accent-fg: #ffffff;
  --cp-success: #1a7f37;
  --cp-danger: #cf222e;
  --cp-danger-soft: #ffebe9;
  --cp-warning: #9a6700;
  --cp-warning-soft: #fff8c5;
  --cp-link: #0969da;
  --cp-link-soft: rgba(9, 105, 218, 0.12);
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.1);
  --cp-shadow-soft: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --cp-overlay: rgba(255, 255, 255, 0.8);
  --cp-panel: rgba(255, 255, 255, 0.86);
  --cp-panel-strong: rgba(255, 255, 255, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.55);
  --cp-highlight: #ffebe9;
}
html[data-theme="dark"] {
  color-scheme: dark;
  --cp-bg: #0d1117;
  --cp-bg-elevated: #161b22;
  --cp-surface: #161b22;
  --cp-surface-soft: #21262d;
  --cp-border: #30363d;
  --cp-border-strong: #484f58;
  --cp-text: #c9d1d9;
  --cp-text-muted: #8b949e;
  --cp-text-soft: #8b949e;
  --cp-accent: #58a6ff;
  --cp-accent-hover: #79c0ff;
  --cp-accent-soft: rgba(88, 166, 255, 0.14);
  --cp-accent-fg: #0d1117;
  --cp-success: #3fb950;
  --cp-danger: #ff7b72;
  --cp-danger-soft: rgba(248, 81, 73, 0.15);
  --cp-warning: #d29922;
  --cp-warning-soft: rgba(187, 128, 9, 0.25);
  --cp-link: #58a6ff;
  --cp-link-soft: rgba(88, 166, 255, 0.15);
  --cp-shadow: 0 18px 48px rgba(1, 4, 9, 0.6);
  --cp-shadow-soft: 0 1px 3px rgba(1, 4, 9, 0.5), 0 1px 2px rgba(1, 4, 9, 0.4);
  --cp-overlay: rgba(13, 17, 23, 0.88);
  --cp-panel: rgba(22, 27, 34, 0.72);
  --cp-panel-strong: rgba(22, 27, 34, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.04);
  --cp-highlight: rgba(248, 81, 73, 0.15);
}
```

### Site typeface

The blog self-hosts Source Sans 3 at `/assets/fonts/source-sans-3/SourceSans3-Latin.woff2`.
The embed iframe is sandboxed **without** `allow-same-origin`, so it has an opaque origin and
**cannot** fetch that file (the request fails CORS). Inline the font as a `data:` URI in the
`@font-face` — verified to load in both standalone and sandboxed contexts. Never link the font by
URL. Place it immediately above `:root`:

```css
@font-face{font-family:"Source Sans 3";font-style:normal;font-weight:200 900;font-display:swap;src:url(data:font/woff2;base64,<base64 of assets/fonts/source-sans-3/SourceSans3-Latin.woff2>) format("woff2")}
```

Generate the payload with:

```bash
node -e "console.log(require('fs').readFileSync('assets/fonts/source-sans-3/SourceSans3-Latin.woff2').toString('base64'))"
```

## Mandatory typography preamble

Copy this immediately after the variable blocks:

```css
*{box-sizing:border-box}
::selection{background:var(--cp-link);color:#ffffff}
html{background:var(--cp-bg)}
body{margin:0;background:var(--cp-bg);color:var(--cp-text);font:1.125rem/1.65 var(--cp-font);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.wrap{max-width:960px;margin:0 auto;padding:2.5rem 1.25rem 2rem}
.is-embedded,.is-embedded body{overflow:hidden;background:transparent}
.is-embedded .wrap{padding:.25rem 0 .5rem;max-width:none}
.is-embedded.with-context .wrap{padding-top:0}
.is-embedded h1,.is-embedded h1+.sub{display:none}
.is-embedded.with-context h1,.is-embedded.with-context h1+.sub{display:block}
h1,h2,h3{line-height:1.3;font-weight:700;color:var(--cp-text)}
h1{font-size:2.3em;margin:0 0 .25rem}
h2{font-size:1.75em;margin:2.5rem 0 .35rem}
h3{font-size:1.15em;margin:0}
p{margin-top:0}
a{color:var(--cp-link);text-decoration:none}
a:hover{text-decoration:underline}
.sub,.muted{color:var(--cp-text-muted)}
.muted{font-size:.8125rem}
.sub{color:var(--cp-text);font-size:1em;line-height:1.7;margin:0 0 1.25rem}
code,.mono,.cfg .name{font-family:var(--cp-mono)}
@media screen and (max-width:768px){h1{font-size:2em}h2{font-size:1.5em}.sub,.note,.cfg-note{font-size:.8em}}
```

Prose (`.sub`, `.note`, `.cfg-note`) is body copy: it must use `var(--cp-text)` at `1em`/`1.7`. Reserve
`var(--cp-text-muted)` for genuinely secondary chrome — captions, unit labels, badges, and hints.

Headings are `700`, matching the site (`_sass/base/_global.scss`). Callout blocks (`.note`) mirror the
site blockquote idiom — `border-left:2px solid var(--cp-link)` over a `var(--cp-link-soft)` wash, never a
box with a full border. Cards carry `var(--cp-shadow-soft)`; never pass `var(--cp-border)` to
`box-shadow` (it is a border color and renders as a muddy halo).

> The `p, li, td { font-size: 0.8em }` rules in `_sass/base/_global.scss` live **inside**
> `@media (max-width: 768px)` / `(max-width: 576px)`. They are mobile-only. Desktop site prose is
> `1.125rem` (18px) at `line-height: 1.7`. When measuring with CDP, always call
> `Emulation.setDeviceMetricsOverride` first — a default tab reports the mobile sizes and will lead
> you to size the artifact 20% too small.

## Styling contract

- Standalone `html`/`body` use `background: var(--cp-bg)` so the page matches the site background.
- Embedded mode uses a transparent background, hides duplicate `h1` and subtitle, removes outer padding, and sets `overflow: hidden` on `html` and `body`.

### Keep the author credit on third-party embeds

The `.byline` credit is only redundant when the playground is embedded in milescole.dev, where the
host article already carries attribution. On any other site it must stay visible. Gate it on the
referrer rather than on `is-embedded` alone, in the same boot script that sets `is-embedded`:

```js
var OWN = /^(?:(?:www\.)?milescole\.dev|mwc360\.github\.io|localhost|127\.0\.0\.1)$/i;
var host = "";
try { host = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { host = ""; }
if (window.parent !== window && host && OWN.test(host)) {
  document.documentElement.classList.add("is-own-host");
}
```

```css
.is-embedded.is-own-host .byline{display:none}
```

Fail open: an empty, unparseable, or unrecognised referrer must leave the credit **visible**.
`document.referrer` is populated inside the sandboxed iframe even though it has an opaque origin
(verified via CDP), so this works despite the missing `allow-same-origin`.
- Component colors must use `var(--cp-*)` — including SVG `stroke`/`fill` on charts. The only literal colors allowed are inside the mandatory `:root`/dark variable blocks.
- Controls, links, focus rings, and selected states use `var(--cp-link)` blue.
- Destructive actions, full rewrites, and latency/cost states use `var(--cp-danger)` red.

### State backgrounds must match their border colour

Blue means "selected / clustered / healthy". Never use a blue wash behind an amber or red border —
it inverts the meaning. Pair the soft background with its own base colour:

| State | Background | Border/text |
| --- | --- | --- |
| Healthy, clustered, compacted | `var(--cp-surface-soft)` | `var(--cp-success)` |
| Unclustered, small, pending compaction | `var(--cp-warning-soft)` | `var(--cp-warning)` |
| Deleted, rewritten, small-file debt | `var(--cp-highlight)` (red wash) | `var(--cp-danger)` |
| Selected / active control | `var(--cp-accent-soft)` | `var(--cp-link)` |
- Healthy/positive states may use `var(--cp-success)` green (e.g. right-sized files, low-cost outcomes).
- `var(--cp-warning)` amber suits threshold/trigger markers.
- Use `var(--cp-font)` for text and `var(--cp-mono)` for code. Never restate a raw font stack.
- Match site typography: `body` is `1.125rem/1.65`, `h1` `2.3em`, `h2` `1.75em`, `h3` `1.15em`, all headings `line-height: 1.3`. Keep dense UI chrome (badges, tiles, tick labels) on explicit small `rem`/`px` sizes.
- Use responsive grids, wrapping controls, ~10px control radii, 16px card radii, and a `960px` `.wrap` max-width to match `.post-content`.

## Code cells must match the blog's markdown code blocks

Every enablement snippet renders as a `.cfg-block` that is a visual clone of a Rouge-highlighted
markdown block on the site (`_sass/base/_highlight.scss` + `assets/js/code-blocks.js`). Authors write
plain source; JavaScript builds the chrome at runtime.

Author it as:

```html
<div class="cfg-block" data-lang="python" data-label="PySpark">
  <pre><code># plain, unescaped source — no spans, no line numbers
spark.conf.set("spark.databricks.delta.autoCompact.enabled", "true")</code></pre>
</div>
```

`data-lang` is the tokenizer key (`python` or `sql`); `data-label` is the toolbar caption.
The `cfgEnhance` bootstrap replaces the block with a header (uppercase language + icon-only copy
button using GitHub's own clipboard/check SVGs) and a two-cell `table.cfg-table` — a `td.cfg-gutter`
of line numbers and a `td.cfg-code` of highlighted source.

Non-negotiables, because these are what make it read as the same component:

- Code cells are **always dark**, in both themes. The site hardcodes `--base00: #0d1117` on
  `div.highlighter-rouge` with no light override, so a light-mode code cell would be wrong.
- Declare the GitHub Dark `--base00`…`--base0e` palette on `.cfg-block` and drive every token colour
  from it. This is the one place literal hex outside the `:root` blocks is expected.
- Metrics that must match exactly: block `font-size: .85em` / `line-height: 1.3em`, `border: 1px solid #30363d`,
  `border-radius: 6px`; toolbar `min-height: 2.5em`, `padding: 0 .75em 0 1em`, `background: var(--base01)`;
  language label `.78em`/600/uppercase/`var(--base03)`; copy button `2em` square on `#21262d`,
  `#238636`/`#7ee787` when `data-copied="true"`; gutter `padding: 0 1em 0 .85em`, `var(--base04)`,
  `border-right: 1px solid #30363d`; code cell `padding-left: 1em`; both `pre` at `.85em 0`.
- Write gutter/code rules as `.cfg-table td.cfg-gutter`, **not** `.cfg-gutter`. The reset
  `.cfg-table td{padding:0;border:0}` has higher specificity than a bare class and will silently
  swallow the divider and padding.
- Use `table-layout: fixed` with the gutter width set inline to `calc(1.85em + <digits>ch)` so the
  code cell's own `overflow: auto` engages instead of widening the page at 320px.
- Copy must copy the **raw source only** — never the line numbers. Keep the original text in a
  closure; do not read it back out of the rendered gutter/code table.

Verify parity by measuring `div.highlighter-rouge` on a real post and the artifact's `.cfg-block`
with `getComputedStyle`; background, colour, font-size, line-height, border and radius should be
identical on both.

## Layout and visual conventions (match the blog theme)

`incremental-liquid-clustering.html` is the canonical style reference — new playgrounds should look like it, not like a generic dashboard. Reuse this class vocabulary and structure:

- `.wrap{max-width:840–900px;margin:0 auto;padding:2.5rem 1.25rem 4rem}` — the single centered column.
- Headings: `h1` 26px/600; `h2` 19px/600 with `margin:2.5rem 0 4px`; `.sub` is the muted 14px lead paragraph under each heading.
- **Buttons are neutral, not solid-filled.** Base: `background:var(--cp-surface);border:1px solid var(--cp-border);color:var(--cp-text);border-radius:0.625rem`. Hover turns blue: `background:var(--cp-surface-soft);border-color:var(--cp-link);color:var(--cp-link)`. Add `.primary` (blue border/text) for the main action and an `.optimize`/destructive modifier that hovers to `var(--cp-danger)`. Do **not** use permanently blue-filled buttons.
- `.toolbar{display:flex;gap:10px;flex-wrap:wrap}` with a `.push{margin-left:auto}` helper to right-align Reset.
- `.card{background:var(--cp-surface);border:1px solid var(--cp-border);border-radius:16px;padding:1rem 1.25rem;box-shadow:0 0 2px var(--cp-border),0 1px 2px var(--cp-border)}`; use `.card.hi{border:2px solid var(--cp-link)}` to highlight the "recommended"/featured side of a comparison.
- `.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}` for side-by-side comparisons — it collapses to one column on narrow screens automatically.
- Sliders as config cards: `.cfg` card with a `.row` holding `.name` (config label) + `.cur` (live current value), then `<input type="range">`, then a `.hint`. Mirror real config names in `mono` (e.g. `autoCompact.minNumFiles`). Update `.cur` live on `input`.
- Metric tiles: `.stat` (`.lbl` + `.val`) grouped in a `.statgrid`. Put a few core metrics up top per scenario; keep the exhaustive metric set in a separate Summary section.
- `.legend` + `.sw` swatches to explain every visual encoding; never rely on color alone.
- `.msg` muted status line (with `aria-live="polite"`) describing the latest action.
- `footer` with a border-top, a Microsoft Learn source link, and a **required attribution byline** so embedders always credit the author: `<p class="byline">Created by Miles Cole &middot; <a href="https://milescole.dev" target="_blank" rel="noopener noreferrer">milescole.dev</a></p>` styled with `.byline{margin:.75rem 0 0;color:var(--cp-text-muted);font-weight:600}`. The footer must stay visible in embedded mode (do not hide it) since these pages are meant to be embedded elsewhere.

## Modeling and content quality

- **Ground behavior in Microsoft Fabric Learn docs** and link the exact page in the footer. Represent the real mechanism accurately (e.g. a deletion-vector `.bin` stores a RoaringBitmap of *deleted row positions* per linked Parquet file, not a 0/1 per row; auto compaction runs synchronously after a qualifying write; liquid clustering only applies at `OPTIMIZE`).
- Prefer **fixed side-by-side scenarios** over on/off toggles when contrasting two behaviors, and apply every user action **identically** to all compared scenarios so differences are attributable to the mechanism, not the input.
- Keep models **deterministic and illustrative**. State any latency/size formulas inline and label them "illustrative — not measured performance."
- Choose metrics that reveal the *tradeoff over time* (e.g. fragmentation between maintenance runs, where latency is paid), not just a single end-state. Avoid a single contrived "winner" score.
- Give every chart a built-in text alternative: `role="img"` plus `aria-labelledby` pointing at an SVG
  `<title>`/`<desc>` that is **regenerated on each render** so it describes the current data, and a
  `<title>` inside each bar/point for on-hover detail. Do not add a `<details>` "Show data table"
  companion — it duplicates the chart, adds layout noise, and drifts out of sync.
- Make the domain obvious in labels (e.g. name the objects "Delta table", show real config keys).

## Accessibility

- Use semantic controls and labels.
- Make every interaction keyboard operable.
- Add visible `:focus-visible` styles.
- Use `aria-live="polite"` for meaningful simulation results.
- Do not rely on color alone.
- Respect `prefers-reduced-motion`.
- Avoid horizontal overflow at 320px.

## Embed contract

```liquid
{% include interactive.html src="/assets/playgrounds/<slug>.html?embedded=1" open_src="/assets/playgrounds/<slug>.html" title="<descriptive title>" height="1200" class="playground-embed" %}
```

### Outbound links

The embed sandbox is `allow-scripts allow-forms allow-popups allow-downloads` — it deliberately omits
`allow-top-navigation`. A link without a target therefore navigates the **iframe itself**, and most
external sites (Microsoft Learn included) send `X-Frame-Options`/`frame-ancestors` and render a
"refused to connect" error in place of the artifact.

Put this in the `<head>` of every artifact so a forgotten attribute can't reintroduce the bug:

```html
<!-- Sandboxed iframe has no allow-top-navigation; external links must open a new tab. -->
<base target="_blank">
```

Still write `target="_blank" rel="noopener noreferrer"` explicitly on each external anchor. Artifacts
must not use same-page `href="#..."` anchors, since `<base target="_blank">` would open those in a new
tab as well.

Report height after load and content changes:

```html
<script>
  function reportHeight() {
    if (window.parent === window) return;
    window.parent.postMessage({
      type: "interactive-resize",
      height: document.documentElement.scrollHeight
    }, "*");
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(reportHeight).observe(document.body);
  }
  window.addEventListener("load", reportHeight);
</script>
```

## Detail page and gallery card

`pages/<slug>.md` front matter: `layout: page`, `title`, `description`, `permalink: /playground/<slug>/`, `hide: true`, then a short intro paragraph, the `interactive.html` include, and a Microsoft Learn reference link. Append a `.playground-card` to `pages/concept-playground.md` mirroring the existing cards (visual, `h2`, one-line description, two topic tags, and a launch link to `/playground/<slug>/`). Reuse the existing card markup and styles in `_sass/base/_global.scss`; only add a small visual modifier if genuinely needed.

## Validation

Run these before claiming completion. Concrete harness that works in this repo:

1. **Inline script syntax:** extract every `<script>` body into one temp `.js` and run `node --check`. PowerShell:
   ```powershell
   $html=[IO.File]::ReadAllText('assets/playgrounds/<slug>.html'); $s=[regex]::Matches($html,'(?s)<script>(.*?)</script>'); $c=($s|%{$_.Groups[1].Value}) -join "`n"; [IO.File]::WriteAllText("$env:TEMP\pg.check.js",$c); node --check "$env:TEMP\pg.check.js"
   ```
2. **Color audit:** strip the three mandatory variable blocks, then confirm no `#hex`/`rgb(a)` remains in component CSS (charts included).
3. **Jekyll 4 build:** `bundle exec jekyll build --future --destination _site-check` (repo's normal bundle). Delete the scratch output after.
4. **GitHub Pages 232 build:** run against an isolated Bundler profile pinned to `gem "github-pages", "232"` — do **not** touch the repo Gemfile/lockfile:
   ```powershell
   $env:BUNDLE_GEMFILE='<path>\Gemfile.pages'; bundle exec github-pages build --source . --destination _site-pages-check --future
   ```
   Remove the temporary profile and scratch output afterward.
5. **Browser behavior (headless Edge + CDP):** launch `msedge.exe --headless=new --remote-debugging-port=9222 --user-data-dir=<tmp>`, then drive pages over the DevTools WebSocket (`PUT /json/new?<url>`, `Runtime.evaluate`). Assert: `data-theme` honors `?scoutTheme=`, `is-embedded` when `?embedded=1`, duplicate `h1` hidden in embed, core interactions/keyboard work, selected states blue, destructive/rewrite red, healthy green, and `document.documentElement.scrollWidth <= clientWidth` at 320–360px via `Emulation.setDeviceMetricsOverride`.
6. Verify iframe resizing has no scrollbar/background flash and no clipping after `ResizeObserver` updates.
7. Confirm the include uses `scout-theme` / `{type:"interactive-resize",height:...}` messages and has `src`, `open_src`, descriptive `title`, generous initial `height`, and `class="playground-embed"`.

Do not claim completion if either build fails or the embed clips, scrolls, flashes, or loses keyboard functionality.
