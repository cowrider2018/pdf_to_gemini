# Gemini Injector — Chrome 擴充 + Selenium 範例

內容：
- `extension/` — Chrome 擴充（content script），監聽 custom event 並將文字插入 Gemini 輸入框。
- `selenium/send_to_gemini.py` — 使用 Selenium 觸發 custom event 的範例腳本。

快速開始：
1. 在 Chrome 的擴充程式管理頁啟用「開發人員模式」，載入 `extension/` 資料夾為 unpacked extension。
2. 安裝 Python 相依：`python -m pip install -r selenium/requirements.txt`
3. 執行範例：
```
python selenium/send_to_gemini.py --text "你好 Gemini" --send --profile "C:\\Users\\<you>\\AppData\\Local\\Google\\Chrome\\User Data"
```

說明：若要使用已登入的 Gemini（保持 session），請指定 `--profile` 指向 Chrome 的 user data 目錄。避免在 headless 模式使用擴充。
