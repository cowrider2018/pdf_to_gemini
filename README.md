# 使用流程

本擴充工具自動渲染多頁 PDF 並上傳至 Gemini 對話框，省去手動截圖的麻煩。

前提
- 已安裝 Python 3.10+（或系統可執行 `python`）。


建立並啟用 server

- 雙擊專案根目錄的 run_server.bat 並等待畫面出現以下提示：

```powershell
PDF server listening at...
```


在瀏覽器載入擴充（Chrome / Edge）

- 開啟 Chrome，網址列輸入 `chrome://extensions`。
- 右上角開啟「開發人員模式」。
- 按「載入未封裝項目」或「載入解壓縮」，然後選擇專案中的 `extension` 資料夾（`pdf_to_gemini\extension`）。


使用瀏覽器擴充功能

- 在瀏覽器開啟 gemini 分頁（https://gemini.google.com/app）。
- 點選瀏覽器工具列的擴充圖示打開 Gemini injector。
- 在 Gemini injector 介面依序操作（選檔、填頁碼、按上傳）。
