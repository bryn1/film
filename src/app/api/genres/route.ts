/**
 * GET /api/genres?type=movie|tv — genrelistan (PLAN §5; the media axis
 * MC 10610 §1: /genre/movie/list | /genre/tv/list, absent ≡ movie).
 * Cachas 86400 s — the tv branch KEEPS the 86400 (DA-c5 §3 note: the
 * revalidate is per-route behavior, not per-type); normaliseras till
 * { id, name }. Tv genre ids DIFFER from movie ids (§1) — safe because
 * ids only reach TMDB inside their own type's endpoint, never hardcoded.
 */

import { fail, ok } from "@/lib/api/envelope";
import { parseMediaType } from "@/lib/api/query";
import { normalizeGenres, TmdbError, tmdbFetch } from "@/lib/tmdb/client";
import type { TmdbGenresResponse } from "@/lib/tmdb/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const type = parseMediaType(new URL(request.url).searchParams);
    if ("error" in type) return fail("BAD_REQUEST", type.error);
    const response = await tmdbFetch<TmdbGenresResponse>(
      type.value === "tv" ? "/genre/tv/list" : "/genre/movie/list",
      undefined,
      { revalidate: 86400 },
    );
    return ok(normalizeGenres(response));
  } catch (error) {
    if (error instanceof TmdbError) {
      return fail(
        error.code,
        error.message,
        error.upstreamStatus === 429 ? 429 : undefined,
      );
    }
    return fail("TMDB_UPSTREAM_ERROR", "Kunde inte hämta genrer.", 502);
  }
}
