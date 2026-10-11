# DEPLOY-BUILD — how the committed `deploy/` artifact is produced (MC 10444)

`deploy/` is a COMMITTED build artifact, not generated on the host. The vm106
reconciler mirrors the repo working tree verbatim — there is no build step on
vm106 — so the served bytes ARE these bytes.

## Release command (verbatim)

From the repo root, with dependencies installed (`npm ci`):

```
NEXT_PUBLIC_BASE_PATH=/film npm run build
```

Then copy per PLAN-t10 §3:

```
.next/standalone  →  deploy/standalone            # server.js + node_modules + package.json
.next/static      →  deploy/standalone/.next/static
public            →  deploy/standalone/public
```

`basePath` is BUILD-TIME (`NEXT_PUBLIC_BASE_PATH` drives `next.config.mjs`
basePath and the `useApi.ts` fetch prefix — the only two files the prefix
touches). Local dev stays unprefixed: env unset ⇒ `BASE=""`.

## Drift rule (release-command law)

ANY change under `src/`, `next.config.mjs` or `package.json` ⇒ rebuild with the
command above and recommit `deploy/` **IN THE SAME COMMIT**. Committed bytes
disagreeing with `src/` is broken release discipline: the mirror serves the
committed artifact, so a stale `deploy/` ships a stale product.

## Sizing

Standalone build = ~1696 files / 25 MB (measured at MC 10444 planning) — under
the reconciler's `MAX_MIRROR_FILES = 4000` cap. If a rebuild grows the tree
past ~3800 files, trim before pushing (cap trip = repo never mirrors = dark).

## Runtime shape

`systemd → /usr/bin/python3 server.py` (outer `$PORT` 8161, 127.0.0.1 only)
`→ node deploy/standalone/server.js` (random loopback inner port) — server.py
re-prefixes `/film/*` because nginx `location /film/` strips the prefix before
proxying. Full chain: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
