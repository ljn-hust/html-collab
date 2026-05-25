'use strict';

/**
 * Parse collab-data JSON island from a document-like object.
 * @param {Document|object} doc - must have getElementById()
 * @returns {object|null}
 */
function getCollabData(doc) {
  const el = doc.getElementById('collab-data');
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

/**
 * Serialize collabData back into the script#collab-data element.
 * @param {Document|object} doc
 * @param {object} data
 */
function setCollabData(doc, data) {
  const el = doc.getElementById('collab-data');
  if (!el) return;
  el.textContent = JSON.stringify(data, null, 2);
}

/**
 * Generate the next available CID for a given type.
 * @param {string} type - e.g. 'p', 'sec', 'h', 'li'
 * @param {string[]} existingCids - all data-cid values currently in the document
 * @returns {string} - e.g. 'p-004'
 */
function generateCid(type, existingCids) {
  const prefix = type + '-';
  const nums = existingCids
    .filter(cid => cid.startsWith(prefix))
    .map(cid => parseInt(cid.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = nums.length === 0 ? 1 : Math.max(...nums) + 1;
  return prefix + String(next).padStart(3, '0');
}

/**
 * Truncate a quote string to at most 500 characters.
 * @param {string} text
 * @returns {string}
 */
function truncateQuote(text) {
  return text.length <= 500 ? text : text.slice(0, 500);
}

/**
 * Format collab-data into a plain-text LLM context string.
 * Replaces base64 image data with size placeholders.
 * @param {object} data - parsed collab-data object
 * @returns {string}
 */
function extractLLMContext(data) {
  const lines = ['[HUMAN FEEDBACK]'];

  if (data.comments.length === 0 && data.edits.length === 0) {
    lines.push('No human feedback.');
    return lines.join('\n');
  }

  if (data.comments.length > 0) {
    lines.push('\nComments:');
    for (const c of data.comments) {
      const imgParts = c.images.map(img => {
        const size = img.sizeBytes >= 1024 * 1024
          ? `${(img.sizeBytes / 1024 / 1024).toFixed(1)}MB`
          : img.sizeBytes >= 1024
            ? `${Math.round(img.sizeBytes / 1024)}KB`
            : `${img.sizeBytes}B`;
        return `[screenshot, ${size}, ${img.type}]`;
      });
      const imgSuffix = imgParts.length > 0 ? ' ' + imgParts.join(' ') : '';
      lines.push(`  · [${c.target}] "${c.quote}" → "${c.text}"${imgSuffix}`);
    }
  }

  if (data.edits.length > 0) {
    lines.push('\nEdits:');
    for (const e of data.edits) {
      lines.push(`  · [${e.target}] "${e.original}" → "${e.revised}"`);
    }
  }

  return lines.join('\n');
}

// CommonJS export guard — allows Node.js testing without breaking browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getCollabData, setCollabData, generateCid, truncateQuote, extractLLMContext };
}
