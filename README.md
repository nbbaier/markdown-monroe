# Markdown Monroe

A clean, GitHub-style Markdown viewer for Chrome.

## Features

- GitHub Flavored Markdown (headings, links, emphasis, tables, task lists, strikethrough, blockquotes, lists, and fenced code)
- Syntax highlighting in fenced code blocks
- Preview, Code, and Raw views, with line numbers and collapsible heading sections in Code
- Toggleable, keyboard-operable Outline that becomes a drawer on narrow screens
- Light, dark, and auto (system) themes with a persisted browser-local preference
- Unsafe HTML is sanitized before it reaches the viewer

Markdown Monroe runs as a content script on all pages but only replaces a response when its MIME type is Markdown (`text/markdown`, `text/x-markdown`, or the corresponding `application/*` types). `text/plain` responses are replaced only when the body is a plain-text document containing recognizable Markdown syntax. Normal HTML documents are left alone.

## Development

Bun is the required runtime and package manager. The repository intentionally contains `bun.lock` and no npm lockfile.

```sh
bun install
bun run check
bun run verify:fixtures
bun run build
bun run package:chrome
bun run package:firefox
```

`bun run build` creates the shared unpacked extension in `dist/`. The two packaging commands create `markdown-monroe-chrome.zip` and `markdown-monroe-firefox.zip`; the manifest is shared because Chrome ignores Firefox's `browser_specific_settings` block and Firefox uses it for the local extension ID.

For repeatable browser checks, start the local fixture server:

```sh
bun run fixtures
```

It serves the fixtures at `http://localhost:4173/`:

- `/markdown.md` — representative GFM, headings, links, emphasis, tables, tasks, strikethrough, blockquotes, lists, and fenced code
- `/unsafe.md` — malformed code and unsafe HTML/URL input
- `/plain.txt` — Markdown-shaped `text/plain` detection
- `/ordinary.html` — ordinary HTML that must remain untouched

## Install the unpacked extension

Build first with `bun run build`, then load the `dist/` directory:

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the repository's `dist/` directory.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `dist/manifest.json`.

Open the fixture links in each browser and verify detection, rendered GFM, Outline navigation and toggle, Preview/Code/Raw switching, Code folding, syntax highlighting, and all three theme choices. Reload after choosing a theme to verify that the theme persists while the view resets to Preview with the Outline open. Also open `/ordinary.html` to confirm it is not replaced and `/unsafe.md` to confirm scripts, event handlers, and unsafe URL schemes do not execute.

`bun run verify:fixtures` uses JSDOM to exercise the detector and sanitizer in Bun. When headed Chrome is launched with a DevTools port, the repeatable Chrome smoke check can be run with `bun run smoke:chrome` (set `MARKDOWN_MONROE_CDP_PORT` and `MARKDOWN_MONROE_FIXTURE_ORIGIN` when they differ from `9222` and `http://127.0.0.1:4174`).

## Browser notes and limitations

- Chrome and Firefox use the same Manifest V3 bundle and storage adapter. Firefox uses the `browser` API when present; Chrome uses `chrome`.
- Temporary Firefox add-ons are removed when the browser session ends; load `dist/manifest.json` again after restarting Firefox.
- The detector intentionally does not replace arbitrary `text/plain` paragraphs because doing so would make ordinary plain-text pages surprising. Such responses need Markdown-shaped syntax or a Markdown MIME type.
- Markdown parsing is provided by Marked with GFM enabled. Sanitization removes raw executable/embedded HTML; intentionally unsafe or unusual raw HTML may therefore render differently from the source.

## Verification status

The repository has been verified with `bun install --frozen-lockfile`, `bun run check`, `bun run verify:fixtures`, `bun run build`, both packaging commands, fixture response checks, Manifest V3 asset checks, and ZIP integrity checks. The interactive checklist above still requires a headed Chrome or Firefox session with the unpacked extension loaded. The installed branded Chrome build in this environment ignores command-line extension-loading flags, and the development environment does not have Firefox installed, so those browser interactions are intentionally unclaimed here.
