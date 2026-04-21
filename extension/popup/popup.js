document.addEventListener('DOMContentLoaded', function () {
  const textEl = document.getElementById('text');
  const btn = document.getElementById('sendBtn');
  const statusEl = document.getElementById('status');
  const doSendEl = document.getElementById('doSend');

  function updateStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#c00' : '#080';
  }

  btn.addEventListener('click', function () {
    const text = textEl.value;
    const send = !!doSendEl.checked;
    if (!text) {
      updateStatus('請輸入文字', true);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) {
        updateStatus('找不到作用中分頁', true);
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: 'inject', text: text, send: send }, function (response) {
        if (chrome.runtime.lastError) {
          // Fallback: use scripting.executeScript to run injection directly
          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id },
              func: function (txt, doSend) {
                if (!txt && txt !== '') return;
                const selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor.textarea.new-input-ui, .ql-editor';
                const editor = document.querySelector(selector);
                if (!editor) { console.warn('Gemini editor not found'); return; }
                editor.focus();
                const paragraphs = String(txt)
                  .split(/\r?\n/)
                  .map(line => line ? (line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;')) : '<br>')
                  .map(line => `<p>${line}</p>`).join('');
                editor.innerHTML = paragraphs;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                if (typeof window.getSelection != 'undefined' && typeof document.createRange != 'undefined') {
                  const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
                }
                if (doSend) {
                  setTimeout(() => {
                    const sendBtn = document.querySelector('button.send-button, button[aria-label*="傳送"], button[aria-label*="Send"], .send-button');
                    if (sendBtn && sendBtn.getAttribute('aria-disabled') !== 'true' && !sendBtn.disabled) { sendBtn.click(); }
                    else { editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); }
                  }, 120);
                }
              },
              args: [text, send]
            },
            function (results) {
              if (chrome.runtime.lastError) {
                updateStatus('注入失敗: ' + chrome.runtime.lastError.message, true);
              } else {
                updateStatus('已注入（fallback）', false);
              }
            }
          );
        } else {
          updateStatus('已發送至擴充', false);
        }
      });
    });
  });
});
