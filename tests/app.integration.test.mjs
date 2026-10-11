/**
 * app.integration.test.mjs — independent TEST phase for the Compileit
 * filmsida (MC 10252.1 T5). node --test, node stdlib only, no new deps.
 *
 * Boots the REAL production build (`next start`) three times against the
 * fixture TMDB server (tests/fixtures/server.mjs):
 *   APP_PORT       app WITH TMDB_API_KEY      → contract + HTML checks
 *   NOKEY_PORT     app WITHOUT the key        → 503 NOT_CONFIGURED checks
 *   DEAD_PORT      app, TMDB_BASE_URL dead    → 502 unreachable checks
 * Only PIDs spawned here are ever killed.
 *
 * Coverage split (stated honestly in TEST-verdict.md):
 *  - API contract (envelopes, negatives, upstream attribution, bearer,
 *    language, TV fold, URL builder, cache, 429/500/401) — this file,
 *    against the real running server. The /api/search gates were
 *    relocated to tests/detail-search.test.mjs at MC 10333 T9 commit-0
 *    (the sections rework makes array-shaped asserts false there);
 *    /api/search shares the envelope/key/validation seam with the other
 *    routes, so the no-key 503 loop keeps the guard proven without it
 *    (ARCHITECT-PLAN Rev 4.1 §9, C4-2b ACCEPTED).
 *  - Static shell (/) — real SSR HTML fetched over HTTP.
 *  - Client-only states (discover chips) — that subtree sits behind a
 *    Suspense boundary whose fallback paints instead, so no fetch can see
 *    chip strings; this file asserts the copy ships in the built chunks,
 *    and the runtime state machine was exercised in a real browser (see
 *    TEST-verdict.md). NOTE (TEST-c2 de-stale): since 82a13ee the
 *    /search?q= body is no longer client-only — page.tsx reads
 *    searchParams server-side, so its h1 + loading skeleton ARE in the
 *    delivered HTML; that new truth is pinned in w4-ssr-shell.test.mjs.
 *    A FIXTURE_PORT override also cannot pass the image allow-list gate
 *    below: next.config.mjs bakes remotePatterns port 3001 into the build.
 *
 * Run: from the repo root (built first):  npm run build && node --test tests/
 */

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = process.env.APP_DIR ?? join(HERE, "..");
const FIXTURE_PORT = Number(process.env.FIXTURE_PORT ?? 3001);
const APP_PORT = Number(process.env.APP_PORT ?? 3211);
const NOKEY_PORT = Number(process.env.NOKEY_PORT ?? 3212);
const DEAD_PORT = Number(process.env.DEAD_PORT ?? 3213);
const DEAD_UPSTREAM = "http://127.0.0.1:4001"; // nothing listens here
const FIXTURE = `http://127.0.0.1:${FIXTURE_PORT}`;
// The app-side URLs follow the brief exactly (localhost, not the IP):
// next.config.mjs remotePatterns whitelists hostname "localhost", so the
// image seam only works through that name.
const FIXTURE_LOCAL = `http://localhost:${FIXTURE_PORT}`;

const TMDB_ENV = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  TMDB_API_KEY: "test-key",
  TMDB_BASE_URL: FIXTURE_LOCAL,
  TMDB_IMAGE_BASE: `${FIXTURE_LOCAL}/t/p`,
};

const children = [];
// The no-key instance must NOT receive the variable at all (PLAN §5 throws
// on a missing key, and env `{KEY: undefined}` is too subtle to trust).
const { TMDB_API_KEY: _droppedKey, ...TMDB_ENV_NOKEY } = TMDB_ENV;

function spawnProc(name, args, env) {
  const out = spawn("node", args, {
    cwd: APP_DIR,
    env,
    stdio: ["ignore", "ignore", "ignore"],
  });
  const record = { name, pid: out.pid, child: out, exited: false };
  out.on("exit", () => {
    record.exited = true;
  });
  out.on("error", (error) => {
    throw new Error(`spawn ${name} failed: ${error.message}`);
  });
  children.push(record);
  return record;
}

async function portFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttp(url, deadlineMs, label) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.status < 500) return; // any real HTTP answer = booted
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`${label} did not answer on ${url} within ${deadlineMs} ms`);
}

async function api(port, path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body (HTML pages) */
  }
  return { status: response.status, json, text, headers: response.headers };
}

