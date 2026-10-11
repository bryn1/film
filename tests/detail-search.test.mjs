/**
 * detail-search.test.mjs — MC 10333 T9 (ARCHITECT-PLAN Rev 4.1 §9).
 * Own boot, own APP_DIR copy: fixture 3006 + app 3229 (env
 * DS_FIXTURE_PORT/DS_APP_PORT), disjoint from the other suite files so the
 * documented glob `node --test tests/*.test.mjs` runs everything
 * concurrently without port races. Only PIDs spawned here are ever killed;
 * before() clears ONLY this copy's .next/cache (canonical .next untouched).
 *
 * Commit-0 (T9) relocated ALL former /api/search couplings here from
 * app.integration.test.mjs; since step 2 the route fans out to
 * /search/movie + /search/person + /search/company (§3), so S1's ring
 * assert rides ALL THREE paths (C3-6d — recovering the attribution
 * coverage commit 0 removed from integration), S2 pins the person section
 * (knownFor movie-only ≤4, derived from the fixture JSON, never
 * hand-tuned) and S3 the company section ("" origin_country ⇒ field
 * OMITTED, S3 falsifier per §7c F-11d). S4 = blank/missing-q 400s, with
 * the local assertFailEnvelope twin (the c1 file is a graded artifact, so
 * helpers here are deliberate local copies, same precedent as w4). S1 is
 * declared FIRST: its ring assert must ride the first (cold) hit of
 * /api/search. The D-gates (step 3, /movie/[id] SERVER HTML), S5 (the
 * SERVER-rendered FilterBar in /discover's bytes) and S6 (W4-grade
 * /search shell + the §7c section copy in built chunks) follow below.
 * Cold-URL discipline (S1 FIRST) is what keeps every ring assert honest.
 */

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = process.env.APP_DIR ?? join(HERE, "..");
const FIXTURE_PORT = Number(process.env.DS_FIXTURE_PORT ?? 3006);
const APP_PORT = Number(process.env.DS_APP_PORT ?? 3229);
const FIXTURE = `http://127.0.0.1:${FIXTURE_PORT}`;
// localhost (not the IP): the image allow-list only names that hostname.
const FIXTURE_LOCAL = `http://localhost:${FIXTURE_PORT}`;

const children = [];
let chunkBundle = "";

/**
 * Minified chunks escape non-ASCII (Sök → S\xf6k) or keep it raw; match
 * either form per character (local copy — same rationale as the api()
 * twin; the integration file is a graded artifact).
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

/** Error envelope per PLAN §5 — local twin (see header for the why). */
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

