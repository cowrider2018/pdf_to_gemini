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
        if (message) {
          if (message.action === 'inject') {
            insertTextToGemini(message.text, { send: !!message.send });
            sendResponse({ result: 'ok' });
            return true;
          }
          if (message.action === 'inject_image_data' || message.imageData) {
            insertImageDataToGemini(message.imageData, { send: !!message.send });
            sendResponse({ result: 'ok' });
            return true;
          }
          if (message.action === 'inject_image' || message.image) {
            const imageName = message.image || 'example.png';
            insertImageToGemini(imageName, { send: !!message.send });
            sendResponse({ result: 'ok' });
            return true;
          }
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

  function insertImageToGemini(imageName, opts) {
    if (!imageName) return;
    const selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor.textarea.new-input-ui, .ql-editor';
    const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL(imageName) : imageName;

    fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], imageName, { type: blob.type || 'image/png' });
      const editor = document.querySelector(selector);
      if (!editor) {
        console.warn('Gemini editor not found using selector:', selector);
        return;
      }
      editor.focus();
      injectImageFile(editor, file, opts);
    })
    .catch(err => console.error('failed to load extension image', err));
}

function insertImageDataToGemini(dataUrl, opts) {
  if (!dataUrl) return;
  const selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor.textarea.new-input-ui, .ql-editor';
  const editor = document.querySelector(selector);
  if (!editor) {
    console.warn('Gemini editor not found using selector:', selector);
    return;
  }
  editor.focus();
  const file = dataUrlToFile(dataUrl, 'page.png');
  injectImageFile(editor, file, opts);
}

function dataUrlToFile(dataUrl, fileName) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/data:(.*);base64/)?.[1] || 'image/png';
  const binary = atob(parts[1] || '');
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new File([array], fileName, { type: mime });
}

function injectImageFile(editor, file, opts) {
  const dt = new DataTransfer();
  dt.items.add(file);
  const dragEventInit = { bubbles: true, cancelable: true, dataTransfer: dt };
  ['dragenter', 'dragover', 'drop'].forEach(type => {
    editor.dispatchEvent(new DragEvent(type, dragEventInit));
  });

  if (!editor.querySelector('img')) {
    try {
      const clipboardData = new DataTransfer();
      clipboardData.items.add(file);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboardData
      });
      editor.dispatchEvent(pasteEvent);
    } catch (err) {
      console.warn('paste event unsupported', err);
    }
  }

  if (opts && opts.send) {
    setTimeout(() => {
      const sendBtn = document.querySelector('button.send-button, button[aria-label*="傳送"], button[aria-label*="Send"], .send-button');
      if (sendBtn && sendBtn.getAttribute('aria-disabled') !== 'true' && !sendBtn.disabled) {
        sendBtn.click();
      } else {
        const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
        editor.dispatchEvent(ev);
      }
    }, 300);
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
