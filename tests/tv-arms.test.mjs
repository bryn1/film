/**
 * tv-arms.test.mjs — MC 10877 P2-1: the two TV API rails the T-suite never
 * touched. /api/now-playing?type=tv and /api/top-rated?type=tv work in
 * source (the now-playing + top-rated route handlers pick /tv/on_the_air
 * and /tv/top_rated) but
 * NO gate in the six pre-existing files hit them — a regression wrongly
 * hitting the movie endpoint shipped movies under a TV home rail with the
 * suite green. A1/A2 close that hole; A3 extends the T10 keyless-envelope
 * pattern from 3 of the 5 type-aware routes to all 5.
 *
 * SPLIT, not an append: tests/tv.test.mjs sits at 539 of the 600-line file
 * cap; these arms push it past it, so they live here (the card's preferred
 * branch). Own boot per file: fixture 3008 + keyed app 3232 + KEYLESS twin
 * 3233 (env TVARMS_FIXTURE_PORT/TVARMS_APP_PORT/TVARMS_NOKEY_PORT; the
 * keyless pattern is tv.test.mjs's T10 — spawned WITHOUT TMDB_API_KEY,
 * never with a fake one). Ports are disjoint from all five sibling files
 * (3001/3211–3213, 3004/3227, 3005/3228, 3006/3229, 3007/3230/3231) so
 * `node --test tests/*.test.mjs` runs them all concurrently; only PIDs
 * spawned here are ever killed; before() clears ONLY this build's
 * .next/cache (a regenerable artifact, same rationale as the siblings).
 *
 * Cold-URL discipline: A1 owns the FIRST hit of /tv/on_the_air upstream and
 * A2 the first of /tv/top_rated — no other suite file ever requests those
 * two URLs (grep-verified), and the startsida rails are CLIENT fetches
 * ('use client' + useApi in src/app/page.tsx), so the boot-time GET / never
 * warms them. The payload pins ride the responses themselves and are
 * cache-hit-invariant; only the ring attribution needs the cold position,
 * which this file holds.
 *
 * Expectations DERIVE from the fixture JSON (never hand-tuned), exactly
 * like the T-suite; helpers are deliberate local copies (the w4/S4/T10
 * precedent — graded artifacts are not restructured for sharing).
 */

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = process.env.APP_DIR ?? join(HERE, "..");
const FIXTURE_PORT = Number(process.env.TVARMS_FIXTURE_PORT ?? 3008);
const APP_PORT = Number(process.env.TVARMS_APP_PORT ?? 3232);
const NOKEY_PORT = Number(process.env.TVARMS_NOKEY_PORT ?? 3233);
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
 *  restructured; helpers here are deliberate local copies, the w4/S4/T10
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

