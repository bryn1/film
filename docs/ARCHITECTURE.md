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
> **MC 10610 T10b re-derived at this commit (2026-10-12, plan
> `.audits/202610111724-bab658dd/out/PLAN-t10b.md` Rev 3): TV shows are
> selectable.** The rows below carry the media axis: `?type=movie|tv` on
> the five list APIs (strict 400 validation in `query.ts`, absent ≡
> movie), `/tv/[id]` detail (λ, SHARED `DetailContent` render with
> `/movie/[id]`), tier-1 media pills on `/discover`, three TV rails on
> `/`, the `/search/multi` fan-out with a fourth result section, and
> `tests/tv.test.mjs` (fixture 3007 / app 3230 / keyless 3231) — five
> suite files, 60 gates.
>
> **MC 10612 T10c re-derived at this commit (2026-10-17, plan
> `.audits/202610111724-bab658dd/out/PLAN-t10c.md` Rev 1, DA-SHIP): the
> detail score is a LINK.** Both detail pages' meta rows carry the score
> badge as an external anchor `https://www.themoviedb.org/{movie|tv}/{id}`
> (`target=_blank rel="noopener noreferrer"`, aria-label names destination
> + new tab, visible badge text unchanged) plus an adjacent IMDb link ONLY
> when the id is known — TMDB's `imdb_id` absent|null|"" all fold to null
> (`||`, the `normalizeCompanies` F-11d falsy-fold precedent), so no
> `imdb.com/title//` dead link can render. Data axis: three additive rows
> (`TmdbMovieDetailRaw.imdb_id`, `MovieDetail.imdbId`, one
> `normalizeDetail` row) — detail-ONLY, the `Movie`/MOVIE_KEYS list pins
> untouched. Gates: +D4/D5 (detail-search) +T11/T12 (tv), 0 existing gates
> updated; the suite is SIX files since MC 10877 landed `tv-arms.test.mjs`
> (fixture 3008 / app 3232 / keyless 3233) — **67 gates measured**.
>
> **Hosted deltas at port (prefix seam + hosting files):** `next.config.mjs`
> gains `output:"standalone"` + build-time `basePath` from
> `NEXT_PUBLIC_BASE_PATH` + `trailingSlash:true` (canonical URL shape carries
> the trailing slash — see Hosting → nginx/Launcher rows, MC 10444 fix-cycle
> 1); the raw-ref sweep goes through ONE home,
> `src/lib/basePath.ts` (`BASE`), consumed by `useApi.ts` (fetch) and the form
> `action`s of `SearchField.tsx` + `FilterBar.tsx` — basePath rewrites `<Link>`
> hrefs but NOT raw fetches/actions (DA gate MC 10444 FIX-1); `package.json`
> gains the `test` script. Plus the hosting files: `hosting.yaml`, `server.py`,
> `DEPLOY-BUILD.md`, committed `deploy/`. See [Hosting](#hosting-vm106--sibbamalacomfilm).

## What this is

Compileit case app ([README](../README.md)): a Swedish movie/TV site over the TMDB API — startsida
(trending / now playing / top rated as three movie rails AND, since MC 10610, three TV rails
below them; the hero stays movie-only), a discover page combining ONE genre chip with numeric
filters (vote range, release-year range, result count 20–200, company) since MC 10333 T9 plus
the MC 10610 tier-1 media pills (filmer / TV-serier), server-rendered detail pages at
`/movie/[id]` AND `/tv/[id]` (one shared render, two loaders), and free-text search in every
view returning four sections (filmer / TV-serier / personer / produktionsbolag). Template:
Next.js 14.1.3 App Router, TypeScript strict, upstream
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
| tv suite (MC 10610 T10b; own fixture + keyed app + KEYLESS twin) | `node --test tests/tv.test.mjs` | 3007 / 3230 / keyless 3231 (env `TV_FIXTURE_PORT`/`TV_APP_PORT`/`TV_NOKEY_PORT`) |
| tv-arms suite (MC 10877 P2-1; own fixture + keyed app + KEYLESS twin) | `node --test tests/tv-arms.test.mjs` | 3008 / 3232 / keyless 3233 (env `TVARMS_FIXTURE_PORT`/`TVARMS_APP_PORT`/`TVARMS_NOKEY_PORT`) |
| **hosted (vm106)** | systemd `vm106-app-film.service` → `/usr/bin/python3 server.py` → spawns `node deploy/standalone/server.js` | **8161** (outer `$PORT`, systemd unit contract) / inner port = ephemeral loopback (launcher picks a free 127.0.0.1:0 port) |

Port convention (tests/README): 3000/3210 belong to humans; 3001/3211–3213, 3004/3227,
3005/3228, 3006/3229, 3007/3230–3231 and 3008/3232–3233 to the suites — all six files run
concurrently under the glob.
Hosted: 8161 inside the reconciler window 8100–8199, both binds **127.0.0.1 only** —
the public path is nginx + the Cloudflare tunnel.
No new processes, no containers, no database daemon. One deployable: the Next app.

**Image-allow-list port caveat (F1, measured TEST-c2; ports re-derived at `9a0201d`, +3007 at
MC 10610):**
`next.config.mjs` bakes the `next/image` `remotePatterns` ports **3001 + 3005 + 3006 + 3007** (the
four fixture hosts) into the build. With `FIXTURE_PORT` ≠ 3001 the
"allows the fixture host" half of the image allow-list gate fails BY DESIGN of the allow-list —
run that file with the fixture on 3001 to exercise it (the refusal half passes on any override).

## Rendering model (per route — re-derived from `.next/prerender-manifest.json` at this build)

| Route | Kind | Single-h1 mechanism (DA P2-1 invariant: exactly one h1 per route, in the SSR HTML) |
|---|---|---|
| `/` (startsida) | static prerender (in manifest `routes`) | h1 lives **inside a client component**: `src/app/page.tsx` is `"use client"`. The prerendered HTML still carries it (initial render = loading state ⇒ sr-only "Trending"); post-hydration the h1 is the hero title when present. |
| `/discover` | **DYNAMIC (λ)** since MC 10333 T9 — absent from manifest `routes` | SERVER `page.tsx` renders the single h1 OUTSIDE the Suspense boundary (unchanged; the h1 TEXT follows the media tier via `COPY.discoverH1[type]` since MC 10610) and additionally reads the seven §3 filter params + the `type` axis server-side (`one(searchParams.type)` — anything-not-tv PAINTS movie; the strict 400 lives on the API), rendering the SERVER `FilterBar` incl. the tier-1 media pills (S5 + T8/T9: pills and controls are in the served bytes); the client body `Discover.tsx` renders no heading and takes the params as props. |
| `/movie/[id]` | **DYNAMIC (λ)** — MC 10333 T9 | SERVER page (no client component at all): thin guard+loader shell — `/^\d+$/` guard and TMDB 404 both `notFound()`, other upstream failure renders the COPY error block (D1–D3) — then the SHARED `<DetailContent>` (MC 10610: extraction, not a copy) owns the h1 (the film title) and the whole detail render; fetch via `lib/tmdb/detail.ts`. The meta row carries the score as the external TMDB link + the conditional IMDb link, `_blank` + `noopener noreferrer` (MC 10612; the 404/error/keyless paths never instantiate DetailContent ⇒ stay link-free, T12). |
| `/tv/[id]` | **DYNAMIC (λ)** — MC 10610 T10b | The tv twin: identical guard/404/error-block shape + the SAME `DetailContent` through `fetchDetail("tv", id)`; tv-specific rows are data-driven inside DetailContent (`episode_run_time[0]` ⇒ "Avsnittslängd", `number_of_seasons` ⇒ "Säsonger: N", both null-omitted). T6/T6b. The score link's `tv` path segment rides `detail.mediaType` — zero new props (T11, MC 10612). |
| `/search` | **DYNAMIC (λ)** — absent from manifest `routes` | SERVER `page.tsx` reads `searchParams` and renders the h1 ITSELF (`Sökresultat för "<q>"`; first-of-repeated `?q=`, trimmed); the client body receives the SAME trimmed q as a prop. Since MC 10610 the results carry FOUR sections (filmer / TV-serier / personer / produktionsbolag), each section rendered only when non-empty. |

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
  `"use client"` — hero + SIX rails (three movie + three TV, MC 10610), each with its own
  `useApi` so states are independent; the hero stays movie-only),
  `src/app/discover/page.tsx` (SERVER h1, reads 7 filters + `type`) +
  `src/app/discover/Discover.tsx` (client body: chips + grid + count; the chip list and both
  API urls follow `params.type`, movie URLs stay byte-stable — `type` is emitted ONLY as tv),
  `src/app/movie/[id]/page.tsx` (SERVER guard+loader shell → `DetailContent`) +
  `src/app/tv/[id]/page.tsx` (the tv twin, MC 10610),
  `src/app/search/page.tsx` (SERVER h1 + `searchParams`) +
  `src/app/search/SearchResults.tsx` (client body, q via prop, renders no heading),
  `globals.css`, `favicon.ico`.
