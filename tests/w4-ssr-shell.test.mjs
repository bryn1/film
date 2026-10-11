/**
 * w4-ssr-shell.test.mjs — ADDITIVE TEST-c2 hardening (MC 10252.1 T5-c2).
 * Pins the W4 SSR-shell design of 82a13ee (DA P2-1/P4-2/P4-3) that c1 could
 * only observe as an ABSENCE (c1 TEST-verdict: shells carried no search
 * field; only / had a visible h1). This file inverts that into positive
 * gates over the REAL delivered HTML — it curls `next start` and asserts:
 *
 *  1. every route's SSR HTML carries EXACTLY one <h1>, server-owned, in the
 *     canon text (/, /discover, /search, /search?q=) — the one-h1 invariant
 *     holds in the SERVER HTML, not just the hydrated DOM;
 *  2. the /search h1 and the fetch query are ONE source: repeated ?q= takes
 *     the first value, whitespace is trimmed, diacritics survive, and a
 *     hostile q is HTML-escaped in the h1 (no raw <script> in the slice);
 *  3. every route's SSR HTML carries <form role="search"> + <input
 *     type="search"> — the STATIC prerender (/) via Nav's
 *     SearchFieldFallback, the DYNAMIC routes (/discover and /search
 *     since MC 10333 T9) via the live SearchField — exactly ONE search
 *     input in the delivered HTML, so fallback and live field cannot
 *     coexist pre-hydration (post-hydration uniqueness was
 *     browser-verified; see TEST-verdict-c2.md);
 *  4. loading regions ship aria-busy="true" in SSR HTML (/ rails ×, /search?q=).
 *
 * Warm-cache resilience (c1 finding 1): every assertion here reads either
 * the STATIC prerender (/) or param-driven server HTML whose text depends
 * only on searchParams (/discover and /search since MC 10333 T9 — both
 * read params server-side and are dynamic λ now), never on TMDB data — a
 * repopulated .next/cache cannot change these bytes. No cache clear, no
 * rebuild.
 *
 * Owns its OWN boot on W4_FIXTURE_PORT/W4_APP_PORT (defaults 3004/3227 —
 * disjoint from app.integration.test.mjs so `node --test tests/*.test.mjs`
 * runs both files CONCURRENTLY without port races; node --test gives each
 * file its own process, so the fetch/spawn helpers are deliberately local
 * copies: the c1 file is a graded artifact and must not be restructured).
 * Only PIDs spawned here are ever killed.
 *
 * Run (built repo): node --test tests/w4-ssr-shell.test.mjs
 *   env overrides: W4_FIXTURE_PORT, W4_APP_PORT
 */

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = process.env.APP_DIR ?? join(HERE, "..");
const FIXTURE_PORT = Number(process.env.W4_FIXTURE_PORT ?? 3004);
const APP_PORT = Number(process.env.W4_APP_PORT ?? 3227);
const FIXTURE = `http://127.0.0.1:${FIXTURE_PORT}`;
// localhost (not the IP): matches how the suite always names the fixture.
const FIXTURE_LOCAL = `http://localhost:${FIXTURE_PORT}`;

const children = [];

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
      if (response.status < 500) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`${label} did not answer on ${url} within ${deadlineMs} ms`);
}