before(async () => {
  for (const port of [FIXTURE_PORT, APP_PORT, NOKEY_PORT]) {
    assert.ok(
      await portFree(port).then(
        () => true,
        () => false,
      ),
      `port ${port} must be free for the tv-arms suite (env overrides exist)`,
    );
  }
  // Cold data cache for this file's OWN build (regenerable artifact — the
  // A1/A2 ring gates below ride the FIRST (cold) hits of their pinned URLs).
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
  // The T10 keyless twin: NO TMDB_API_KEY in this env at all (never an
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
 * A1 (FIRST = fresh-cache position): the "På TV nu" rail's API. The
 * regression this gate exists for (MC 10877 P2-1): a ?type=tv that
 * wrongly hit /movie/now_playing ships FOUR movies (fixture ids 12001–
 * 12004) under the TV home rail — the ids deepEqual, the title fold and
 * the ring path each catch it independently.
 * ------------------------------------------------------------------ */
test("A1: /api/now-playing?type=tv answers ok with tv-titled mediaType-tagged entries via /tv/on_the_air", async () => {
  await resetRing();
  const { status, json } = await api(APP_PORT, "/api/now-playing?type=tv");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  const source = fixtureJson("tv-on-the-air.json").results;
  assert.deepEqual(
    json.data.map((movie) => movie.id),
    source.map((entry) => entry.id),
    "tv on-the-air ids arrive in fixture order — movie now_playing ids would redden this",
  );
  assert.deepEqual(
    json.data.map((movie) => movie.title),
    source.map((entry) => entry.name),
    "the tv NAME arrives as title (normalizeMovie fold)",
  );
  assert.ok(
    json.data.every((movie) => movie.mediaType === "tv"),
    "every now-playing?type=tv entry carries mediaType tv (cards route /tv/<id>)",
  );
  const requests = await ring();
  assert.equal(requests.length, 1, "exactly ONE upstream call for the rail");
  assert.equal(requests[0].path, "/tv/on_the_air");
  assert.equal(requests[0].query.language, "sv-SE");
  assert.equal(requests[0].hasAuth, true, "bearer header");
  assert.equal(
    requests.some((request) => request.path === "/movie/now_playing"),
    false,
    "type=tv must NEVER touch /movie/now_playing (the P2-1 regression)",
  );
});

/* ------------------------------------------------------------------ *
 * A2 (FIRST = fresh-cache position): the "Högst betygsatta serier"
 * rail's API — the same three independent catchers on the tv top_rated
 * ids (fixture 13201–13205 vs the movie rail's 13001–13003).
 * ------------------------------------------------------------------ */
test("A2: /api/top-rated?type=tv answers ok with tv-titled mediaType-tagged entries via /tv/top_rated", async () => {
  await resetRing();
  const { status, json } = await api(APP_PORT, "/api/top-rated?type=tv");
  assert.equal(status, 200);
  assert.equal(json.ok, true);
  const source = fixtureJson("tv-top-rated.json").results;
  assert.deepEqual(
    json.data.map((movie) => movie.id),
    source.map((entry) => entry.id),
    "tv top-rated ids arrive in fixture order — movie top_rated ids would redden this",
  );
  assert.deepEqual(
    json.data.map((movie) => movie.title),
    source.map((entry) => entry.name),
    "the tv NAME arrives as title (normalizeMovie fold)",
  );
  assert.ok(
    json.data.every((movie) => movie.mediaType === "tv"),
    "every top-rated?type=tv entry carries mediaType tv (cards route /tv/<id>)",
  );
  const requests = await ring();
  assert.equal(requests.length, 1, "exactly ONE upstream call for the rail");
  assert.equal(requests[0].path, "/tv/top_rated");
  assert.equal(requests[0].query.language, "sv-SE");
  assert.equal(requests[0].hasAuth, true, "bearer header");
  assert.equal(
    requests.some((request) => request.path === "/movie/top_rated"),
    false,
    "type=tv must NEVER touch /movie/top_rated (the P2-1 regression)",
  );
});

/* ------------------------------------------------------------------ *
 * A3 (extends T10's F-D pattern to these two routes — the keyless twin
 * on 3233): the envelope ring now covers ALL FIVE type-aware routes
 * (T10: trending/genres/discover; here: now-playing/top-rated). The
 * keyless movie-default 503 is app.integration §7's fact; this gate is
 * the ?type=tv shape, and it is path-INDEPENDENT by construction — the
 * key throws in tmdbFetch BEFORE the route's path pick matters, which is
 * exactly why the ring must stay empty here too.
 * ------------------------------------------------------------------ */
test("A3: keyless boot answers 503 TMDB_NOT_CONFIGURED on now-playing AND top-rated with ?type=tv", async () => {
  await resetRing();
  for (const route of [
    "/api/now-playing?type=tv",
    "/api/top-rated?type=tv",
  ]) {
    const { status, json } = await api(NOKEY_PORT, route);
    assert.equal(status, 503, route);
    assertFailEnvelope(json, "TMDB_NOT_CONFIGURED");
    assert.ok(
      json.error.message.includes("TMDB_API_KEY"),
      `${route}: the operator-facing message names the missing variable`,
    );
  }
  const requests = await ring();
  assert.deepEqual(
    requests,
    [],
    "a missing key must throw BEFORE any fetch is issued (PLAN §5) — these two rails included",
  );
});