- **API route handlers** (per-request; keep the key server-side). THE MEDIA AXIS (MC 10610):
  `/api/trending`, `/api/now-playing`, `/api/top-rated` and `/api/genres` accept `?type=`
  (`movie|tv`, absent ≡ movie, anything else ⇒ 400 `"Ogiltig mediatyp."` — validation via
  `parseMediaType` in `query.ts`, routes themselves stay dumb): trending →
  `/trending/<type>/day`, now-playing → `/movie/now_playing` | `/tv/on_the_air`, top-rated →
  `/<type>/top_rated`, genres → `/genre/<type>/list` (revalidate 86400 kept on BOTH arms),
  `/api/search?q=` (T9 + MC 10610: ONE `Promise.all` fan-out over `/search/multi` (with
  `include_adult=false`) + `/search/person` + `/search/company` — `/search/movie` is REPLACED,
  still exactly three upstream calls; the multi results split by `media_type` and its `person`
  entries are DROPPED (dedicated person call is the only people source), fail-closed — `data`
  is `{movies, tv, people, companies}`), and
  `/api/discover` (T9 + MC 10610: numeric params `genre`, `min_score`/`max_score` (clamped
  0–10), `year_from`/`year_to` (1878–2100 → year mapping is PER TYPE: `primary_release_date.gte/
  lte` for movie, `first_air_date.gte/lte` for tv), `count` (positive int else 400; values
  above 200 CLAMP to 200 — they do NOT 400; the route fans out ≤10 upstream pages in parallel,
  `page` only for pages ≥2, dedupes by id and slices — upstream never sees `count`), `company`,
  `type`; no filter param beyond (an optional) `type` ⇒ `/movie/popular` | `/tv/popular` as
  the type's degenerate list, real filters ⇒ `/discover/<type>` (BOTH filter arms send
  `include_adult=false`; the popular arms do NOT); validation lives ONLY in
  `src/lib/api/query.ts` (`buildDiscoverParams` + `parseMediaType`, "" ≡ absent,
  400 messages)). All callers of the TMDB seam: the route handlers **and SERVER components (via
  `detail.ts`) since T9** — the client bundle never reaches it. Response envelope via
  `src/lib/api/envelope.ts` (`ok`/`fail`):
  200 `{ok:true,data}` · error `{ok:false,error:{code,message}}`
  (503 TMDB_NOT_CONFIGURED · 502/429 TMDB_UPSTREAM_ERROR · 400 BAD_REQUEST). Empty result = 200 `data:[]`.
