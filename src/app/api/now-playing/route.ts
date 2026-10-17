/**
 * GET /api/now-playing?type=movie|tv — bio just nu / på TV nu (PLAN §5;
 * the media axis MC 10610 §1: movie → /movie/now_playing, tv →
 * /tv/on_the_air, absent ≡ movie). Thin handler: TMDB only via the
 * client seam, answers only via the envelope. Curated public list —
 * no include_adult param exists (§1 F-C, status quo cited).
 */

import { fail, ok } from "@/lib/api/envelope";
import { parseMediaType } from "@/lib/api/query";
import { normalizeMovies, TmdbError, tmdbFetch } from "@/lib/tmdb/client";
import type { TmdbMovieRaw, TmdbPagedResponse } from "@/lib/tmdb/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const type = parseMediaType(new URL(request.url).searchParams);
    if ("error" in type) return fail("BAD_REQUEST", type.error);
    const path =
      type.value === "tv" ? "/tv/on_the_air" : "/movie/now_playing";
    const page = await tmdbFetch<TmdbPagedResponse<TmdbMovieRaw>>(path);
    return ok(normalizeMovies(page, type.value));
  } catch (error) {
    if (error instanceof TmdbError) {
      return fail(
        error.code,
        error.message,
        error.upstreamStatus === 429 ? 429 : undefined,
      );
    }
    return fail("TMDB_UPSTREAM_ERROR", "Kunde inte hämta filmdata.", 502);
  }
}
