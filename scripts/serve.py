"""
Local preview server for testing the site before committing.

    python scripts/serve.py            then open http://localhost:8000 on this computer
    python scripts/serve.py --phone    also reachable from a phone on the same Wi-Fi (prints the address)

Works like GitHub Pages for addresses without .html (/concerts serves concerts.html), and tells the
browser not to cache anything, so every reload shows your latest edits. Stop it with Ctrl+C.
"""
import http.server
import os
import socket
import sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
PORT = int(args[0]) if args else 8000
PHONE = '--phone' in sys.argv


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=SITE, **kw)

    def translate_path(self, path):
        local = super().translate_path(path)
        if not os.path.exists(local) and os.path.exists(local + '.html'):
            return local + '.html'
        return local

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('192.0.2.1', 80))   # no traffic is sent; this just picks the Wi-Fi network address
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


if __name__ == '__main__':
    host = '0.0.0.0' if PHONE else '127.0.0.1'
    print(f'Serving {SITE}')
    print(f'  On this computer:  http://localhost:{PORT}')
    if PHONE:
        ip = lan_ip()
        print(f'  On your phone:     http://{ip}:{PORT}   (same Wi-Fi; allow Python if Windows asks)' if ip
              else '  Could not find this computer\'s Wi-Fi address.')
    print('Ctrl+C to stop.')
    http.server.ThreadingHTTPServer((host, PORT), Handler).serve_forever()
