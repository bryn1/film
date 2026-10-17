/**
 * tv.test.mjs — MC 10610 T10b "TV shows selectable" (PLAN-t10b §6, gates
 * T1–T10). Own boot: fixture 3007 + keyed app 3230 + KEYLESS app 3231
 * (env TV_FIXTURE_PORT/TV_APP_PORT/TV_NOKEY_PORT; the NOKEY precedent is
 * app.integration's 3212 — the keyless instance is spawned WITHOUT
 * TMDB_API_KEY, never with a fake one). Ports are disjoint from the
 * other four suite files so `node --test tests/*.test.mjs` runs them all
 * concurrently without races; only PIDs spawned here are ever killed;
 * before() clears ONLY this build's .next/cache (a regenerable artifact,
 * same rationale as the sibling files).
 *
 * Cold-URL discipline (the ring gates FIRST, in declaration order):
 * T1 owns the first hit of /trending/tv/day, T4 the first
 * /discover/tv?…2005…10757-shaped call, T7 the first
 * /search/multi?query=kamomilla. Every token here is UNIQUE to this file
 * (kamomilla, NOT ronja — ronja is S1's cold token in detail-search and
 * the .next/cache directory is shared on disk across suite files). The
 * remaining gates are DATA/HTML assertions — cache-hit-invariant by
 * construction, so the shared-cache races cannot false-red them.
 *
 * Expectations DERIVE from the fixture JSON + pool.mjs mechanics (never
 * hand-tuned) exactly like the T9 suites; the literal breakers (paths,
 * param names, byte-order) stay in gate text.
 */

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { filterPool, pageWindow, TV_DATES } from "./fixtures/pool.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = process.env.APP_DIR ?? join(HERE, "..");
const FIXTURE_PORT = Number(process.env.TV_FIXTURE_PORT ?? 3007);
const APP_PORT = Number(process.env.TV_APP_PORT ?? 3230);
const NOKEY_PORT = Number(process.env.TV_NOKEY_PORT ?? 3231);
const FIXTURE = `http://127.0.0.1:${FIXTURE_PORT}`;
// localhost (not the IP): the image allow-list only names that hostname.
const FIXTURE_LOCAL = `http://localhost:${FIXTURE_PORT}`;

const children = [];

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

