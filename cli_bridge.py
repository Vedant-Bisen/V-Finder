import sys
import json
from pathlib import Path
from vector_embedded_finder import ingest_file, ingest_directory, search, count

def main():
    if len(sys.argv) < 3 and sys.argv[1] != "count":
        print(json.dumps({"error": "Missing arguments"}), flush=True)
        sys.exit(1)
        
    command = sys.argv[1]
    
    if command == "count":
        try:
            print(json.dumps({"count": count()}), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)

    elif command == "ingest_file":
        try:
            res = ingest_file(sys.argv[2])
            print(json.dumps(res), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e), "path": sys.argv[2]}), flush=True)
            
    elif command == "ingest_dir":
        path = sys.argv[2]
        def progress(i, total, result):
            result["progress_info"] = {"current": i, "total": total}
            print(json.dumps(result), flush=True)
            
        try:
            ingest_directory(path, progress_callback=progress)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)

    elif command == "search":
        query = sys.argv[2]
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        try:
            res = search(query, n_results=limit)
            print(json.dumps({"results": res}), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)

    else:
        print(json.dumps({"error": "Unknown command"}), flush=True)

if __name__ == "__main__":
    main()
