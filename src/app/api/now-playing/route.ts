/**
 * GET /api/now-playing — filmer på bio just nu (PLAN §5).
 * Thin handler: TMDB only via the client seam, answers only via the envelope.
 */

import { fail, ok } from "@/lib/api/envelope";
import { normalizeMovies, TmdbError, tmdbFetch } from "@/lib/tmdb/client";
import type { TmdbMovieRaw, TmdbPagedResponse } from "@/lib/tmdb/types";

export async function GET(): Promise<Response> {
  try {
    const page = await tmdbFetch<TmdbPagedResponse<TmdbMovieRaw>>(
      "/movie/now_playing",
    );
    return ok(normalizeMovies(page));
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
