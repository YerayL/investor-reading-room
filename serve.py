"""Serve the static reading room on the local machine using only Python's standard library."""
from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

def main():
    parser = ArgumentParser(description="投资家文稿阅读器")
    parser.add_argument("--port", type=int, default=8726, help="本机端口，默认 8726")
    opts = parser.parse_args()
    root = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", opts.port), handler) as server:
        print(f"http://127.0.0.1:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
