import os
import json
import threading
from pathlib import Path
from functools import lru_cache
from http.server import HTTPServer, BaseHTTPRequestHandler
from vector_embedded_finder import ingest_file, ingest_directory, store
from vector_embedded_finder import embedder, config

# ─── Settings Management ─────────────────────────────────────────────
SETTINGS_DIR = Path.home() / ".vfinder"
SETTINGS_FILE = SETTINGS_DIR / "settings.json"

def load_settings() -> dict:
    """Load settings from ~/.vfinder/settings.json"""
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text())
        except:
            pass
    return {}

def save_settings(settings: dict):
    """Save settings to ~/.vfinder/settings.json"""
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(settings, indent=2))

def apply_api_key():
    """Apply API key from settings file if it exists."""
    settings = load_settings()
    api_key = settings.get("api_key", "")
    if api_key:
        os.environ["GEMINI_API_KEY"] = api_key

# Apply on startup
apply_api_key()

# ─── Query Embedding Cache ───────────────────────────────────────────
@lru_cache(maxsize=128)
def _cached_embed_query(query: str) -> tuple:
    vec = embedder.embed_query(query)
    return tuple(vec)

def cached_search(query: str, n_results: int = 12, media_type: str | None = None):
    embedding = list(_cached_embed_query(query))
    where = None
    if media_type:
        where = {"media_category": media_type}
    raw = store.search(embedding, n_results=n_results, where=where)
    
    results = []
    for i in range(len(raw["ids"][0])):
        meta = raw["metadatas"][0][i]
        distance = raw["distances"][0][i]
        similarity = 1 - distance
        results.append({
            "id": raw["ids"][0][i],
            "similarity": round(similarity, 4),
            "file_path": meta.get("file_path", ""),
            "file_name": meta.get("file_name", ""),
            "media_category": meta.get("media_category", ""),
            "timestamp": meta.get("timestamp", ""),
            "description": meta.get("description", ""),
            "source": meta.get("source", ""),
            "preview": raw["documents"][0][i][:200] if raw["documents"][0][i] else "",
        })
    return results

# ─── Ingestion Progress Tracking ─────────────────────────────────────
_ingest_progress = {
    "active": False,
    "current": 0,
    "total": 0,
    "current_file": "",
    "done": False,
    "error": None,
}
_ingest_lock = threading.Lock()

def _progress_callback(i, total, result):
    with _ingest_lock:
        _ingest_progress["current"] = i
        _ingest_progress["total"] = total
        _ingest_progress["current_file"] = result.get("path", "")

def _ingest_worker(path: str):
    global _ingest_progress
    with _ingest_lock:
        _ingest_progress["active"] = True
        _ingest_progress["current"] = 0
        _ingest_progress["total"] = 0
        _ingest_progress["current_file"] = ""
        _ingest_progress["done"] = False
        _ingest_progress["error"] = None
    
    try:
        if os.path.isdir(path):
            ingest_directory(path, progress_callback=_progress_callback)
        else:
            ingest_file(path)
            with _ingest_lock:
                _ingest_progress["current"] = 1
                _ingest_progress["total"] = 1
    except Exception as e:
        with _ingest_lock:
            _ingest_progress["error"] = str(e)
    finally:
        with _ingest_lock:
            _ingest_progress["active"] = False
            _ingest_progress["done"] = True


