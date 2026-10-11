/**
 * tests/fixtures/server.mjs — the ONE fixture mechanism of the filmsida
 * tests (PLAN-placement.md §5 + ARCHITECT-PLAN Rev 4.1 §6, MC 10333 T9):
 * a local stand-in for TMDB v3 on http://localhost:3001 (FIXTURE_PORT
 * overrides). node stdlib only.
 *
 * Implements the pinned paths the app calls: /trending/movie/day,
 * /movie/now_playing, /movie/top_rated, /movie/popular, /discover/movie,
 * /search/movie, /search/person, /search/company, /movie/<id> (literal
 * lists resolve BEFORE the id regex — F-11c), /genre/movie/list — plus
 * real PNGs at /t/p/<size><path> so next/image resolves. Honours
 * `Authorization: Bearer …` (401 without), `language` (sv-SE ⇒ Swedish
 * genre names, anything else ⇒ English) and `query` (400 without on the
 * three /search/* endpoints, echoed back in X-FQuery so fixture-side
 * assertions can see what the app actually sent).
 *
 * /discover/movie now speaks the 192-item FILTER POOL (pool.mjs):
 * filtering (genre ∩ vote/date/company) happens first, matches sort by
 * id ascending, page size 20, page k≥2 starts at item (k−1)·18+1 (overlap
 * items 18k+1, 18k+2 exactly); out-of-range page ⇒ 200 + empty window.
 *
 * Special pins the suite exercises (poison pins are SINGLE-SELECTOR
 * scoped: they fire only when with_genres is the sole filter selector —
 * no vote_average.*, primary_release_date.* or with_companies):
 *   /discover/movie?with_genres=99998 → 500 upstream   (app must answer 502)
 *   /discover/movie?with_genres=99997 → 429 upstream   (app must answer 429)
 *   /discover/movie?with_genres=99999 → 200 empty list (UI empty state)
 *   /discover/movie?with_genres=99996 → 500 ONLY on page ≥ 2 (fan-out fail-closed)
 *   /search/movie?query=tomtest       → 200 empty list (UI empty state)
 *
 * Debug ring buffer (test support, NOT part of the TMDB surface):
 *   GET  /_debug/requests  → { requests: [{method,path,query,hasAuth}] }
 *   POST /_debug/reset     → clears the ring (per-assertion attribution)
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { filterPool, pageWindow } from "./pool.mjs";

const PORT = Number(process.env.FIXTURE_PORT ?? 3001);
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");

/** Poison ids the suite pins (PLAN §5 error paths + §6 fan-out pin). */
const POISON_500 = "99998";
const POISON_429 = "99997";
/** Genre id that legitimately has zero fixture movies. */
const EMPTY_GENRE = "99999";
/** Poison that only fires on page ≥ 2 — the fan-out fail-closed pin (F7). */
const POISON_PAGE2 = "99996";

const jsonCache = new Map();
function fixture(name) {
  if (!jsonCache.has(name)) {
    jsonCache.set(name, JSON.parse(readFileSync(join(DATA_DIR, name), "utf8")));
  }
  return jsonCache.get(name);
}

/* ---------- a real 8×8 PNG, built with node:zlib only ---------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
const PNG = (() => {
  const size = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = [];
  for (let y = 0; y < size; y += 1) {
    raw.push(Buffer.from([0])); // filter byte
    const row = Buffer.alloc(size * 4);
    for (let x = 0; x < size; x += 1) {
      const o = x * 4;
      row[o] = 16;
      row[o + 1] = 21;
      row[o + 2] = 31;
      row[o + 3] = 255; // near-black, like a dark poster tile
    }
    raw.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(raw))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
})();

/* ---------- request ring (test attribution) ---------- */
const MAX_RING = 500;
const ring = [];
function record(req, url) {
  if (url.pathname.startsWith("/_debug")) return;
  ring.push({
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    hasAuth: /^Bearer \S+/.test(req.headers.authorization ?? ""),
  });
  if (ring.length > MAX_RING) ring.shift();
}

function send(res, status, body, headers = {}) {
  const payload =
    body instanceof Buffer ? body : Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": body instanceof Buffer ? "image/png" : "application/json",
    "Access-Control-Allow-Origin": "*",
    ...headers,
  });
  res.end(payload);
}

const PAGED_FIXTURES = {
  "/trending/movie/day": "movies-trending.json",
  "/movie/now_playing": "movies-now-playing.json",
  "/movie/top_rated": "movies-top-rated.json",
  "/movie/popular": "movies-popular.json",
};

