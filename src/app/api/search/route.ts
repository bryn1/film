/**
 * GET /api/search?q=<text> — fri textsökning (ARCHITECT-PLAN Rev 4.1
 * §3/§4f, MC 10333 T9; both-types rework MC 10610 §5). `q` trimmas;
 * saknas/är tom → 400 BAD_REQUEST (unchanged). Fan-out: /search/multi
 * (movies AND tv "in a single request", include_adult=false per F-C) +
 * /search/person + /search/company IN PARALLEL, fail-closed (§5: any
 * section failing fails the whole request — a partial section set would
 * paint "Inga träffar" over data that merely timed out). Call count
 * stays EXACTLY 3 — multi REPLACES /search/movie, no 4th call (§5
 * ruling). Success data = {movies, tv, people, companies}; multi's
 * `person` entries are DROPPED (/search/person stays the sole known_for
 * source), the rest splits by media_type. Every section possibly empty,
 * the envelope never is. 429 passes through.
 */

import { fail, ok } from "@/lib/api/envelope";
import { normalizeCompanies, normalizePeople } from "@/lib/tmdb/detail";
import { normalizeMovies, TmdbError, tmdbFetch } from "@/lib/tmdb/client";
import type {
  SearchSections,
  TmdbCompanyRaw,
  TmdbMovieRaw,
  TmdbPagedResponse,
  TmdbPersonRaw,
} from "@/lib/tmdb/types";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams.get("q")?.trim();
    if (!query) {
      return fail("BAD_REQUEST", "Sökfrågan saknas eller är tom.");
    }
    const [multiPage, personPage, companyPage] = await Promise.all([
      tmdbFetch<TmdbPagedResponse<TmdbMovieRaw>>("/search/multi", {
        query,
        include_adult: false,
      }),
      tmdbFetch<TmdbPagedResponse<TmdbPersonRaw>>("/search/person", { query }),
      tmdbFetch<TmdbPagedResponse<TmdbCompanyRaw>>("/search/company", { query }),
    ]);
    const mixed = multiPage.results ?? [];
    const sections: SearchSections = {
      movies: normalizeMovies({
        results: mixed.filter((entry) => entry.media_type === "movie"),
      }),
      tv: normalizeMovies(
        { results: mixed.filter((entry) => entry.media_type === "tv") },
        "tv",
      ),
      people: normalizePeople(personPage),
      companies: normalizeCompanies(companyPage),
    };
    return ok(sections);
  } catch (error) {
    if (error instanceof TmdbError) {
      return fail(
        error.code,
        error.message,
        error.upstreamStatus === 429 ? 429 : undefined,
      );
    }
    return fail("TMDB_UPSTREAM_ERROR", "Kunde inte söka.", 502);
  }
}
