document.addEventListener('DOMContentLoaded', function () {
  const pdfFileInput = document.getElementById('pdfFile');
  const pagesInput = document.getElementById('pages');
  const uploadBtn = document.getElementById('uploadPdfBtn');
  const statusEl = document.getElementById('status');
  const doSendEl = document.getElementById('doSend');
  const pdfUploadArea = document.getElementById('pdfUploadArea');
  const fileNameDisplay = document.getElementById('fileName');

  function updateStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#c00' : '#080';
  }

  // ===== PDF 上傳區域事件 =====
  function displayFileName(name) {
    if (name) {
      fileNameDisplay.textContent = '✓ ' + name;
      fileNameDisplay.classList.add('active');
    } else {
      fileNameDisplay.textContent = '';
      fileNameDisplay.classList.remove('active');
    }
  }

  // 點擊上傳區域打開文件選擇
  pdfUploadArea.addEventListener('click', function () {
    pdfFileInput.click();
  });

  // 文件選擇後顯示名稱
  pdfFileInput.addEventListener('change', function (e) {
    if (e.target.files[0]) {
      displayFileName(e.target.files[0].name);
    }
  });

  // 拖放事件
  ['dragenter', 'dragover'].forEach(eventName => {
    pdfUploadArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      pdfUploadArea.classList.add('dragging-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    pdfUploadArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      pdfUploadArea.classList.remove('dragging-over');
    }, false);
  });

  // 處理拖放文件
  pdfUploadArea.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const pdfFile = Array.from(files).find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (pdfFile) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(pdfFile);
        pdfFileInput.files = dataTransfer.files;
        displayFileName(pdfFile.name);
        pdfFileInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        updateStatus('請拖放 PDF 檔案', true);
      }
    }
  }, false);

  function updateStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#c00' : '#080';
  }

  function sendImageDataToTab(imageDataUrl, imageName, send, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) {
        updateStatus('找不到作用中分頁', true);
        if (callback) callback(new Error('no active tab'));
        return;
      }
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, { action: 'inject_image_data', imageData: imageDataUrl, fileName: imageName, send: send }, function (response) {
        if (chrome.runtime.lastError) {
          updateStatus('擴充注入失敗，嘗試 fallback: ' + chrome.runtime.lastError.message, true);
          fallbackInjectImageData(tabId, imageDataUrl, imageName, send, callback);
        } else {
          if (callback) callback(null, response);
        }
      });
    });
  }

  function fallbackInjectImageData(tabId, imageDataUrl, imageName, send, callback) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        func: function (dataUrl, fileName, doSend) {
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
          const file = new File([array], fileName, { type: mime });
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
        args: [imageDataUrl, imageName, send]
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
          const imageName = `page_${index + 1}.png`;
          sendImageDataToTab(imageDataUrl, imageName, send, (err) => {
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
