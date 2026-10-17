/**
 * query.ts — /api/discover parameter parsing, ALL validation math living
 * here so the route carries none (ARCHITECT-PLAN Rev 4.1 §3/§4a, MC 10333
 * T9). Absent AND `""` both mean OFF (§4e: a partial UI submit legitimately
 * ships empty fields); a PRESENT value is validated to the §3 table and
 * mapped to the upstream TMDB discover params. `count` additionally drives
 * the page fan-out: pages = ceil(count/20), cap 200. Routing rule (§3):
 * hasAny=false only when NO recognized param is present at all.
 * MC 10610 T10b adds the media axis: parseMediaType (absent/"" ⇒ movie,
 * "movie"|"tv" pass, anything else ⇒ 400 "Ogiltig mediatyp." — the ONE
 * strict-400 home), `type` RECOGNIZED (⇒ ?type=tv alone is hasAny) and
 * `hasFilters` (recognized MINUS type: the discover-vs-popular branch);
 * the years map per type — movie primary_release_date.*, tv
 * first_air_date.* (§1: tv discover lacks the movie params — required,
 * not cosmetic). Both discover arms pass include_adult=false (F-C).
 */

import type { TmdbParams } from "@/lib/tmdb/client";
import type { MediaType } from "@/lib/tmdb/types";

export const YEAR_MIN = 1878;
export const YEAR_MAX = 2100;
/** Upstream fan-out cap: count >200 clamps to 200 (§3). */
export const COUNT_MAX = 200;
/** TMDB page size; fan-out pages = ceil(count/PAGE_SIZE). */
export const PAGE_SIZE = 20;
/** The pinned discover sort (§3): popularity.desc, always. */
export const DISCOVER_SORT = "popularity.desc";

const RECOGNIZED = [
  "type",
  "genre",
  "min_score",
  "max_score",
  "year_from",
  "year_to",
  "count",
  "company",
] as const;

/** The media axis parse (MC 10610 §1): absent/"" ⇒ movie; only the two
 *  exact values pass; anything else 400. Pages paint anything-not-tv as
 *  movie (page.tsx's own rule) — the API stays strict. */
export function parseMediaType(
  sp: URLSearchParams,
): { value: MediaType } | { error: string } {
  const raw = sp.get("type");
  if (raw === null || raw.trim() === "") return { value: "movie" };
  if (raw === "movie" || raw === "tv") return { value: raw };
  return { error: "Ogiltig mediatyp." };
}

export interface DiscoverQuery {
  /** Upstream discover params (sort_by + include_adult included). */
  params: TmdbParams;
  /** Parallel pages to fetch, 1..ceil(count/20). */
  pages: number;
  /** Slice cap after dedup; null when count is off. */
  count: number | null;
  /** False only when no recognized param is present at all → popular. */
  hasAny: boolean;
  /** Any recognized filter param BESIDES type — false with type-only/absent
   *  routes to /<type>/popular, true routes to /discover/<type> (§1). */
  hasFilters: boolean;
  /** The validated media axis. */
  type: MediaType;
}

export type DiscoverQueryResult = { error: string } | DiscoverQuery;

type Parsed<T> = { value: T | null } | { error: string };

/** Empty string or absent ⇒ off. §4e partial-submit rule. */
function active(raw: string | null): raw is string {
  return raw !== null && raw.trim() !== "";
}

function positiveInt(raw: string | null, error: string): Parsed<number> {
  if (!active(raw)) return { value: null };
  return /^\d+$/.test(raw) && Number(raw) > 0
    ? { value: Number(raw) }
    : { error };
}

/** Score: numeric else 400; clamped into [0,10] (§3). */
function score(raw: string | null): Parsed<number> {
  if (!active(raw)) return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: "Betyg måste vara ett tal." };
  return { value: Math.min(10, Math.max(0, n)) };
}

/** Year: integer 1878–2100 else 400 (§3). */
function year(raw: string | null): Parsed<number> {
  if (!active(raw)) return { value: null };
  if (!/^\d+$/.test(raw) || Number(raw) < YEAR_MIN || Number(raw) > YEAR_MAX) {
    return { error: `År måste vara ett heltal mellan ${YEAR_MIN} och ${YEAR_MAX}.` };
  }
  return { value: Number(raw) };
}

export function buildDiscoverParams(sp: URLSearchParams): DiscoverQueryResult {
  const type = parseMediaType(sp);
  if ("error" in type) return type;
  // F-C ruling (MC 10610 §1): the filterable surface passes
  // include_adult=false EXPLICITLY (TMDB's default is already false — a
  // public site says so out loud). Rides both discover arms.
  const params: TmdbParams = {
    sort_by: DISCOVER_SORT,
    include_adult: false,
  };
  const hasAny = RECOGNIZED.some((key) => sp.has(key));
  const hasFilters = RECOGNIZED.some(
    (key) => key !== "type" && sp.has(key),
  );

  const genre = positiveInt(
    sp.get("genre"),
    "Genre måste vara ett positivt heltal.",
  );
  if ("error" in genre) return genre;
  if (genre.value !== null) params.with_genres = genre.value;

  const company = positiveInt(
    sp.get("company"),
    "Företags-id måste vara ett positivt heltal.",
  );
  if ("error" in company) return company;
  if (company.value !== null) params.with_companies = company.value;

  const min = score(sp.get("min_score"));
  if ("error" in min) return min;
  const max = score(sp.get("max_score"));
  if ("error" in max) return max;
  if (min.value !== null && max.value !== null && min.value > max.value) {
    return { error: "Minsta betyg kan inte vara större än högsta." };
  }
  if (min.value !== null) params["vote_average.gte"] = min.value;
  if (max.value !== null) params["vote_average.lte"] = max.value;

  const from = year(sp.get("year_from"));
  if ("error" in from) return from;
  const to = year(sp.get("year_to"));
  if ("error" in to) return to;
  if (from.value !== null && to.value !== null && from.value > to.value) {
    return { error: "Från-år kan inte vara större än till-år." };
  }
  // The per-type year swap (§1, VERIFIED against TMDB docs): tv discover
  // has no primary_release_date.* — the tv selector is first_air_date.*.
  const yearKey = type.value === "tv" ? "first_air_date" : "primary_release_date";
  if (from.value !== null) params[`${yearKey}.gte`] = `${from.value}-01-01`;
  if (to.value !== null) params[`${yearKey}.lte`] = `${to.value}-12-31`;

  const count = positiveInt(sp.get("count"), "Antal måste vara ett positivt heltal.");
  if ("error" in count) return count;
  const capped = count.value === null ? null : Math.min(count.value, COUNT_MAX);
  const pages = capped === null ? 1 : Math.ceil(capped / PAGE_SIZE);

  return {
    params,
    pages,
    count: capped,
    hasAny,
    hasFilters,
    type: type.value,
  };
}
