#!/usr/bin/env node
// Headless Playwright render harness for octave-ui variant screenshots.
//
// Usage:
//   node tools/render-variant.mjs \
//     --html '<button class="...">Click me</button>' \
//     --out web/primitives/button/primary-md.png \
//     --width 200 --height 60 --bg transparent
//
// Or with a file source (useful for longer HTML):
//   node tools/render-variant.mjs \
//     --html-file path/to/snippet.html \
//     --out web/primitives/dialog/default.png \
//     --width 480 --height 320 --bg dark
//
// Flags:
//   --html <string>       HTML snippet to render.
//   --html-file <path>    File containing the HTML snippet (UTF-8).
//   --out <path>          Output PNG path (relative paths resolve to repo root).
//   --width <int>         Viewport width (default 400).
//   --height <int>        Viewport height (default 200).
//   --bg <transparent|dark>  Background mode (default dark).
//   --settle <ms>         Extra settle delay after fonts load (default 200).
//   --help                Print usage.
//
// The script looks for [data-variant-root] inside [data-content] and
// screenshots that element (tight crop). If no [data-variant-root] is found,
// it screenshots the first child of [data-content].

import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const HARNESS_PATH = resolve(__dirname, "harness.html");

// ----- arg parsing ----------------------------------------------------------

function parseArgs(argv) {
  const out = {
    html: null,
    htmlFile: null,
    out: null,
    width: 400,
    height: 200,
    bg: "dark",
    settle: 200,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--html":
        out.html = next();
        break;
      case "--html-file":
        out.htmlFile = next();
        break;
      case "--out":
        out.out = next();
        break;
      case "--width":
        out.width = parseInt(next(), 10);
        break;
      case "--height":
        out.height = parseInt(next(), 10);
        break;
      case "--bg":
        out.bg = next();
        break;
      case "--settle":
        out.settle = parseInt(next(), 10);
        break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

function printHelp() {
  // The leading comment block of this file is the canonical usage doc.
  // Print it verbatim (minus the shebang) so --help mirrors source-of-truth.
  process.stdout.write(`octave-ui render-variant
  --html <string> | --html-file <path>
  --out <path>
  [--width <int>=400] [--height <int>=200]
  [--bg transparent|dark] [--settle <ms>=200]

Outputs a tightly-cropped PNG of the rendered HTML snippet using Mozart's
Tailwind tokens. See the file header for details.
`);
}

// ----- main -----------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.html && !args.htmlFile) {
    throw new Error("Must provide --html or --html-file");
  }
  if (!args.out) {
    throw new Error("Must provide --out");
  }
  if (!Number.isFinite(args.width) || args.width <= 0) {
    throw new Error("--width must be a positive integer");
  }
  if (!Number.isFinite(args.height) || args.height <= 0) {
    throw new Error("--height must be a positive integer");
  }
  if (args.bg !== "transparent" && args.bg !== "dark") {
    throw new Error("--bg must be 'transparent' or 'dark'");
  }

  const snippet = args.html
    ? args.html
    : await readFile(resolve(process.cwd(), args.htmlFile), "utf8");

  const harnessTemplate = await readFile(HARNESS_PATH, "utf8");
  const pageHtml = harnessTemplate
    .replace("<!--CONTENT-->", snippet)
    .replace('data-bg="dark"', `data-bg="${args.bg}"`);

  const outPath = isAbsolute(args.out)
    ? args.out
    : resolve(REPO_ROOT, args.out);
  await mkdir(dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let exitCode = 0;
  try {
    const context = await browser.newContext({
      viewport: { width: args.width, height: args.height },
      deviceScaleFactor: 2, // crisp PNGs for Notion embeds
    });
    const page = await context.newPage();

    // Use setContent with a baseURL so CDN scripts (Tailwind, fonts) resolve.
    await page.setContent(pageHtml, { waitUntil: "networkidle" });

    // Wait for fonts and Tailwind's runtime pass.
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });
    if (args.settle > 0) {
      await page.waitForTimeout(args.settle);
    }

    // Resolve the screenshot target.
    const target = await page.evaluateHandle(() => {
      const content = document.querySelector("[data-content]");
      if (!content) return null;
      const explicit = content.querySelector("[data-variant-root]");
      if (explicit) return explicit;
      return content.firstElementChild;
    });

    const element = target.asElement();
    if (!element) {
      throw new Error(
        "No screenshot target found. Add [data-variant-root] to your snippet or ensure it has a root element.",
      );
    }

    await element.screenshot({
      path: outPath,
      omitBackground: args.bg === "transparent",
    });

    // Write a tiny manifest next to the file? No -- keep the output minimal.
    process.stdout.write(`${outPath}\n`);
  } catch (err) {
    process.stderr.write(`render-variant failed: ${err.stack || err}\n`);
    exitCode = 1;
  } finally {
    await browser.close();
  }
  process.exit(exitCode);
}

main().catch((err) => {
  process.stderr.write(`render-variant fatal: ${err.stack || err}\n`);
  process.exit(1);
});
