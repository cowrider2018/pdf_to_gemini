document.addEventListener('DOMContentLoaded', function () {
  const pdfFileInput = document.getElementById('pdfFile');
  const pagesInput = document.getElementById('pages');
  const helperPromptInput = document.getElementById('helperPrompt');
  const uploadBtn = document.getElementById('uploadPdfBtn');
  const statusEl = document.getElementById('status');
  const doSendEl = document.getElementById('doSend');
  const pdfUploadArea = document.getElementById('pdfUploadArea');
  const fileNameDisplay = document.getElementById('fileName');
  const DEFAULT_PROMPT = (window.DEFAULT_PROMPT && String(window.DEFAULT_PROMPT).trim()) || '請從 PDF 中萃取重點與上下文，並整理成精準摘要。';

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

  // 載入時自動填入預設提示
  helperPromptInput.value = DEFAULT_PROMPT;

  // 預設將輔助提示關閉（隱藏 textarea）
  const helperLabel = document.getElementById('helperLabel');
  if (helperPromptInput) {
    helperPromptInput.classList.add('collapsed');
  }

  // 切換顯示輔助提示的函式
  function toggleHelperPrompt() {
    if (!helperPromptInput || !helperLabel) return;
    const isCollapsed = helperPromptInput.classList.toggle('collapsed');
    helperLabel.setAttribute('aria-expanded', String(!isCollapsed));
    // 調整 popup 高度以符合內容
    try {
      const container = document.querySelector('.container');
      if (container) {
        const newHeight = container.scrollHeight + 16;
        document.documentElement.style.height = newHeight + 'px';
        document.body.style.height = newHeight + 'px';
      }
    } catch (e) { /* ignore */ }
  }

  // 點擊與鍵盤事件支援
  if (helperLabel) {
    helperLabel.addEventListener('click', toggleHelperPrompt);
    helperLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleHelperPrompt();
      }
    });
  }

  function fallbackInjectTextToTab(tabId, promptText, callback) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        func: function (text) {
          const selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor.textarea.new-input-ui, .ql-editor';
          const editor = document.querySelector(selector);
          if (!editor) {
            return { error: 'Gemini editor not found' };
          }
          editor.focus();
          const paragraphs = String(text)
            .split(/\r?\n/)
            .map(line => line ? line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : '<br>')
            .map(line => `<p>${line}</p>`)
            .join('');
          editor.innerHTML = paragraphs;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          return { result: 'ok' };
        },
        args: [promptText]
      },
      function (results) {
        if (chrome.runtime.lastError) {
          if (callback) callback(new Error(chrome.runtime.lastError.message));
        } else if (results && results[0] && results[0].result && results[0].result.error) {
          if (callback) callback(new Error(results[0].result.error));
        } else {
          if (callback) callback(null, results);
        }
      }
    );
  }

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

  function insertPromptTextToTab(promptText, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) {
        updateStatus('找不到作用中分頁', true);
        if (callback) callback(new Error('no active tab'));
        return;
      }
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, { action: 'inject', text: promptText, send: false }, function (response) {
        if (chrome.runtime.lastError) {
          updateStatus('提示語注入失敗，改用 fallback。', true);
          fallbackInjectTextToTab(tabId, promptText, callback);
        } else {
          if (callback) callback(null, response);
        }
      });
    });
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

    const helperPrompt = helperPromptInput.value.trim();
    const promptText = helperPrompt || DEFAULT_PROMPT;
    const form = new FormData();
    form.append('file', file);
    form.append('pages', pages);

    const beginUpload = function () {
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
            const sendImage = send && index === data.images.length - 1;
            sendImageDataToTab(imageDataUrl, imageName, sendImage, (err) => {
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
    };

    if (promptText) {
      updateStatus('正在插入輔助提示...', false);
      insertPromptTextToTab(promptText, (err) => {
        if (err) {
          updateStatus('輔助提示插入失敗: ' + err.message, true);
          return;
        }
        beginUpload();
      });
    } else {
      beginUpload();
    }
  });
});
