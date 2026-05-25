# collab-html Design Spec

**Date:** 2026-05-25  
**Status:** Approved  
**Location:** `~/Projects/collab-html/`

---

## 1. Overview

**collab-html** is a lightweight, open-source format and toolset for LLM–human collaborative document editing. It uses a single self-contained `.html` file as the canonical document format: the LLM generates structured content, the human annotates and edits in Chrome, and the same file is fed back to the LLM for the next revision cycle.

### Goals

- **Portable**: one `.html` file carries the full context — content + all annotations + editing history
- **Zero-dependency viewer**: any Chrome user can open and interact with the file, no install required
- **AI-native**: the format is designed to be read and written by LLMs, not just humans
- **Lightweight**: vanilla JS only, no frameworks, no build step required to view

### Non-Goals

- Real-time multi-user collaboration (no server, no WebSocket)
- Version control / branching (only latest diff per block is retained)
- Mobile support (Chrome desktop only)
- Rich text formatting (no bold/italic toolbar, no media embedding)

---

## 2. File Format Spec

Every collab-html document is a single `.html` file with three logical layers:

```
document.html
├── <article id="collab-content">     Content layer (LLM-generated HTML)
├── <script id="collab-data">         Data layer (JSON island, machine-readable)
├── <style id="collab-styles">        UI layer (inlined CSS, ~100 lines)
└── <script id="collab-engine">       Engine layer (inlined vanilla JS, ~400 lines)
```

### 2.1 Content Layer

```html
<article id="collab-content">
  <h1>Document Title</h1>
  <p data-cid="p-001">Every block-level element gets a stable content ID.</p>
  <section data-cid="sec-001">
    <h2>Section Heading</h2>
    <p data-cid="p-002">Paragraphs, list items, and sections all carry data-cid.</p>
    <ul>
      <li data-cid="li-001">List items too.</li>
    </ul>
  </section>
</article>
```

**`data-cid` rules:**
- Format: `<type>-<zero-padded-3-digit-sequence>` (e.g. `p-001`, `sec-002`, `li-003`)
- Assigned by the LLM at generation time
- Must be unique within a document
- Preserved across revisions — the LLM must not reassign existing CIDs
- Applied to: `<p>`, `<section>`, `<li>`, `<blockquote>`, `<pre>`, `<table>`

### 2.2 Data Layer

```html
<script type="application/json" id="collab-data">
{
  "version": "0.1",
  "meta": {
    "title": "Document Title",
    "created": "2026-05-25T10:00:00Z",
    "model": "claude-opus-4",
    "maxImageBytes": 512000,
    "imageStorage": "base64"
  },
  "comments": [
    {
      "id": "c-001",
      "target": "p-001",
      "quote": "exact selected text from the paragraph",
      "text": "Human comment text",
      "images": [
        {
          "id": "img-001",
          "type": "base64",
          "data": "data:image/png;base64,...",
          "sizeBytes": 245000,
          "compressedBy": "claude-opus-4"
        }
      ],
      "author": "human",
      "timestamp": "2026-05-25T11:00:00Z"
    }
  ],
  "edits": [
    {
      "id": "e-001",
      "target": "p-002",
      "original": "text before edit",
      "revised": "text after edit",
      "author": "human",
      "timestamp": "2026-05-25T11:05:00Z"
    }
  ]
}
</script>
```

**Schema notes:**
- `maxImageBytes`: configurable per-document, default `512000` (500 KB). As AI context windows grow, this value can be increased.
- `imageStorage`: `"base64"` (current default) or `"url"` (future image hosting support)
- `edits[].original/revised`: only the latest diff per block is retained (no edit history tree)
- Images array per comment supports multiple screenshots

### 2.3 Image Handling

| Scenario | Behavior |
|----------|----------|
| Pasted image ≤ maxImageBytes | Store as base64, no warning |
| Pasted image > maxImageBytes | Show soft warning (English), store anyway |
| LLM supports multimodal | LLM compresses image to ≤ maxImageBytes before writing |
| Context extraction for LLM | Replace image data with placeholder: `[screenshot, 245KB, base64]` |
| Future: URL storage | Store `{"type": "url", "url": "https://..."}`, omit `data` field |
| Future: local bundle | Zip file = HTML + `/assets/` image files |

---

## 3. Project Structure

```
~/Projects/collab-html/
│
├── src/
│   ├── engine.js               Annotation engine source (~400 lines, vanilla JS)
│   └── engine.css              Annotation UI styles (~100 lines)
│
├── template/
│   └── template.html           Base template with placeholders, engine not yet inlined
│
├── dist/
│   └── collab-template.html    Build output: engine inlined, ready for LLM to fill
│
├── schema/
│   └── collab-data.schema.json JSON Schema for collab-data validation
│
├── skill/
│   └── SKILL.md                Claude Code / OpenClaw skill
│
├── examples/
│   └── example.html            A complete example document with annotations
│
├── docs/
│   └── superpowers/specs/
│       └── 2026-05-25-collab-html-design.md   (this file)
│
├── build.js                    Build script (Node.js, zero npm deps)
├── README.md
└── LICENSE                     MIT
```

