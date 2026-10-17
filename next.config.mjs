/** @type {import('next').NextConfig} */
// basePath is BUILD-time (MC 10444): the committed deploy/ artifact is built with
// NEXT_PUBLIC_BASE_PATH=/film for sibbamala.com/film; local dev and the 67-gate test
// suite build unprefixed (env unset ⇒ ""). Never a runtime knob.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  basePath,
  // Canonical trailing slash (MC 10444 fix-cycle 1, live browser finding): with
  // it the router emits /film/… for every link/prefetch, so the browser hot
  // path never hits the nginx `location = /film` exact-match rule — whose
  // absolute_redirect Location was http://sibbamala.com/film/ behind the TLS
  // tunnel (measured: navigation dropped to HTTP, subresource/RSC prefetches
  // died as mixed-content errors). Bare /film… now gets at most ONE
  // app-level, scheme-preserving 308 to canonical; hot path: zero redirects.
  trailingSlash: true,
  output: "standalone",
  images: {
    remotePatterns: [
      // TMDB artwork CDN (default TMDB_IMAGE_BASE host)
      { protocol: "https", hostname: "image.tmdb.org" },
      // fixture image servers of the tests (tests/fixtures/server.mjs, PLAN §5;
      // 3005 = discover-filters copy, 3006 = detail-search copy, MC 10333 T9;
      // 3007 = tv suite copy, MC 10610 T10b — the ONE row this change adds)
      { protocol: "http", hostname: "localhost", port: "3001" },
      { protocol: "http", hostname: "localhost", port: "3005" },
      { protocol: "http", hostname: "localhost", port: "3006" },
      { protocol: "http", hostname: "localhost", port: "3007" },
    ],
  },
};

export default nextConfig;
