/**
 * tests/discover-filters.test.mjs — the /api/discover numeric-filter +
 * count fan-out gates (ARCHITECT-PLAN Rev 4.1 §9 F1–F11, MC 10333 T9).
 * Fixture TMDB on port 3005 (FILTERS_FIXTURE_PORT), app under test on
 * 3228 (FILTERS_APP_PORT), booted from APP_DIR's built .next.
 *
 * Cache discipline (§9, the single biggest false-red source): the Next
 * data cache (600s revalidate) is per-upstream-URL, so every gate whose
 * asserts READ THE RING rides a cold, params-unique URL, and the
 * declaration order is pinned: F4 (fills page-1/2 cache) → F3 (reuses it,
 * values + DIRECT fixture reads only) → F11 (year_from=1984 discriminator
 * — F5 rides year_from=1985 so the two never share a cache entry) → F1 →
 * F2 → F5 → F6 → F7 → F8 → F9 → F10. /_debug/reset precedes every
 * ring-reading gate. Expectations DERIVE from tests/fixtures/pool.mjs
 * (never hand-tuned); the literal breakers stay in gate text (15019,
 * 15004–15006, "10"/"0" clamps).
 *
 * Run: from a copy of the built app: node --test tests/discover-filters.test.mjs
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { filterPool, pageWindow, distinctUnion } from "./fixtures/pool.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = process.env.APP_DIR ?? join(HERE, "..");
const FIXTURE_PORT = Number(process.env.FILTERS_FIXTURE_PORT ?? 3005);
const APP_PORT = Number(process.env.FILTERS_APP_PORT ?? 3228);
const FIXTURE_URL = `http://localhost:${FIXTURE_PORT}`;
const APP_URL = `http://localhost:${APP_PORT}`;
const POOL = JSON.parse(
  readFileSync(join(HERE, "fixtures", "data", "movies-discover-pool.json"), "utf8"),
).results;

const children = [];

function spawnProc(command, args, options) {
  const child = spawn(command, args, { stdio: "ignore", ...options });
  children.push(child);
  child.on("error", (error) => console.error(`spawn ${command} failed:`, error));
  return child;
}

function portFree(port, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ port, host });
    socket.setTimeout(300);
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error(`port ${port} is already in use — refusing to boot`));
    });
    socket.once("error", (error) => {
      socket.destroy();
      resolve(error.code === "ECONNREFUSED" || error.code === "ECONNRESET");
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(true);
    });
  });
}

async function waitForHttp(url, child, timeoutMs = 40_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (child && child.exitCode !== null) {
      throw new Error(`booted process died early (exit ${child.exitCode}) while waiting for ${url}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return response;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function api(port, path) {
  const response = await fetch(`${APP_URL}${path}`, {
    signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status, json: await response.json() };
}

/** Direct fixture read (bearer required — the seam honours it). */
async function fixtureGet(path) {
  return fetch(`${FIXTURE_URL}${path}`, {
    headers: { Authorization: "Bearer test-key" },
    signal: AbortSignal.timeout(5_000),
  });
}

async function resetRing() {
  await fetch(`${FIXTURE_URL}/_debug/reset`, { method: "POST" });
}

async function ring() {
  const response = await fetch(`${FIXTURE_URL}/_debug/requests`);
  return (await response.json()).requests;
}

/** Local twin of the integration helper (assertFailEnvelope). */
function assertFailEnvelope(body, code) {
  assert.equal(body.ok, false);
  assert.equal(typeof body.error?.message, "string");
  assert.ok(body.error.message.length > 0, "error.message must be non-empty");
  if (code) assert.equal(body.error.code, code);
}

/** Ring entries the app sent to /discover/movie (the fan-out surface). */
async function discoverRing() {
  return (await ring()).filter((entry) => entry.path === "/discover/movie");
}

let fixture;
let app;

before(async () => {
  assert.ok(await portFree(FIXTURE_PORT), `fixture port ${FIXTURE_PORT} must be free`);
  assert.ok(await portFree(APP_PORT), `app port ${APP_PORT} must be free`);
  // OWN copy of the scratch build → clearing cache ONLY here is in-bounds (§9).
  rmSync(join(APP_DIR, ".next", "cache"), { recursive: true, force: true });
  fixture = spawnProc(process.execPath, [join(HERE, "fixtures", "server.mjs")], {
    env: { ...process.env, FIXTURE_PORT: String(FIXTURE_PORT) },
  });
  await waitForHttp(`${FIXTURE_URL}/_debug/requests`, fixture);
  app = spawnProc(process.execPath, [
    join(APP_DIR, "node_modules", "next", "dist", "bin", "next"), "start",
    "-p", String(APP_PORT), "-H", "127.0.0.1",
  ], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      NODE_ENV: "production",
      TMDB_API_KEY: "test-key",
      TMDB_BASE_URL: FIXTURE_URL,
      TMDB_IMAGE_BASE: `${FIXTURE_URL}/t/p`,
    },
  });
  await waitForHttp(`${APP_URL}/api/genres`, app);
});

