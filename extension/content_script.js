(function () {
  // Listen for custom events dispatched from the page (or Selenium).
  window.addEventListener('gemini_inject_text', function (ev) {
    insertTextToGemini(ev.detail, { send: false });
  });
  window.addEventListener('gemini_inject_text_and_send', function (ev) {
    insertTextToGemini(ev.detail, { send: true });
  });

  // Listen for messages from the extension popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      try {
        if (message && message.action === 'inject') {
          insertTextToGemini(message.text, { send: !!message.send });
          sendResponse({ result: 'ok' });
          return true;
        }
      } catch (err) {
        console.error('inject message handler error', err);
        sendResponse({ result: 'error', message: err && err.message });
      }
    });
  }

  function insertTextToGemini(text, opts) {
    if (!text && text !== '') return;
    const selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor.textarea.new-input-ui, .ql-editor';
    const editor = document.querySelector(selector);
    if (!editor) {
      console.warn('Gemini editor not found using selector:', selector);
      return;
    }

    // Focus and set HTML (preserve paragraphs)
    editor.focus();
    const paragraphs = String(text)
      .split(/\r?\n/)
      .map(line => line ? escapeHtml(line) : '<br>')
      .map(line => `<p>${line}</p>`)
      .join('');
    editor.innerHTML = paragraphs;

    // Notify the page that input changed
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    // Move caret to end
    placeCaretAtEnd(editor);

    if (opts && opts.send) {
      // Try to find and click the send button
      setTimeout(() => {
        const sendBtn = document.querySelector('button.send-button, button[aria-label*="傳送"], button[aria-label*="Send"], .send-button');
        if (sendBtn && sendBtn.getAttribute('aria-disabled') !== 'true' && !sendBtn.disabled) {
          sendBtn.click();
        } else {
          // Fallback: dispatch Enter key on editor
          const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
          editor.dispatchEvent(ev);
        }
      }, 120);
    }
  }

  function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection != 'undefined' && typeof document.createRange != 'undefined') {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
