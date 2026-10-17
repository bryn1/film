/**
 * Data shapes for the Compileit filmsida — the pinned contract of
 * PLAN-placement.md §5. `Movie`/`Genre` are the normalized app shapes
 * (camelCase, TMDB noise already stripped by src/lib/tmdb/client.ts);
 * the Tmdb*Raw shapes exist only to type what crosses the client seam.
 * The ApiEnvelope shapes are the exact JSON of every /api/* route.
 */

/** The media axis (MC 10610 T10b): movie is the default everywhere —
 *  an absent ?type= is movie (parseMediaType's ruling), tv is opt-in. */
export type MediaType = "movie" | "tv";

/** Normalized movie as the app (and every API response) knows it. */
export interface Movie {
  id: number;
  /** Routing axis for the card (MovieCard links /tv/<id> only for "tv"). */
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  /** Server-built display URL (w500) via tmdbImageUrl; null when no poster. */
  posterUrl: string | null;
  /** Server-built display URL (w1280) via tmdbImageUrl; null when no backdrop. */
  backdropUrl: string | null;
  releaseDate: string | null;
  voteAverage: number;
  genreIds: number[];
}

/** Normalized genre (the pinned app shape: id + name). */
export interface Genre {
  id: number;
  name: string;
}

/** Normalized person (ARCHITECT-PLAN Rev 4.1 §3, MC 10333 T9). */
export interface Person {
  id: number;
  name: string;
  /** movie|tv media_type only, ≤4 entries (normalizePeople enforces
   *  both; MC 10610 §5 widened movie-only → movie|tv — a tv chip's link
   *  is LIVE because /tv/[id] now exists, the dead-/movie-link
   *  invariant is satisfied, not deleted). */
  knownFor: { id: number; title: string; mediaType: MediaType }[];
}

/** Normalized production company (§3): "" origin_country ⇒ field OMITTED. */
export interface Company {
  id: number;
  name: string;
  originCountry?: string;
}

/** Cast member of the detail page (§7a): strip ≤12, profile w185. */
export interface CastMember {
  id: number;
  name: string;
  character: string;
  /** Display URL (w185) via tmdbImageUrl; null when no profile image. */
  profileUrl: string | null;
}

/** Normalized /movie/[id] detail (normalizeDetail, §4b). */
export interface MovieDetail extends Movie {
  tagline: string;
  runtime: number | null;
  /** Full Genre[] (ids + sv names) from the detail response. */
  genres: Genre[];
  /** First crew member with job === "Director"; null when absent. */
  director: string | null;
  cast: CastMember[];
  /** tv detail: episode_run_time[0] (ARRAY — empty/missing ⇒ null ⇒ the
   *  meta row is omitted); movie detail: always null (MC 10610 §3). */
  episodeRunTime: number | null;
  /** tv detail: number_of_seasons; movie detail: always null. */
  numberOfSeasons: number | null;
}

/** /api/search success shape (§3 + MC 10610 §5): four sections, each
 *  possibly empty; `tv` is the /search/multi media_type==="tv" split. */
export interface SearchSections {
  movies: Movie[];
  tv: Movie[];
  people: Person[];
  companies: Company[];
}

/* ---------- raw TMDB shapes (never leave src/lib/tmdb/client.ts) ---------- */

export interface TmdbMovieRaw {
  id: number;
  title?: string | null;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number | null;
  genre_ids?: number[] | null;
  /** multi/trending carry it per result; list endpoints per type do not
   *  — normalizeMovie's fallback supplies the type for those (MC 10610 §3). */
  media_type?: string | null;
}

/** TMDB paginated list responses (trending, now_playing, top_rated, search, discover). */
export interface TmdbPagedResponse<T> {
  page?: number;
  results?: T[] | null;
  total_pages?: number;
  total_results?: number;
}

export interface TmdbGenreRaw {
  id: number;
  name?: string | null;
}

/* ---------- search sections + detail raw shapes (§4c, MC 10333 T9) ---------- */

export interface TmdbKnownForRaw {
  id: number;
  title?: string | null;
  name?: string | null;
  media_type?: string | null;
}

export interface TmdbPersonRaw {
  id: number;
  name?: string | null;
  known_for?: TmdbKnownForRaw[] | null;
}

export interface TmdbCompanyRaw {
  id: number;
  name?: string | null;
  origin_country?: string | null;
}

export interface TmdbCastRaw {
  id: number;
  name?: string | null;
  character?: string | null;
  profile_path?: string | null;
}

export interface TmdbCrewRaw {
  id: number;
  name?: string | null;
  job?: string | null;
}

export interface TmdbCreditsRaw {
  cast?: TmdbCastRaw[] | null;
  crew?: TmdbCrewRaw[] | null;
}

/** /movie|tv/<id>?append_to_response=credits response shape. */
export interface TmdbMovieDetailRaw extends TmdbMovieRaw {
  tagline?: string | null;
  runtime?: number | null;
  /** tv detail: ARRAY (the movie scalar assumption BREAKS here — §3). */
  episode_run_time?: number[] | null;
  /** tv detail only. */
  number_of_seasons?: number | null;
  genres?: TmdbGenreRaw[] | null;
  credits?: TmdbCreditsRaw | null;
}

export interface TmdbGenresResponse {
  genres?: TmdbGenreRaw[] | null;
}

/* ---------- API envelope (exact JSON of all six /api/* routes, PLAN §5) ---------- */

/** Error codes carried in the envelope: the two TmdbError codes + BAD_REQUEST. */
export type ApiErrorCode =
  | "TMDB_NOT_CONFIGURED"
  | "TMDB_UPSTREAM_ERROR"
  | "BAD_REQUEST";

/** Success: 200 {"ok":true,"data":...} — empty results are data:[], never an error. */
export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

/** Failure: {"ok":false,"error":{"code","message"}} with a status per code
 * (TMDB_NOT_CONFIGURED→503, TMDB_UPSTREAM_ERROR→502/429, BAD_REQUEST→400). */
export interface ApiFail {
  ok: false;
  error: ApiErrorBody;
}

export type ApiEnvelope<T> = ApiOk<T> | ApiFail;
