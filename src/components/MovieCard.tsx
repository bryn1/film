/**
 * MovieCard — the shared poster card (PLAN-placement.md §5 pin:
 * MovieCard{movie, priority?}). Presentational only: no fetch. Since MC
 * 10333 T9 the card LINKS to the detail route — the card is the way into
 * a title (a LINK TO A REAL PAGE is the live-CTA side of the
 * no-fake-content rule). Since MC 10610 §3 the card SELF-ROUTES on its
 * mediaType: /tv/<id> for tv (+ a small "TV" badge), /movie/<id> for
 * movie — movie markup stays byte-identical (badge only when tv), so
 * PosterGrid/MovieRail need NO prop change.
 *
 * Poster source is movie.posterUrl — the w500 display URL built SERVER-side
 * per PLAN §5 RE-PIN (types.ts has carried it required since c3dc38f);
 * this component never assembles a TMDB URL. posterUrl === null ⇒ honest
 * placeholder block, never a broken image.
 */

import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/lib/tmdb/types";
import { formatRating, formatReleaseYear } from "@/lib/format";
import styles from "./MovieCard.module.css";

export interface MovieCardProps {
  /** Movie (PLAN §5); posterUrl = the RE-PIN's server-built w500 URL. */
  movie: Movie;
  /** Passed straight through to next/image (above-the-fold rails). */
  priority?: boolean;
}

/** Rendered widths ≈ w500 source; keeps next/image from oversampling. */
const POSTER_SIZES =
  "(min-width: 1440px) 220px, (min-width: 1024px) 18vw, (min-width: 640px) 30vw, 46vw";

export function MovieCard({ movie, priority = false }: MovieCardProps) {
  const year = formatReleaseYear(movie.releaseDate);
  const hasRating = movie.voteAverage > 0;
  const isTv = movie.mediaType === "tv";

  return (
    <Link
      href={isTv ? `/tv/${movie.id}` : `/movie/${movie.id}`}
      className={styles.cardLink}
    >
      <div className={styles.card}>
      <div className={styles.posterFrame}>
        {isTv && (
          // Type badge ONLY on tv cards (MC 10610 §3 — the one card
          // mechanism shared by rails, grids and the search sections).
          <span className={styles.badge} aria-hidden="true">
            TV
          </span>
        )}
        {movie.posterUrl ? (
          <Image
            src={movie.posterUrl}
            alt={movie.title}
            fill
            sizes={POSTER_SIZES}
            priority={priority}
            className={styles.poster}
          />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <span className={styles.placeholderFrame} />
          </div>
        )}
      </div>
      <div className={styles.caption}>
        <p className={styles.title}>{movie.title}</p>
        {(year !== null || hasRating) && (
          <p className={styles.meta}>
            {year !== null && <span>{year}</span>}
            {hasRating && (
              <span className={styles.rating}>
                ★ {formatRating(movie.voteAverage)}
              </span>
            )}
          </p>
        )}
      </div>
      </div>
    </Link>
  );
}

export default MovieCard;
