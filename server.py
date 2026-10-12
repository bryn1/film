#!/usr/bin/env python3
"""
server.py — vm106 launcher for the film app (MC 10444, PLAN-t10 §4).

systemd starts THIS file (hosting.yaml exec) with $PORT = the outer port nginx
proxying. The trailing slash STRIPS the /film prefix —
while the committed Next build (basePath "/film" baked) answers /film/* only.
So the launcher re-prefixes: it spawns the committed standalone build
(deploy/standalone/server.js) on a loopback inner port and forwards every
request to it with root_path prepended. The prepend is IDEMPOTENT and the
path passes through AS GIVEN — canonical shape carries the trailing slash
(next.config trailingSlash:true, MC 10444 fix-cycle 1): a nginx-stripped "/"
becomes "/film/" and direct "/film/..." requests pass through, both served
200 straight; a bare "/film..." gets ONE app-level scheme-preserving 308 to
canonical. The browser hot path sees ZERO redirects.

Supervision: if the node child exits, this launcher exits non-zero so the
unit's Restart=on-failure restarts the pair. stdlib only — no venv, no
requirements.txt (the unit then runs /usr/bin/python3 per the render contract).

The variable name `root_path` is deliberate and lowercase: reconcile.py's
PREFIX_REWRITER_RE is case-sensitive and matches this literal token — the
fleet's blessed prefix-rewrite shape.
"""
import hashlib
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import tarfile
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

root_path = "/film"
APP_DIR = os.path.dirname(os.path.abspath(__file__))
STANDALONE = os.path.join(APP_DIR, "deploy", "standalone")
ENTRY = os.path.join(STANDALONE, "server.js")

# Vendored Node fallback (MC 10444 follow-up): the vm106 hosting lane is
# python3+static and must stay host-untouched, so the app ships the official
# runtime and extracts ONLY its bin/node member when no system node exists.
# Pinned sha256 of deploy/vendor/node-v20.20.2-linux-x64.tar.xz from the
# freshly fetched https://nodejs.org/dist/v20.20.2/SHASUMS256.txt. That file
# lists archive hashes only (no per-file entry for the raw bin/node — checked
# 2026-10-12), so the TARBALL sha256 is verified once before extraction and
# the extracted binary must then pass `--version` before anything execs it.
NODE_VERSION = "v20.20.2"
NODE_TARBALL_SHA256 = "df770b2a6f130ed8627c9782c988fda9669fa23898329a61a871e32f965e007d"
VENDOR_TARBALL = os.path.join(APP_DIR, "deploy", "vendor",
                              f"node-{NODE_VERSION}-linux-x64.tar.xz")

# RFC 2616 §13.5.1 connection-scoped headers: never forwarded either way.
HOP_BY_HOP = frozenset({
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "trailers", "transfer-encoding", "upgrade",
})
UPSTREAM_TIMEOUT = 30


def re_prefix(path):
    """root_path + path, idempotent (segment-boundary check): forward what
    nginx hands us, prefixed — the canonical URL shape carries the trailing
    slash (next.config trailingSlash:true), so "/" becomes "/film/" (served
    200 straight) and "/film/..." passes through untouched. A bare external
    "/film..." is forwarded unchanged and gets ONE app-level 308 to the
    canonical URL — Next's Location is relative, scheme-preserving, fine —
    while the browser hot path never sees a redirect. (The old shape here
    STRIPPED the trailing slash so next start 308'd "/film/" -> "/film" and
    the nginx `location = /film` 301 answered an absolute http:// Location
    behind the TLS tunnel — MC 10444 live finding.) Query partitioned and
    rejoined explicitly: the query rides along untouched."""
    target = path if path == root_path or path.startswith(root_path + "/") \
        else f"{root_path}{path}"
    path_part, sep, query = target.partition("?")
    return path_part + sep + query


def die(msg):
    sys.exit(f"film-launcher: {msg}")


