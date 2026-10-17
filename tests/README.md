# tests/ — integration suite for the Compileit filmsida

How to run: `npm run build` (a production build must exist — the suite boots
it with `next start`), then `node --test tests/app.integration.test.mjs`
from the repo root (or `node --test tests/*.test.mjs`; the bare directory
form `node --test tests/` errors with `ERR_UNSUPPORTED_DIR_IMPORT` on this
seat's node v22.23.2 — a runner quirk, not a test failure). The suite is
node stdlib only (no new deps) and owns the whole lifecycle: it starts the
fixture TMDB server (`tests/fixtures/server.mjs`, port 3001), one app
instance WITH `TMDB_API_KEY` (port 3211), one WITHOUT the key (3212) and
one pointing at a dead upstream (3213), waits for them to answer, runs the
PLAN §5 contract suite (envelopes, 400/429/500→502/503, bearer +
`language=sv-SE` attribution, TV fold, w500/w1280 URL seam, image
remotePatterns, SSR shell + built-chunk copy), and kills exactly the PIDs
it started when done. Ports collide with nothing else by convention:
app 3000/3210 belong to humans, 3001/3211/3212/3213 to this suite; override
with `FIXTURE_PORT` / `APP_PORT` / `NOKEY_PORT` / `DEAD_PORT` env. Client
states behind hydration (`/search?q=`, discover chips) are asserted as
built-chunk copy here and were exercised live in the browser pass recorded
in `TEST-verdict.md`.

`tests/w4-ssr-shell.test.mjs` (TEST-c2 additive hardening) pins the W4 SSR
shell over HTTP: exactly one canon h1 per route in the SERVER HTML, the
h1↔query single-source boundaries (first-of-repeated, trim, diacritics,
HTML-escaping), the Nav search field — `SearchFieldFallback` on the static
`/`, the LIVE field on the dynamic `/discover` and `/search` (MC 10333 T9
flipped that arm) — putting `<form role="search">` + one
`input[type=search]` into every route's delivered HTML, and `aria-busy`
loading regions. It boots its OWN fixture + app on `W4_FIXTURE_PORT`
(default 3004) / `W4_APP_PORT` (default 3227) so the documented glob
`node --test tests/*.test.mjs` runs both files concurrently without port
collisions; it never clears `.next/cache` (its assertions are warm-cache
stable by design).

`tests/discover-filters.test.mjs` (MC 10333 T9) gates the §3 numeric
filter/count contract (F1–F11) and `tests/detail-search.test.mjs` gates
the `/api/search` sections fan-out, the `/movie/[id]` SSR detail (D1–D3)
and the §7b/§7c shell (S1–S6). Each owns its OWN fixture + app boot:
`discover-filters` on `FILTERS_FIXTURE_PORT`/`FILTERS_APP_PORT` (defaults
3005/3228), `detail-search` on `DS_FIXTURE_PORT`/`DS_APP_PORT` (defaults
3006/3229) — disjoint from 3001/3211–3213 and 3004/3227, so the
documented glob runs the files concurrently without port races.

`tests/tv.test.mjs` (MC 10610 T10b) gates the media axis: gates T1–T10
over the `?type=` API switch (trending/genres/discover fan-out + year
mapping, strict 400, popular-arm byte pins, the `/tv/[id]` SSR detail,
the `/search/multi` split with its three-call fan-out, the tier-1 pills'
served bytes incl. the T9 tree-order/implicit-submit pin) and the KEYLESS
tv surface. It boots its OWN fixture + keyed app + keyless twin on
`TV_FIXTURE_PORT`/`TV_APP_PORT`/`TV_NOKEY_PORT` (defaults 3007/3230/3231 —
3007 is the port the image allow-list row `next.config.mjs` names for
this file, and the NOKEY precedent is 3212's keyless twin), making the
glob a five-file concurrent run.

`tests/tv-arms.test.mjs` (MC 10877 P2-1) gates the two TV rails the T-suite
never touched: `/api/now-playing?type=tv` (→ `/tv/on_the_air`) and
`/api/top-rated?type=tv` (→ `/tv/top_rated`) — envelope ids/title/mediaType
derived from the tv fixtures, the never-touch-`/movie/*` ring pins, and the
keyless 503 `TMDB_NOT_CONFIGURED` twin of T10 for these two routes (the
envelope ring then covers all five type-aware routes). It is a SPLIT, not
an append: `tv.test.mjs` sits at 539 of the 600-line file cap. Own fixture +
keyed app + keyless twin on `TVARMS_FIXTURE_PORT`/`TVARMS_APP_PORT`/
`TVARMS_NOKEY_PORT` (defaults 3008/3232/3233 — disjoint from all five
siblings), making the glob a six-file concurrent run.

Port caveat (measured TEST-c2): the `next/image` allow-list gate in
`app.integration.test.mjs` is baked at BUILD time by `next.config.mjs`
(remotePatterns port 3001). With `FIXTURE_PORT` ≠ 3001 the "allows the
fixture host" half fails BY DESIGN of the allow-list — run that file with
the fixture on 3001 to exercise it; the refusal half (foreign host,
unregistered port) passes on any override.