const fixtureGet = (path, { auth = true, headers = {} } = {}) =>
  fetch(`${FIXTURE}${path}`, {
    headers: {
      ...(auth ? { Authorization: "Bearer test-key" } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(10000),
  });

async function resetRing() {
  const response = await fetch(`${FIXTURE}/_debug/reset`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
}

async function ring() {
  const response = await fixtureGet("/_debug/requests", { auth: false });
  assert.equal(response.status, 200);
  return (await response.json()).requests;
}

/** Error envelope per PLAN §5: {"ok":false,"error":{"code","message"}}. */
function assertFailEnvelope(body, code) {
  assert.equal(body.ok, false, `ok must be false, got ${JSON.stringify(body)}`);
  assert.equal(
    Object.hasOwn(body, "data"),
    false,
    "error envelope must not carry data",
  );
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  assert.ok(body.error.message.length > 0, "error.message must be non-empty");
}

const MOVIE_KEYS = [
  "backdropPath",
  "backdropUrl",
  "genreIds",
  "id",
  "overview",
  "posterPath",
  "posterUrl",
  "releaseDate",
  "title",
  "voteAverage",
];

/**
 * Minified chunks escape non-ASCII (Sök → S\xf6k) or keep it raw; match
 * either form per character so copy-presence holds across minifier settings.
 */
function chunkCopyRegex(phrase) {
  const source = [...phrase]
    .map((char) => {
      const code = char.codePointAt(0);
      if (code < 0x80) {
        return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      const hex = code.toString(16).padStart(code < 0x100 ? 2 : 4, "0");
      const esc = code < 0x100 ? `\\\\x${hex}` : `\\\\u${hex}`;
      const raw = char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return `(?:${raw}|${esc})`;
    })
    .join("");
  return new RegExp(source);
}

let chunkBundle = "";

before(async () => {
  for (const port of [FIXTURE_PORT, APP_PORT, NOKEY_PORT, DEAD_PORT]) {
    assert.ok(
      await portFree(port).then(
        () => true,
        () => false,
      ),
      `port ${port} must be free for the test run (env overrides exist)`,
    );
  }
  // Next's data cache (revalidate:600) persists to .next/cache/fetch-cache
  // ON DISK across next-start runs. The attribution + fresh-cache tests
  // need a COLD cache to prove what the seam actually sends upstream, so
  // the build cache (a regenerable artifact, not a source file) is cleared
  // for every run — otherwise a second consecutive run is served from disk
  // and the fixture sees nothing (seen: run 2 green-attribution false-red).
  rmSync(join(APP_DIR, ".next", "cache"), { recursive: true, force: true });
  spawnProc("fixture", [join(HERE, "fixtures", "server.mjs")], {
    PATH: process.env.PATH,
    FIXTURE_PORT: String(FIXTURE_PORT),
  });
  await waitForHttp(`${FIXTURE}/_debug/requests`, 15000, "fixture server");

  const nextBin = join(APP_DIR, "node_modules", "next", "dist", "bin", "next");
  readFileSync(nextBin); // fails loudly if the build dir has no next
  spawnProc("app", [nextBin, "start", "-p", String(APP_PORT), "-H", "127.0.0.1"], {
    ...TMDB_ENV,
  });
  spawnProc("app-nokey", [nextBin, "start", "-p", String(NOKEY_PORT), "-H", "127.0.0.1"], {
    ...TMDB_ENV_NOKEY,
  });
  spawnProc("app-dead", [nextBin, "start", "-p", String(DEAD_PORT), "-H", "127.0.0.1"], {
    ...TMDB_ENV,
    TMDB_BASE_URL: DEAD_UPSTREAM,
  });
  await waitForHttp(`http://127.0.0.1:${APP_PORT}/`, 60000, "app");
  await waitForHttp(`http://127.0.0.1:${NOKEY_PORT}/`, 60000, "no-key app");
  await waitForHttp(`http://127.0.0.1:${DEAD_PORT}/`, 60000, "dead-upstream app");

  chunkBundle = (function readChunks(dir) {
    let bundle = "";
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) bundle += readChunks(path);
      else if (entry.name.endsWith(".js")) bundle += readFileSync(path, "utf8");
    }
    return bundle;
  })(join(APP_DIR, ".next", "static", "chunks"));
  assert.ok(chunkBundle.length > 100_000, "built chunks should be readable");
});

after(async () => {
  for (const record of children) {
    try {
      record.child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && children.some((record) => !record.exited)) {
    await sleep(100);
  }
  for (const record of children) {
    if (!record.exited) record.child.kill("SIGKILL");
  }
});

/* ------------------------------------------------------------------ *
 * 1. Upstream attribution FIRST: the Next data cache (revalidate 600)
 * serves repeats without touching the fixture, so this test consumes
 * the first (uncached) hit of every pinned URL and asserts what the
 * REAL client seam sent: path, language, bearer.
 * ------------------------------------------------------------------ */
test("all five routes reach the fixture over the pinned TMDB v3 paths, with bearer + sv-SE", async () => {
  await resetRing();
  const routes = [
    "/api/trending",
    "/api/now-playing",
    "/api/top-rated",
    "/api/discover",
    "/api/discover?genre=18",
    "/api/genres",
  ];
  for (const route of routes) {
    const { status } = await api(APP_PORT, route);
    assert.equal(status, 200, `${route} must answer 200 on the warm server`);
  }
  const requests = await ring();
  const paths = requests.map((entry) => entry.path);
  for (const pinned of [
    "/trending/movie/day",
    "/movie/now_playing",
    "/movie/top_rated",
    "/movie/popular", // absent discover genre ⇒ popular
    "/discover/movie",
    "/genre/movie/list",
  ]) {
    assert.ok(
      paths.includes(pinned),
      `fixture must have been asked for ${pinned}; saw ${JSON.stringify(paths)}`,
    );
  }
  for (const entry of requests) {
    assert.equal(entry.query.language, "sv-SE", `${entry.path} language`);
    assert.equal(entry.hasAuth, true, `${entry.path} bearer header`);
  }
  const discover = requests.find((entry) => entry.path === "/discover/movie");
  assert.equal(discover.query.with_genres, "18", "genre must map to with_genres");
});

/* ---------------------------- 2. envelopes --------------------------- */
test("envelope {ok:true,data:[...]} on the five gated routes, data non-empty", async () => {
  const routes = [
    "/api/trending",
    "/api/now-playing",
    "/api/top-rated",
    "/api/discover",
    "/api/discover?genre=18",
    "/api/genres",
  ];
  for (const route of routes) {
    const { status, json } = await api(APP_PORT, route);
    assert.equal(status, 200, route);
    assert.equal(json.ok, true, route);
    assert.ok(Array.isArray(json.data), `${route} data must be an array`);
    assert.ok(json.data.length > 0, `${route} fixture data must be non-empty`);
  }
});

test("discover with absent genre answers the POPULAR pool (PLAN §5 fallback rule)", async () => {
  const { status, json } = await api(APP_PORT, "/api/discover");
  assert.equal(status, 200);
  assert.deepEqual(
    json.data.map((movie) => movie.id),
    [14001, 14002, 14003, 14004],
    "absent genre must serve exactly the /movie/popular fixture ids",
  );
});

test("normalized Movie shape incl. server-built w500/w1280 URLs (PLAN §5 RE-PIN)", async () => {
  const { json } = await api(APP_PORT, "/api/trending");
  const movie = json.data.find((entry) => entry.id === 11001);
  assert.ok(movie, "fixture movie 11001 must be present");
  assert.deepEqual(Object.keys(movie).sort(), MOVIE_KEYS);
  assert.match(
    movie.posterUrl,
    new RegExp(`^http://localhost:${FIXTURE_PORT}/t/p/w500/.+\\.jpg$`),
  );
  assert.match(
    movie.backdropUrl,
    new RegExp(`^http://localhost:${FIXTURE_PORT}/t/p/w1280/.+\\.jpg$`),
  );
  assert.equal(typeof movie.title, "string");
  assert.equal(typeof movie.overview, "string");
  assert.equal(typeof movie.voteAverage, "number");
  assert.ok(Array.isArray(movie.genreIds));
  const noPoster = json.data.find((entry) => entry.id === 11004);
  assert.equal(noPoster.posterPath, null);
  assert.equal(noPoster.posterUrl, null, "null posterPath must yield null URL");
  assert.ok(noPoster.backdropUrl.includes("/w1280/"));
});

test("TV fold: name/first_air_date entry arrives with title + releaseDate", async () => {
  const { json } = await api(APP_PORT, "/api/trending");
  const tv = json.data.find((entry) => entry.id === 11003);
  assert.ok(tv, "TV-shaped fixture entry must survive normalization");
  assert.equal(tv.title, "Snabba cash");
  assert.equal(tv.releaseDate, "2023-10-20");
});

/* ------------------------- 3. empty-state contracts ------------------ */
test("empty upstream results are 200 ok:true data:[] (UI empty state, never an error)", async () => {
  const discover = await api(APP_PORT, "/api/discover?genre=99999");
  assert.equal(discover.status, 200);
  assert.deepEqual(discover.json.data, []);
});

/* ----------------------------- 4. genres ----------------------------- */
test("genres arrive in sv-SE (language=sv-SE is honoured, not defaulted English)", async () => {
  const { json } = await api(APP_PORT, "/api/genres");
  const names = json.data.map((genre) => genre.name);
  assert.ok(names.includes("Äventyr"), `expected Swedish names, saw ${names}`);
  assert.ok(names.includes("Animerad"));
  assert.ok(!names.includes("Adventure"), "English name leaked: language lost");
  assert.deepEqual(Object.keys(json.data[0]), ["id", "name"]);
  // The fixture only serves Swedish when asked — prove the honouring rule.
  const en = await (await fixtureGet("/genre/movie/list")).json();
  assert.ok(en.genres.some((genre) => genre.name === "Adventure"));
});

/* ------------------------------ 5. 400s ------------------------------ */
test("400 BAD_REQUEST for malformed genre (four negative cases; the /api/search 400 arms relocated to detail-search)", async () => {
  const badRequests = [
    "/api/discover?genre=abc",
    "/api/discover?genre=0",
    "/api/discover?genre=-5",
    "/api/discover?genre=1e9",
  ];
  for (const route of badRequests) {
    const { status, json } = await api(APP_PORT, route);
    assert.equal(status, 400, route);
    assertFailEnvelope(json, "BAD_REQUEST");
  }
});

/* --------------------------- 6. upstream errors ---------------------- */
test("upstream 500 (poison genre) → 502 TMDB_UPSTREAM_ERROR", async () => {
  const { status, json } = await api(APP_PORT, "/api/discover?genre=99998");
  assert.equal(status, 502);
  assertFailEnvelope(json, "TMDB_UPSTREAM_ERROR");
});

test("upstream 429 (poison genre) passes through as 429, not 502", async () => {
  const { status, json } = await api(APP_PORT, "/api/discover?genre=99997");
  assert.equal(status, 429);
  assertFailEnvelope(json, "TMDB_UPSTREAM_ERROR");
});

test("upstream unreachable → 502 TMDB_UPSTREAM_ERROR (fetch-failure branch)", async () => {
  const { status, json } = await api(DEAD_PORT, "/api/trending");
  assert.equal(status, 502);
  assertFailEnvelope(json, "TMDB_UPSTREAM_ERROR");
});

test("fixture honours Authorization: 401 without bearer, 200 with (bearer is real)", async () => {
  const anon = await fixtureGet("/trending/movie/day", { auth: false });
  assert.equal(anon.status, 401);
  const authed = await fixtureGet("/trending/movie/day");
  assert.equal(authed.status, 200);
  const body = await authed.json();
  assert.ok(Array.isArray(body.results) && body.results.length > 0);
});

/* ------------------------------ 7. 503s ------------------------------ */
test("WITHOUT TMDB_API_KEY every route answers 503 with the canon message, and no upstream call is made", async () => {
  await resetRing();
  const routes = [
    "/api/trending",
    "/api/now-playing",
    "/api/top-rated",
    "/api/discover",
    "/api/genres",
  ];
  for (const route of routes) {
    const { status, json } = await api(NOKEY_PORT, route);
    assert.equal(status, 503, route);
    assertFailEnvelope(json, "TMDB_NOT_CONFIGURED");
    assert.equal(json.error.message, "TMDB_API_KEY är inte satt i servermiljön");
  }
  const requests = await ring();
  assert.deepEqual(
    requests,
    [],
    "missing key must throw BEFORE any fetch is issued (PLAN §5)",
  );
});

/* ------------------------- 8. image seam / config -------------------- */
test("fixture serves real PNGs at /t/p/<size><path> so next/image resolves", async () => {
  const response = await fixtureGet("/t/p/w500/po/ronja.jpg");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("next/image optimizer fetches the fixture host (remotePatterns) and rejects foreign hosts", async () => {
  // The app builds posterUrl from TMDB_IMAGE_BASE on the HOSTNAME localhost
  // (next.config.mjs allows protocol http + hostname localhost + port 3001),
  // so this asks the optimizer with exactly that URL — not a raw IP.
  const allowed = new URLSearchParams({
    url: `http://localhost:${FIXTURE_PORT}/t/p/w500/po/ronja.jpg`,
    w: "640",
    q: "75",
  });
  const response = await fetch(
    `http://127.0.0.1:${APP_PORT}/_next/image?${allowed}`,
    { signal: AbortSignal.timeout(15000) },
  );
  assert.equal(response.status, 200, "config must allow localhost:3001");
  assert.match(response.headers.get("content-type") ?? "", /^image\//);
  const foreign = new URLSearchParams({
    url: "https://evil.example.com/po/ronja.jpg",
    w: "640",
    q: "75",
  });
  const denial = await fetch(`http://127.0.0.1:${APP_PORT}/_next/image?${foreign}`, {
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(denial.status >= 400 && denial.status < 500, `saw ${denial.status}`);
});

// TEST-c2 additive: the allow-list is port-exact — the SAME hostname the
// fixture uses, on a port next.config.mjs never registered (4001, the dead
// upstream port), must be refused before any upstream fetch happens.
test("image allow-list is port-exact: localhost on an unregistered port is refused", async () => {
  const params = new URLSearchParams({
    url: "http://localhost:4001/t/p/w500/po/ronja.jpg",
    w: "640",
    q: "75",
  });
  const response = await fetch(
    `http://127.0.0.1:${APP_PORT}/_next/image?${params}`,
    { signal: AbortSignal.timeout(15000) },
  );
  assert.ok(
    response.status >= 400 && response.status < 500,
    `unregistered port must be refused, saw ${response.status}`,
  );
});

/* ---------------------------- 9. static shell ------------------------ */
test("/ SSR HTML renders the three rail headings + nav (Startsida/Upptäck), sv locale, one h1", async () => {
  const { status, text } = await api(APP_PORT, "/");
  assert.equal(status, 200);
  for (const heading of [">Trending<", ">På bio nu<", ">Toppbetygsatta<"]) {
    assert.ok(text.includes(heading), `rail heading ${heading} missing`);
  }
  assert.ok(text.includes("Startsida"), "nav Startsida missing");
  assert.ok(text.includes("Upptäck"), "nav Upptäck missing");
  assert.ok(text.includes('lang="sv"'), 'html lang="sv" missing');
  assert.ok(text.includes('id="main"'), "<main id=\"main\"> missing");
  const h1count = (text.match(/<h1[\s>]/g) ?? []).length;
  assert.equal(h1count, 1, "exactly one h1 in the startsida shell");
});

test("/discover and /search shells carry nav + sv locale + main landmark", async () => {
  for (const route of ["/discover", "/search"]) {
    const { status, text } = await api(APP_PORT, route);
    assert.equal(status, 200, route);
    assert.ok(text.includes("Startsida"), `${route} nav`);
    assert.ok(text.includes("Upptäck"), `${route} nav`);
    assert.ok(text.includes('lang="sv"'), `${route} lang`);
    assert.ok(text.includes('id="main"'), `${route} main`);
  }
});

/* ---------------- 10. copy presence in built chunks ------------------ */
test("COMP-NOTES canon copy ships in the built client chunks (hydrated states exercised in browser pass)", () => {
  const phrases = [
    "Sökresultat för",
    "Inga träffar",
    "Prova en annan sökning eller ett annat filter.",
    "Rensa sökning",
    "Visa alla",
    "Försök igen",
    "Kan inte visa filmer",
    "Ingen TMDB-nyckel är konfigurerad",
    "Sök film…",
    "Filtrera genrer",
    "Hoppa till innehåll",
    "Något gick fel",
    "Vi kunde inte hämta filmerna just nu.",
    "Upptäck filmer",
  ];
  for (const phrase of phrases) {
    assert.match(chunkBundle, chunkCopyRegex(phrase), `copy missing: ${phrase}`);
  }
  assert.match(chunkBundle, /role:"search"/, 'form role="search" missing');
  assert.match(chunkBundle, /type:"search"/, 'input type="search" missing');
  assert.match(chunkBundle, /aria-pressed/, "chips must ship aria-pressed");
});