async function html(path) {
  const response = await fetch(`http://127.0.0.1:${APP_PORT}${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  assert.equal(response.status, 200, `${path} must answer 200`);
  return text;
}

const countH1 = (text) => (text.match(/<h1[\s>]/g) ?? []).length;
const countSearchInputs = (text) =>
  (text.match(/<input[^>]*type="search"/g) ?? []).length;
function h1Slice(text) {
  const start = text.indexOf("<h1");
  const end = text.indexOf("</h1>", start);
  assert.ok(start >= 0 && end > start, "page must contain an <h1>…</h1>");
  return text.slice(start, end + "</h1>".length);
}

before(async () => {
  for (const port of [FIXTURE_PORT, APP_PORT]) {
    assert.ok(
      await portFree(port).then(
        () => true,
        () => false,
      ),
      `port ${port} must be free for the W4 shell suite (env overrides exist)`,
    );
  }
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
 * W1 — one server-owned h1 per route, in the canon text (DA P2-1).
 * The h1 must already be in the SERVER HTML (curl), not only after
 * hydration; exactly one per document.
 * ------------------------------------------------------------------ */
test("W4: SSR HTML of /, /discover, /search, /search?q= carries exactly one canon h1", async () => {
  const cases = [
    ["/", /<h1[^>]*>Trending<\/h1>/], // sr-only stand-in while data is client-side
    ["/discover", /<h1[^>]*>Upptäck filmer<\/h1>/],
    ["/search", /<h1[^>]*>Sökresultat<\/h1>/],
    ["/search?q=ronja", /<h1[^>]*>Sökresultat för &quot;ronja&quot;<\/h1>/],
  ];
  for (const [path, canon] of cases) {
    const text = await html(path);
    assert.equal(countH1(text), 1, `${path} must carry EXACTLY one h1`);
    assert.match(h1Slice(text), canon, `${path} server h1 not canon text`);
  }
});

/* ------------------------------------------------------------------ *
 * W2 — h1↔query are ONE source (src/app/search/page.tsx reads
 * searchParams once via firstQ and feeds both the h1 and
 * <SearchResults q={q}>; these boundaries pin that reading over HTTP).
 * ------------------------------------------------------------------ */
test("W4: /search SSR h1 follows the query — first-of-repeated, trimmed, diacritics, escaped", async () => {
  const repeated = await html("/search?q=film&q=annat");
  assert.match(h1Slice(repeated), /för &quot;film&quot;/, "repeated q: first wins");
  assert.doesNotMatch(h1Slice(repeated), /annat/, "second value must not leak");
  const trimmed = await html("/search?q=%20ronja%20");
  assert.match(h1Slice(trimmed), /för &quot;ronja&quot;/, "surrounding spaces trimmed");
  const sv = await html("/search?q=film%20kv%C3%A4ll");
  assert.match(h1Slice(sv), /för &quot;film kväll&quot;/, "diacritics + space survive");
  const hostile = await html("/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  assert.match(h1Slice(hostile), /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(h1Slice(hostile), /<script/i, "hostile q must not render raw in h1");
  assert.doesNotMatch(hostile, /<script>alert\(1\)/, "no raw injection in the document");
});

/* ------------------------------------------------------------------ *
 * W3 — every delivered HTML carries the real search field (inverts
 * c1's absence observation), and NEVER two: exactly one
 * <form role="search"> + one input[type=search] per document.
 * Two honest variants, both pinned (arm split flipped by MC 10333 T9,
 * the commit that made /discover read searchParams server-side):
 *  - STATIC prerender (/): the Suspense boundary paints
 *    SearchFieldFallback — no-JS GET action="/search" method="get"
 *    with aria-label (the Nav comment's promise).
 *  - DYNAMIC (/discover, /search — pages read searchParams): the
 *    boundary's CHILD renders server-side — the live field: form
 *    role="search" with NO action, label for="site-search",
 *    id="site-search" — and /search's input already carries value=<q>,
 *    so field↔URL sync holds before any JS runs. Fallback and live
 *    field never coexist on any route (count === 1 everywhere).
 * ------------------------------------------------------------------ */
test("W4: every route's SSR HTML carries exactly ONE search field (fallback on static /, live on dynamic /discover + /search)", async () => {
  for (const path of ["/", "/discover", "/search", "/search?q=ronja"]) {
    const text = await html(path);
    assert.equal(
      (text.match(/<form[^>]*role="search"/g) ?? []).length,
      1,
      `${path}: exactly one search form in delivered HTML`,
    );
    assert.equal(
      countSearchInputs(text),
      1,
      `${path}: delivered HTML must carry exactly one search input`,
    );
    assert.match(
      text,
      /<input[^>]*name="q"[^>]*>|<input[^>]*type="search"/,
      `${path}: search input must post name="q"`,
    );
    assert.match(
      text,
      /aria-label="Sök film"|>Sök film<\/label>/,
      `${path}: accessible name "Sök film" missing`,
    );
  }
  for (const path of ["/"]) {
    const text = await html(path);
    assert.match(
      text,
      /<form[^>]*role="search"[^>]*action="\/search"[^>]*method="get"/,
      `${path}: static route must ship the no-JS GET fallback form`,
    );
    assert.doesNotMatch(
      text,
      /id="site-search"/,
      `${path}: static route paints the fallback, not the live field`,
    );
  }
  // Dynamic arm (§9 W-row): the LIVE field is in the served HTML —
  // role="search" form WITHOUT a no-JS action, label + id targets.
  for (const path of ["/discover", "/search", "/search?q=ronja"]) {
    const text = await html(path);
    assert.match(
      text,
      /<label[^>]*for="site-search"/,
      `${path}: live field label target missing`,
    );
    assert.match(
      text,
      /id="site-search"/,
      `${path}: dynamic route must paint the live field, not the fallback`,
    );
    assert.doesNotMatch(
      text,
      /<form[^>]*role="search"[^>]*action=/,
      `${path}: live form must NOT carry the fallback's action`,
    );
  }
  const live = await html("/search?q=ronja");
  assert.match(
    live,
    /id="site-search"[^>]*value="ronja"/,
    "live input must carry the URL q server-side (pre-JS sync)",
  );
});

/* ------------------------------------------------------------------ *
 * W4 — loading states announce themselves server-side (DA P4-3):
 * the skeleton containers carry aria-busy in the delivered HTML.
 * ------------------------------------------------------------------ */
test("W4: SSR loading HTML carries aria-busy (/ rails and /search?q= skeleton)", async () => {
  const start = await html("/");
  assert.match(start, /aria-busy="true"/, "/ rails loading must carry aria-busy");
  const search = await html("/search?q=ronja");
  assert.equal(
    (search.match(/aria-busy="true"/g) ?? []).length,
    1,
    "/search?q= must carry exactly one aria-busy results region",
  );
});
