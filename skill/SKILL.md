# collab-html Skill

Use this skill when asked to create a document for human review, read an annotated collab-html file, or produce a revised version based on human feedback.

---

## GENERATE — Create a new collab-html document

**When:** User asks you to write, draft, or generate a document.

**Steps:**

1. Start with the content of `dist/collab-template.html` as your base structure.
2. Fill `<article id="collab-content">` with semantic HTML:
   - Use `<h1>` for the document title, `<h2>` for sections, `<p>` for paragraphs, `<ul>`/`<li>` for lists.
3. Assign a `data-cid` attribute to **every** block element. Rules:
   - Format: `<type>-<zero-padded-3-digits>` — e.g. `p-001`, `h-001`, `sec-001`, `li-001`
   - Types: `p` → `<p>`, `h` → `<h1>`–`<h6>`, `sec` → `<section>`, `li` → `<li>`, `bq` → `<blockquote>`, `pre` → `<pre>`, `tbl` → `<table>`
   - Sequential per type across the whole document (not per section)
   - Every block must have one; never skip or duplicate
4. Populate `collab-data` meta:
   - `title`: the document title
   - `originalCreated` and `lastRevised`: both set to the current ISO timestamp
   - `model`: your model identifier
   - `maxImageBytes`: 512000 (default; do not change unless user specifies)
   - `imageStorage`: "base64"
   - `comments`: []
   - `edits`: []
5. Output the complete `.html` file.

---

## READ — Extract context from an annotated file

**When:** User provides a `.html` file that has been annotated by a human.

**Steps:**

1. Parse `<article id="collab-content">` — this is the document text.
2. Parse the JSON inside `<script type="application/json" id="collab-data">`.
3. Build and present this context block:

```
[DOCUMENT CONTENT]
<paste the inner HTML of <article id="collab-content"> here>

[HUMAN FEEDBACK]

Comments:
  · [<target>] "<quote>" → "<comment text>" [screenshot, <size>KB, base64]

Edits:
  · [<target>] "<original>" → "<revised>"
```

The format above matches the output of `extractLLMContext()` in `src/utils.js` exactly. Do not change this format independently in the skill without also updating `extractLLMContext`.

4. Image handling:
   - **Default (text-only model):** replace each image's `data` value with `[screenshot, <size>KB, base64]`. Do not include the raw base64 string.
   - **Multimodal model:** decode each base64 image and send it as an image input alongside the text context.

5. Where the same `data-cid` appears in both Comments and Edits: note that the comment's quote reflects the **original** (pre-edit) text. In REVISE, apply the edit first, then interpret the comment against the updated text.

---

## REVISE — Produce a new version incorporating human feedback

**When:** After READ, the user asks you to revise the document.

**Steps:**

1. For each entry in `edits`: replace the text of the corresponding `data-cid` block with `revised` verbatim.
2. For each entry in `comments`: revise the content of the targeted block to address the feedback. For blocks with both an edit and a comment, apply the edit first, then address the comment.
3. Add new blocks as needed: assign fresh CIDs continuing from the highest existing number for each type (e.g. if `p-007` exists, next paragraph is `p-008`).
4. Remove blocks as needed: retire their CIDs permanently — never reuse them.
5. Output a new complete `.html` file with:
   - Updated `<article>` content
   - All original `data-cid` values preserved (do not reassign existing IDs)
   - `collab-data` reset: `comments: []`, `edits: []`
   - `meta.lastRevised` updated to current timestamp
   - `meta.model` updated to your model identifier
   - `meta.originalCreated` **unchanged**

---

## Image compression (multimodal models, REVISE mode)

If a comment contains images with `sizeBytes > meta.maxImageBytes`, and you support multimodal input:
1. Receive the image as a visual input.
2. Re-encode a compressed version (≤ `maxImageBytes`) to base64.
3. Write the compressed version to the new file with `"compressedBy": "<your model id>"`.

---

## Reference

- Format spec: `docs/superpowers/specs/2026-05-25-collab-html-design.md`
- Template: `dist/collab-template.html`
- Example: `examples/example.html`
