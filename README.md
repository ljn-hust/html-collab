# collab-html

A lightweight, open-source format for LLM–human collaborative document editing.

One `.html` file contains LLM-generated content, human annotations, and inline edits —
all readable by the next LLM call. Open in Chrome, annotate, save, feed back to AI.

## Quick start

**For humans (Chrome):**
1. Open any `.html` file built with collab-html in Chrome
2. Select text → `+ Comment` to add a comment (paste screenshots with Ctrl+V)
3. Hover a paragraph → `✎ Edit` to edit inline (Ctrl+Enter to confirm)
4. `Ctrl+S` to save

**For LLMs:** See `skill/SKILL.md` for GENERATE / READ / REVISE instructions.

## Build

```bash
node build.js
# → dist/collab-template.html
```

No npm install required.

## Run tests

```bash
node --test tests/utils.test.js tests/build.test.js
```

## Format

A collab-html file has four layers:

| Layer | Element | Description |
|-------|---------|-------------|
| Content | `<article id="collab-content">` | LLM-generated HTML with `data-cid` on every block |
| Data | `<script id="collab-data" type="application/json">` | JSON island: comments, edits, meta |
| Styles | `<style id="collab-styles">` | Inlined annotation UI CSS |
| Engine | `<script id="collab-engine">` | Inlined vanilla JS annotation engine |

See `docs/superpowers/specs/2026-05-25-collab-html-design.md` for the full spec.

## Browser support

Chrome desktop only (requires [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)).

## License

MIT