after(() => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
});

/* -------------------------------- F4 ---------------------------------- */
test("F4: count=200 merges 10 parallel pages, dedupes by id, slices — page-set {none}∪{2..10} exactly", async () => {
  await resetRing();
  const { status, json } = await api(APP_PORT, "/api/discover?count=200");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  const expected = distinctUnion(filterPool(POOL, {}), 10);
  assert.equal(expected.length, 182, "fixture pages 1..10 union over 192 items = 182");
  assert.deepEqual(json.data.map((movie) => movie.id), expected);
  const requests = await discoverRing();
  assert.equal(requests.length, 10, `fan-out must be 10 upstream calls, saw ${requests.length}`);
  const pages = requests.map((entry) => entry.query.page);
  assert.equal(pages.filter((page) => page === undefined).length, 1, "exactly one pageless call (page 1)");
  for (let page = 2; page <= 10; page += 1) {
    assert.ok(pages.includes(String(page)), `page=${page} must be sent`);
  }
  assert.ok(!pages.includes("1"), "page=1 must NEVER be sent (§3)");
});

/* -------------------------------- F3 ---------------------------------- */
test("F3: count=40 overlaps exactly 2 (item 19 twice) — union, set-unique, literal 15019 via direct fixture reads", async () => {
  const { status, json } = await api(APP_PORT, "/api/discover?count=40");
  assert.equal(status, 200);
  const expected = distinctUnion(filterPool(POOL, {}), 2);
  assert.equal(expected.length, 38, "40-requested merges 20+20 minus the 2-item overlap = 38");
  assert.deepEqual(json.data.map((movie) => movie.id), expected);
  assert.equal(new Set(json.data.map((movie) => movie.id)).size, json.data.length, "no id appears twice");
  const page1 = await (await fixtureGet("/discover/movie")).json();
  const page2 = await (await fixtureGet("/discover/movie?page=2")).json();
  assert.equal(page1.results[18].id, 15019, "fixture page 1 item 19 is id 15019");
  assert.equal(page2.results[0].id, 15019, "fixture page 2 starts at item 19 — the overlap");
});

/* -------------------------------- F11 --------------------------------- */
test("F11: count=10&year_from=1984 sends ONE pageless call and slices the full 20-item page to 10", async () => {
  await resetRing();
  const { status, json } = await api(APP_PORT, "/api/discover?count=10&year_from=1984");
  assert.equal(status, 200);
  const requests = await discoverRing();
  assert.equal(requests.length, 1, "count=10 ⇒ exactly one upstream page");
  assert.equal(requests[0].query.page, undefined, "page 1 carries NO page param");
  assert.equal(requests[0].query["primary_release_date.gte"], "1984-01-01");
  assert.equal(requests[0].query.sort_by, "popularity.desc");
  assert.equal(requests[0].hasAuth, true);
  const expected = pageWindow(filterPool(POOL, { "primary_release_date.gte": "1984-01-01" }), 1).slice(0, 10);
  assert.ok(expected.length === 10 && distinctUnion(filterPool(POOL, { "primary_release_date.gte": "1984-01-01" }), 1).length > 10, "raw page is 20 — slice falsifier armed");
  assert.deepEqual(json.data.map((movie) => movie.id), expected.map((movie) => movie.id));
});

/* -------------------------------- F1 ---------------------------------- */
test("F1: min_score=7.5&max_score=9 serves only votes inside [7.5,9] (values, not request counts)", async () => {
  const { status, json } = await api(APP_PORT, "/api/discover?min_score=7.5&max_score=9");
  assert.equal(status, 200);
  assert.ok(json.ok && json.data.length > 0, "band must not be empty (§6 ≥4 items + chip coverage)");
  for (const movie of json.data) {
    assert.ok(movie.voteAverage >= 7.5 && movie.voteAverage <= 9, `vote ${movie.voteAverage} leaked the [7.5,9] window (id ${movie.id})`);
  }
});

/* -------------------------------- F2 ---------------------------------- */
test("F2: year_from=2010&year_to=2020 serves only release years inside [2010,2020]", async () => {
  const { status, json } = await api(APP_PORT, "/api/discover?year_from=2010&year_to=2020");
  assert.equal(status, 200);
  assert.ok(json.ok && json.data.length > 0, "year band must not be empty");
  for (const movie of json.data) {
    const year = Number(movie.releaseDate.slice(0, 4));
    assert.ok(year >= 2010 && year <= 2020, `year ${year} leaked the [2010,2020] window (id ${movie.id}, date ${movie.releaseDate})`);
  }
});

