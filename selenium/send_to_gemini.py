#!/usr/bin/env python3
"""
send_to_gemini.py

說明：
- 使用 Selenium 開啟 Chrome（可選載入本地 unpacked extension），並在 Gemini 頁面 dispatch custom event，
  由擴充接收並把文字插入輸入框。

範例：
  python send_to_gemini.py --text "你好 Gemini" --send

備註：
- 若要使用已登入的 Chrome 帳號，可加上 --profile "C:\\Users\\<you>\\AppData\\Local\\Google\\Chrome\\User Data"
- headless 模式無法載入擴充，請不要使用 headless。
"""
import os
import time
import argparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def main():
    p = argparse.ArgumentParser(description='Send text into Gemini using a Chrome extension and Selenium.')
    p.add_argument('--text', required=True, help='文字內容（可以包含換行）')
    p.add_argument('--send', action='store_true', help='插入後嘗試按送出')
    p.add_argument('--extension-path', default=None, help='unpacked extension 路徑，預設為 workspace/extension')
    p.add_argument('--profile', default=None, help='Chrome user-data-dir，若要共用登入狀態請提供（選用）')
    p.add_argument('--url', default='https://gemini.google.com/', help='要開啟的 URL（可選）')
    p.add_argument('--keep-open', action='store_true', help='執行完畢後保留瀏覽器視窗（預設關閉）')
    args = p.parse_args()

    # 預設 extension 路徑為 repo 下的 extension/
    if args.extension_path:
        ext_path = os.path.abspath(args.extension_path)
    else:
        here = os.path.dirname(os.path.abspath(__file__))
        ext_path = os.path.abspath(os.path.join(here, '..', 'extension'))

    chrome_opts = Options()
    if os.path.isdir(ext_path):
        chrome_opts.add_argument(f'--load-extension={ext_path}')
    else:
        print('Warning: extension path not found, continuing without extension:', ext_path)

    if args.profile:
        chrome_opts.add_argument(f'--user-data-dir={args.profile}')

    # 注意：headless 模式不能載入 extension
    driver = webdriver.Chrome(options=chrome_opts)
    try:
        driver.get(args.url)

        # 等待 editor 出現
        selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor'
        WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
        time.sleep(0.4)  # 等 content_script 附加

        event_name = 'gemini_inject_text_and_send' if args.send else 'gemini_inject_text'
        js = "window.dispatchEvent(new CustomEvent(arguments[0], { detail: arguments[1] }));"
        driver.execute_script(js, event_name, args.text)
        print('已發送事件給擴充 (event=%s).' % event_name)

        # 等待短暫時間讓輸入/送出完成
        time.sleep(1.2)

        if not args.keep_open:
            driver.quit()
            print('關閉瀏覽器並結束。')
        else:
            print('保留瀏覽器視窗供檢查，請手動關閉。')

    except Exception as e:
        print('發生錯誤：', e)
        try:
            driver.quit()
        except:
            pass


if __name__ == '__main__':
    main()