- **Components** (CSS Modules, the template's mechanism — no Tailwind): Nav (skip link,
  aria-current, SearchField under Suspense), SearchField (exports the live field AND the
  `useSearchParams`-free `SearchFieldFallback`), FilterBar (T9 + MC 10610: SERVER native-GET
  form, no `role` — C3-4; tier-1 media pills are BUTTON submitters — NO hidden type input
  (double-emit trap), EVERY submitter names `type`, the `value={type}` plain-prop "Visa" button
  is the FIRST submit button in TREE order (react-dom 18.2.0 drops `defaultValue` on buttons —
  F-G probe; Enter-implicit-submit ships the current type, T9 byte-pins it), CSS `order` puts
  the pill row visually first (DOM ≠ visual), five controls + hidden `filter` outside Suspense,
  "Rensa filter" PRESERVES the tier under tv (F-B)), DetailContent (MC 10610: the SHARED
  server detail render — h1, meta (runtime|episodeRunTime + seasons rows), Handling, director,
  cast ≤12 — used by BOTH detail pages, one render two loaders; MC 10612: the meta row's
  score is an external raw-`<a>` (an absolute external href is not routing — the skip-link
  precedent) to `themoviedb.org/{mediaType}/{id}` + a conditional IMDb anchor
  (`imdbId !== null`), both `target=_blank rel="noopener noreferrer"`, aria-labels COMPOSED
  from COPY), MovieCard (T9: the card
  LINKS to `/movie/<id>` or `/tv/<id>` by `movie.mediaType` — normalized, so every card knows
  its type; tv cards carry a "TV" badge), PosterGrid, MovieRail, FilterChips,
  states/{EmptyState,ErrorState,Skeleton}.
