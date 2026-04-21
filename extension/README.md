# Gemini Injector (Chrome 擴充)

此擴充在 Gemini 頁面注入一個 content script，並提供擴充介面（popup）可上傳本地 PDF、選擇頁碼，將指定 PDF 頁面渲染成圖片後插入 Gemini。

功能：
- Popup：從擴充功能圖示打開 popup，選擇本地 PDF、輸入頁碼，按「上傳 PDF 並插入圖片」。
- Page events：仍保留原先的 page-level custom events：`gemini_inject_text`（只插入文字）與 `gemini_inject_text_and_send`（插入文字並嘗試送出）。另外新增可由擴充接收的 message：`{ action: 'inject_image_data', imageData: '<data-url>', send: true }`。

使用方式：
1. 以開發者模式載入 unpacked extension（目錄為本套件的 `extension/`）。
2. 啟動本地 PDF 渲染伺服器：
```
python selenium/pdf_server.py
```
3. 在 Gemini 分頁點選瀏覽器右上方的擴充圖示，選擇 PDF 檔案、輸入頁碼，按「上傳 PDF 並插入圖片」。

備援：
- 若 content script 未在該分頁運行，popup 會直接嘗試將圖片傳送給分頁上的 content script（需在 manifest 授權 `scripting` 和 `activeTab`）。

若要由 Selenium 使用，請參考 workspace 下的 `selenium/send_to_gemini.py` 腳本。