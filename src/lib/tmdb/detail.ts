/**
 * detail.ts — normalizers for the /api/search sections and the
 * /movie/[id] + /tv/[id] detail surfaces (ARCHITECT-PLAN Rev 4.1 §4b,
 * MC 10333 T9; tv axis MC 10610 §3). Pure shaping: this file NEVER
 * issues HTTP — client.ts remains the only file that does (header duty
 * per §4b): fetchDetail/fetchMovieDetail merely call client.ts's
 * tmdbFetch and shape the response here.
 */

import { normalizeMovie, tmdbFetch, tmdbImageUrl, type TmdbParams } from "./client";
import type {
  CastMember,
  Company,
  MediaType,
  MovieDetail,
  Person,
  TmdbCompanyRaw,
  TmdbMovieDetailRaw,
  TmdbPagedResponse,
  TmdbPersonRaw,
} from "./types";

/**
 * One detail call: /<type>/<id> with credits appended (the §4b loader
 * since MC 10333 T9, the tv arm MC 10610 §3 — still ONE mechanism,
 * delegated to client.ts, the ONLY HTTP in the codebase). A TMDB 404
 * arrives as a TmdbError with upstreamStatus 404 (the page branch).
 */
export async function fetchDetail(
  type: MediaType,
  id: string,
): Promise<MovieDetail> {
  const params: TmdbParams = { append_to_response: "credits" };
  const raw = await tmdbFetch<TmdbMovieDetailRaw>(`/${type}/${id}`, params);
  return normalizeDetail(raw, type);
}

/**
 * One movie detail call — name and signature PINNED (existing D-gates
 * read the route through it); it delegates to the one fetchDetail (§3).
 */
export async function fetchMovieDetail(id: string): Promise<MovieDetail> {
  return fetchDetail("movie", id);
}

/** normalizeMovie + tagline/runtime/Genre[]/director/cast ≤12 (§4b);
 *  tv fields per §3: episodeRunTime from the ARRAY episode_run_time[0]
 *  (empty/missing ⇒ null ⇒ the meta row is omitted), numberOfSeasons. */
export function normalizeDetail(
  raw: TmdbMovieDetailRaw,
  type: MediaType = "movie",
): MovieDetail {
  const crew = raw.credits?.crew ?? [];
  const cast: CastMember[] = (raw.credits?.cast ?? []).slice(0, 12).map((c) => ({
    id: c.id,
    name: c.name ?? "",
    character: c.character ?? "",
    profileUrl: tmdbImageUrl(c.profile_path, "w185"),
  }));
  return {
    ...normalizeMovie(raw, type),
    tagline: raw.tagline ?? "",
    runtime: raw.runtime ?? null,
    episodeRunTime: raw.episode_run_time?.[0] ?? null,
    numberOfSeasons: raw.number_of_seasons ?? null,
    genres: (raw.genres ?? []).map((g) => ({ id: g.id, name: g.name ?? "" })),
    director: crew.find((c) => c.job === "Director")?.name ?? null,
    // `||` NOT `??` (MC 10612): TMDB answers imdb_id absent, null OR "" —
    // all three mean unknown; "" under `??` would render imdb.com/title//
    // dead. Falsy-fold precedent: normalizeCompanies omits "" origin_country (F-11d).
    imdbId: raw.imdb_id || null,
    cast,
  };
}

/**
 * Person[] from a /search/person response. knownFor keeps movie|tv
 * media_type entries, max 4 (§3, MC 10610 §5 widen): the old "TV noise
 * never renders a dead /movie/<id> link" invariant stays SATISFIED —
 * tv entries carry mediaType and their chip links /tv/<id>, a route
 * that now exists.
 */
export function normalizePeople(
  response: TmdbPagedResponse<TmdbPersonRaw>,
): Person[] {
  return (response.results ?? []).map((raw) => ({
    id: raw.id,
    name: raw.name ?? "",
    knownFor: (raw.known_for ?? [])
      .filter((entry) => entry.media_type === "movie" || entry.media_type === "tv")
      .slice(0, 4)
      .map((entry) => ({
        id: entry.id,
        title: entry.title ?? entry.name ?? "",
        mediaType: entry.media_type === "tv" ? ("tv" as const) : ("movie" as const),
      })),
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