- **lib (single seams)**: `src/lib/format.ts` — the ONE home for shared display copy
  (`COPY`: 503/generic error strings, the page `<h1>`s, the detail/section/filter labels
  (COMP-NOTES canon verbatim) and since MC 10610 the TYPE TWINS — `discoverH1`/
  `filters.count`/`filters.submit` per `movie|tv`, `typeMovie`/`typeTv`,
  `sections.tvShows`, `detail.episodeRuntime`/`detail.seasons`, MC 10612's
  `detail.ratingOnTmdb`/`detail.imdb`/`detail.newTab` (detail-link strings — only
  "IMDb" is COMP-NOTES-visible, the others compose aria-labels); `TMDB_KEY_MARKER`) and
  display formatters (`formatReleaseYear`, `formatRating` sv-SE comma); client-safe by
  contract (no env reads, no fetch). `src/lib/tmdb/client.ts` — the ONLY file that touches
  TMDB (`tmdbFetch`, `tmdbImageUrl`, `normalizeMovie(s)`/`normalizeGenres`, `TmdbError`;
  the env seam `TMDB_API_KEY`/`TMDB_BASE_URL`/`TMDB_IMAGE_BASE` lives here). Since MC 10610
  `normalizeMovie(raw, fallback: MediaType = "movie")` folds the tv shape ONCE —
  `mediaType` (raw `media_type` else the fallback), `title ?? name`,
  `releaseDate ← release_date ?? first_air_date` — so every list/rail/card downstream knows
  its type without endpoint knowledge. `src/lib/tmdb/detail.ts` (T9)
  — pure shaping + `fetchDetail(type, id)` (the ONE detail loader, `/{type}/{id}` with the
  credits append) + `fetchMovieDetail` delegating to it (the name is kept — the D-gates'
  seam), `normalizeDetail` adding `episodeRunTime` (`episode_run_time[0]` else null),
  `numberOfSeasons` and MC 10612's `imdbId: raw.imdb_id || null` — `||` NOT `??`: TMDB
  answers imdb_id absent, null OR "" and all three mean unknown; `""` under `??` would
  render `imdb.com/title//` dead (D5 falsifier; the `normalizeCompanies` ""-omission
  F-11d precedent); `normalizePeople` knownFor **movie|tv** ≤4 (mediaType-tagged,
  `title ?? name` — the search chip links `/tv/<id>` or `/movie/<id>` by the tag) and
  `normalizeCompanies` "" ⇒ field OMITTED; `src/lib/api/query.ts` (T9) — the ONLY validation
  layer: `buildDiscoverParams` (per-type year mapping, `include_adult=false` on the filter
  arms, `hasAny`/`hasFilters`) + `parseMediaType` the single `?type=` truth (absent ≡ movie,
  exact `movie|tv` pass, else 400 `"Ogiltig mediatyp."`); routes do no numeric math.
  `src/lib/tmdb/types.ts` (`MediaType = "movie" | "tv"`, `Movie.mediaType`,
  `SearchSections.tv`, `MovieDetail.episodeRunTime/numberOfSeasons`; MC 10612 adds
  `TmdbMovieDetailRaw.imdb_id?` + `MovieDetail.imdbId` — detail-ONLY, `Movie` stays
  key-list-pinned);
  `src/lib/api/envelope.ts`; `src/lib/basePath.ts` (hosted delta — the ONE `BASE` home,
  consumed by `useApi`/`SearchField`/`FilterBar` and NOTHING else — MC 10610 added zero new
  consumers: the pills are BUTTONs inside FilterBar's already-based form);
  `src/lib/useApi.ts` (client fetch hook — components never call TMDB directly; fetches via
  `BASE`).
- **Tests/fixtures**: SIX suite files (counts re-derived at this commit — MC 10877
  ADDED `tests/tv-arms.test.mjs`; MC 10612 ADDED the four score-link gates and UPDATED
  none; MC 10610 had ADDED `tests/tv.test.mjs` and UPDATED four named `detail-search`
  gates + the one integration key-list, per §5 of its plan) —
  `tests/app.integration.test.mjs` (567 lines, 19 gates: contract, envelope, negatives,
  attribution, image-allow-list; its `MOVIE_KEYS` pin carries `mediaType` since MC 10610 —
  a key-list truth-update, no assertion weakened), `tests/w4-ssr-shell.test.mjs` (299 lines,
  4 gates: W1–W4 SSR-shell over delivered HTML), `tests/discover-filters.test.mjs` (T9;
  328 lines, 12 gates: F1–F11 + F5b, fixture 3005/app 3228), `tests/detail-search.test.mjs`
  (T9; 581 lines, 15 gates: S1–S6 + S5b echo + D1–D3 + MC 10612's D4/D5 (score anchor
  attr-parsed + the `""`-fixture `||`-fold falsifier) + the three search gates relocated from
  integration in commit-0; fixture 3006/app 3229 — MC 10610 §5 UPDATED exactly four of them:
  S1's envelope-keys `deepEqual` (+= `tv`) + its ring path (`/search/movie`→`/search/multi`),
  the "empty search results" whole-object `deepEqual` (+= `tv: []`), the "search normalizes
  query" ring path, and S2's knownFor `deepEqual`s widened `movie|tv` with `mediaType`), and
  `tests/tv.test.mjs` (MC 10610; 575 lines, 14 gates T1–T10 + T6b/T7b + MC 10612's
  T11/T12: the `?type=` API
  switch, strict-400 `type`, the `/discover/tv` attribution (`first_air_date.gte`, NEVER
  `primary_release_date`), the popular-arm byte pins, `/tv/[id]` SSR bytes, the
  `/search/multi` three-call split with the movie/tv id-overlap inert, the tree-order
  implicit-submit byte-gate, the keyless twin, and the tv score anchor + link-free keyless
  block; own fixture 3007 / app 3230 / keyless
  3231), `tests/tv-arms.test.mjs` (MC 10877 P2-1; 309 lines, 3 gates: the two tv rails
  `/api/now-playing?type=tv` → `/tv/on_the_air` + `/api/top-rated?type=tv` →
  `/tv/top_rated` with never-touch-`/movie/*` ring pins and the keyless 503 twin; own
  fixture 3008 / app 3232 / keyless 3233) — **67 gates measured at this commit** (the 63
  at base `88d0abe` UNCHANGED-green + 4 new: D4/D5/T11/T12, 0 existing gates updated —
  PLAN-t10c §3's pin enumeration held) against the built app via `next start`. Fixture seam:
  `tests/fixtures/server.mjs`
  (404 lines; MC 10610 added the literal tv paths `/trending/tv/day` + `/tv/on_the_air` +
  `/tv/top_rated` + `/tv/popular` resolving BEFORE the `/tv/<id>` id regex, `/discover/tv`,
  `/search/multi` (mixed `media_type`, incl. the deliberate 11001 movie/tv id-overlap and a
  person-noise entry) and `/genre/tv/list`) + `tests/fixtures/pool.mjs` (89 lines — the §6
  `filterPool`/`pageWindow`/`distinctUnion` mechanics shared by fixture and gates; `filterPool`
  gained an injectable date selector (`TV_DATES`), default byte-identical for 2-arg callers) +
  `tests/fixtures/data/*.json`
  (20 fixtures, 3882 lines; `movies-discover-pool.json` is the 192-item filter pool with the
  §6 conjunction rows incl. poisons `99998→500 / 99997→429 / 99999→200∅ / 99996→page≥2-500`,
  scoped to sole-`with_genres` requests; `tv-discover-pool.json` is the 24-item tv pool,
  `tv-15003.json` the tv detail whose id exists ONLY as tv — `/movie/15003` stays the D2 404;
  the three detail docs carry MC 10612's `imdb_id` rows: movie-15001 `tt1234567`,
  tv-15003 `tt0903624`, movie-15002 `""` — the D5 falsifier fixture, referenced by no
  earlier gate),
  pointed at via `TMDB_BASE_URL`/`TMDB_IMAGE_BASE`.
  Node stdlib only — the suites add no dependency. One mechanism, no others.

## Dependencies (unchanged from template; re-verified against `package.json` at b706a91)

runtime: next 14.1.3, react ^18, react-dom ^18 · dev: typescript ^5, eslint ^8, eslint-config-next
14.1.3, @types/*. **Build rule: add NO new dependency** — the app uses plain fetch, no SDK, no
styling framework, no state library — re-verified unchanged at `9a0201d` (MC 10333 T9 added
zero). next/image IS used (remotePatterns: `image.tmdb.org` + `localhost:3001/3005/3006/3007`,
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
legal. Re-measured at MC 10610: largest src file 241 lines (`Discover.tsx`, still under the
250 soft cap; `types.ts` 201, `page.tsx` 198 — `DetailContent.tsx` 118, `tv/[id]/page.tsx` 41
added), largest tests `app.integration.test.mjs` 567/600, `tv.test.mjs` 539/600,
`detail-search.test.mjs` 524/600 — all legal. Re-measured at MC 10612: largest src UNCHANGED
`Discover.tsx` 241 (`types.ts` 208, `DetailContent.tsx` 144, `format.ts` 100 — under the soft
cap); largest tests `detail-search.test.mjs` 581/600, `tv.test.mjs` 575/600,
`app.integration.test.mjs` 567/600 — all legal. `server.py` at `d55be2a` is 260 lines — 10 over
the ~250 soft line, well under the 400
hard cap; its module header carries the standing single-file reason (stdlib-only launcher, no
venv/requirements — the render contract runs ONE file), and the growth since 173 lines is the
documented vendored-node block + canonical-shape docstrings. No TODO/FIXME markers in src or tests. Commits authored
`git -c user.name="<profile> (<card id>)" -c user.email="<profile>@agent-town.local"` — never `git config`.

## Hosting (vm106 — sibbamala.com/film)

Chain (MC 10444, PLAN-t10 §§1–4 — the hosting rows this port adds):

| Link | Fact |
|---|---|
| Discover | **public under bryn1 + a valid `hosting.yaml` at the root IS the deploy signal** — the reconciler (`RECONCILE_ORGS=bryn1`, hosting.yaml required) picks the repo up on a ~15-min tick; there is no separate publish step. name→path: `film` ⇒ `sibbamala.com/film/`. |
| Unit | `vm106-app-film.service` (rendered from the production template); `ExecStart=/usr/bin/python3 <workdir>/server.py`; env contract = `HOME` + `PORT=8161` ONLY — **no `EnvironmentFile` anywhere ⇒ no `TMDB_API_KEY` reaches the hosted app today (B2 blocker, owner decision D2 open).** |
| Launcher | `server.py` (stdlib only, no venv) binds **127.0.0.1:8161** (fleet doctrine: services bind loopback only, the internet path is the Cloudflare tunnel), resolves node — system `node` when on PATH, else the **vendored runtime** `deploy/vendor/node-v20.20.2-linux-x64.tar.xz` (committed, MC 10444 owner-go: the vm106 lane is python3+static — tarball sha256 verified against the pinned constant BEFORE reading any member, ONLY the `bin/node` member extracted atomically under `$HOME`, `--version` gate before anything execs it; missing tarball = typed fail-fast, the D1 path) — then spawns `node deploy/standalone/server.js` on an ephemeral loopback inner port (`PORT`/`HOSTNAME` env). Forwards every request re-prefixed with `root_path="/film"`: the prepend is idempotent and the path passes **AS GIVEN** — the canonical shape carries the trailing slash (`trailingSlash:true`), so "/" → "/film/" and "/film/..." pass through, both served 200 straight; a bare "/film..." gets ONE app-level 308 with a RELATIVE, scheme-preserving Location. If the node child exits, the launcher exits non-zero so `Restart=on-failure` restarts the pair. Lowercase literal `root_path` = the shape reconcile.py's case-sensitive `PREFIX_REWRITER_RE` blesses. |
| nginx | `location = /film { return 301 /film/; }` + `location /film/ { proxy_pass http://127.0.0.1:8161/; }` — the trailing slash on `proxy_pass` **strips** the `/film` prefix before the app; the launcher re-prefixes it back for the basePath-baked build (§4 mismatch resolved here, not in nginx). **Canonical = WITH trailing slash** (`next.config.mjs trailingSlash:true`, MC 10444 fix-cycle 1): every router link/prefetch emits `/film/…`, so the browser hot path sees ZERO redirects and never touches the exact-match rule. WHY that rule must stay off the hot path: behind the Cloudflare TLS tunnel its `absolute_redirect` Location was `http://sibbamala.com/film/` — navigation dropped to HTTP and RSC/subresource fetches died as mixed-content errors (measured live finding; fixed at `d55be2a`). The rule remains only as the entry hop for bare external `/film` links. |
| Artifact | `deploy/standalone/` is **committed** — the mirror has no build step, served bytes ARE repo bytes (same-commit drift rule in [DEPLOY-BUILD.md](../DEPLOY-BUILD.md)); `deploy/vendor/` likewise carries the committed pinned-node tarball (Launcher row). `hosting.yaml` `mirror` block: `cachebust:"off"` (built Next bytes ship untouched; rewriting minified JS refs is unbounded risk) + root-anchored `/.next/**` defensive exclude — `deploy/standalone/.next/static` is **intentionally served** (root anchor can't reach it, mirror.py `_glob_re` rule). |
| Keyless state (honest) | Without D2 the hosted copy serves its **fail-closed keyless product**: pages render 200 with the error block and the `Kunde inte nå filmdatabasen` fallback, `/api/*` envelopes return 503 `TMDB_NOT_CONFIGURED` — zero film data, zero crashes. That is a DEGRADED product, not a malfunction; do not report it as "shows films". |

Prefix-safety gates: `basePath:"/film"` is baked at build time so every served HTML
asset ref is `/film/_next/...` (prefixed, not bare — `BARE_ASSET_RES` clean), and
`server.py` carries the literal lowercase `root_path` (`PREFIX_REWRITER_RE` matches)
— the repo passes both limbs.