async function resetRing() {
  const response = await fetch(`${FIXTURE}/_debug/reset`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
}

async function ring() {
  const response = await fetch(`${FIXTURE}/_debug/requests`, {
    headers: { Authorization: "Bearer test-key" },
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  return (await response.json()).requests;
}

/** Error envelope per PLAN §5 — local twin (graded artifacts are not
 *  restructured; helpers here are deliberate local copies, the w4/S4
 *  precedent). */
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

const fixtureJson = (name) =>
  JSON.parse(readFileSync(join(HERE, "fixtures", "data", name), "utf8"));

/** Every <button> OPEN tag carrying name="type", in document byte order —
 *  the F-A tree-order surface T9 pins (server HTML ⇒ tree order == byte
 *  order for this form; no client render has run under node --test). */
function typeButtonTags(text) {
  return (text.match(/<button\b[^>]*>/g) ?? []).filter((tag) =>
    /\bname="type"/.test(tag),
  );
}

function attrValue(tag, attr) {
  const match = new RegExp(`(?:^|\\s)${attr}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

before(async () => {
  for (const port of [FIXTURE_PORT, APP_PORT, NOKEY_PORT]) {
    assert.ok(
      await portFree(port).then(
        () => true,
        () => false,
      ),
      `port ${port} must be free for the tv suite (env overrides exist)`,
    );
  }
  // Cold data cache for this file's OWN build (regenerable artifact — the
  // ring gates below ride first (cold) hits of their pinned URLs).
  rmSync(join(APP_DIR, ".next", "cache"), { recursive: true, force: true });
  spawnProc("fixture", [join(HERE, "fixtures", "server.mjs")], {
    PATH: process.env.PATH,
    FIXTURE_PORT: String(FIXTURE_PORT),
  });
  await waitForHttp(`${FIXTURE}/_debug/requests`, 15000, "fixture server");
  const nextBin = join(APP_DIR, "node_modules", "next", "dist", "bin", "next");
  readFileSync(nextBin); // fails loudly if the build dir has no next
  const baseEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    TMDB_BASE_URL: FIXTURE_LOCAL,
    TMDB_IMAGE_BASE: `${FIXTURE_LOCAL}/t/p`,
  };
  spawnProc("app", [nextBin, "start", "-p", String(APP_PORT), "-H", "127.0.0.1"], {
    ...baseEnv,
    TMDB_API_KEY: "test-key",
  });
  await waitForHttp(`http://127.0.0.1:${APP_PORT}/`, 60000, "app");
  // T10's keyless twin: NO TMDB_API_KEY in this env at all (never an
  // empty one — the route must see it as UNSET). Same build dir.
  spawnProc("app-keyless", [nextBin, "start", "-p", String(NOKEY_PORT), "-H", "127.0.0.1"], {
    ...baseEnv,
  });
  await waitForHttp(`http://127.0.0.1:${NOKEY_PORT}/`, 60000, "keyless app");
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
 * T1 (FIRST = fresh-cache position): the tv trending rail's API. Every
 * normalized entry carries mediaType "tv" (the card self-routing tag),
 * titles arrive from `name`, and the ring proves the seam hit
 * /trending/tv/day — bearer + sv-SE — nothing else.
 * ------------------------------------------------------------------ */
test("T1: /api/trending?type=tv answers ok with tv-titled mediaType-tagged entries via /trending/tv/day", async () => {
  await resetRing();
  const { status, json } = await api(APP_PORT, "/api/trending?type=tv");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  const source = fixtureJson("tv-trending.json").results;
  assert.deepEqual(
    json.data.map((movie) => movie.id),
    source.map((entry) => entry.id),
    "tv trending ids arrive in fixture order",
  );
  assert.deepEqual(
    json.data.map((movie) => movie.title),
    source.map((entry) => entry.name),
    "the tv NAME arrives as title (normalizeMovie fold)",
  );
  assert.ok(
    json.data.every((movie) => movie.mediaType === "tv"),
    "every trending?type=tv entry carries mediaType tv (cards route /tv/<id>)",
  );
  const requests = await ring();
  assert.equal(requests.length, 1, "exactly ONE upstream call for the rail");
  assert.equal(requests[0].path, "/trending/tv/day");
  assert.equal(requests[0].query.language, "sv-SE");
  assert.equal(requests[0].hasAuth, true, "bearer header");
});

/* ------------------- T2: strict API, paint-not pages ---------------- */
test("T2: ?type=bogus answers 400 BAD_REQUEST 'Ogiltig mediatyp.' on discover + trending + genres", async () => {
  for (const route of [
    "/api/discover?type=bogus",
    "/api/trending?type=bogus",
    "/api/genres?type=bogus",
  ]) {
    const { status, json } = await api(APP_PORT, route);
    assert.equal(status, 400, route);
    assertFailEnvelope(json, "BAD_REQUEST");
    assert.equal(json.error.message, "Ogiltig mediatyp.", route);
  }
});

/* ---------------- T3: the tv genre list (chips source) -------------- */
test("T3: /api/genres?type=tv serves the tv id space (10759-class) with sv names via /genre/tv/list", async () => {
  await resetRing();
  const { status, json } = await api(APP_PORT, "/api/genres?type=tv");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.deepEqual(
    json.data,
    fixtureJson("genres-tv-sv.json").genres,
    "tv genres arrive exactly as the sv fixture list (ids AND names)",
  );
  assert.ok(
    json.data.some((genre) => genre.id === 10759 && genre.name === "Action & äventyr"),
    "the tv id space (10759) is served — a movie-list leak would pin movie ids",
  );
  const requests = await ring();
  const entry = requests.find((request) => request.path === "/genre/tv/list");
  assert.ok(entry, "/genre/tv/list must be the upstream path");
  assert.equal(entry.query.language, "sv-SE");
  assert.equal(entry.hasAuth, true);
});

/* ------------------------------------------------------------------ *
 * T4 (cold URL, unique-shaped): the type axis reaches buildDiscoverParams
 * — /discover/tv with first_air_date.gte, NOT primary_release_date (the
 * per-type year mapping), with_genres, include_adult=false, and the data
 * DERIVES from the tv pool via pool.mjs (never hand-tuned).
 * ------------------------------------------------------------------ */
test("T4: /api/discover?type=tv&year_from=2005&genre=10759 hits /discover/tv with first_air_date.gte — never primary_release_date", async () => {
  await resetRing();
  const { status, json } = await api(
    APP_PORT,
    "/api/discover?type=tv&year_from=2005&genre=10759",
  );
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  const requests = await ring();
  const entry = requests.find((request) => request.path === "/discover/tv");
  assert.ok(entry, `/discover/tv must be called; ring was ${requests.map((r) => r.path)}`);
  assert.equal(
    requests.some((request) => request.path === "/discover/movie"),
    false,
    "type=tv must NEVER touch /discover/movie",
  );
  assert.equal(entry.query["first_air_date.gte"], "2005-01-01", "tv year mapping");
  assert.equal(entry.query.with_genres, "10759");
  assert.equal(entry.query.sort_by, "popularity.desc");
  assert.equal(entry.query.include_adult, "false", "F-C: the tv filter arm passes include_adult=false");
  assert.ok(
    !("primary_release_date.gte" in entry.query) &&
      !("primary_release_date.lte" in entry.query),
    "primary_release_date.* must NOT ride a tv discover call",
  );
  assert.equal(entry.query.language, "sv-SE");
  assert.equal(entry.hasAuth, true);
  const expected = pageWindow(
    filterPool(
      fixtureJson("tv-discover-pool.json").results,
      new URLSearchParams({ with_genres: "10759", "first_air_date.gte": "2005-01-01" }),
      TV_DATES,
    ),
    1,
  ).map((item) => item.id);
  assert.ok(expected.length > 0, "fixture sanity: the selector window is non-empty");
  assert.deepEqual(
    json.data.map((movie) => movie.id),
    expected,
    "data derives from the tv pool under the SAME mechanics (§9)",
  );
  assert.ok(
    json.data.every((movie) => movie.mediaType === "tv"),
    "fan-out results normalize as tv",
  );
});

/* --------------------- T5: the popular-arm byte pins ---------------- */
test("T5: /api/discover?type=tv alone serves the tv-popular list; no-params still serves the movie one", async () => {
  const tv = await api(APP_PORT, "/api/discover?type=tv");
  assert.equal(tv.status, 200);
  assert.deepEqual(
    tv.json.data.map((movie) => movie.id),
    fixtureJson("tv-popular.json").results.map((entry) => entry.id),
    "type=tv ALONE (no filters) is a degenerate request → /tv/popular list",
  );
  assert.ok(
    tv.json.data.every((movie) => movie.mediaType === "tv"),
    "the tv popular arm normalizes tv even though the endpoint implies it (media_type fallback)",
  );
  const movie = await api(APP_PORT, "/api/discover");
  assert.equal(movie.status, 200);
  assert.deepEqual(
    movie.json.data.map((m) => m.id),
    fixtureJson("movies-popular.json").results.map((entry) => entry.id),
    "no-params keeps serving the movie popular list BYTE-STABLE (backward compat)",
  );
  assert.ok(
    movie.json.data.every((m) => m.mediaType === "movie"),
    "no type ⇒ mediaType movie",
  );
});

/* ----------------------- T6: the tv detail page --------------------- */
test("T6: /tv/15003 serves one h1 with the name-title, Avsnittslängd from episode_run_time[0] and the Säsonger row", async () => {
  const { status, text } = await api(APP_PORT, "/tv/15003");
  assert.equal(status, 200);
  assert.equal((text.match(/<h1[\s>]/g) ?? []).length, 1, "DA P2-1 one-h1 invariant on /tv/[id]");
  assert.match(text, /<h1[^>]*>Säsongernas välde<\/h1>/, "tv name arrives as the h1 title");
  // React SSR separates adjacent text-node children with <!-- -->
  // markers; the readable-text form is what a human (and D1-style gates
  // on single nodes) sees — strip the node boundaries, keep every byte.
  const plain = text.replace(/<!--.*?-->/g, "");
  assert.match(plain, /Avsnittslängd 45 min/, "episode_run_time[0] renders as Avsnittslängd");
  assert.doesNotMatch(plain, /Speltid/, "a tv page never renders the movie duration label");
  assert.match(plain, /Säsonger: 3/, "number_of_seasons renders the seasons row");
  assert.ok(text.includes("8,1"), "formatRating comma form survives for tv");
  assert.ok(text.includes("Mikael Rooth"), "credits.cast reaches the tv page");
  assert.ok(text.includes("Astrid Ekblom"), "credits.crew Director reaches the tv page");
});

test("T6b: /tv/12abc AND /tv/999999 answer 404 (guard + TMDB 404, the D3 shape on tv)", async () => {
  for (const route of ["/tv/12abc", "/tv/999999"]) {
    const { status } = await api(APP_PORT, route);
    assert.equal(status, 404, `${route} must be 404, saw ${status}`);
  }
});

/* ------------------------------------------------------------------ *
 * T7 (cold URL, unique token): /api/search fans out to EXACTLY THREE
 * upstreams (/search/multi + person + company), splits multi by
 * media_type (person-noise DROPPED), and the movie/tv id OVERLAP from
 * the fixture stays inert (sections keyed by mediaType, not id).
 * ------------------------------------------------------------------ */
test("T7: /api/search?q=kamomilla fills movies AND tv from multi — person-noise dropped — with EXACTLY three upstream calls", async () => {
  await resetRing();
  const { status, json } = await api(APP_PORT, "/api/search?q=kamomilla");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.ok(json.data.movies.length > 0, "movies section non-empty (multi movie entries)");
  assert.ok(json.data.tv.length > 0, "tv section non-empty (multi tv entries)");
  assert.ok(json.data.movies.every((movie) => movie.mediaType === "movie"), "movies section is movie-typed");
  assert.ok(json.data.tv.every((show) => show.mediaType === "tv"), "tv section is tv-typed");
  const ids = [
    ...json.data.movies.map((m) => m.id),
    ...json.data.tv.map((t) => t.id),
    ...json.data.people.map((p) => p.id),
    ...json.data.companies.map((c) => c.id),
  ];
  assert.equal(ids.includes(20009), false, "the multi person-noise entry is DROPPED (multi person entries never join a section)");
  const requests = await ring();
  assert.equal(requests.length, 3, `exactly THREE upstream calls (multi+person+company, no /search/movie twin), saw ${requests.map((r) => r.path)}`);
  assert.deepEqual(
    requests.map((request) => request.path).sort(),
    ["/search/company", "/search/multi", "/search/person"],
  );
  for (const request of requests) {
    assert.equal(request.query.query, "kamomilla", `${request.path}: q reaches upstream`);
    assert.equal(request.query.language, "sv-SE");
    assert.equal(request.hasAuth, true);
  }
  assert.equal(
    requests.some((request) => request.path === "/search/movie"),
    false,
    "/search/movie is REPLACED, not kept beside multi",
  );
});

test("T7b: movie/tv id OVERLAP (fixture id 11001 both types) stays inert — each section keeps its own entry", async () => {
  const { status, json } = await api(APP_PORT, "/api/search?q=ronja");
  assert.equal(status, 200);
  const film = json.data.movies.find((movie) => movie.id === 11001);
  const show = json.data.tv.find((entry) => entry.id === 11001);
  assert.ok(film && show, "the overlap entry exists once per type in its own section");
  assert.equal(film.mediaType, "movie");
  assert.equal(show.mediaType, "tv");
  assert.equal(film.title, "Ronja Rövardotter", "the movie keeps its title");
  assert.ok(
    show.title !== film.title && show.title.includes("Kamomilla"),
    "the tv entry keeps ITS title — same id never merges the sections",
  );
});

/* ------------------------------------------------------------------ *
 * T8: /discover/?type=tv SERVED HTML (no JS ran) carries the pressed/
 * unpressed type pills + the tv copy twins; /discover (no type) keeps
 * the movie copy — the S5 surface stays green (F-E: the pills are
 * BUTTONs, the input-regexes never see them).
 * ------------------------------------------------------------------ */
test("T8: /discover/?type=tv served HTML carries the pressed tv pill and the tv copy twins; /discover stays movie-copy", async () => {
  const { status, text } = await api(APP_PORT, "/discover/?type=tv");
  assert.equal(status, 200, "trailingSlash keeps /discover/?type=tv at 200");
  assert.equal((text.match(/<h1[\s>]/g) ?? []).length, 1, "one h1 per document");
  assert.match(text, /<h1[^>]*>Upptäck TV-serier<\/h1>/, "tv h1 from COPY.discoverH1[type]");
  // React SSR may reorder attributes (name lands after class) — parse the
  // button tags by attribute, not by JSX order (the same discipline T9
  // uses; the TREE ORDER of the tags themselves is what T9 pins).
  const tvTags = typeButtonTags(text);
  assert.equal(tvTags.length, 3, `${"/discover/?type=tv"}: Visa + two pills`);
  assert.ok(
    tvTags.some((tag) => attrValue(tag, "value") === "tv" && attrValue(tag, "aria-pressed") === "true"),
    "the tv pill is PRESSED in the server bytes",
  );
  assert.ok(
    tvTags.some((tag) => attrValue(tag, "value") === "movie" && attrValue(tag, "aria-pressed") === "false"),
    "the movie pill is unpressed (server-computed, JS never ran)",
  );
  assert.ok(text.includes("Antal serier"), "count label is the tv twin");
  assert.ok(!text.includes("Antal filmer"), "the movie count label is gone under tv");
  assert.ok(text.includes("Visa serier"), "submit label is the tv twin");
  assert.ok(text.includes("Rensa filter"), "F-B: under tv the clear link always stands (isDefault gained type===movie)");
  assert.ok(
    text.includes('href="/discover/?type=tv"'),
    "F-B: 'Rensa filter' PRESERVES the media tier (canonical /discover/?type=tv under trailingSlash)",
  );
  const movie = await api(APP_PORT, "/discover");
  assert.equal(movie.status, 200);
  assert.match(movie.text, /<h1[^>]*>Upptäck filmer<\/h1>/, "bare /discover keeps the movie h1 (W1 pin)");
  assert.ok(movie.text.includes("Antal filmer") && movie.text.includes("Visa filmer"), "movie copy twins intact");
  const movieTags = typeButtonTags(movie.text);
  assert.ok(
    movieTags.some((tag) => attrValue(tag, "value") === "movie" && attrValue(tag, "aria-pressed") === "true"),
    "the movie pill is pressed by default",
  );
});

/* ------------------------------------------------------------------ *
 * T9 (F-A pin, T9b = the planted-red proof this gate can bite): in the
 * served bytes of /discover/?type=tv the FIRST <button> carrying
 * name="type" carries value="tv" (on /discover: value="movie"). The
 * implicit-submit (Enter in a number field) ships the default button =
 * first submit in TREE order, and server HTML makes tree order == byte
 * order — so a reordered form (pills first) reddens this gate.
 * ------------------------------------------------------------------ */
test("T9: the FIRST name=\"type\" button in served bytes ships the CURRENT type (implicit-submit defense)", async () => {
  for (const [route, expected] of [
    ["/discover/?type=tv", "tv"],
    ["/discover", "movie"],
  ]) {
    const { text } = await api(APP_PORT, route);
    const tags = typeButtonTags(text);
    assert.equal(tags.length, 3, `${route}: Visa button + two pills all name "type"`);
    const first = attrValue(tags[0], "value");
    assert.equal(
      first,
      expected,
      `${route}: first type-named submit must ship "${expected}", saw "${first}" — Enter would switch the tier`,
    );
    assert.ok(
      !/<input[^>]*name="type"/.test(text),
      `${route}: NO hidden type input may exist beside the named submitters (double-emit trap, F-A)`,
    );
  }
});

/* ------------------------------------------------------------------ *
 * T10 (F-D): the KEYLESS boot (3231, env WITHOUT TMDB_API_KEY) stays
 * fail-closed on the whole tv surface: 503 TMDB_NOT_CONFIGURED on the
 * APIs, the COPY error block on /tv/15003 (never a crash, never the
 * 500 blank page) — and ZERO upstream calls reach the fixture.
 * ------------------------------------------------------------------ */
test("T10: keyless boot answers 503 TMDB_NOT_CONFIGURED on every ?type=tv API and renders the error block on /tv/15003", async () => {
  await resetRing();
  for (const route of [
    "/api/trending?type=tv",
    "/api/genres?type=tv",
    "/api/discover?type=tv",
  ]) {
    const { status, json } = await api(NOKEY_PORT, route);
    assert.equal(status, 503, route);
    assertFailEnvelope(json, "TMDB_NOT_CONFIGURED");
    assert.ok(
      json.error.message.includes("TMDB_API_KEY"),
      `${route}: the operator-facing message names the missing variable`,
    );
  }
  const detail = await api(NOKEY_PORT, "/tv/15003");
  assert.equal(detail.status, 200, "/tv/[id] degrades to the COPY error block, not a 500");
  assert.ok(
    detail.text.includes("Något gick fel"),
    "COPY.errorGeneric title renders in the served HTML",
  );
  const requests = await ring();
  assert.deepEqual(requests, [], "a missing key must throw BEFORE any fetch is issued (PLAN §5) — tv surface included");
});
