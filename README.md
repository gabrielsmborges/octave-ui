# octave-ui

Variant screenshots for the Octave UI design system, referenced from the Octave UI ADR on Notion.

PNGs are organized by platform/category/primitive:

```
{platform}/{category}/{primitive}/{variant}-{state}.png
```

For example:

```
web/primitives/button/primary-md.png
web/primitives/button/secondary-md-hover.png
app/primitives/dialog/sheet-default.png
web/brand/logo/wordmark-light.png
```

## Embedding in Notion

Variants are embedded into the Notion ADR via `raw.githubusercontent.com` URLs:

```
https://raw.githubusercontent.com/gabrielsmborges/octave-ui/main/web/primitives/button/primary-md.png
```

The repo is public so these URLs work without authentication.

## Render harness

`tools/render-variant.mjs` is a small Playwright-based headless renderer that
turns an HTML snippet into a tightly-cropped PNG using Mozart's design tokens
(Tailwind colours, fonts, CSS variables).

See `tools/README.md` (or run `node tools/render-variant.mjs --help`) for usage.

## Repo layout

```
.
├── README.md
├── .gitignore
├── tools/
│   ├── render-variant.mjs    # Playwright render script
│   ├── harness.html          # HTML harness with Mozart tokens
│   └── package.json          # Playwright dependency
├── web/
│   ├── primitives/           # Web UI primitives (button, input, dialog, ...)
│   └── brand/                # Web brand assets (logo, wordmark, ...)
└── app/
    ├── primitives/           # Mobile UI primitives
    └── brand/                # Mobile brand assets
```
