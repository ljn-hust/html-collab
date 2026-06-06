'use strict';
/* html-collab engine — DOM-dependent, runs in Chrome only */

(function collabEngine() {

  // ── State ──────────────────────────────────────────────────
  let fileHandle = null;
  let isDirty = false;
  let pendingCommentRange = null;   // Selection range when comment toolbar clicked
  let pendingCommentTarget = null;  // data-cid of targeted block

  // ── Auto-save ──────────────────────────────────────────────
  let autoSaveTimer = null;
  const AUTOSAVE_DELAY_MS = 3000;  // 3 s debounce after last change

  function scheduleAutoSave() {
    if (!fileHandle) return;  // only after first manual save establishes the handle
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveFile(), AUTOSAVE_DELAY_MS);
  }

  // ── DOM refs ───────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  // header is populated inside init() after DOM is ready
  let header;

  // ── Init ───────────────────────────────────────────────────
  function init() {
    header = {
      title: $('collab-title-display'),
      status: $('collab-save-status'),
      btnSave: $('collab-btn-save'),
    };

    const data = getCollabData(document);
    if (data && data.meta.title) {
      header.title.textContent = data.meta.title;
      document.title = data.meta.title + ' — html-collab';
    }

    attachEditButtons();
    renderState();

    header.btnSave.addEventListener('click', saveFile);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); }
    });

    document.addEventListener('selectionchange', onSelectionChange);
  }

  // ── File access ────────────────────────────────────────────

  /**
   * djb2-style hash of article text content (8-char hex).
   * Used to detect whether the document has changed since last save.
   */
  function computeVersionHash() {
    const article = $('collab-content');
    if (!article) return '';
    const text = article.innerText || article.textContent || '';
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = (((hash << 5) + hash) ^ text.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * Compact structural index of the document for LLM orientation.
   * Written to meta.summary on every save so LLMs can skip full parsing.
   * Format: "sections:sec-001(Title); blocks:8p,6h; comments:2(p-001,p-003); edits:1(p-005)"
   */
  function generateSummary() {
    const article = $('collab-content');
    if (!article) return '';

    // Count named CID blocks by type prefix
    const counts = {};
    article.querySelectorAll('[data-cid]').forEach(el => {
      const cid = el.dataset.cid || '';
      if (!cid || cid.startsWith('auto-')) return;
      const type = cid.split('-')[0];
      counts[type] = (counts[type] || 0) + 1;
    });

    // List sections with heading label
    const sections = [];
    article.querySelectorAll('[data-cid^="sec-"]').forEach(sec => {
      const h = sec.querySelector('h1,h2,h3,h4,h5,h6');
      const label = h ? h.textContent.trim().slice(0, 20) : '';
      sections.push(label ? sec.dataset.cid + '(' + label + ')' : sec.dataset.cid);
    });

    const blockStr = Object.entries(counts)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => v + k)
      .join(',');

    const data = getCollabData(document);
    const cCount = (data?.comments || []).length;
    const eCount = (data?.edits || []).length;
    const cTargets = (data?.comments || []).map(c => c.target).filter(Boolean).join(',');
    const eTargets = (data?.edits || []).map(e => e.target).filter(Boolean).join(',');

    const parts = [];
    if (sections.length > 0) parts.push('sections:' + sections.join(','));
    if (blockStr) parts.push('blocks:' + blockStr);
    parts.push('comments:' + cCount + (cTargets ? '(' + cTargets + ')' : ''));
    parts.push('edits:' + eCount + (eTargets ? '(' + eTargets + ')' : ''));
    return parts.join('; ');
  }

  async function saveFile() {
    try {
      // Update summary and version hash before serialising
      const data = getCollabData(document);
      if (data) {
        data.meta.summary = generateSummary();
        data.meta.versionHash = computeVersionHash();
        setCollabData(document, data);
      }

      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: (getCollabData(document)?.meta?.title || 'document') + '.html',
          types: [{ description: 'html-collab documents', accept: { 'text/html': ['.html'] } }],
        });
      }
      const writable = await fileHandle.createWritable();
      await writable.write(document.documentElement.outerHTML);
      await writable.close();
      setStatus('saved');
      isDirty = false;
    } catch (err) {
      if (err.name === 'AbortError') return; // user cancelled picker — silent no-op
      console.error('[html-collab] Save failed:', err);
      setStatus('unsaved');
    }
  }

  function markDirty() {
    if (!isDirty) { isDirty = true; setStatus('unsaved'); }
    scheduleAutoSave();
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
  // ── Render saved state on file load ───────────────────────
  function renderState() {
    const data = getCollabData(document);
    if (!data) return;

    // Remove comment bubbles that were baked into the serialised DOM.
    // saveFile() uses outerHTML, which captures dynamic bubbles; without this,
    // reopening the file causes renderState() to render each bubble a second time.
    $('collab-comments-list').querySelectorAll('.collab-comment-bubble').forEach(b => b.remove());

    // Render edits: show diff markup for each saved edit
    for (const edit of data.edits) {
      const el = $('collab-content').querySelector(`[data-cid="${edit.target}"]`);
      if (!el) continue;
      el.innerHTML = `<span class="collab-original">${escapeHtml(edit.original)}</span> <span class="collab-revised">${escapeHtml(edit.revised)}</span><span class="collab-edited-badge">edited</span>`;
      // Re-attach edit button (innerHTML wipe destroyed the one from attachEditButtons)
      attachEditButton(el);
    }

    // Render comment bubbles (highlights are already in the HTML if saved after selection)
    for (const comment of data.comments) {
      renderCommentBubble(comment);
    }
  }

  // ── Inline edit ────────────────────────────────────────────
  function attachEditButtons() {
    const content = $('collab-content');
    content.querySelectorAll('[data-cid]').forEach(attachEditButton);

    // Also handle auto-CID for blocks without data-cid
    let autoIdx = 0;
    const BLOCK_TAGS = ['P','SECTION','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','PRE','TABLE'];
    content.querySelectorAll(BLOCK_TAGS.join(',')).forEach(el => {
      if (!el.dataset.cid) {
        el.dataset.cid = 'auto-' + (++autoIdx);
        console.warn('[html-collab] auto-assigned CID:', el.dataset.cid, el);
        attachEditButton(el);
      }
    });
  }

  function attachEditButton(el) {
    if (el.querySelector('.collab-edit-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'collab-edit-btn';
    btn.textContent = '✎ Edit';
    btn.addEventListener('click', (e) => { e.stopPropagation(); startEdit(el); });
    el.appendChild(btn);
  }

  function startEdit(el) {
    // Dim all other blocks
    $('collab-content').querySelectorAll('[data-cid]').forEach(b => {
      b.classList.toggle('dimmed', b !== el);
    });
    el.classList.add('editing');
    el.contentEditable = 'true';
    el.focus();

    // Store original text (from LLM version, not a previous human edit)
    const data = getCollabData(document);
    const existing = data.edits.find(e => e.target === el.dataset.cid);
    el.dataset.editOriginal = existing ? existing.original : el.innerText.trim();

    // Show confirm/cancel bar
    const bar = document.createElement('div');
    bar.className = 'collab-edit-bar';
    bar.innerHTML = `
      <button class="confirm">Confirm (Ctrl+Enter)</button>
      <button class="cancel">Cancel</button>
    `;
    bar.querySelector('.confirm').onclick = () => confirmEdit(el, bar);
    bar.querySelector('.cancel').onclick = () => cancelEdit(el, bar);
    el.after(bar);

    el._editKeyHandler = function(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        confirmEdit(el, bar);
      }
    };
    el.addEventListener('keydown', el._editKeyHandler);
  }

  function confirmEdit(el, bar) {
    const revised = el.innerText.trim();
    const original = el.dataset.editOriginal;

    if (revised === original) {
      cancelEdit(el, bar);
      return;
    }

    // Save diff to collab-data
    const data = getCollabData(document);
    const cid = el.dataset.cid;
    const existingIdx = data.edits.findIndex(e => e.target === cid);
    const editRecord = {
      id: existingIdx >= 0
        ? data.edits[existingIdx].id
        : 'e-' + String(data.edits.length + 1).padStart(3, '0'),
      target: cid,
      original,
      revised,
      author: 'human',
      timestamp: new Date().toISOString(),
    };
    if (existingIdx >= 0) data.edits[existingIdx] = editRecord;
    else data.edits.push(editRecord);
    setCollabData(document, data);
    markDirty();

    // Render diff in place
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el.innerHTML = `<span class="collab-original">${escapeHtml(original)}</span> <span class="collab-revised">${escapeHtml(revised)}</span><span class="collab-edited-badge">edited</span>`;

    // Refresh edit button (innerHTML wiped the old one)
    el.querySelector('.collab-edit-btn')?.remove();
    attachEditButton(el);

    el.removeEventListener('keydown', el._editKeyHandler);
    delete el._editKeyHandler;
    bar.remove();
    undimAll();
  }

  function cancelEdit(el, bar) {
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el.removeEventListener('keydown', el._editKeyHandler);
    delete el._editKeyHandler;
    delete el.dataset.editOriginal;
    bar.remove();
    undimAll();
  }

  function undimAll() {
    $('collab-content').querySelectorAll('[data-cid]').forEach(b => b.classList.remove('dimmed'));
  }

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
        console.warn('[html-collab] Could not highlight selection:', e);
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
      <button class="collab-comment-delete" aria-label="Delete comment" title="Delete comment">×</button>
      <div class="collab-comment-quote">${escapeHtml(comment.quote)}</div>
      <div class="collab-comment-body">${escapeHtml(comment.text)}</div>
      ${comment.images.map(img =>
        img.type === 'base64'
          ? `<img src="${img.data}" alt="screenshot">`
          : `<img src="${img.url}" alt="screenshot">`
      ).join('')}
      <div class="collab-comment-meta">${new Date(comment.timestamp).toLocaleString()}</div>
    `;
    // Wire delete button imperatively after innerHTML (avoids inline onclick)
    bubble.querySelector('.collab-comment-delete')
      .addEventListener('click', (e) => { e.stopPropagation(); deleteComment(comment.id); });
    list.appendChild(bubble);
  }

  function deleteComment(id) {
    // 1. Remove from collab-data
    const data = getCollabData(document);
    data.comments = data.comments.filter(c => c.id !== id);
    setCollabData(document, data);

    // 2. Unwrap <mark> in article — preserve text content, remove wrapper element
    const mark = $('collab-content')
      .querySelector(`.collab-highlight[data-comment-id="${id}"]`);
    if (mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    }

    // 3. Remove bubble from sidebar
    const bubble = $('collab-comments-list')
      .querySelector(`.collab-comment-bubble[data-comment-id="${id}"]`);
    if (bubble) bubble.remove();

    // 4. Mark document dirty
    markDirty();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Screenshot paste ───────────────────────────────────────
  function handleCommentPaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const sizeBytes = blob.size;
        const data = getCollabData(document);
        const maxBytes = data?.meta?.maxImageBytes ?? 51200;

        if (sizeBytes > maxBytes) {
          const warn = $('collab-comment-warning');
          const sizeKB = Math.round(sizeBytes / 1024);
          const maxKB = Math.round(maxBytes / 1024);
          warn.textContent = `This image is ${sizeKB} KB (limit: ${maxKB} KB). Consider cropping it before attaching to keep the file AI-friendly.`;
          warn.style.display = 'block';
        }

        const imgObj = {
          id: 'img-' + Date.now(),
          type: 'base64',
          data: dataUrl,
          sizeBytes,
        };
        $('collab-comment-panel')._images.push(imgObj);

        const preview = document.createElement('img');
        preview.src = dataUrl;
        $('collab-comment-images').appendChild(preview);
      };
      reader.readAsDataURL(blob);
    }
  }

  // ── Expose internal functions used in later tasks ──────────
  window._collab = { markDirty, setStatus };

  // Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
