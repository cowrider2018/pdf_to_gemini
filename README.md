# 使用流程

本擴充工具自動渲染多頁 PDF 並上傳至 Gemini 對話框，省去手動截圖的麻煩。

前提
- 已安裝 Python 3.10+（或系統可執行 `python`）。
- 本指引針對 Windows（PowerShell、cmd）示範命令。

1) 建立並啟用虛擬環境（venv）

- 在專案根目錄開啟 PowerShell，執行：

```powershell
python -m venv .venv
```

- 啟用 venv（PowerShell / cmd 有所不同）：

```powershell
& .\.venv\Scripts\Activate.ps1
```

```cmd
.venv\Scripts\activate
```

2) 安裝 Python 相依

- 進入 `server` 資料夾並安裝：

```powershell
cd server
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

3) 啟動本地 PDF 渲染伺服器

```powershell
python pdf_server.py
```

4) 在瀏覽器載入擴充（Chrome / Edge）

- 開啟 Chrome，網址列輸入 `chrome://extensions`。
- 右上角開啟「開發人員模式」。
- 按「載入未封裝項目」，然後選擇專案中的 `extension` 資料夾（`pdf_to_gemini\extension`）。

5) 使用擴充的步驟

- 在瀏覽器開啟 gemini 分頁（https://gemini.google.com/app）。
- 點選瀏覽器工具列的擴充圖示打開 Gemini injector。
- 在 Gemini injector 介面依序操作（選檔、填頁碼、按上傳）。

# 命令總覽

PowerShell（在專案根目錄）:

```powershell
python -m venv .venv
& .\.venv\Scripts\Activate.ps1
cd server
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python pdf_server.py
```

在 Chrome 載入擴充：打開 `chrome://extensions` → 右上角開啟「開發人員模式」→ 點「Load unpacked」→ 選擇 `extension` 資料夾。