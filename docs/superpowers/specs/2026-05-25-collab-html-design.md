# html-collab Design Spec

**Date:** 2026-05-25  
**Status:** Approved  
**Location:** `~/Projects/html-collab/`

---

## 1. Overview

**html-collab** is a lightweight, open-source format and toolset for LLM–human collaborative document editing. It uses a single self-contained `.html` file as the canonical document format: the LLM generates structured content, the human annotates and edits in Chrome, and the same file is fed back to the LLM for the next revision cycle.

### Goals

- **Portable**: one `.html` file carries the full context — content + all annotations + latest inline edits
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

Every html-collab document is a single `.html` file with four logical layers:

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
    <h2 data-cid="h-001">Section Heading</h2>
    <p data-cid="p-002">Paragraphs, list items, and sections all carry data-cid.</p>
    <ul>
      <li data-cid="li-001">List items too.</li>
    </ul>
  </section>
</article>
```

**`data-cid` rules:**
- Format: `<type>-<zero-padded-3-digit-sequence>` (e.g. `p-001`, `sec-002`, `h-001`, `li-003`)
- Assigned by the LLM at generation time; sequential per type across the whole document
- Must be unique within a document
- Preserved across revisions — the LLM must not reassign or reuse existing CIDs
- Applied to: `<p>`, `<section>`, `<h1>`–`<h6>`, `<li>`, `<blockquote>`, `<pre>`, `<table>`
- **Missing `data-cid`**: if the engine encounters a block element without a CID (e.g. hand-edited HTML), it auto-assigns a temporary ID in the format `auto-<index>` and logs a console warning. Temporary IDs are not written back to the file.
- **Adding blocks in REVISE**: new blocks inserted by the LLM during revision must receive fresh CIDs continuing the highest existing sequence number for that type (e.g. if `p-007` is the highest paragraph ID, the next new paragraph is `p-008`). The LLM must never reuse a CID that appeared in a previous version.
- **Deleting blocks in REVISE**: the LLM may delete a block to address feedback. Its CID is retired and must never be reused. Any comments or edits targeting a deleted CID are silently dropped when `collab-data` is reset in the new version.

### 2.2 Data Layer

```html
<script type="application/json" id="collab-data">
{
  "version": "0.1",
  "meta": {
    "title": "Document Title",
    "originalCreated": "2026-05-25T10:00:00Z",
    "lastRevised": "2026-05-25T12:00:00Z",
    "model": "claude-opus-4",
    "maxImageBytes": 512000,
    "imageStorage": "base64"
  },
  "comments": [
    {
      "id": "c-001",
      "target": "p-001",
      "quote": "exact selected text (max 500 chars)",
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
- `meta.originalCreated`: set once at GENERATE time, never changed across revisions. At GENERATE time, `originalCreated` and `lastRevised` are set to the same timestamp; they diverge only after the first REVISE cycle.
- `meta.lastRevised`: updated to current timestamp on every REVISE cycle
- `meta.model`: the model that produced the current content version
- `meta.maxImageBytes`: configurable per-document, default `512000` (500 KB). Increase as AI context windows grow.
- `meta.imageStorage`: `"base64"` (current default) or `"url"` (future image hosting support)
- `comments[].quote`: the exact selected text at comment time, truncated to 500 characters. Truncation is applied silently; the full selected text is not stored elsewhere.
- `comments[].author` / `edits[].author`: valid value for v0.1 is `"human"` only. The value `"llm"` is reserved for future use. LLMs do not write comment or edit records — they reset both arrays to `[]` on REVISE.
- `edits[].original/revised`: only the latest diff per block is retained (no edit history tree). A second edit to the same `data-cid` overwrites the previous record. `original` always holds the text as it existed in the LLM-generated version, not the text from a previous human edit; `revised` is the authoritative final text the LLM should apply.
- Images array per comment supports multiple screenshots.

### 2.3 Image Handling

| Scenario | Behavior |
|----------|----------|
| Pasted image ≤ maxImageBytes | Store as base64, no warning |
| Pasted image > maxImageBytes | Show soft warning (English, informational only); store anyway. The warning does not block saving. Context extraction will replace this image with a placeholder regardless. |
| LLM supports multimodal (REVISE mode) | When writing the new file, LLM receives oversized image as multimodal input, re-encodes a compressed version (≤ maxImageBytes) to base64, and sets `compressedBy` to the model name |
| Context extraction for LLM (READ mode) | Replace all image `data` values with placeholder: `[screenshot, 245KB, base64]` regardless of size |
| Multimodal READ | Decode base64, send as image input to the model; do not include raw base64 in the text context |
| Future: URL storage | Store `{"type": "url", "url": "https://..."}`, omit `data` field |
| Future: local bundle | Zip file = HTML + `/assets/` image files |

---

## 3. Project Structure

```
~/Projects/html-collab/
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
5. If screenshot > `maxImageBytes`: soft warning shown in English (informational only, does not block)
6. User clicks **"Add"** →
   - Selected text highlighted in yellow
   - Comment bubble appears in right sidebar, anchored to paragraph
   - `collab-data.comments` updated

### 4.1a Delete Comment Flow

Each rendered comment bubble carries a **[× Delete]** button (top-right of bubble).

1. User clicks **[× Delete]** on a comment bubble →
   - The comment record is removed from `collab-data.comments`
   - The corresponding `<mark class="collab-highlight">` element in the article is unwrapped (its text content is preserved; only the `<mark>` wrapper is removed)
   - The sidebar bubble is removed from the DOM
   - Document marked dirty
2. No confirmation dialog — deletion is immediate.
3. If the mark element cannot be found (e.g. the selection spanned multiple elements and no `<mark>` was inserted), the data deletion and bubble removal still proceed; the missing mark is silently ignored.

**Scope:** Delete only. Comments are not editable after submission.

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
Newly generated file (no FileHandle yet):
  [Save] button or Ctrl+S
  → File System Access API: showSaveFilePicker (filter: .html)
  → FileHandle stored in memory
  → Write full HTML to chosen path
  → Header shows filename + "Saved ✓"

Opening an existing file:
  [Open File] button
  → showOpenFilePicker (filter: .html)
  → FileHandle stored in memory
  → File content loaded into page
  → Header shows filename

On changes (either case):
  Header shows "● Unsaved changes"

Subsequent saves:
  [Save] button or Ctrl+S
  → Serialize current collab-data into <script id="collab-data">
  → FileHandle.createWritable() → write full HTML → close
  → Header shows "Saved ✓"

Note: FileHandle is session-scoped and not persisted across page loads.
Closing and reopening the tab clears the handle; the next Ctrl+S will
trigger showSaveFilePicker again.
```

### 4.4 Combined Comment + Edit on the Same Block

A block may have both a comment and an edit simultaneously. The UI renders both independently:
- The **"edited"** badge and strikethrough/green diff show the text change
- The yellow highlight and sidebar bubble show the comment, anchored to the block

In the READ context sent to the LLM, the comment's `quote` field reflects the **original** text (as it was when the comment was made). The LLM must interpret the comment as feedback on the original text, not the revised text.

In REVISE mode, the LLM applies the human edit verbatim first, then interprets the comment against the post-edit content to determine if further changes are needed.

### 4.5 Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│  html-collab |  Document Title          [Open File]  [Save] │
├─────────────────────────────────────┬────────────────────────┤
│                                     │                        │
│  <article>                          │  Comment sidebar       │
│                                     │                        │
│  Normal paragraph text              │                        │
│                                     │                        │
│  [yellow highlight] selected text ──┼──► ┌─────────────────┐ │
│                                     │    │ Comment text  [×]│ │
│  ~~original text~~ revised text     │    │ [screenshot]    │ │
│  [edited]                           │    └─────────────────┘ │
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
3. Assign `data-cid` to every block element (`<p>`, `<section>`, `<h1>`–`<h6>`, `<li>`, `<blockquote>`, `<pre>`, `<table>`), sequential per type
4. Initialize `collab-data` with:
   - `meta`: `originalCreated` and `lastRevised` both set to current timestamp, model name, title, `maxImageBytes: 512000`, `imageStorage: "base64"`
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
(inner HTML of <article>, engine scripts stripped)

[HUMAN FEEDBACK]
Comments:
  · [p-001] "quoted text (≤500 chars)" → "comment body" [1 screenshot: 245KB]
  · [sec-001] "heading text" → "please add competitor comparison"

Edits:
  · [p-002] "original text" → "revised text"

Note: where a block appears in both Comments and Edits, the comment
quote reflects the original text. Treat both as feedback on the same block.

4. Image handling:
   · Default: replace image data with [screenshot, 245KB, base64]
   · Multimodal model: decode base64, send as image input alongside text context
```

### Mode 3: REVISE

**Trigger:** After READ, user asks LLM to produce next version.

**Steps:**
1. For each block with an edit: apply the human's revised text verbatim
2. For each block with a comment (after edits are applied): revise the content to address the comment
3. For blocks with both: apply edit first, then address comment
4. Add new blocks as needed; assign fresh CIDs continuing from the highest existing sequence per type
5. Remove blocks as needed; retire their CIDs permanently
6. Generate new html-collab file:
   - Updated content with all CIDs preserved or extended
   - `collab-data` reset: `comments: []`, `edits: []`
   - `meta.lastRevised` updated to current timestamp
   - `meta.model` updated to current model
   - `meta.originalCreated` unchanged

---

## 6. Future Considerations (Out of Scope for v0.1)

| Feature | Notes |
|---------|-------|
| URL image storage | `imageStorage: "url"`, requires image hosting tool |
| Local bundle (zip) | HTML + `/assets/` folder, for offline sharing with original images |
| Light edit log | Optional append-only log of past revisions, only if implementation stays simple |
| npm package | Publish `html-collab` to npm for programmatic use |
| OpenClaw A2UI integration | Render html-collab inside OpenClaw Canvas with agent eval bridge |
