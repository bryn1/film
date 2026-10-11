/**
 * detail.ts — normalizers for the /api/search sections and the
 * /movie/[id] detail surface (ARCHITECT-PLAN Rev 4.1 §4b, MC 10333 T9).
 * Pure shaping: this file NEVER issues HTTP — client.ts remains the only
 * file that does (header duty per §4b): fetchMovieDetail merely calls
 * client.ts's tmdbFetch and shapes the response here.
 */

import { normalizeMovie, tmdbFetch, tmdbImageUrl, type TmdbParams } from "./client";
import type {
  CastMember,
  Company,
  MovieDetail,
  Person,
  TmdbCompanyRaw,
  TmdbMovieDetailRaw,
  TmdbPagedResponse,
  TmdbPersonRaw,
} from "./types";

/**
 * One detail call: /movie/<id> with credits appended (the §4b loader,
 * delegated to client.ts — still the ONLY HTTP in the codebase). A TMDB
 * 404 arrives as a TmdbError with upstreamStatus 404 (the page branch).
 */
export async function fetchMovieDetail(id: string): Promise<MovieDetail> {
  const params: TmdbParams = { append_to_response: "credits" };
  const raw = await tmdbFetch<TmdbMovieDetailRaw>(`/movie/${id}`, params);
  return normalizeDetail(raw);
}

/** normalizeMovie + tagline/runtime/Genre[]/director/cast ≤12 (§4b). */
export function normalizeDetail(raw: TmdbMovieDetailRaw): MovieDetail {
  const crew = raw.credits?.crew ?? [];
  const cast: CastMember[] = (raw.credits?.cast ?? []).slice(0, 12).map((c) => ({
    id: c.id,
    name: c.name ?? "",
    character: c.character ?? "",
    profileUrl: tmdbImageUrl(c.profile_path, "w185"),
  }));
  return {
    ...normalizeMovie(raw),
    tagline: raw.tagline ?? "",
    runtime: raw.runtime ?? null,
    genres: (raw.genres ?? []).map((g) => ({ id: g.id, name: g.name ?? "" })),
    director: crew.find((c) => c.job === "Director")?.name ?? null,
    cast,
  };
}

/**
 * Person[] from a /search/person response. knownFor keeps MOVIE
 * media_type entries only, max 4 (§3: TV noise never renders a dead
 * /movie/<id> link; VERIFIED-DA).
 */
export function normalizePeople(
  response: TmdbPagedResponse<TmdbPersonRaw>,
): Person[] {
  return (response.results ?? []).map((raw) => ({
    id: raw.id,
    name: raw.name ?? "",
    knownFor: (raw.known_for ?? [])
      .filter((entry) => entry.media_type === "movie")
      .slice(0, 4)
      .map((entry) => ({ id: entry.id, title: entry.title ?? entry.name ?? "" })),
  }));
}

/**
 * Company[] from a /search/company response. An EMPTY origin_country
 * means "unknown", not "no country": the field is OMITTED so the UI can
 * never paint an empty chip (§7c F-11d, S3).
 */
export function normalizeCompanies(
  response: TmdbPagedResponse<TmdbCompanyRaw>,
): Company[] {
  return (response.results ?? []).map((raw) => ({
    id: raw.id,
    name: raw.name ?? "",
    ...(raw.origin_country ? { originCountry: raw.origin_country } : {}),
  }));
}
