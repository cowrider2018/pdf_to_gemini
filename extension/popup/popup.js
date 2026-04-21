document.addEventListener('DOMContentLoaded', function () {
  const pdfFileInput = document.getElementById('pdfFile');
  const pagesInput = document.getElementById('pages');
  const uploadBtn = document.getElementById('uploadPdfBtn');
  const statusEl = document.getElementById('status');
  const doSendEl = document.getElementById('doSend');

  function updateStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#c00' : '#080';
  }

  function sendImageDataToTab(imageDataUrl, send, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) {
        updateStatus('找不到作用中分頁', true);
        if (callback) callback(new Error('no active tab'));
        return;
      }
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, { action: 'inject_image_data', imageData: imageDataUrl, send: send }, function (response) {
        if (chrome.runtime.lastError) {
          updateStatus('擴充注入失敗，嘗試 fallback: ' + chrome.runtime.lastError.message, true);
          fallbackInjectImageData(tabId, imageDataUrl, send, callback);
        } else {
          if (callback) callback(null, response);
        }
      });
    });
  }

  function fallbackInjectImageData(tabId, imageDataUrl, send, callback) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        func: function (dataUrl, doSend) {
          const selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor.textarea.new-input-ui, .ql-editor';
          const editor = document.querySelector(selector);
          if (!editor) {
            return { error: 'Gemini editor not found' };
          }
          editor.focus();
          const parts = dataUrl.split(',');
          const mimeMatch = parts[0].match(/data:(.*);base64/);
          const mime = mimeMatch ? mimeMatch[1] : 'image/png';
          const binary = atob(parts[1] || '');
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
          }
          const file = new File([array], 'page.png', { type: mime });
          const dt = new DataTransfer();
          dt.items.add(file);
          const dragEventInit = { bubbles: true, cancelable: true, dataTransfer: dt };
          ['dragenter', 'dragover', 'drop'].forEach(type => editor.dispatchEvent(new DragEvent(type, dragEventInit)));
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
          if (doSend) {
            setTimeout(() => {
              const sendBtn = document.querySelector('button.send-button, button[aria-label*=\"傳送\"], button[aria-label*=\"Send\"], .send-button');
              if (sendBtn && sendBtn.getAttribute('aria-disabled') !== 'true' && !sendBtn.disabled) {
                sendBtn.click();
              } else {
                editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
              }
            }, 300);
          }
          return { result: 'ok' };
        },
        args: [imageDataUrl, send]
      },
      function (results) {
        if (chrome.runtime.lastError) {
          const err = new Error('fallback inject failed: ' + chrome.runtime.lastError.message);
          updateStatus('fallback 注入失敗: ' + chrome.runtime.lastError.message, true);
          if (callback) callback(err);
        } else if (results && results[0] && results[0].result && results[0].result.error) {
          const err = new Error(results[0].result.error);
          updateStatus('fallback 注入失敗: ' + err.message, true);
          if (callback) callback(err);
        } else {
          if (callback) callback(null, results);
        }
      }
    );
  }

  uploadBtn.addEventListener('click', function () {
    const file = pdfFileInput.files[0];
    const pages = pagesInput.value.trim();
    const send = !!doSendEl.checked;

    if (!file) {
      updateStatus('請選擇 PDF 檔案', true);
      return;
    }
    if (!pages) {
      updateStatus('請輸入頁碼', true);
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('pages', pages);

    updateStatus('正在上傳 PDF 並渲染頁面...', false);
    fetch('http://127.0.0.1:8000/upload', {
      method: 'POST',
      body: form
    })
      .then(response => response.json())
      .then(data => {
        if (!data.images || !data.images.length) {
          throw new Error('伺服器未回傳圖片');
        }
        updateStatus(`已渲染 ${data.images.length} 頁，開始插入...`, false);
        let index = 0;
        const insertNext = () => {
          if (index >= data.images.length) {
            updateStatus('已將 PDF 頁面插入 Gemini。', false);
            return;
          }
          const imageDataUrl = data.images[index];
          sendImageDataToTab(imageDataUrl, send, (err) => {
            if (err) {
              updateStatus('插入圖片失敗: ' + err.message, true);
              return;
            }
            index += 1;
            setTimeout(insertNext, 600);
          });
        };
        insertNext();
      })
      .catch(err => {
        updateStatus('PDF 上傳或渲染失敗: ' + (err && err.message), true);
      });
  });
});
