/**
 * basePath.ts — the ONE home for the build-time route prefix (MC 10444).
 *
 * Next rewrites <Link> hrefs by itself, but NOT raw fetch() calls or form
 * `action` attributes — anything raw must go through BASE so the hosted copy
 * (built with NEXT_PUBLIC_BASE_PATH=/film for sibbamala.com/film) never
 * submits or fetches off-app, while local dev and the test suite (env unset
 * ⇒ "") stay unprefixed. Same env as next.config.mjs's basePath — one knob,
 * build-time only (inlined by Next at build).
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
