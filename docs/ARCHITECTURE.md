# ARCHITECTURE — film (bryn1/film, public hosting copy)

> **Status: PORTED + HOSTING ROWS — bryn1/film @ MC 10444, 2026-10-11.** Tree
> ported verbatim from `compileit-ab/code-test` branch `feature/compileit-filmsida`
> at `8d4ea91` (the source of truth; product rows below carried from its closing
> re-derive). This file adds the **Hosting** section: the vm106 chain that serves
> this repo at https://sibbamala.com/film/. Everything under it still describes
> the product; product changes originate in the source line (owner doctrine).
>
> **Source-repo status line (verbatim, its tree at `d65d7ae`/`8d4ea91`):**
> **T9 rows re-derived 2026-10-09 from
> the tree at `9a0201d`, CLOSING re-check at TIP `d65d7ae`** (MC 10333, plan
> `.audits/202610081837-bab658dd/out/ARCHITECT-PLAN.md` Rev 4.1). Verification basis: `git ls-files` / `find` / `wc` file inventory,
> `.next/prerender-manifest.json` route classification, `package.json`, `next.config.mjs`,
> `.env.example` and the `tests/**` headers — everything below is re-derived from the artifact,
> not carried from a report. Original placement plan:
> `.audits/202610071347-bab658dd/out/PLAN-placement.md`. Design tokens/copy live in
> [DESIGN.md](DESIGN.md) and [design/COMP-NOTES.md](design/COMP-NOTES.md), NOT here.
>
> **Hosted deltas at port (the ONLY three):** `next.config.mjs` gains
> `output:"standalone"` + build-time `basePath` from `NEXT_PUBLIC_BASE_PATH`;
> `useApi.ts` gains the matching `BASE` fetch prefix; `package.json` gains the
> `test` script. Plus the hosting files: `hosting.yaml`, `server.py`,
> `DEPLOY-BUILD.md`, committed `deploy/`. See [Hosting](#hosting-vm106--sibbamalacomfilm).

## What this is

Compileit case app ([README](../README.md)): a Swedish movie site over the TMDB API — startsida
(trending / now playing / top rated), a discover page combining ONE genre chip with numeric
filters (vote range, release-year range, result count 20–200, company) since MC 10333 T9, a
server-rendered film detail page at `/movie/[id]`, and free-text search in every view returning
three sections (filmer / personer / produktionsbolag). Template: Next.js 14.1.3 App Router, TypeScript strict, upstream
`compileit-ab/code-test`, branch `feature/compileit-filmsida`.

## Entrypoints & ports

| Entry | Command | Port |
|---|---|---|
| dev server | `npm run dev` (next dev) | 3000 (next default) |
| prod build / start | `npm run build && npm run start` | 3000 |
| lint | `npm run lint` | — |
| fixture TMDB stand-in (tests only) | `node tests/fixtures/server.mjs` | 3001 (env `FIXTURE_PORT`) |
| integration suite (boots own fixture + 3 app instances) | `node --test tests/app.integration.test.mjs` | fixture 3001 · app WITH key 3211 · app WITHOUT key 3212 · app on dead upstream 3213 (env `FIXTURE_PORT`/`APP_PORT`/`NOKEY_PORT`/`DEAD_PORT`) |
| SSR-shell suite (boots own fixture + app) | `node --test tests/w4-ssr-shell.test.mjs` | 3004 / 3227 (env `W4_FIXTURE_PORT`/`W4_APP_PORT`) — deliberately disjoint from the other file so the documented glob `node --test tests/*.test.mjs` runs both concurrently |
| discover-filters suite (MC 10333 T9; own fixture + app) | `node --test tests/discover-filters.test.mjs` | 3005 / 3228 (env `FILTERS_FIXTURE_PORT`/`FILTERS_APP_PORT`) |
| detail-search suite (MC 10333 T9; own fixture + app) | `node --test tests/detail-search.test.mjs` | 3006 / 3229 (env `DS_FIXTURE_PORT`/`DS_APP_PORT`) |
| **hosted (vm106)** | systemd `vm106-app-film.service` → `/usr/bin/python3 server.py` → spawns `node deploy/standalone/server.js` | **8161** (outer `$PORT`, systemd unit contract) / inner port = ephemeral loopback (launcher picks a free 127.0.0.1:0 port) |

Port convention (tests/README): 3000/3210 belong to humans; 3001/3211–3213, 3004/3227,
3005/3228 and 3006/3229 to the suites — all four files run concurrently under the glob.
Hosted: 8161 inside the reconciler window 8100–8199, both binds **127.0.0.1 only** —
the public path is nginx + the Cloudflare tunnel.
No new processes, no containers, no database daemon. One deployable: the Next app.

**Image-allow-list port caveat (F1, measured TEST-c2; ports re-derived at `9a0201d`):**
`next.config.mjs` bakes the `next/image` `remotePatterns` ports **3001 + 3005 + 3006** (the
three fixture hosts) into the build. With `FIXTURE_PORT` ≠ 3001 the
"allows the fixture host" half of the image allow-list gate fails BY DESIGN of the allow-list —
run that file with the fixture on 3001 to exercise it (the refusal half passes on any override).

## Rendering model (per route — re-derived from `.next/prerender-manifest.json` at this build)

| Route | Kind | Single-h1 mechanism (DA P2-1 invariant: exactly one h1 per route, in the SSR HTML) |
|---|---|---|
| `/` (startsida) | static prerender (in manifest `routes`) | h1 lives **inside a client component**: `src/app/page.tsx` is `"use client"`. The prerendered HTML still carries it (initial render = loading state ⇒ sr-only "Trending"); post-hydration the h1 is the hero title when present. |
| `/discover` | **DYNAMIC (λ)** since MC 10333 T9 — absent from manifest `routes` | SERVER `page.tsx` renders the single h1 OUTSIDE the Suspense boundary (unchanged) and additionally reads all seven §3 filter params server-side, rendering the SERVER `FilterBar` (S5: controls are in the served bytes); the client body `Discover.tsx` renders no heading and takes the params as props. |
| `/movie/[id]` | **DYNAMIC (λ)** — MC 10333 T9 | SERVER page (no client component at all): h1 = the film title, detail loaded server-side via `lib/tmdb/detail.ts`; `/^\d+$/` guard and TMDB 404 both `notFound()`; other upstream failure renders the COPY error block (D1–D3). |
| `/search` | **DYNAMIC (λ)** — absent from manifest `routes` | SERVER `page.tsx` reads `searchParams` and renders the h1 ITSELF (`Sökresultat för "<q>"`; first-of-repeated `?q=`, trimmed); the client body receives the SAME trimmed q as a prop. |

`/search` dynamic is an **accepted decision** (DA ledger): the required cost of an h1 that reflects
the query server-side — reading `searchParams` opts the route out of prerender. Since MC 10333 T9
`/discover` joins it — the same mechanism, accepted for the same reason: the FilterBar must be in
the served HTML (S5's F-1 mechanism), which requires server-side `searchParams`; `/movie/[id]` is
dynamic by nature (per-id fetch). Tiny per-request renders, no harm at this scale.

Search-field split (pinned by TEST-c2 gate W3, arm split flipped by MC 10333 T9): the STATIC
prerender (`/`) delivers the **SearchFieldFallback** from Nav's Suspense boundary in the HTML
(`action="/search" method="get"`, aria-labelled, and NO `id="site-search"` — absence is pinned, so
fallback+live cannot coexist); the DYNAMIC routes (`/discover`, `/search*`) server-render the
**LIVE** field instead (label `for="site-search"`, no `action`; the input carries `value="<q>"`
on /search — field↔URL sync before any JS).

## Modules (actual tree — re-derived at b706a91)

- **Pages/routes** (App Router): `src/app/layout.tsx` (root: `lang="sv"`, `data-theme="dark"`,
  Inter via `next/font`, Nav shell + `<main id="main">`), `src/app/page.tsx` (startsida,
  `"use client"` — hero + three rails, each with its own `useApi` so states are independent),
  `src/app/discover/page.tsx` (SERVER h1) + `src/app/discover/Discover.tsx` (client body:
  chips + grid + count), `src/app/search/page.tsx` (SERVER h1 + `searchParams`) +
  `src/app/search/SearchResults.tsx` (client body, q via prop, renders no heading),
  `globals.css`, `favicon.ico`.
- **API route handlers** (per-request; keep the key server-side): `/api/trending`,
  `/api/now-playing`, `/api/top-rated`, `/api/genres`,
  `/api/search?q=` (T9: ONE `Promise.all` fan-out over `/search/movie` + `/search/person` +
  `/search/company`, fail-closed — `data` is `{movies, people, companies}`), and
  `/api/discover` (T9: numeric params `genre`, `min_score`/`max_score` (clamped 0–10),
  `year_from`/`year_to` (1878–2100 → `primary_release_date.gte/lte`), `count` (positive int
  else 400; values above 200 CLAMP to 200 — they do NOT 400; the route fans out ≤10 upstream
  pages in parallel, `page` only for pages ≥2, dedupes by id and slices — upstream never sees
  `count`), `company`; no recognized param at all ⇒ `/movie/popular` as
  before; validation lives ONLY in `src/lib/api/query.ts` (`buildDiscoverParams`, "" ≡ absent,
  400 messages)). All callers of the TMDB seam: the route handlers **and SERVER components (via
  `detail.ts`) since T9** — the client bundle never reaches it. Response envelope via
  `src/lib/api/envelope.ts` (`ok`/`fail`):
  200 `{ok:true,data}` · error `{ok:false,error:{code,message}}`
  (503 TMDB_NOT_CONFIGURED · 502/429 TMDB_UPSTREAM_ERROR · 400 BAD_REQUEST). Empty result = 200 `data:[]`.
- **Components** (CSS Modules, the template's mechanism — no Tailwind): Nav (skip link,
  aria-current, SearchField under Suspense), SearchField (exports the live field AND the
  `useSearchParams`-free `SearchFieldFallback`), FilterBar (T9: SERVER native-GET form, no
  `role` — C3-4; five controls + hidden `filter` outside Suspense), MovieCard (T9: the card
  LINKS to `/movie/<id>`), PosterGrid, MovieRail, FilterChips,
  states/{EmptyState,ErrorState,Skeleton}.
- **lib (single seams)**: `src/lib/format.ts` — the ONE home for shared display copy
  (`COPY`: 503/generic error strings, the page `<h1>`s and since T9 the detail/section/filter
  labels, COMP-NOTES canon verbatim; `TMDB_KEY_MARKER`) and display formatters
  (`formatReleaseYear`, `formatRating` sv-SE comma); client-safe by contract (no env reads,
  no fetch). `src/lib/tmdb/client.ts` — the ONLY file that touches TMDB (`tmdbFetch`,
  `tmdbImageUrl`, `normalizeMovie(s)`/`normalizeGenres`, `TmdbError`; the env seam
  `TMDB_API_KEY`/`TMDB_BASE_URL`/`TMDB_IMAGE_BASE` lives here); `src/lib/tmdb/detail.ts` (T9)
  — pure shaping + `fetchMovieDetail` (delegates its one call to `tmdbFetch`; also
  `normalizePeople` knownFor movie-only ≤4 and `normalizeCompanies` "" ⇒ field OMITTED);
  `src/lib/api/query.ts` (T9) — the ONLY validation layer for discover params (routes do no
  numeric math); `src/lib/tmdb/types.ts`; `src/lib/api/envelope.ts`; `src/lib/useApi.ts`
  (client fetch hook — components never call TMDB directly).
- **Tests/fixtures**: FOUR suite files (gates re-derived at TIP `d65d7ae`; CLOSING counted
  actuals) —
  `tests/app.integration.test.mjs` (562 lines, 19 gates: contract, envelope, negatives,
  attribution, image-allow-list), `tests/w4-ssr-shell.test.mjs` (299 lines, 4 gates: W1–W4
  SSR-shell over delivered HTML), `tests/discover-filters.test.mjs` (T9; 328 lines, 12 gates:
  F1–F11 + F5b, fixture 3005/app 3228) and `tests/detail-search.test.mjs` (T9; 501 lines, 13
  gates: S1–S6 + S5b echo + D1–D3 + the three search gates relocated from integration in
  commit-0; fixture 3006/app 3229) — **48 gates total** (base had 26 = 22 integration + 4 w4;
  22 gates are new — but commit-0 MOVED 3 integration search gates into detail-search, so
  integration now reads 19 and detail-search's 13 include those 3; S1's three-path ring assert
  recovers the attribution coverage the relocation removed) against the built app via `next
  start`. Fixture seam: `tests/fixtures/server.mjs`
  (315 lines) + `tests/fixtures/pool.mjs` (70 lines — the §6 `filterPool`/`pageWindow`/
  `distinctUnion` mechanics shared by fixture and gates) + `tests/fixtures/data/*.json`
  (12 fixtures, 3113 lines; `movies-discover-pool.json` is the 192-item filter pool with the
  §6 conjunction rows incl. poisons `99998→500 / 99997→429 / 99999→200∅ / 99996→page≥2-500`,
  scoped to sole-`with_genres` requests), pointed at via `TMDB_BASE_URL`/`TMDB_IMAGE_BASE`.
  Node stdlib only — the suites add no dependency. One mechanism, no others.

## Dependencies (unchanged from template; re-verified against `package.json` at b706a91)

runtime: next 14.1.3, react ^18, react-dom ^18 · dev: typescript ^5, eslint ^8, eslint-config-next
14.1.3, @types/*. **Build rule: add NO new dependency** — the app uses plain fetch, no SDK, no
styling framework, no state library — re-verified unchanged at `9a0201d` (MC 10333 T9 added
zero). next/image IS used (remotePatterns: `image.tmdb.org` + `localhost:3001/3005/3006`,
see the port caveat above). Fonts via `next/font/google` (Inter) — no font
dependency.

## Data stores

None local. No DB, no file store, no client persistence. One remote data source: **TMDB API v3**
(read-only, Bearer key). HTTP caching only (`fetch next.revalidate`: 600 s default for lists,
86400 s for genres). Images hotlinked from TMDB CDN via next/image.

## Env vars (never committed; `.env.local` is gitignored; no secrets in the repo)

`.env.example` is the operator seam: a Swedish-commented "copy me to `.env.local`" file (the key
never enters the repo — `.env.local` is gitignored).

| Var | Default | Purpose |
|---|---|---|
| `TMDB_API_KEY` | — (unset ⇒ honest 503 state) | Bearer token, server-side only |
| `TMDB_BASE_URL` | `https://api.themoviedb.org/3` | API seam (fixtures point here) |
| `TMDB_IMAGE_BASE` | `https://image.tmdb.org/t/p` | image seam (fixtures point here) |

## Conventions

File hygiene ~250/400 (header reason if >400), tests ≤600, fixtures/config/data exempt. At
`d65d7ae`: largest src file is 218 lines (`Discover.tsx`) — no src file above the 250 soft cap,
so no header reason lines are required; the largest test file is `app.integration.test.mjs` at
562/600 (after the commit-0 relocation), `detail-search.test.mjs` next at 501/600 — both
legal. No TODO/FIXME markers in src or tests. Commits authored
`git -c user.name="<profile> (10252.1)" -c user.email="<profile>@agent-town.local"` — never `git config`.

## Hosting (vm106 — sibbamala.com/film)

Chain (MC 10444, PLAN-t10 §§1–4 — the hosting rows this port adds):

| Link | Fact |
|---|---|
| Discover | **public under bryn1 + a valid `hosting.yaml` at the root IS the deploy signal** — the reconciler (`RECONCILE_ORGS=bryn1`, hosting.yaml required) picks the repo up on a ~15-min tick; there is no separate publish step. name→path: `film` ⇒ `sibbamala.com/film/`. |
| Unit | `vm106-app-film.service` (rendered from the production template); `ExecStart=/usr/bin/python3 <workdir>/server.py`; env contract = `HOME` + `PORT=8161` ONLY — **no `EnvironmentFile` anywhere ⇒ no `TMDB_API_KEY` reaches the hosted app today (B2 blocker, owner decision D2 open).** |
| Launcher | `server.py` (stdlib only, no venv) binds **127.0.0.1:8161** (fleet doctrine: services bind loopback only, the internet path is the Cloudflare tunnel), spawns `node deploy/standalone/server.js` on an ephemeral loopback inner port (`PORT`/`HOSTNAME` env), and forwards every request re-prefixed with `root_path="/film"`. If the node child exits, the launcher exits non-zero so `Restart=on-failure` restarts the pair. Lowercase literal `root_path` = the shape reconcile.py's case-sensitive `PREFIX_REWRITER_RE` blesses. |
| nginx | `location = /film { return 301 /film/; }` + `location /film/ { proxy_pass http://127.0.0.1:8161/; }` — the trailing slash **strips** the `/film` prefix before the app; the launcher re-prefixes it back for the basePath-baked build (§4 mismatch resolved here, not in nginx). |
| Artifact | `deploy/standalone/` is **committed** — the mirror has no build step, served bytes ARE repo bytes (same-commit drift rule in [DEPLOY-BUILD.md](../DEPLOY-BUILD.md)). `hosting.yaml` `mirror` block: `cachebust:"off"` (built Next bytes ship untouched; rewriting minified JS refs is unbounded risk) + root-anchored `/.next/**` defensive exclude — `deploy/standalone/.next/static` is **intentionally served** (root anchor can't reach it, mirror.py `_glob_re` rule). |
| Keyless state (honest) | Without D2 the hosted copy serves its **fail-closed keyless product**: pages render 200 with the error block and the `Kunde inte nå filmdatabasen` fallback, `/api/*` envelopes return 503 `TMDB_NOT_CONFIGURED` — zero film data, zero crashes. That is a DEGRADED product, not a malfunction; do not report it as "shows films". |

Prefix-safety gates: `basePath:"/film"` is baked at build time so every served HTML
asset ref is `/film/_next/...` (prefixed, not bare — `BARE_ASSET_RES` clean), and
`server.py` carries the literal lowercase `root_path` (`PREFIX_REWRITER_RE` matches)
— the repo passes both limbs.
