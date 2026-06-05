# html-collab

Single-file HTML format for LLM–human collaborative document editing.

**This project documents itself.** Download [`index.html`](./index.html) and open it in Chrome — that file *is* the documentation, and it's built with html-collab.

## What it does

One `.html` file holds LLM-generated content, human annotations (comments + inline edits), and everything the AI needs to produce the next revision. No server, no install, no account.

## Quick start

**As a human reviewer (Chrome):**
1. Open any html-collab `.html` file in Chrome
2. Select text → **+ Comment** · Hover paragraph → **✎ Edit**
3. `Ctrl+S` to save — hand the file back to your AI

**As an LLM:** load `skill/SKILL.md` and follow the GENERATE / READ / REVISE instructions.

## Build from source

```bash
node build.js        # → dist/collab-template.html
node --test          # run tests
```

## License

MIT