def node_version(node_bin):
    """stdout of `node_bin --version`, or None on exec error/timeout (15s)."""
    try:
        out = subprocess.run([node_bin, "--version"], capture_output=True,
                             text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return None
    v = out.stdout.strip()
    return v if out.returncode == 0 and v.startswith("v") else None


def extract_vendored_node(target):
    """Extract ONLY member node-<ver>-linux-x64/bin/node from VENDOR_TARBALL
    into `target` (under RUNTIME/bin). Tarball sha256 verified BEFORE reading
    any member (see NODE_TARBALL_SHA256 comment). Race discipline: unique tmp
    name (same filesystem as target) + atomic os.replace, so a concurrent boot
    never reads a half-written binary and no writer can clobber another's
    tmp; makedirs(exist_ok=True) is the tolerated FileExistsError re-check."""
    if not os.path.exists(VENDOR_TARBALL):
        die(f"no system node and vendored runtime missing: {VENDOR_TARBALL} "
            "(MC 10444 D1)")
    digest = hashlib.sha256()
    with open(VENDOR_TARBALL, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    if digest.hexdigest() != NODE_TARBALL_SHA256:
        die(f"vendored tarball sha256 mismatch: {VENDOR_TARBALL}")
    os.makedirs(os.path.dirname(target), exist_ok=True)
    tmp = f"{target}.tmp.{os.getpid()}"
    try:
        with tarfile.open(VENDOR_TARBALL, "r:xz") as tar:
            src = tar.extractfile(f"node-{NODE_VERSION}-linux-x64/bin/node")
            if src is None:
                die(f"member bin/node absent from {VENDOR_TARBALL}")
            with open(tmp, "wb") as out:
                shutil.copyfileobj(src, out)
        os.chmod(tmp, 0o755)
        os.replace(tmp, target)  # atomic publish: readers see old or complete
    except (OSError, tarfile.TarError) as exc:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        die(f"vendored node extraction failed: {exc}")


def resolve_node():
    """(a) shutil.which("node") as always; else (b) the app-vendored runtime,
    extracted on first boot into RUNTIME and reused while it answers
    --version. Journal always names kind + path + version."""
    node = shutil.which("node")
    if node is not None:
        print(f"film-launcher: node resolved: system ({node} "
              f"{node_version(node) or '--version failed'})",
              file=sys.stderr, flush=True)
        return node
    target = os.path.join(os.environ.get("HOME") or tempfile.gettempdir(),
                          f"film-node-{NODE_VERSION}", "bin", "node")
    if node_version(target) is None:  # absent OR incomplete -> (re-)extract
        extract_vendored_node(target)
        if node_version(target) is None:
            die(f"extracted vendored node fails --version: {target} "
                "(never exec an unverified runtime)")
    print(f"film-launcher: node resolved: vendored ({target} "
          f"{node_version(target)})", file=sys.stderr, flush=True)
    return target


PORT = int(os.environ.get("PORT") or 0)  # unit contract: Environment=PORT=<port>
if not PORT:
    die("PORT env missing — the systemd unit contract supplies it")
NODE = resolve_node()  # typed fail-fast inside: journalctl names the cause (D1 path)
if not os.path.exists(ENTRY):
    die(f"committed artifact missing: {ENTRY} (see DEPLOY-BUILD.md)")


def pick_inner_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


INNER = pick_inner_port()
# HOSTNAME=127.0.0.1: standalone server.js binds process.env.HOSTNAME — loopback
# only, same doctrine as the outer bind. cwd=STANDALONE: the artifact is self-contained.
APP = subprocess.Popen(
    [NODE, "server.js"],
    cwd=STANDALONE,
    env={**os.environ, "PORT": str(INNER), "HOSTNAME": "127.0.0.1"},
)


def watch_child():
    code = APP.wait()
    print(f"film-launcher: node child exited (code={code}); launcher exiting non-zero "
          "so systemd Restart=on-failure restarts the pair", file=sys.stderr, flush=True)
    os._exit(code if isinstance(code, int) and 0 < code < 256 else 1)


def forward_signal(signum, _frame):
    APP.terminate()
    sys.exit(0)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive upstream + accurate Content-Length below

    def _tunnel(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        try:
            conn = HTTPConnection("127.0.0.1", INNER, timeout=UPSTREAM_TIMEOUT)
            headers = [(k, v) for k, v in self.headers.items()
                       if k.lower() not in HOP_BY_HOP]
            conn.request(self.command, re_prefix(self.path),
                         body=body, headers=dict(headers))
            resp = conn.getresponse()
            data = resp.read()  # de-chunks; we re-frame with our own Content-Length
        except OSError as exc:  # node still booting, died mid-request, or timed out
            data = b'{"ok":false,"error":{"code":"UPSTREAM_UNAVAILABLE","message":"film app not reachable"}}'
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)
            print(f"film-launcher: upstream error: {exc}", file=sys.stderr, flush=True)
            return
        self.send_response(resp.status, resp.reason)
        for k, v in resp.getheaders():
            low = k.lower()
            if low in HOP_BY_HOP or (low == "content-length" and self.command != "HEAD"):
                continue  # HEAD keeps upstream's Content-Length (describes the GET body)
            self.send_header(k, v)
        if self.command != "HEAD":
            self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
        conn.close()

    do_GET = do_POST = do_HEAD = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = _tunnel

    def log_message(self, fmt, *args):  # journal-bound access line, one per request
        print(f"film-launcher: {self.address_string()} {fmt % args}", file=sys.stderr, flush=True)


def wait_for_inner(deadline_s=30):
    """Don't accept outer traffic until node's port answers (staging gate probes
    immediately; a refused inner connect would surface as a false 502)."""
    end = time.monotonic() + deadline_s
    while time.monotonic() < end:
        if APP.poll() is not None:
            die(f"node child exited during startup (code={APP.returncode})")
        try:
            with socket.create_connection(("127.0.0.1", INNER), timeout=0.5):
                return
        except OSError:
            time.sleep(0.1)
    die(f"node child did not start serving within {deadline_s}s")


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, forward_signal)
    signal.signal(signal.SIGINT, forward_signal)
    threading.Thread(target=watch_child, daemon=True).start()
    wait_for_inner()
    print(f"film-launcher: serving :{PORT} -> 127.0.0.1:{INNER}{root_path}/ "
          f"(node pid {APP.pid})", file=sys.stderr, flush=True)
    # 127.0.0.1 ONLY (fleet doctrine vm106-render-apps.py L15): the public path
    # is nginx + the Cloudflare tunnel, never this socket.
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
