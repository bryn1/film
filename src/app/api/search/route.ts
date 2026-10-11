/**
 * GET /api/search?q=<text> — fri textsökning (ARCHITECT-PLAN Rev 4.1 §3/§4f,
 * MC 10333 T9). `q` trimmas; saknas/är tom → 400 BAD_REQUEST (unchanged).
 * Fan-out: /search/movie + /search/person + /search/company IN PARALLEL,
 * fail-closed (§5: any section failing fails the whole request — a partial
 * section set would paint "Inga träffar" over data that merely timed out).
 * Success data = {movies, people, companies} (§3 SearchSections); every
 * section possibly empty, the envelope never is. 429 passes through.
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
    const [moviePage, personPage, companyPage] = await Promise.all([
      tmdbFetch<TmdbPagedResponse<TmdbMovieRaw>>("/search/movie", { query }),
      tmdbFetch<TmdbPagedResponse<TmdbPersonRaw>>("/search/person", { query }),
      tmdbFetch<TmdbPagedResponse<TmdbCompanyRaw>>("/search/company", { query }),
    ]);
    const sections: SearchSections = {
      movies: normalizeMovies(moviePage),
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
