---
name: concept-playground-authoring
description: "Author or update self-contained Concept Playground interactive HTML pages for the mwc360.github.io blog, including the hidden detail page, playground catalog card, and optional article embed. Use when creating a browser-based simulator, explainer, visualization, or interactive learning tool for this blog."
---

# Concept Playground Authoring

Create accessible, responsive, self-contained HTML artifacts for this repository. Do not add frameworks, dependencies, remote assets, analytics, or unrelated setup.

Inspect these files before editing:

- `_includes/interactive.html`
- `assets/js/code-blocks.js`
- An existing root playground HTML file
- Its hidden `pages/*.md` detail page
- `pages/concept-playground.md`

## Deliverables

1. Put the standalone artifact at the repository root as `<slug>.html`.
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

## Mandatory Clawpilot variables

Copy this block exactly:

```css
:root {
  color-scheme: light;
  --cp-bg: #f7f4ef;
  --cp-bg-elevated: #fcfbf8;
  --cp-surface: #ffffff;
  --cp-surface-soft: #f5f5f5;
  --cp-border: #dedede;
  --cp-border-strong: #919191;
  --cp-text: #242424;
  --cp-text-muted: #5c5c5c;
  --cp-text-soft: #6f6f6f;
  --cp-accent: #b11f4b;
  --cp-accent-hover: #9a1a41;
  --cp-accent-soft: rgba(177, 31, 75, 0.08);
  --cp-accent-fg: #ffffff;
  --cp-success: #16a34a;
  --cp-danger: #dc2626;
  --cp-warning: #f59e0b;
  --cp-link: #0078d4;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
  --cp-overlay: rgba(255, 255, 255, 0.8);
  --cp-panel: rgba(255, 255, 255, 0.86);
  --cp-panel-strong: rgba(255, 255, 255, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.55);
  --cp-highlight: rgba(177, 31, 75, 0.12);
}
html[data-theme="dark"] {
  color-scheme: dark;
  --cp-bg: #3d3b3a;
  --cp-bg-elevated: #343231;
  --cp-surface: #292929;
  --cp-surface-soft: #2e2e2e;
  --cp-border: #474747;
  --cp-border-strong: #5f5f5f;
  --cp-text: #dedede;
  --cp-text-muted: #919191;
  --cp-text-soft: #b0b0b0;
  --cp-accent: #fd8ea1;
  --cp-accent-hover: #fb7b91;
  --cp-accent-soft: rgba(253, 142, 161, 0.14);
  --cp-accent-fg: #1a1a1a;
  --cp-success: #4ade80;
  --cp-danger: #f87171;
  --cp-warning: #fbbf24;
  --cp-link: #4da6ff;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
  --cp-overlay: rgba(41, 41, 41, 0.88);
  --cp-panel: rgba(41, 41, 41, 0.72);
  --cp-panel-strong: rgba(41, 41, 41, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.04);
  --cp-highlight: rgba(253, 142, 161, 0.12);
}
```

Follow it with the blog's GitHub Dark neutral override:

```css
html[data-theme="dark"] {
  --cp-bg: #0d1117;
  --cp-bg-elevated: #161b22;
  --cp-surface: #161b22;
  --cp-surface-soft: #21262d;
  --cp-border: #30363d;
  --cp-border-strong: #484f58;
  --cp-text: #c9d1d9;
  --cp-text-muted: #8b949e;
  --cp-text-soft: #8b949e;
  --cp-overlay: rgba(13, 17, 23, 0.88);
  --cp-panel: rgba(22, 27, 34, 0.72);
  --cp-panel-strong: rgba(22, 27, 34, 0.96);
}
```

## Styling contract

- Standalone `body` uses `background: var(--cp-surface)`.
- Embedded mode uses a transparent background, hides duplicate `h1` and subtitle, removes outer padding, and sets `overflow: hidden` on `html` and `body`.
- Component colors must use `var(--cp-*)` — including SVG `stroke`/`fill` on charts. The only literal colors allowed are inside the mandatory `:root`/dark variable blocks.
- Controls, links, focus rings, and selected states use `var(--cp-link)` blue.
- Destructive actions, full rewrites, and latency/cost states use `var(--cp-danger)` red.
- Healthy/positive states may use `var(--cp-success)` green (e.g. right-sized files, low-cost outcomes).
- `var(--cp-warning)` amber suits threshold/trigger markers.
- Use `"Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif`.
- Use `Consolas, "Courier New", Courier, monospace` for code and numeric/config labels.
- Use responsive grids, wrapping controls, ~10px control radii, and 16px card radii.

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
- `footer` with a border-top, a Microsoft Learn source link, and a **required attribution byline** so embedders always credit the author: `<p class="byline">Created by <a href="https://milescole.dev" target="_blank" rel="noopener noreferrer">Miles Cole</a> &middot; <a href="https://milescole.dev" target="_blank" rel="noopener noreferrer">milescole.dev</a></p>` styled with `.byline{margin:.75rem 0 0;color:var(--cp-text-muted);font-weight:600}`. The footer must stay visible in embedded mode (do not hide it) since these pages are meant to be embedded elsewhere.

## Modeling and content quality

- **Ground behavior in Microsoft Fabric Learn docs** and link the exact page in the footer. Represent the real mechanism accurately (e.g. a deletion-vector `.bin` stores a RoaringBitmap of *deleted row positions* per linked Parquet file, not a 0/1 per row; auto compaction runs synchronously after a qualifying write; liquid clustering only applies at `OPTIMIZE`).
- Prefer **fixed side-by-side scenarios** over on/off toggles when contrasting two behaviors, and apply every user action **identically** to all compared scenarios so differences are attributable to the mechanism, not the input.
- Keep models **deterministic and illustrative**. State any latency/size formulas inline and label them "illustrative — not measured performance."
- Choose metrics that reveal the *tradeoff over time* (e.g. fragmentation between maintenance runs, where latency is paid), not just a single end-state. Avoid a single contrived "winner" score.
- Pair every chart with a text-alternative data table in a `<details>` element.
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
{% include interactive.html src="/<slug>.html?embedded=1" open_src="/<slug>.html" title="<descriptive title>" height="1200" class="playground-embed" %}
```

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
   $html=[IO.File]::ReadAllText('<slug>.html'); $s=[regex]::Matches($html,'(?s)<script>(.*?)</script>'); $c=($s|%{$_.Groups[1].Value}) -join "`n"; [IO.File]::WriteAllText("$env:TEMP\pg.check.js",$c); node --check "$env:TEMP\pg.check.js"
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
