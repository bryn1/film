/**
 * PosterGrid — shared results grid (PLAN §5 pin: PosterGrid{movies, loading,
 * error?} + onRetry passthrough per the W2-shared brief). State order:
 * loading → Skeleton grid · error → ErrorState (retry button only when
 * onRetry is given) · empty → EmptyState · else <ul> of MovieCard <li>s.
 *
 * The "N träffar" role=status count line is rendered by the PARENT page,
 * never here (pinned — avoids double announcement). Presentational only:
 * no fetch, no 'use client'; pages may render it from server or client.
 */

import type { Movie } from "@/lib/tmdb/types";
import { COPY } from "@/lib/format";
import { MovieCard } from "./MovieCard";
import { EmptyState } from "./states/EmptyState";
import { ErrorState } from "./states/ErrorState";
import { Skeleton } from "./states/Skeleton";
import styles from "./PosterGrid.module.css";

export interface PosterGridProps {
  movies: Movie[];
  loading: boolean;
  /** Truthy = failed load; content is the envelope message (trigger only —
   *  the visible copy stays the COMP-NOTES canon verbatim). Pages with
   *  code-specific copy (e.g. the 503 "Kan inte visa filmer") render
   *  ErrorState themselves. */
  error?: string;
  /** Wired to ErrorState's "Försök igen"; absent ⇒ no retry button. */
  onRetry?: () => void;
}

export function PosterGrid({ movies, loading, error, onRetry }: PosterGridProps) {
  if (loading) {
    // aria-busy while loading (DA P4-3): the Skeleton is aria-hidden
    // (decorative), so this plain container announces the busy state.
    return (
      <div aria-busy="true">
        <Skeleton variant="grid" count={12} />
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        title={COPY.errorGeneric.title}
        description={COPY.errorGeneric.description}
        onRetry={onRetry}
      />
    );
  }
  if (movies.length === 0) {
    return (
      <EmptyState
        title="Inga träffar"
        description="Prova en annan sökning eller ett annat filter."
      />
    );
  }

  return (
    <ul className={styles.grid}>
      {movies.map((movie) => (
        <li key={movie.id} className={styles.cell}>
          <MovieCard movie={movie} />
        </li>
      ))}
    </ul>
  );
}

export default PosterGrid;
