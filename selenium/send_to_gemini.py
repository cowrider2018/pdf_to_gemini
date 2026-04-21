#!/usr/bin/env python3
"""
send_to_gemini.py

說明：
- 使用 Selenium 開啟 Chrome（可選載入本地 unpacked extension），並在 Gemini 頁面插入文字或 PDF 渲染後的圖片。

範例：
  python send_to_gemini.py --text "你好 Gemini" --send
  python send_to_gemini.py --pdf "C:\\path\\to\\document.pdf" --pages 1,3-4 --send

備註：
- 若要使用已登入的 Chrome 帳號，可加上 --profile "C:\\Users\\<you>\\AppData\\Local\\Google\\Chrome\\User Data"
- headless 模式無法載入擴充，請不要使用 headless。
"""
import os
import time
import argparse
import base64
import tempfile
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def parse_pages(pages_text):
    pages = set()
    for part in pages_text.split(','):
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            start, end = part.split('-', 1)
            start = int(start)
            end = int(end)
            pages.update(range(start, end + 1))
        else:
            pages.add(int(part))
    return sorted(pages)


def render_pdf_pages(pdf_path, pages, scale=2.0):
    import fitz
    doc = fitz.open(pdf_path)
    temp_dir = Path(tempfile.mkdtemp(prefix='gemini_pdf_'))
    image_paths = []
    for page_number in pages:
        if page_number < 1 or page_number > len(doc):
            raise ValueError(f'PDF 頁碼超出範圍: {page_number}')
        page = doc.load_page(page_number - 1)
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        image_path = temp_dir / f'page_{page_number}.png'
        pix.save(str(image_path))
        image_paths.append(str(image_path))
    return image_paths


def upload_image_via_selenium(driver, image_path, send):
    with open(image_path, 'rb') as f:
        image_data = base64.b64encode(f.read()).decode('ascii')

    js_upload = '''
    const selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor.textarea.new-input-ui, .ql-editor';
    const editor = document.querySelector(selector);
    if (!editor) {
      return 'no editor';
    }
    const base64 = arguments[0];
    const fileName = arguments[1];
    const mimeType = arguments[2];
    const doSend = arguments[3];
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([array], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });
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
          clipboardData: clipboardData,
        });
        editor.dispatchEvent(pasteEvent);
      } catch (err) {
        // ignore paste fallback
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
    return 'ok';
    '''

    result = driver.execute_script(js_upload, image_data, os.path.basename(image_path), 'image/png', send)
    return result


def main():
    p = argparse.ArgumentParser(description='Send text or PDF pages into Gemini using Selenium.')
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument('--text', help='文字內容（可以包含換行）')
    group.add_argument('--pdf', help='本地 PDF 檔案路徑，會渲染指定頁面為圖片並上傳')
    p.add_argument('--pages', default='1', help='要渲染的頁碼，格式例如 1,3-5。只對 --pdf 有效。')
    p.add_argument('--scale', type=float, default=2.0, help='PDF 渲染縮放比例。')
    p.add_argument('--send', action='store_true', help='插入後嘗試按送出')
    p.add_argument('--extension-path', default=None, help='unpacked extension 路徑，預設為 workspace/extension')
    p.add_argument('--profile', default=None, help='Chrome user-data-dir，若要共用登入狀態請提供（選用）')
    p.add_argument('--url', default='https://gemini.google.com/', help='要開啟的 URL（可選）')
    p.add_argument('--keep-open', action='store_true', help='執行完畢後保留瀏覽器視窗（預設關閉）')
    args = p.parse_args()

    if args.pdf:
        if not os.path.isfile(args.pdf):
            raise FileNotFoundError(f'PDF 檔案不存在: {args.pdf}')
        page_list = parse_pages(args.pages)
        image_paths = render_pdf_pages(args.pdf, page_list, args.scale)
        print('渲染圖片：', image_paths)
    else:
        image_paths = []

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

    driver = webdriver.Chrome(options=chrome_opts)
    try:
        driver.get(args.url)

        selector = 'rich-textarea .ql-editor, .text-input-field_textarea .ql-editor, .ql-editor'
        WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
        time.sleep(0.4)

        if args.pdf:
            for image_path in image_paths:
                result = upload_image_via_selenium(driver, image_path, args.send)
                print(f'上傳 {image_path} -> {result}')
                time.sleep(1.0)
        else:
            event_name = 'gemini_inject_text_and_send' if args.send else 'gemini_inject_text'
            js = "window.dispatchEvent(new CustomEvent(arguments[0], { detail: arguments[1] }));"
            driver.execute_script(js, event_name, args.text)
            print('已發送事件給擴充 (event=%s).' % event_name)

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
