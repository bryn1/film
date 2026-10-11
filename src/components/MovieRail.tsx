/**
 * MovieRail — the startsida rail (PLAN-placement.md §5 pin + W3-start brief:
 * MovieRail{title, movies, loading, error?, onRetry?}). Presentational only:
 * the PAGE fetches (useApi in page.tsx); this component owns no data and no
 * fetch, so it carries no "use client" (it is rendered inside the client page).
 *
 * Section shape (PLAN §5 HTML-element quality): <section aria-labelledby=…>
 * + <h2> = title + a native horizontal <ul>/<li> scroller (MovieRail.module.css
 * — scroll-snap, hidden scrollbar, keyboard/trackpad usable; NO fake carousel
 * buttons per COMP-NOTES "deliberate deltas"). Cards are non-interactive by
 * design (detail routes are out of case scope → dead links forbidden), so the
 * SCROLL REGION itself is tabIndex=0 + role="list" (labelled by the heading):
 * the only honest keyboard affordance for a scroller of non-focusable cards.
 *
 * State order (COMP-NOTES canon copy, verbatim): loading → Skeleton variant
 * "rail" · error → ErrorState · empty → EmptyState · else the movie list.
 * Error copy mirrors src/app/search/SearchResults.tsx exactly — useApi
 * surfaces the envelope MESSAGE, not its code, so the missing-key 503 is
 * matched on the shared TMDB_KEY_MARKER (src/lib/format) and rendered
 * WITHOUT a retry button (retry cannot fix a missing key); every other
 * error keeps the retry. All strings come from COPY in src/lib/format —
 * the canon's one home.
 */

import { useId } from "react";
import type { Movie } from "@/lib/tmdb/types";
import { COPY, TMDB_KEY_MARKER } from "@/lib/format";
import { MovieCard } from "./MovieCard";
import { EmptyState } from "./states/EmptyState";
import { ErrorState } from "./states/ErrorState";
import { Skeleton } from "./states/Skeleton";
import styles from "./MovieRail.module.css";

export interface MovieRailProps {
  /** Visible <h2>; also the accessible name of the section + scroller. */
  title: string;
  movies: Movie[];
  loading: boolean;
  /** Truthy = failed load; the envelope message is the trigger (copy below). */
  error?: string;
  /** Wired to ErrorState "Försök igen"; never shown for the missing-key 503. */
  onRetry?: () => void;
}

export function MovieRail({
  title,
  movies,
  loading,
  error,
  onRetry,
}: MovieRailProps) {
  const headingId = useId();

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>

      {loading ? (
        // aria-busy while loading (DA P4-3): the Skeleton is aria-hidden
        // (decorative), so this labelled region carries the busy state.
        <div aria-busy="true">
          <Skeleton variant="rail" count={6} />
        </div>
      ) : error ? (
        error.includes(TMDB_KEY_MARKER) ? (
          <ErrorState
            title={COPY.error503.title}
            description={COPY.error503.description}
          />
        ) : (
          <ErrorState
            title={COPY.errorGeneric.title}
            description={COPY.errorGeneric.description}
            onRetry={onRetry}
          />
        )
      ) : movies.length === 0 ? (
        <EmptyState title="Inga träffar" />
      ) : (
        <ul
          className={styles.scroller}
          role="list"
          tabIndex={0}
          aria-labelledby={headingId}
        >
          {movies.map((movie) => (
            <li key={movie.id} className={styles.item}>
              <MovieCard movie={movie} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MovieRail;
