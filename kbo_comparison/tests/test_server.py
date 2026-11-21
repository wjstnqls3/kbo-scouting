"""HTTP handler verification without opening network sockets."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('kbo_server', ROOT / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class FakeSocket:
    def __init__(self, path):
        self.input = io.BytesIO(f'GET {path} HTTP/1.0\r\n\r\n'.encode())
        self.output = bytearray()
    def makefile(self, *args, **kwargs):
        return self.input
    def sendall(self, value):
        self.output.extend(value)

class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass

class ServerTests(unittest.TestCase):
    def request(self, path):
        socket = FakeSocket(path)
        QuietHandler(socket, ('127.0.0.1', 0), types.SimpleNamespace())
        head, body = bytes(socket.output).split(b'\r\n\r\n', 1)
        return head.decode(), body
    def test_players_api(self):
        head, body = self.request('/api/players')
        self.assertIn('200 OK', head)
        self.assertIn('application/json', head)
        self.assertIn('no-store', head)
        rows = json.loads(body)
        self.assertEqual(len(rows), 10209)
    def test_metadata_static(self):
        head, body = self.request('/data_metadata.json')
        self.assertIn('200 OK', head)
        self.assertIsNone(json.loads(body)['collected_at'])
    def test_missing_source_returns_json_error(self):
        original = server.ROOT
        try:
            with tempfile.TemporaryDirectory(dir='/private/tmp') as directory:
                server.ROOT = Path(directory)
                head, body = self.request('/api/players')
                self.assertIn('500', head)
                self.assertIn('error', json.loads(body))
        finally:
            server.ROOT = original

if __name__ == '__main__':
    unittest.main()