/* -------------------------------- F5 ---------------------------------- */
test("F5: count=500 clamps to 200 ⇒ 10 pages deduped — served set equals the union of a fresh 10-page set", async () => {
  const neg0 = await api(APP_PORT, "/api/discover?count=0");
  assert.equal(neg0.status, 400);
  assertFailEnvelope(neg0.json, "BAD_REQUEST");
  const negA = await api(APP_PORT, "/api/discover?count=abc");
  assert.equal(negA.status, 400);
  assertFailEnvelope(negA.json, "BAD_REQUEST");
  const { status, json } = await api(APP_PORT, "/api/discover?count=500&year_from=1985");
  assert.equal(status, 200);
  const expected = distinctUnion(filterPool(POOL, { "primary_release_date.gte": "1985-01-01" }), 10);
  assert.equal(expected.length, 167, "1985+ window leaves 167 matches — deduped union < 200 (no-dedup ⇒ red)");
  assert.equal(json.data.length, expected.length, "no-dedup merge would serve 200 with repeats");
  assert.deepEqual(json.data.map((movie) => movie.id), expected);
});

/* -------------------------------- F5b --------------------------------- */
test("F5b: 400s — non-numeric score, out-of-range years, inverted year pair, inverted score pair", async () => {
  for (const path of [
    "/api/discover?min_score=abc",
    "/api/discover?year_from=1500",
    "/api/discover?year_from=3000",
    "/api/discover?min_score=8&max_score=7",
  ]) {
    const { status, json } = await api(APP_PORT, path);
    assert.equal(status, 400, `${path} must be 400`);
    assertFailEnvelope(json, "BAD_REQUEST");
  }
});

/* -------------------------------- F6 ---------------------------------- */
test("F6: scores clamp to the TMDB domain — min 15 → gte \"10\", max −3 → lte \"0\", inverted pair → 400", async () => {
  await resetRing();
  const high = await api(APP_PORT, "/api/discover?min_score=15");
  assert.equal(high.status, 200);
  let requests = await discoverRing();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].query["vote_average.gte"], "10", "min_score clamps to 10, never 15");
  assert.equal(requests[0].query["vote_average.lte"], undefined);
  await resetRing();
  const low = await api(APP_PORT, "/api/discover?max_score=-3");
  assert.equal(low.status, 200);
  requests = await discoverRing();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].query["vote_average.lte"], "0", "max_score clamps to 0, never −3");
  assert.equal(requests[0].query["vote_average.gte"], undefined);
  const inverted = await api(APP_PORT, "/api/discover?min_score=6&max_score=5");
  assert.equal(inverted.status, 400);
  assertFailEnvelope(inverted.json, "BAD_REQUEST");
});

/* -------------------------------- F7 ---------------------------------- */
test("F7: page-2 poison (genre=99996&count=40) fails the whole merge CLOSED — 502, never a partial slice", async () => {
  const { status, json } = await api(APP_PORT, "/api/discover?genre=99996&count=40");
  assert.equal(status, 502, "a poisoned page ≥2 must fail closed (§6 fan-out pin)");
  assertFailEnvelope(json, "TMDB_UPSTREAM_ERROR");
});

/* -------------------------------- F8 ---------------------------------- */
test("F8: five-way conjunction rides ONE call with every param mapped — trio 15004–15006 exactly", async () => {
  await resetRing();
  const { status, json } = await api(
    APP_PORT,
    "/api/discover?genre=18&min_score=7.5&year_from=2010&year_to=2020&company=88888",
  );
  assert.equal(status, 200);
  const requests = await discoverRing();
  assert.equal(requests.length, 1, "count off ⇒ one page, filters must ride one call");
  const query = requests[0].query;
  assert.equal(query.with_genres, "18");
  assert.equal(query["vote_average.gte"], "7.5");
  assert.equal(query["primary_release_date.gte"], "2010-01-01");
  assert.equal(query["primary_release_date.lte"], "2020-12-31");
  assert.equal(query.with_companies, "88888");
  assert.equal(query.sort_by, "popularity.desc");
  assert.equal(query.page, undefined);
  assert.deepEqual(json.data.map((movie) => movie.id), [15004, 15005, 15006]);
});

/* -------------------------------- F9 ---------------------------------- */
test("F9: partial UI submit (empty fields sent) behaves as OFF — one call, ONLY the year selector", async () => {
  await resetRing();
  const { status, json } = await api(
    APP_PORT,
    "/api/discover?year_from=2010&min_score=&max_score=&year_to=&count=",
  );
  assert.equal(status, 200, "empty fields are OFF, not 400 (§4e)");
  assert.equal(json.ok, true);
  const requests = await discoverRing();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].query["primary_release_date.gte"], "2010-01-01");
  assert.equal(requests[0].query["primary_release_date.lte"], undefined, "empty year_to must NOT map");
  assert.equal(requests[0].query["vote_average.gte"], undefined, "empty min_score must NOT map");
  assert.equal(requests[0].query["vote_average.lte"], undefined);
  assert.equal(requests[0].query.page, undefined, "empty count must NOT fan pages");
});

/* -------------------------------- F10 --------------------------------- */
test("F10: company=88888 maps to with_companies and serves exactly the Svea trio", async () => {
  const { status, json } = await api(APP_PORT, "/api/discover?company=88888");
  assert.equal(status, 200);
  assert.deepEqual(json.data.map((movie) => movie.id), [15004, 15005, 15006]);
});
