# Gemini Injector (Chrome 擴充)

此擴充在 Gemini 頁面注入一個 content script，並提供擴充介面（popup）可直接輸入文字並送出。

功能：
- Popup：從擴充功能圖示打開 popup，輸入文字後按「送出」，擴充會把文字貼到 Gemini 的輸入框並根據勾選決定是否按送出。
- Page events：仍保留原先的 page-level custom events：`gemini_inject_text`（只插入）與 `gemini_inject_text_and_send`（插入並嘗試送出），Selenium 或其他 script 可繼續使用。

使用方式：
1. 以開發者模式載入 unpacked extension（目錄為本套件的 `extension/`）。
2. 在 Gemini 分頁點選瀏覽器右上方的擴充圖示，填入文字並按「送出」。

備援：
- 若 content script 未在該分頁運行，popup 會使用 `chrome.scripting.executeScript` 直接注入腳本並執行（需在 manifest 授權 `scripting`）。

若要由 Selenium 使用，請參考 workspace 下的 `selenium/send_to_gemini.py` 腳本。