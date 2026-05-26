'use strict';
/* collab-html engine — DOM-dependent, runs in Chrome only */

(function collabEngine() {

  // ── State ──────────────────────────────────────────────────
  let fileHandle = null;
  let isDirty = false;
  let pendingCommentRange = null;   // Selection range when comment toolbar clicked
  let pendingCommentTarget = null;  // data-cid of targeted block

  // ── DOM refs ───────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  // header is populated inside init() after DOM is ready
  let header;

  // ── Init ───────────────────────────────────────────────────
  function init() {
    header = {
      title: $('collab-title-display'),
      status: $('collab-save-status'),
      btnOpen: $('collab-btn-open'),
      btnSave: $('collab-btn-save'),
    };

    const data = getCollabData(document);
    if (data && data.meta.title) {
      header.title.textContent = data.meta.title;
      document.title = data.meta.title + ' — collab-html';
    }

    attachEditButtons();
    renderState();

    header.btnOpen.addEventListener('click', openFile);
    header.btnSave.addEventListener('click', saveFile);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); }
    });

    document.addEventListener('selectionchange', onSelectionChange);
  }

  // ── File access ────────────────────────────────────────────
  async function openFile() {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'collab-html documents', accept: { 'text/html': ['.html'] } }],
    });
    // Note: document.write() replaces the entire page including this IIFE.
    // The new document's embedded engine script re-executes from scratch,
    // which means fileHandle will be reset to null in the new instance.
    // This is intentional and consistent with the spec (Section 4.3):
    // "FileHandle is session-scoped; re-opening the tab requires showSaveFilePicker again."
    // The first Ctrl+S after opening a file will trigger showSaveFilePicker.
    const file = await handle.getFile();
    const html = await file.text();
    document.open();
    document.write(html);
    document.close();
  }

  async function saveFile() {
    try {
      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: (getCollabData(document)?.meta?.title || 'document') + '.html',
          types: [{ description: 'collab-html documents', accept: { 'text/html': ['.html'] } }],
        });
      }
      const writable = await fileHandle.createWritable();
      await writable.write(document.documentElement.outerHTML);
      await writable.close();
      setStatus('saved');
      isDirty = false;
    } catch (err) {
      if (err.name === 'AbortError') return; // user cancelled picker — silent no-op
      console.error('[collab-html] Save failed:', err);
      setStatus('unsaved');
    }
  }

  function markDirty() {
    if (!isDirty) { isDirty = true; setStatus('unsaved'); }
  }

  function setStatus(state) {
    const el = header.status;
    el.className = state;
    if (state === 'saved') el.textContent = 'Saved ✓';
    else if (state === 'unsaved') el.textContent = '● Unsaved changes';
    else el.textContent = '';
  }

  // ── Placeholders for functions added in Tasks 8-11 ────────
  // Must exist here so init() can call them during Tasks 7-10.
  function renderState() { /* implemented in Task 11 */ }
  function attachEditButtons() { /* implemented in Task 10 */ }

  // ── Selection / toolbar ────────────────────────────────────
  function onSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      $('collab-toolbar').style.display = 'none';
      return;
    }
    // Only show toolbar if selection is inside #collab-content
    const range = sel.getRangeAt(0);
    const content = $('collab-content');
    if (!content.contains(range.commonAncestorContainer)) {
      $('collab-toolbar').style.display = 'none';
      return;
    }
    // Position toolbar above the selection
    const rect = range.getBoundingClientRect();
    const toolbar = $('collab-toolbar');
    toolbar.style.display = 'block';
    // position: fixed uses viewport coords — getBoundingClientRect() already is viewport-relative
    toolbar.style.top = (rect.top - 38) + 'px';
    toolbar.style.left = rect.left + 'px';

    $('collab-toolbar-comment').onclick = () => {
      pendingCommentRange = range.cloneRange();
      pendingCommentTarget = findTargetCid(range.commonAncestorContainer);
      toolbar.style.display = 'none';
      openCommentPanel();
    };
  }

  function findTargetCid(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== document.body) {
      if (el.dataset.cid) return el.dataset.cid;
      el = el.parentElement;
    }
    return null;
  }

  // ── Comment panel ──────────────────────────────────────────
  function openCommentPanel() {
    const panel = $('collab-comment-panel');
    $('collab-comment-text').value = '';
    $('collab-comment-images').innerHTML = '';
    $('collab-comment-warning').style.display = 'none';
    panel.style.display = 'block';
    $('collab-comments-list').prepend(panel);
    $('collab-comment-text').focus();

    panel._images = [];   // staged images for current comment

    $('collab-comment-text').onpaste = handleCommentPaste;
    $('collab-comment-add').onclick = commitComment;
    $('collab-comment-cancel').onclick = () => {
      panel.style.display = 'none';
      pendingCommentRange = null;
      pendingCommentTarget = null;
    };
  }

  function commitComment() {
    const text = $('collab-comment-text').value.trim();
    if (!text && $('collab-comment-panel')._images.length === 0) return;

    const quote = pendingCommentRange
      ? truncateQuote(pendingCommentRange.toString())
      : '';

    const data = getCollabData(document);
    const existingIds = data.comments.map(c => c.id);
    const id = generateCid('c', existingIds);  // uses max existing c-NNN, avoids duplicates
    const comment = {
      id,
      target: pendingCommentTarget || 'unknown',
      quote,
      text,
      images: $('collab-comment-panel')._images,
      author: 'human',
      timestamp: new Date().toISOString(),
    };
    data.comments.push(comment);
    setCollabData(document, data);
    markDirty();

    // Highlight selection in article
    if (pendingCommentRange) {
      const mark = document.createElement('mark');
      mark.className = 'collab-highlight';
      mark.dataset.commentId = id;
      try {
        pendingCommentRange.surroundContents(mark);
      } catch (e) {
        // surroundContents fails if range spans multiple elements; skip highlight
        console.warn('[collab-html] Could not highlight selection:', e);
      }
    }

    $('collab-comment-panel').style.display = 'none';
    pendingCommentRange = null;
    pendingCommentTarget = null;
    renderCommentBubble(comment);
  }

  function renderCommentBubble(comment) {
    const list = $('collab-comments-list');
    const bubble = document.createElement('div');
    bubble.className = 'collab-comment-bubble';
    bubble.dataset.commentId = comment.id;
    bubble.innerHTML = `
      <div class="collab-comment-quote">${escapeHtml(comment.quote)}</div>
      <div class="collab-comment-body">${escapeHtml(comment.text)}</div>
      ${comment.images.map(img =>
        img.type === 'base64'
          ? `<img src="${img.data}" alt="screenshot">`
          : `<img src="${img.url}" alt="screenshot">`
      ).join('')}
      <div class="collab-comment-meta">${new Date(comment.timestamp).toLocaleString()}</div>
    `;
    list.appendChild(bubble);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Screenshot paste — placeholder for Task 9 ─────────────
  function handleCommentPaste(e) { /* implemented in Task 9 */ }

  // ── Expose internal functions used in later tasks ──────────
  window._collab = { markDirty, setStatus };

  // Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
