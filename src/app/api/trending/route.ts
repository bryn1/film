/**
 * GET /api/trending?type=movie|tv — dagens trendande (PLAN §5; the media
 * axis MC 10610 §1, absent ≡ movie). Thin handler: TMDB only via the
 * client seam, answers only via the envelope; ?type= rides the same
 * strict parse as discover (query.ts is the ONE validation home).
 * Trending is a curated public list — no include_adult param exists
 * (§1 F-C: status quo identical to today's movie rails, cited).
 */

import { fail, ok } from "@/lib/api/envelope";
import { parseMediaType } from "@/lib/api/query";
import { normalizeMovies, TmdbError, tmdbFetch } from "@/lib/tmdb/client";
import type { TmdbMovieRaw, TmdbPagedResponse } from "@/lib/tmdb/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const type = parseMediaType(new URL(request.url).searchParams);
    if ("error" in type) return fail("BAD_REQUEST", type.error);
    const page = await tmdbFetch<TmdbPagedResponse<TmdbMovieRaw>>(
      `/trending/${type.value}/day`,
    );
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
