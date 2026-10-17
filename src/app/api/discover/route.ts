/**
 * GET /api/discover (ARCHITECT-PLAN Rev 4.1 §3/§4d, MC 10333 T9; the
 * media axis MC 10610 §1). Validation lives entirely in query.ts (the
 * route does no math itself). Three-way branch (§1): NO recognized param
 * present ⇒ "/movie/popular" ("Alla", byte-stable, existing gate) · type
 * only (no filters) ⇒ popular PER TYPE ("/tv/popular" symmetry, T5) ·
 * filters ⇒ "/discover/<type>" with sort_by=popularity.desc +
 * include_adult=false (F-C) + the mapped filters. `count` fans pages
 * 1..ceil(count/20) out IN PARALLEL (page 1 carries NO page param — the
 * ring page-set is {none} ∪ {2..N} exactly), merges ascending, dedupes
 * by id first-occurrence and slices to count. ANY page failing fails
 * the whole request closed (a partial merge would silently reorder).
 * Spekar ENDAST TMDB-id (slug→id är sidans jobb, via /api/genres).
 */

import { fail, ok } from "@/lib/api/envelope";
import { buildDiscoverParams } from "@/lib/api/query";
import { normalizeMovies, TmdbError, tmdbFetch } from "@/lib/tmdb/client";
import type { TmdbMovieRaw, TmdbPagedResponse } from "@/lib/tmdb/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = buildDiscoverParams(new URL(request.url).searchParams);
    if ("error" in query) return fail("BAD_REQUEST", query.error);
    if (!query.hasAny || !query.hasFilters) {
      // Popular "Alla" list — per type (movie arm byte-stable pin).
      const popular = await tmdbFetch<TmdbPagedResponse<TmdbMovieRaw>>(
        `/${query.type}/popular`,
      );
      return ok(normalizeMovies(popular, query.type));
    }
    // Pages in parallel; page 1 deliberately carries no `page` param (§3).
    const fetches: Promise<TmdbPagedResponse<TmdbMovieRaw>>[] = [];
    for (let page = 1; page <= query.pages; page += 1) {
      const params =
        page === 1 ? query.params : { ...query.params, page };
      fetches.push(
        tmdbFetch<TmdbPagedResponse<TmdbMovieRaw>>(
          `/discover/${query.type}`,
          params,
        ),
      );
    }
    const pagesData = await Promise.all(fetches); // any failure ⇒ fail-closed
    const seen = new Set<number>();
    const merged: TmdbMovieRaw[] = [];
    for (const pageData of pagesData) {
      for (const movie of pageData.results ?? []) {
        if (!seen.has(movie.id)) {
          seen.add(movie.id);
          merged.push(movie);
        }
      }
    }
    const sliced =
      query.count === null ? merged : merged.slice(0, query.count);
    return ok(normalizeMovies({ results: sliced }, query.type));
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