/** Pool ids carrying a full detail+credits document (/movie/<id> surface). */
const DETAIL_FIXTURES = {
  15001: "movie-15001.json",
  15002: "movie-15002.json",
};

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  record(req, url);

  if (url.pathname === "/_debug/requests" && req.method === "GET") {
    return send(res, 200, { requests: [...ring] });
  }
  if (url.pathname === "/_debug/reset" && req.method === "POST") {
    ring.length = 0;
    return send(res, 200, { ok: true });
  }

  if (url.pathname.startsWith("/t/p/")) {
    // /t/p/<size><path> — every fixture poster/backdrop path resolves.
    return send(res, 200, PNG, { "Cache-Control": "public, max-age=86400" });
  }

  // Everything below is the TMDB surface: bearer is honoured (401 without).
  if (!/^Bearer \S+/.test(req.headers.authorization ?? "")) {
    return send(res, 401, {
      status: 401,
      status_message: "No or invalid API key. (fixture)",
    });
  }

  const paged = PAGED_FIXTURES[url.pathname];
  if (paged) {
    return send(res, 200, fixture(paged));
  }

  if (url.pathname === "/discover/movie") {
    const params = url.searchParams;
    const genre = params.get("with_genres") ?? "";
    // Poison pins are SINGLE-SELECTOR scoped: they fire only when
    // with_genres is the sole filter selector — a combined query like
    // F7's genre=99996&count=40 must reach the page logic instead.
    const soleSelector =
      !params.has("vote_average.gte") &&
      !params.has("vote_average.lte") &&
      !params.has("primary_release_date.gte") &&
      !params.has("primary_release_date.lte") &&
      !params.has("with_companies");
    if (soleSelector) {
      if (genre === POISON_500) {
        return send(res, 500, {
          status: 500,
          status_message: "Internal fixture error (planted poison).",
        });
      }
      if (genre === POISON_429) {
        return send(res, 429, {
          status: 429,
          status_message: "Too many requests (planted poison).",
        });
      }
      const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
      if (genre === POISON_PAGE2 && page >= 2) {
        return send(res, 500, {
          status: 500,
          status_message: "Planted poison: page ≥ 2 only.",
        });
      }
    }
    // §6 pool mechanics: filter first, sort id-ascending, then window.
    const matches = filterPool(fixture("movies-discover-pool.json").results, params);
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    return send(res, 200, {
      page,
      results: pageWindow(matches, page),
      total_pages: Math.max(1, Math.ceil(matches.length / 18)),
      total_results: matches.length,
    });
  }

  if (url.pathname === "/search/movie") {
    const query = url.searchParams.get("query");
    if (!query) {
      return send(res, 400, {
        status: 7,
        status_message: "Invalid query: query is required. (fixture)",
      });
    }
    const headers = { "X-FQuery": query };
    const pool = fixture("movies-search.json");
    if (query === "tomtest") {
      return send(
        res,
        200,
        { page: 1, results: [], total_pages: 1, total_results: 0 },
        headers,
      );
    }
    const needle = query.toLowerCase();
    const results = pool.results.filter((movie) =>
      movie.title.toLowerCase().includes(needle),
    );
    return send(
      res,
      200,
      {
        page: 1,
        results,
        total_pages: 1,
        total_results: results.length,
      },
      headers,
    );
  }

  // /search/person + /search/company: same query discipline as /search/movie
  // (400 without query, X-FQuery echo) — token-substring on `name` so the
  // S3 multi-token gate exercises a real fan-in match (§6).
  if (url.pathname === "/search/person" || url.pathname === "/search/company") {
    const query = url.searchParams.get("query");
    if (!query) {
      return send(res, 400, {
        status: 7,
        status_message: "Invalid query: query is required. (fixture)",
      });
    }
    const headers = { "X-FQuery": query };
    const file = url.pathname === "/search/person" ? "persons-search.json" : "companies-search.json";
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results = fixture(file).results.filter((entry) =>
      tokens.some((token) => entry.name.toLowerCase().includes(token)),
    );
    return send(
      res,
      200,
      { page: 1, results, total_pages: 1, total_results: results.length },
      headers,
    );
  }

  // /movie/<id> detail+credits. AFTER the literal PAGED_FIXTURES map above,
  // so /movie/popular &co can never fall into the id regex (F-11c).
  const detail = /^\/movie\/(\d+)$/.exec(url.pathname);
  if (detail) {
    const known = DETAIL_FIXTURES[detail[1]];
    if (!known) {
      return send(res, 404, {
        status: 34,
        status_message: `The movie id ${detail[1]} does not exist. (fixture)`,
      });
    }
    return send(res, 200, fixture(known));
  }

  if (url.pathname === "/genre/movie/list") {
    // language is honoured: only sv-SE gets the Swedish names.
    const sv = url.searchParams.get("language") === "sv-SE";
    return send(res, 200, fixture(sv ? "genres-sv.json" : "genres-en.json"));
  }

  return send(res, 404, {
    status: 7,
    status_message: `Path not in fixture: ${url.pathname}`,
  });
});

server.listen(PORT, () => {
  console.log(`fixture TMDB server listening on http://localhost:${PORT}`);
});
