import json
from http.server import *
class H(BaseHTTPRequestHandler):
    def do_GET(s):
        print(s.path)
        if s.path.startswith("/devices/device-001/display"):
            body = json.dumps({"changed": "current=" not in s.path or s.path.endswith("current="),
                               "image_id": "img1", "url": "http://192.168.1.109:8000/test.jpg",
                               "next_poll_sec": 5}).encode()
            s.send_response(200); s.send_header("Content-Type","application/json")
        else:
            body = open("test.jpg","rb").read()
            s.send_response(200); s.send_header("Content-Type","image/jpeg")
        s.send_header("Content-Length", str(len(body))); s.end_headers(); s.wfile.write(body)
    def do_POST(s):
        n = int(s.headers.get("Content-Length",0)); print("POST", s.path, s.rfile.read(n))
        s.send_response(200); s.send_header("Content-Length","2"); s.end_headers(); s.wfile.write(b"{}")
HTTPServer(("",8000),H).serve_forever()