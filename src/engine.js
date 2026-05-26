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
  function onSelectionChange() { /* implemented in Task 8 */ }
  function attachEditButtons() { /* implemented in Task 10 */ }

  // ── Expose internal functions used in later tasks ──────────
  window._collab = { markDirty, setStatus };

  // Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