**Build process:**
```
src/engine.js + src/engine.css
        ↓  (node build.js)
dist/collab-template.html
```

`build.js` uses only Node.js built-in `fs` module. No npm dependencies required.

**Skill distribution:**
- `skill/SKILL.md` — canonical location in project
- Symlink or copy to `~/Projects/skills/` — for OpenClaw agent use
- Copy to `~/.claude/` — for Claude Code use

---

## 4. Interaction Model (Chrome Browser)

### 4.1 Comment Flow

1. User selects text in `<article id="collab-content">`
2. Floating toolbar appears: **[+ Comment]**
3. User clicks → right sidebar opens comment input panel
4. User types text; can paste screenshot via Ctrl+V
5. If screenshot > `maxImageBytes`: soft warning shown (English)
6. User clicks **"Add"** →
   - Selected text highlighted in yellow
   - Comment bubble appears in right sidebar, anchored to paragraph
   - `collab-data.comments` updated

### 4.2 Inline Edit Flow

1. User hovers over a block element → pencil icon appears (top-right of block)
2. User clicks → block enters `contenteditable` mode; other blocks dimmed
3. User edits text freely (no formatting toolbar)
4. **"Confirm"** (or Ctrl+Enter) →
   - Original text shown with strikethrough
   - Revised text shown in green
   - Block receives **"edited"** badge
   - Diff written to `collab-data.edits` (overwrites previous diff for same `data-cid`)
5. **"Cancel"** → restores original, no diff recorded

### 4.3 Save Flow

```
First open:
  [Open File] button → File System Access API (showOpenFilePicker)
  → FileHandle stored in memory
  → File content loaded into page

On changes:
  Header shows "● Unsaved changes"

Save:
  [Save] button or Ctrl+S
  → Serialize current collab-data into <script id="collab-data">
  → FileHandle.createWritable() → write full HTML → close
  → Header shows "Saved ✓"
```

### 4.4 Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│  collab-html  |  Document Title          [Open File]  [Save] │
├─────────────────────────────────────┬────────────────────────┤
│                                     │                        │
│  <article>                          │  Comment sidebar       │
│                                     │                        │
│  Normal paragraph text              │                        │
│                                     │                        │
│  [yellow highlight] selected text ──┼──► ┌────────────────┐  │
│                                     │    │ Comment text   │  │
│  ~~original text~~ revised text     │    │ [screenshot]   │  │
│  [edited]                           │    └────────────────┘  │
│                                     │                        │
└─────────────────────────────────────┴────────────────────────┘
```

All UI text in English. No i18n layer.

---

## 5. LLM Skill Design

The skill (`skill/SKILL.md`) defines three operating modes:

### Mode 1: GENERATE

**Trigger:** User requests a document for human review.

**Steps:**
1. Start from `dist/collab-template.html`
2. Fill `<article id="collab-content">` with semantic HTML content
3. Assign `data-cid` to every block element (sequential, per-type numbering)
4. Initialize `collab-data` with:
   - `meta`: model name, timestamp, title, `maxImageBytes: 512000`, `imageStorage: "base64"`
   - `comments: []`
   - `edits: []`
5. Output the complete `.html` file

### Mode 2: READ

**Trigger:** User provides an annotated `.html` file for LLM review.

**Extraction:**
```
1. Parse <article id="collab-content"> for document content
2. Parse <script id="collab-data"> for annotations
3. Build structured context:

[DOCUMENT CONTENT]
(inner HTML of <article>, stripped of engine scripts)

[HUMAN FEEDBACK]
Comments:
  · [p-001] "quoted text" → "comment body" [1 screenshot: 245KB]
  · [sec-001] "heading text" → "please add competitor comparison"

Edits:
  · [p-002] "original text" → "revised text"

4. Image handling:
   · Default: replace image data with [screenshot, 245KB, base64]
   · Multimodal model: decode base64, send as image input
```

### Mode 3: REVISE

**Trigger:** After READ, user asks LLM to produce next version.

**Steps:**
1. Merge all `edits` into the corresponding `data-cid` blocks
2. Address each `comment` by revising the targeted content
3. Generate new collab-html file:
   - Updated content
   - Same `data-cid` values preserved
   - `collab-data` reset to empty (`comments: []`, `edits: []`)
   - `meta.model` and `meta.created` updated

---

## 6. Future Considerations (Out of Scope for v0.1)

| Feature | Notes |
|---------|-------|
| URL image storage | `imageStorage: "url"`, requires image hosting tool |
| Local bundle (zip) | HTML + `/assets/` folder, for offline sharing with original images |
| Light edit log | Optional append-only log of past revisions, only if implementation stays simple |
| npm package | Publish `collab-html` to npm for programmatic use |
| OpenClaw A2UI integration | Render collab-html inside OpenClaw Canvas with agent eval bridge |
