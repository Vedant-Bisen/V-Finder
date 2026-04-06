import os
path = 'server.py'
with open(path, 'r') as f:
    content = f.read()

# Fix import
if 'from vector_embedded_finder import ingest_file, ingest_directory, store, utils' not in content:
    content = content.replace(
        'from vector_embedded_finder import ingest_file, ingest_directory, store',
        'from vector_embedded_finder import ingest_file, ingest_directory, store, utils'
    )

# Fix _send_cors_headers
old_cors = """    def _send_cors_headers(self, status_code):
        self.send_response(status_code)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE')"""

new_cors = """    def _send_cors_headers(self, status_code):
        self.send_response(status_code)
        origin = self.headers.get('Origin')
        if origin in self.ALLOWED_ORIGINS or '*' in self.ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin if origin else '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE')"""

if old_cors in content:
    content = content.replace(old_cors, new_cors)

# Fix send_json
old_json = """    def send_json(self, status_code, data):
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()"""

new_json = """    def send_json(self, status_code, data):
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            origin = self.headers.get('Origin')
            if origin in self.ALLOWED_ORIGINS or '*' in self.ALLOWED_ORIGINS:
                self.send_header('Access-Control-Allow-Origin', origin if origin else '*')
            self.end_headers()"""

if old_json in content:
    content = content.replace(old_json, new_json)

with open(path, 'w') as f:
    f.write(content)
