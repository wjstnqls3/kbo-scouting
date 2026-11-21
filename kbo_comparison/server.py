"""Local JSON-backed server: python3 kbo_comparison/server.py"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlsplit(self.path).path != '/api/players':
            return super().do_GET()
        try:
            with (ROOT / 'sample_data.json').open(encoding='utf-8') as stream:
                records = json.load(stream)
            body = json.dumps(records, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
        except (OSError, ValueError):
            body = json.dumps({'error': '데이터 파일을 읽을 수 없습니다.'}, ensure_ascii=False).encode('utf-8')
            self.send_response(500)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__':
    print('브라우저에서 http://localhost:8000 을 여세요.', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8000), Handler).serve_forever()
