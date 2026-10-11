/** @type {import('next').NextConfig} */
// basePath is BUILD-time (MC 10444): the committed deploy/ artifact is built with
// NEXT_PUBLIC_BASE_PATH=/film for sibbamala.com/film; local dev and the 48-gate test
// suite build unprefixed (env unset ⇒ ""). Never a runtime knob.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  basePath,
  output: "standalone",
  images: {
    remotePatterns: [
      // TMDB artwork CDN (default TMDB_IMAGE_BASE host)
      { protocol: "https", hostname: "image.tmdb.org" },
      // fixture image servers of the tests (tests/fixtures/server.mjs, PLAN §5;
      // 3005 = discover-filters copy, 3006 = detail-search copy, MC 10333 T9)
      { protocol: "http", hostname: "localhost", port: "3001" },
      { protocol: "http", hostname: "localhost", port: "3005" },
      { protocol: "http", hostname: "localhost", port: "3006" },
    ],
  },
};

export default nextConfig;
