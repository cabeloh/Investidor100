#!/usr/bin/env python3
"""Servidor temporário de upload — recebe o JSON do Investidor10 e salva em data/samples/"""
import http.server, os, sys
from pathlib import Path

SAVE_DIR = Path(__file__).parent.parent / "data" / "samples"
PORT = 9876

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(fmt % args)

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"""
        <html><body style="font-family:monospace;padding:2em">
        <h2>Upload do investidor10 JSON</h2>
        <form method="POST" enctype="multipart/form-data">
          <input type="file" name="file" accept=".json"><br><br>
          <button type="submit">Enviar</button>
        </form>
        </body></html>
        """)

    def do_POST(self):
        import cgi, io
        ct = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in ct:
            self.send_error(400, "Esperado multipart/form-data")
            return
        env = {"REQUEST_METHOD": "POST", "CONTENT_TYPE": ct,
               "CONTENT_LENGTH": self.headers.get("Content-Length", "0")}
        form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ=env)
        f = form["file"]
        data = f.file.read()
        filename = f.filename or "investidor10_upload.json"
        dest = SAVE_DIR / filename
        dest.write_bytes(data)
        print(f"Salvo: {dest} ({len(data):,} bytes)")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(f"<h2>OK! Salvo em:<br><code>{dest}</code></h2><p>Pode fechar esta aba.</p>".encode())
        # encerra o servidor após receber 1 arquivo
        os._exit(0)

print(f"Servidor rodando em http://0.0.0.0:{PORT}")
print(f"Salvando em: {SAVE_DIR}")
print("Esperando upload... (Ctrl+C para cancelar)")
http.server.HTTPServer(("", PORT), Handler).serve_forever()
