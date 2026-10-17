/**
 * client.ts — the ONLY file that touches TMDB (PLAN-placement.md §5).
 * Server-side only: its callers are the API route handlers and SERVER
 * components (via lib/tmdb/detail.ts since MC 10333 T9) — never a client
 * bundle, so the Bearer key never ships. Env is read at call time (all
 * optional at build): TMDB_API_KEY (secret), TMDB_BASE_URL,
 * TMDB_IMAGE_BASE. Tests point both URL vars at
 * tests/fixtures/server.mjs (localhost:3001) — the same v3 paths, bearer
 * honoured. One seam, no other mechanism.
 */

import type {
  Genre,
  MediaType,
  Movie,
  TmdbGenresResponse,
  TmdbGenreRaw,
  TmdbMovieRaw,
  TmdbPagedResponse,
} from "./types";

const DEFAULT_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_IMAGE_BASE = "https://image.tmdb.org/t/p";
const LANGUAGE = "sv-SE";
const TIMEOUT_MS = 10_000;
const DEFAULT_REVALIDATE_SECONDS = 600;

export type TmdbErrorCode = "TMDB_NOT_CONFIGURED" | "TMDB_UPSTREAM_ERROR";

/** Every failure of this module throws TmdbError with one of the two codes. */
export class TmdbError extends Error {
  readonly code: TmdbErrorCode;
  /** Upstream HTTP status when known — PLAN §5: a TMDB 429 passes through as 429. */
  readonly upstreamStatus?: number;

  constructor(code: TmdbErrorCode, message: string, upstreamStatus?: number) {
    super(message);
    this.name = "TmdbError";
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

export type TmdbParams = Record<string, string | number | boolean | undefined>;

export interface TmdbFetchOptions {
  /** Seconds until Next revalidates the cached response (default 600; genres pass 86400). */
  revalidate?: number;
}

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new TmdbError(
      "TMDB_NOT_CONFIGURED",
      "TMDB_API_KEY är inte satt i servermiljön",
    );
  }
  return key;
}

function trimSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * GET `${TMDB_BASE_URL}${path}` with the query params plus the pinned
 * `language=sv-SE`, Bearer auth, a 10 s timeout and Next data-cache
 * revalidation. Missing key throws BEFORE any fetch is issued.
 */
export async function tmdbFetch<T>(
  path: string,
  params?: TmdbParams,
  options?: TmdbFetchOptions,
): Promise<T> {
  const key = apiKey();
  const base = trimSlashes(process.env.TMDB_BASE_URL ?? DEFAULT_BASE_URL);
  const url = new URL(`${base}${path}`);
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(name, String(value));
    }
  }
  url.searchParams.set("language", LANGUAGE);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const requestInit: RequestInit & { next?: { revalidate: number } } = {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    next: { revalidate: options?.revalidate ?? DEFAULT_REVALIDATE_SECONDS },
    signal: controller.signal,
  };
  try {
    const response = await fetch(url, requestInit);
    if (!response.ok) {
      throw new TmdbError(
        "TMDB_UPSTREAM_ERROR",
        `TMDB svarade ${response.status} för ${path}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TmdbError) {
      throw error;
    }
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new TmdbError(
      "TMDB_UPSTREAM_ERROR",
      aborted
        ? `Timeout (${TIMEOUT_MS / 1000} s) mot TMDB för ${path}`
        : `TMDB-anropet misslyckades för ${path}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Full image URL from a TMDB path + size ("w500", "original", ...); null in ⇒ null out. */
export function tmdbImageUrl(
  path: string | null | undefined,
  size: string,
): string | null {
  if (!path) {
    return null;
  }
  const imageBase = trimSlashes(
    process.env.TMDB_IMAGE_BASE ?? DEFAULT_IMAGE_BASE,
  );
  return `${imageBase}/${size}${path}`;
}

/** Strip TMDB noise to the pinned normalized Movie (PLAN §5). TV entries of
 *  mixed rails carry title/date in `name`/`first_air_date` — folded in so a
 *  rail card is never silently titleless. `fallback` (MC 10610 §3) is the
 *  media axis for raws WITHOUT media_type (per-type list endpoints carry
 *  none): raw media_type "tv" always wins, else the caller's type. */
export function normalizeMovie(
  raw: TmdbMovieRaw,
  fallback: MediaType = "movie",
): Movie {
  return {
    id: raw.id,
    mediaType: raw.media_type === "tv" ? "tv" : fallback,
    title: raw.title ?? raw.name ?? "",
    overview: raw.overview ?? "",
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    posterUrl: tmdbImageUrl(raw.poster_path, "w500"),
    backdropUrl: tmdbImageUrl(raw.backdrop_path, "w1280"),
    releaseDate: raw.release_date ?? raw.first_air_date ?? null,
    voteAverage: raw.vote_average ?? 0,
    genreIds: raw.genre_ids ?? [],
  };
}

/** Normalized Movie[] from a paginated TMDB list response; `fallback`
 *  tags entries of endpoints that carry no per-result media_type (§3). */
export function normalizeMovies(
  response: TmdbPagedResponse<TmdbMovieRaw>,
  fallback?: MediaType,
): Movie[] {
  return (response.results ?? []).map((raw) =>
    normalizeMovie(raw, fallback),
  );
}

function normalizeGenre(raw: TmdbGenreRaw): Genre {
  return { id: raw.id, name: raw.name ?? "" };
}

/** Normalized Genre[] from the /genre/list response. */
export function normalizeGenres(response: TmdbGenresResponse): Genre[] {
  return (response.genres ?? []).map(normalizeGenre);
}
