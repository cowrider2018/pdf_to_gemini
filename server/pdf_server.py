#!/usr/bin/env python3
import base64
import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler

import fitz

HOST = '127.0.0.1'
PORT = 8000


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


def render_pdf_pages(pdf_bytes, pages, scale=2.0):
    doc = fitz.open(stream=pdf_bytes, filetype='pdf')
    images = []
    total_pages = len(doc)
    for page_number in pages:
        if page_number < 1 or page_number > total_pages:
            raise ValueError(f'頁碼 {page_number} 超出 PDF 範圍 1-{total_pages}')
        page = doc.load_page(page_number - 1)
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        png = pix.tobytes('png')
        data_url = 'data:image/png;base64,' + base64.b64encode(png).decode('ascii')
        images.append(data_url)
    return images


class PDFServerHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_POST(self):
        if self.path != '/upload':
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))
            return

        content_type_header = self.headers.get('Content-Type', '')
        m = re.match(r'multipart/form-data;\s*boundary=(.+)', content_type_header)
        if not m:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Invalid content type'}).encode('utf-8'))
            return

        boundary = m.group(1)
        if boundary.startswith('"') and boundary.endswith('"'):
            boundary = boundary[1:-1]
        boundary_bytes = ('--' + boundary).encode('utf-8')

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        file_bytes = None
        pages_field = '1'
        for part in body.split(boundary_bytes):
            part = part.strip(b'\r\n')
            if not part or part == b'--':
                continue
            header, _, value = part.partition(b'\r\n\r\n')
            if not header or not value:
                continue
            header_text = header.decode('utf-8', errors='ignore')
            disposition = None
            for hline in header_text.split('\r\n'):
                if hline.lower().startswith('content-disposition:'):
                    disposition = hline
                    break
            if not disposition:
                continue
            name_match = re.search(r'name="([^"]+)"', disposition)
            if not name_match:
                continue
            field_name = name_match.group(1)
            if field_name == 'file':
                # Remove trailing boundary marker if present
                if value.endswith(b'--'):
                    value = value[:-2].rstrip(b'\r\n')
                file_bytes = value
            elif field_name == 'pages':
                pages_field = value.decode('utf-8', errors='ignore').strip()

        if not file_bytes:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Missing PDF file'}).encode('utf-8'))
            return

        try:
            pages = parse_pages(pages_field)
            images = render_pdf_pages(file_bytes, pages)
        except Exception as exc:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': str(exc)}).encode('utf-8'))
            return

        self._set_headers(200)
        self.wfile.write(json.dumps({'images': images}).encode('utf-8'))


def run_server(host=HOST, port=PORT):
    server_address = (host, port)
    httpd = HTTPServer(server_address, PDFServerHandler)
    print(f'PDF server listening at http://{host}:{port}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down PDF server')
        httpd.server_close()


if __name__ == '__main__':
    run_server()
