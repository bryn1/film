/**
 * Discover.tsx — the /discover page logic. URL is the source of truth
 * (PLAN §5): filter=<genreSlug> + the numeric filter params (§3), all
 * SEVEN read server-side by page.tsx and handed down as props — this
 * component no longer touches useSearchParams (§4h). Back/forward and
 * chip pushes keep working because every navigation goes through
 * router.push/replace with the FULL active param set re-serialized
 * (§4h: "chip pushes re-serialize ALL active params"), so changing one
 * filter never silently drops another.
 *
 * State machine (exactly-one-active genre chip is the invariant;
 * "pressed" is membership in the slug→id map):
 *  - filter absent/""    → "Alla" pressed, GET /api/discover (popular)
 *    + any numeric params that ARE set, untouched (chips never strip them)
 *  - known slug          → that chip pressed, GET /api/discover?genre=<id>
 *    (numeric params ride along)
 *  - unknown slug (typed URL or stale link) with genres loaded → NO chip
 *    pressed, NO results request (no genre id exists; an empty ?genre=
 *    is a 400), and the results section shows EmptyState "Inga träffar"
 *    with "Visa alla" (replace — clears the unresolvable filter only,
 *    never the user's numeric params).
 *  - genres request failed → chips degrade to "Alla" only, pressed, and
 *    the results section shows the error state instead of a grid.
 * h1: unchanged (DA P2-1) — page.tsx owns the single h1; FilterBar is a
 * SERVER sibling outside Suspense (S5); nothing here renders a heading.
 */

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FilterChips, slugify } from "@/components/FilterChips";
import { PosterGrid } from "@/components/PosterGrid";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { COPY, TMDB_KEY_MARKER } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { Genre, Movie } from "@/lib/tmdb/types";
import styles from "./Discover.module.css";

/** The seven raw ?params page.tsx read (§3); "" ≡ absent everywhere. */
export interface UrlParams {
  filter: string;
  minScore: string;
  maxScore: string;
  yearFrom: string;
  yearTo: string;
  count: string;
  company: string;
}

/** UrlParams keys → wire param names (§3 table). */
const PARAM_KEYS: [keyof UrlParams, string][] = [
  ["filter", "filter"],
  ["minScore", "min_score"],
  ["maxScore", "max_score"],
  ["yearFrom", "year_from"],
  ["yearTo", "year_to"],
  ["count", "count"],
  ["company", "company"],
];

/** /discover URL carrying exactly the non-empty params of `next` (§4h). */
function discoverUrl(next: UrlParams): string {
  const qs = new URLSearchParams();
  for (const [key, wire] of PARAM_KEYS) {
    if (next[key] !== "") qs.set(wire, next[key]);
  }
  const s = qs.toString();
  return s === "" ? "/discover" : `/discover?${s}`;
}

/** /api/discover URL for the resolved filters (genre id from the chip). */
function resultsUrl(genreId: number | null, params: UrlParams): string {
  const qs = new URLSearchParams();
  if (genreId !== null) qs.set("genre", String(genreId));
  for (const [key, wire] of PARAM_KEYS) {
    if (key !== "filter" && params[key] !== "") qs.set(wire, params[key]);
  }
  const s = qs.toString();
  return s === "" ? "/api/discover" : `/api/discover?${s}`;
}

export function Discover({ params }: { params: UrlParams }) {
  const router = useRouter();
  const filter = params.filter;

  const {
    data: genres,
    loading: genresLoading,
    error: genresError,
    retry: retryGenres,
  } = useApi<Genre[]>("/api/genres");

  const slugToId = useMemo(() => {
    const map = new Map<string, number>();
    for (const genre of genres ?? []) {
      const slug = slugify(genre.name);
      // First owner wins a slug (mirrors FilterChips' dedup).
      if (slug !== "" && !map.has(slug)) {
        map.set(slug, genre.id);
      }
    }
    return map;
  }, [genres]);

  // Aliased condition: inside `genresFailed ? …` TS narrows genresError
  // to string (the ORIGINAL file's mechanism too — the ?-shown twin was
  // dead weight; dropped).
  const genresFailed = !genresLoading && genresError !== null;
  const genreId =
    !genresFailed && filter !== "" ? slugToId.get(filter) ?? null : null;
  const unknownFilter =
    !genresLoading && !genresFailed && filter !== "" && genreId === null;

  const selectGenre = (slug: string) => {
    // Slugs are [a-z0-9-] by construction. push (not replace) on purpose
    // (DA P4-1); the push re-serializes the WHOLE active param set (§4h),
    // so chip changes never silently drop a numeric filter or company.
    router.push(discoverUrl({ ...params, filter: slug }));
  };

  return (
    <>
      <FilterChips
        genres={genresFailed ? [] : genres ?? []}
        activeSlug={genresFailed ? "" : filter}
        onSelect={selectGenre}
      />
      {genresFailed ? (
        <LoadError error={genresError} onRetry={retryGenres} />
      ) : unknownFilter ? (
        <EmptyState
          title="Inga träffar"
          description="Prova en annan sökning eller ett annat filter."
        >
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => router.replace(discoverUrl({ ...params, filter: "" }))}
          >
            Visa alla
          </button>
        </EmptyState>
      ) : genresLoading ? (
        // Can't resolve the URL's slug to an id yet — skeleton, never the
        // wrong (Alla) results for a genre deep-link.
        <PosterGrid movies={[]} loading />
      ) : (
        <Results genreId={genreId} params={params} />
      )}
    </>
  );
}

function Results({ genreId, params }: { genreId: number | null; params: UrlParams }) {
  const router = useRouter();
  const { data, loading, error, retry } = useApi<Movie[]>(
    resultsUrl(genreId, params),
  );

  if (loading) {
    return <PosterGrid movies={[]} loading />;
  }
  if (error !== null) {
    return <LoadError error={error} onRetry={retry} />;
  }
  if (data === null) {
    return null;
  }
  if (data.length === 0) {
    return (
      <EmptyState
        title="Inga träffar"
        description="Prova en annan sökning eller ett annat filter."
      >
        <button
          type="button"
          className={styles.clearButton}
          onClick={() => router.replace(discoverUrl({ ...params, filter: "" }))}
        >
          Visa alla
        </button>
      </EmptyState>
    );
  }

  return (
    <>
      <p role="status" className={styles.count}>
        {data.length === 1 ? "1 träff" : `${data.length} träffar`}
      </p>
      <PosterGrid movies={data} loading={false} />
    </>
  );
}

function LoadError({ error, onRetry }: { error: string; onRetry: () => void }) {
  // Same copy split as SearchResults: the TMDB_NOT_CONFIGURED message is
  // the only envelope error naming the key marker (src/lib/format), so
  // the 503 missing-key state is matched on TMDB_KEY_MARKER; a missing
  // key is not retryable, so no button for it. Strings come from COPY.
  if (error.includes(TMDB_KEY_MARKER)) {
    return (
      <ErrorState
        title={COPY.error503.title}
        description={COPY.error503.description}
      />
    );
  }
  return (
    <ErrorState
      title={COPY.errorGeneric.title}
      description={COPY.errorGeneric.description}
      onRetry={onRetry}
    />
  );
}
