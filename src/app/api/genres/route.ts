/**
 * GET /api/genres — genrelistan (PLAN §5). Cachas 86400 s (the genres
 * caller passes to tmdbFetch); normaliseras till { id, name }.
 */

import { fail, ok } from "@/lib/api/envelope";
import { normalizeGenres, TmdbError, tmdbFetch } from "@/lib/tmdb/client";
import type { TmdbGenresResponse } from "@/lib/tmdb/types";

export async function GET(): Promise<Response> {
  try {
    const response = await tmdbFetch<TmdbGenresResponse>(
      "/genre/movie/list",
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