before(async () => {
  for (const port of [FIXTURE_PORT, APP_PORT]) {
    assert.ok(
      await portFree(port).then(
        () => true,
        () => false,
      ),
      `port ${port} must be free for the detail-search suite (env overrides exist)`,
    );
  }
  // Cold data cache for this file's OWN copy only (regenerable artifact,
  // same rationale as app.integration.test.mjs): the ring asserts below
  // prove what the seam sends upstream, so their URLs must be uncached.
  rmSync(join(APP_DIR, ".next", "cache"), { recursive: true, force: true });
  spawnProc("fixture", [join(HERE, "fixtures", "server.mjs")], {
    PATH: process.env.PATH,
    FIXTURE_PORT: String(FIXTURE_PORT),
  });
  await waitForHttp(`${FIXTURE}/_debug/requests`, 15000, "fixture server");
  const nextBin = join(APP_DIR, "node_modules", "next", "dist", "bin", "next");
  readFileSync(nextBin); // fails loudly if the build dir has no next
  spawnProc("app", [nextBin, "start", "-p", String(APP_PORT), "-H", "127.0.0.1"], {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    TMDB_API_KEY: "test-key",
    TMDB_BASE_URL: FIXTURE_LOCAL,
    TMDB_IMAGE_BASE: `${FIXTURE_LOCAL}/t/p`,
  });
  await waitForHttp(`http://127.0.0.1:${APP_PORT}/`, 60000, "app");
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
 * S1 (FIRST = fresh-cache position): /api/search attribution + shape.
 * Cold URL ⇒ the ring shows exactly what the seam sent upstream: ALL
 * THREE fan-out paths, each with query + language=sv-SE + bearer.
 * ------------------------------------------------------------------ */
test("S1: /api/search?q=ronja answers ok + the title match, reaching all THREE search paths with bearer + sv-SE", async () => {
  await resetRing();
  const { status, json } = await api(APP_PORT, "/api/search?q=ronja");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.deepEqual(Object.keys(json.data).sort(), ["companies", "movies", "people"]);
  assert.equal(json.data.movies.length, 1, "fixture filters movies by query substring");
  assert.equal(json.data.movies[0].title, "Ronja Rövardotter");
  assert.ok(Array.isArray(json.data.people) && Array.isArray(json.data.companies), "sections always arrays");
  const requests = await ring();
  for (const path of ["/search/movie", "/search/person", "/search/company"]) {
    const entry = requests.find((request) => request.path === path);
    assert.ok(entry, `${path} must be called (three-way fan-out, C3-6d)`);
    assert.equal(entry.query.query, "ronja", `${path}: q must reach upstream as query`);
    assert.equal(entry.query.language, "sv-SE");
    assert.equal(entry.hasAuth, true, `${path}: bearer header`);
  }
});

/* -------------------------- S2: persons ---------------------------- */
test("S2: a person-name q with no title match fills the people section — knownFor movie-only, ≤4, movie ids ⊆ pool", async () => {
  const unique = "ingrid";
  const { status, json } = await api(APP_PORT, `/api/search?q=${unique}`);
  assert.equal(status, 200);
  assert.equal(json.data.movies.length, 0, "no fixture TITLE contains the token — films section empty");
  assert.ok(json.data.people.length >= 1, "person fixture must match");
  const person = json.data.people.find((p) => p.name === "Ingrid Kallsjö");
  assert.ok(person, `expected Ingrid Kallsjö among ${json.data.people.map((p) => p.name)}`);
  // Expectation DERIVED from the fixture JSON at test level (§9): movie
  // media_type only, first 4 — the fixture carries 4 movies + 2 tv entries.
  const source = JSON.parse(
    readFileSync(join(HERE, "fixtures", "data", "persons-search.json"), "utf8"),
  );
  const raw = source.results.find((p) => p.name === "Ingrid Kallsjö");
  assert.equal(raw.known_for.filter((k) => k.media_type === "movie").length, 5, "fixture carries 5 movie + 1 tv known_for (TV-cutoff falsifier armed)");
  const expected = raw.known_for
    .filter((k) => k.media_type === "movie")
    .slice(0, 4)
    .map((k) => ({ id: k.id, title: k.title }));
  assert.deepEqual(person.knownFor, expected, "knownFor: movie-only, ≤4, in fixture order");
  const poolIds = new Set(
    JSON.parse(
      readFileSync(join(HERE, "fixtures", "data", "movies-discover-pool.json"), "utf8"),
    ).results.map((movie) => movie.id),
  );
  assert.ok(expected.every((k) => poolIds.has(k.id)), "known_for movie ids exist in the pool (§6 overlap)");
  // Second TV-cutoff falsifier (DA-verdict-c6 P2-1): the q=saga path hits
  // the tv-only person 20003, whose single known_for entry (id 9021) is
  // NOT in the pool — movie filter intact it must serve knownFor: [],
  // filter deleted it would serve the dead /movie/9021 link (red here,
  // independent of the 20001 reordering above).
  const saga = await api(APP_PORT, "/api/search?q=saga");
  assert.equal(saga.status, 200);
  const tvOnly = saga.json.data.people.find((p) => p.id === 20003);
  assert.ok(tvOnly, "tv-only person (20003) must match q=saga");
  assert.equal(poolIds.has(9021), false, "fixture pin: 9021 is outside the movie pool (dead link if served)");
  assert.deepEqual(tvOnly.knownFor, [], "tv-only person must serve knownFor: [] — movie filter never deleted (§3)");
});

/* ------------------------- S3: companies ---------------------------- */
test("S3: company matches fill the companies section — empty origin_country OMITS the field (no empty chip ever)", async () => {
  // Token-OR fixture matching: both tokens hit one company each (§6).
  const { status, json } = await api(APP_PORT, "/api/search?q=svea%20nordik");
  assert.equal(status, 200);
  assert.equal(json.data.companies.length, 2, "both fixture companies match the two tokens");
  const svea = json.data.companies.find((c) => c.id === 88888);
  assert.ok(svea, "Svea Filmbolag (88888) expected");
  assert.equal(svea.name, "Svea Filmbolag");
  assert.ok(
    !Object.hasOwn(svea, "originCountry"),
    "origin_country \"\" must OMIT the field entirely (§7c F-11d)",
  );
  const nordik = json.data.companies.find((c) => c.id === 77777);
  assert.ok(nordik, "Nordik Produktion (77777) expected");
  assert.equal(nordik.originCountry, "SE", "a real country must SURVIVE normalization");
});

/* ------------------- relocated search-state gates -------------------- */
test("empty search results are 200 ok with ALL THREE sections empty (UI empty state, never an error)", async () => {
  const { status, json } = await api(APP_PORT, "/api/search?q=tomtest");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.deepEqual(json.data, { movies: [], people: [], companies: [] });
});

test("search normalizes `query` upstream for any query string (fresh cache key)", async () => {
  const unique = `ronja-${process.pid}-${Date.now()}`;
  await resetRing();
  const { status, json } = await api(APP_PORT, `/api/search?q=${unique}`);
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  assert.deepEqual(
    json.data,
    { movies: [], people: [], companies: [] },
    "unique query matches no fixture entry anywhere",
  );
  const requests = await ring();
  const search = requests.find((entry) => entry.path === "/search/movie");
  assert.ok(search, "unique query must force a fresh upstream call");
  assert.equal(search.query.query, unique);
});

test("fixture echoes received query in X-FQuery and rejects a missing one on ALL THREE search paths (fixture discipline, §6)", async () => {
  for (const path of ["/search/movie", "/search/person", "/search/company"]) {
    const okResponse = await fixtureGet(`${path}?query=ronja`);
    assert.equal(okResponse.status, 200, `${path}: answers with query`);
    assert.equal(okResponse.headers.get("x-fquery"), "ronja", `${path}: X-FQuery echo`);
    const missing = await fixtureGet(path);
    assert.equal(missing.status, 400, `${path}: 400 without query`);
  }
});

/* ------------------------------------------------------------------ *
 * D-gates (step 3): /movie/[id] SERVER-rendered detail (§7a). HTML
 * asserts are content-level: the fixture overview/cast/director/rating
 * strings must ALREADY be in the delivered bytes (no client fetch runs
 * under node --test, so anything absent here never renders at all).
 * ------------------------------------------------------------------ */
test("D1: /movie/15001 delivered HTML carries title, overview, cast name, director and the sv-SE rating", async () => {
  const { status, text } = await api(APP_PORT, "/movie/15001");
  assert.equal(status, 200);
  assert.ok(text.includes("Drama på Dramaten"), "h1 title");
  assert.ok(
    text.includes("En debuterande regissör sätter upp en pjäs om sin egen släkt"),
    "fixture overview must be SERVER-rendered (not client-fetched)",
  );
  assert.ok(text.includes("Märta Lindqvist"), "cast member name");
  assert.ok(text.includes("Görel Sandmark"), "director (crew job Director)");
  assert.ok(text.includes("7,3"), "formatRating comma form");
});

test("D2: the detail page ships EXACTLY ONE <h1>", async () => {
  const { text } = await api(APP_PORT, "/movie/15001");
  assert.equal((text.match(/<h1[\s>]/g) ?? []).length, 1, "DA P2-1 invariant holds on /movie/[id]");
});

test("D3: /movie/999999 AND /movie/12abc answer 404 (notFound guard, D3/F-7)", async () => {
  for (const route of ["/movie/999999", "/movie/12abc"]) {
    const { status } = await api(APP_PORT, route);
    assert.equal(status, 404, `${route} must be 404, saw ${status}`);
  }
});

/* ------------------------------ S4 (neg) ----------------------------- */
test("S4: /api/search answers 400 BAD_REQUEST for missing/blank q", async () => {
  for (const route of ["/api/search", "/api/search?q=%20%20"]) {
    const { status, json } = await api(APP_PORT, route);
    assert.equal(status, 400, route);
    assertFailEnvelope(json, "BAD_REQUEST");
  }
});

/* ------------------------------------------------------------------ *
 * S5 (step 4): /discover SERVED HTML carries the five filter controls,
 * their labels and the count options — proof of the §4g F-1 mechanism:
 * FilterBar is a SERVER component outside Suspense, so the controls are
 * in the delivered bytes, never only in client JS.
 * ------------------------------------------------------------------ */
test("S5: /discover served HTML carries five FilterBar controls + labels + count options (server-rendered, §7b)", async () => {
  const { status, text } = await api(APP_PORT, "/discover");
  assert.equal(status, 200);
  const forms = text.match(/<form\b[^>]*>/g) ?? [];
  const filterForm = forms.find((f) => f.includes('action="/discover"'));
  assert.ok(filterForm, "native GET form to /discover must be in the served HTML");
  assert.match(filterForm, /method="get"/, "method=get (§7b)");
  assert.ok(
    !filterForm.includes("role="),
    "C3-4: the filter form carries NO role — the one role=search form is Nav's",
  );
  // the live Nav field is still the document's ONLY search input
  assert.equal(
    (text.match(/<input[^>]*type="search"/g) ?? []).length,
    1,
    "FilterBar must not add a second search input",
  );
  const inputs = text.match(/<input\b[^>]*/g) ?? [];
  const tagFor = (name) => inputs.find((t) => t.includes(`name="${name}"`));
  const hidden = tagFor("filter");
  assert.ok(hidden?.includes('type="hidden"'), "hidden filter input (§7b)");
  for (const [name, step] of [
    ["min_score", 'step="0.1"'],
    ["max_score", 'step="0.1"'],
    ["year_from", 'step="1"'],
    ["year_to", 'step="1"'],
  ]) {
    const tag = tagFor(name) ?? "";
    assert.ok(tag.includes('type="number"'), `${name}: must be a number input`);
    assert.ok(tag.includes(step), `${name}: ${step}`);
    if (name.endsWith("_score")) {
      assert.ok(tag.includes('min="0"') && tag.includes('max="10"'), `${name}: 0..10`);
    }
  }
  assert.match(
    text,
    /<select\b[^>]*name="count"/,
    "select name=count must be server-rendered",
  );
  for (const n of [20, 40, 60, 80, 100, 120, 140, 160, 180, 200]) {
    assert.ok(
      new RegExp(`<option[^>]*value="${n}"`).test(text),
      `count option ${n} missing from served HTML`,
    );
  }
  // the §7b default is 20: React marks exactly that option selected when
  // the URL carries no count (defaultValue "20").
  assert.equal(
    (text.match(/<option[^>]*selected/g) ?? []).length,
    1,
    "exactly one pre-selected count option",
  );
  assert.match(text, /<option[^>]*value="20"[^>]*selected/);
  for (const [forId, label] of [
    ["min-score", "Betyg från"],
    ["max-score", "Betyg till"],
    ["year-from", "År från"],
    ["year-to", "År till"],
    ["count", "Antal filmer"],
  ]) {
    assert.match(
      text,
      new RegExp(`<label[^>]*for="${forId}"[^>]*>${label}</label>`),
      `label ${forId} ("${label}") missing (§7b every input has one)`,
    );
  }
  assert.match(text, /<button[^>]*type="submit"[^>]*>Visa filmer<\/button>/);
  assert.doesNotMatch(
    text,
    /Rensa filter/,
    "default state must NOT offer a clear (§7b: only when non-default)",
  );
});

test("S5b: /discover?filter=drama&min_score=8&count=40 echoes values and offers Rensa filter (§7b)", async () => {
  const { text } = await api(
    APP_PORT,
    "/discover?filter=drama&min_score=8&count=40",
  );
  const inputs = text.match(/<input\b[^>]*/g) ?? [];
  const hidden = inputs.find((t) => t.includes('name="filter"'));
  assert.ok(hidden?.includes('value="drama"'), "hidden filter echoes the chip slug");
  const min = inputs.find((t) => t.includes('name="min_score"'));
  assert.ok(min?.includes('value="8"'), "min_score echoes 8");
  assert.match(
    text,
    /<option[^>]*value="40"[^>]*selected/,
    "count option 40 must be marked selected",
  );
  assert.match(text, /Rensa filter/, "non-default state offers the clear link");
});

/* ------------------------------------------------------------------ *
 * S6 (step 4): /search?q= served HTML is the W4-grade shell (one h1,
 * one aria-busy region) and the three §7c section headings ship in the
 * built client chunks. Fixture tokens stay at JSON level (S1–S3) — the
 * SERVED /search bytes never contain them (server HTML = skeleton).
 * ------------------------------------------------------------------ */
test("S6: /search?q= shell carries one h1 + one aria-busy, and Filmer/Personer/Produktionsbolag ship in built chunks (§7c)", async () => {
  const { status, text } = await api(APP_PORT, "/search?q=ronja");
  assert.equal(status, 200);
  assert.equal((text.match(/<h1[\s>]/g) ?? []).length, 1, "single server h1");
  assert.equal(
    (text.match(/aria-busy="true"/g) ?? []).length,
    1,
    "exactly one aria-busy results region (SSR skeleton, DA P4-3)",
  );
  assert.doesNotMatch(
    text,
    /Ronja Rövardotter/,
    "fixture titles never appear in the shell (sections render client-side)",
  );
  for (const heading of ["Filmer", "Personer", "Produktionsbolag"]) {
    assert.match(
      chunkBundle,
      chunkCopyRegex(heading),
      `section copy missing from built chunks: ${heading}`,
    );
  }
});