class VFinderHandler(BaseHTTPRequestHandler):
    ALLOWED_ORIGINS = [
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:1420",
    ]

    def log_message(self, format, *args):
        print(f"  {args[0]}")

    def do_OPTIONS(self):
        self._send_cors_headers(200)

    def _send_cors_headers(self, status_code):
        self.send_response(status_code)
        origin = self.headers.get('Origin')
        if origin in self.ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)

        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()

    def send_json(self, status_code, data):
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            origin = self.headers.get('Origin')
            if origin in self.ALLOWED_ORIGINS:
                self.send_header('Access-Control-Allow-Origin', origin)
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except BrokenPipeError:
            pass

    def do_GET(self):
        if self.path == '/list':
            try:
                data = store.list_all(limit=2000)
                result = []
                if data and "ids" in data:
                    for i in range(len(data["ids"])):
                        meta = data["metadatas"][i] if data["metadatas"] else {}
                        result.append({
                            "id": data["ids"][i],
                            "file_name": meta.get("file_name", ""),
                            "file_path": meta.get("file_path", ""),
                            "category": meta.get("media_category", ""),
                            "timestamp": meta.get("timestamp", "")
                        })
                    result.sort(key=lambda x: x["timestamp"], reverse=True)
                self.send_json(200, {"results": result})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        elif self.path == '/stats':
            try:
                cache_info = _cached_embed_query.cache_info()
                self.send_json(200, {
                    "count": store.count(),
                    "cache_hits": cache_info.hits,
                    "cache_misses": cache_info.misses,
                })
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        elif self.path == '/ingest/status':
            with _ingest_lock:
                self.send_json(200, dict(_ingest_progress))

        elif self.path == '/settings':
            try:
                settings = load_settings()
                # Mask API key for display (show last 4 chars only)
                api_key = settings.get("api_key", "")
                masked = ""
                if api_key:
                    masked = "•" * (len(api_key) - 4) + api_key[-4:] if len(api_key) > 4 else "•" * len(api_key)
                self.send_json(200, {
                    "api_key_masked": masked,
                    "api_key_set": bool(api_key),
                    "data_dir": settings.get("data_dir", str(config.DATA_DIR)),
                })
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        elif self.path == '/health':
            self.send_json(200, {"status": "ok"})
        else:
            self.send_json(404, {"error": "Not Found"})

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b""
        
        try:
            body = json.loads(post_data) if post_data else {}
        except:
            body = {}

        if self.path == '/search':
            query = body.get('query', '')
            media_type = body.get('media_type', None)
            try:
                res = cached_search(query, n_results=12, media_type=media_type or None)
                self.send_json(200, {"results": res})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        elif self.path == '/ingest':
            path = body.get('path', '')
            if not os.path.exists(path):
                self.send_json(400, {"error": "Path does not exist"})
                return
            
            # Check if already ingesting
            with _ingest_lock:
                if _ingest_progress["active"]:
                    self.send_json(409, {"error": "Ingestion already in progress"})
                    return
            
            # Start ingestion in background thread
            thread = threading.Thread(target=_ingest_worker, args=(path,), daemon=True)
            thread.start()
            self.send_json(202, {"status": "started", "path": path})

        elif self.path == '/delete':
            doc_id = body.get('id', '')
            if not doc_id:
                self.send_json(400, {"error": "Missing doc id"})
                return
            try:
                store.delete(doc_id)
                self.send_json(200, {"success": True})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        elif self.path == '/open':
            file_path = body.get('path', '')
            if not file_path or not os.path.exists(file_path):
                self.send_json(400, {"error": "File not found"})
                return
            try:
                import subprocess
                subprocess.Popen(['open', file_path])
                self.send_json(200, {"success": True})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        elif self.path == '/settings':
            try:
                new_settings = load_settings()
                api_key = body.get('api_key', '')
                data_dir = body.get('data_dir', '')
                
                if api_key:
                    new_settings["api_key"] = api_key
                    os.environ["GEMINI_API_KEY"] = api_key
                    # Reset the embedder client so it picks up new key
                    embedder._client = None
                    # Clear the query cache since the model context changed
                    _cached_embed_query.cache_clear()
                
                if data_dir:
                    new_settings["data_dir"] = data_dir
                
                save_settings(new_settings)
                self.send_json(200, {"success": True})
            except Exception as e:
                self.send_json(500, {"error": str(e)})
        else:
            self.send_json(404, {"error": "Not Found"})

def run(server_class=HTTPServer, handler_class=VFinderHandler, port=32034):
    server_address = ('127.0.0.1', port)
    httpd = server_class(server_address, handler_class)
    print(f"VFinder Daemon running on http://127.0.0.1:{port}")
    print(f"  Query embedding cache enabled (maxsize=128)")
    print(f"  Settings stored at {SETTINGS_FILE}")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
