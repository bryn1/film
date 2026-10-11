/**
 * page.tsx — startsida (hero + three rails). 'use client' because it fetches
 * through useApi (the app's single client data mechanism, PLAN §5). Copy is
 * COMP-NOTES canon verbatim; states are honest (never a fake poster).
 *
 * Data wiring (one fetch per concern, reuse-first — no duplicate requests):
 *   - /api/trending, /api/now-playing, /api/top-rated → the three rails, each
 *     with its OWN useApi so their loading/error/empty states are INDEPENDENT
 *     (one rail failing never blanks the others) — COMP "each with its own".
 *   - /api/genres → id→name map for the hero meta row (genreIds arrive on each
 *     Movie; names come from here; comma-separated sv-SE list).
 *
 * Hero (COMP-NOTES "hero source = first trending item with a backdrop; fallback
 * first now-playing"): it REUSES the Trending rail's trending data (and the
 * now-playing rail's for the fallback) rather than re-fetching. That keeps the
 * hero a pure view over data the page already has, so "hero failure = render
 * hero as absent" is exact: if no item carries a backdrop (or trending errored)
 * there is simply no hero, and every rail still renders. The hero never blanks
 * the page because it owns no separate request that could strand it.
 *
 * 503 (missing key): the envelope hides the code, so useApi surfaces only the
 * message; the TMDB_NOT_CONFIGURED copy is matched on the shared key marker
 * (src/lib/format) — the SAME reading as src/app/search/SearchResults.tsx.
 * Each rail renders its own ErrorState with that canon copy (COPY in
 * src/lib/format, the canon's one home) and NO retry (retry cannot fix a
 * missing key); that logic lives in MovieRail, keeping "one ErrorState per
 * affected section, no retry loop" in one place.
 *
 * h1 hierarchy choice (documented per brief): the hero title IS the page <h1>.
 * Whenever the hero is absent (loading / error / empty), an sr-only <h1>
 * "Trending" stands in so the document ALWAYS has exactly one h1; the rails are
 * <h2>s (in MovieRail). Layout.tsx wraps every page in <main id="main">, so
 * this component returns a plain <div> — no second <main>.
 */

"use client";

import Image from "next/image";
import { Fragment, useMemo, type ReactNode } from "react";
import { MovieRail } from "@/components/MovieRail";
import { formatRating, formatReleaseYear } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { Genre, Movie } from "@/lib/tmdb/types";
import styles from "./StartPage.module.css";

/** First movie that actually carries a backdrop URL (the hero needs one). */
function firstWithBackdrop(movies: Movie[] | null): Movie | null {
  return movies?.find((movie) => movie.backdropUrl) ?? null;
}

/** hero meta "ÅR · GENRE(S) · ★ BETYG" — only the parts the data supports. */
function buildHeroMeta(movie: Movie, genreNames: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const year = formatReleaseYear(movie.releaseDate);
  if (year) {
    parts.push(<span key="year">{year}</span>);
  }
  if (genreNames) {
    parts.push(<span key="genres">{genreNames}</span>);
  }
  if (movie.voteAverage > 0) {
    parts.push(
      <span key="rating" className={styles.heroRating}>
        ★ {formatRating(movie.voteAverage)}
      </span>,
    );
  }
  return parts;
}

export default function StartPage() {
  const trending = useApi<Movie[]>("/api/trending");
  const nowPlaying = useApi<Movie[]>("/api/now-playing");
  const topRated = useApi<Movie[]>("/api/top-rated");
  const genres = useApi<Genre[]>("/api/genres");

  // genre id → name, rebuilt only when the (86400 s-cached) genre list lands.
  const genreById = useMemo(() => {
    const map = new Map<number, string>();
    for (const genre of genres.data ?? []) {
      map.set(genre.id, genre.name);
    }
    return map;
  }, [genres.data]);

  // Hero source: first trending item with a backdrop, else first now-playing
  // with one — both arrays are the rails' already-fetched data (no new fetch).
  const hero = firstWithBackdrop(trending.data) ?? firstWithBackdrop(nowPlaying.data);

  const heroGenreNames = hero
    ? hero.genreIds
        .map((id) => genreById.get(id))
        .filter((name): name is string => Boolean(name))
        .join(", ")
    : "";
  const heroMeta = hero ? buildHeroMeta(hero, heroGenreNames) : [];

  const heroLoading = trending.loading && hero === null;

  return (
    <div className={styles.page}>
      {hero ? (
        <section className={styles.hero} aria-label="Utvald film">
          {/* Decorative backdrop: the visible <h1> below already names the
              film, so alt="" (DA P4-2 — repeating the title as alt is a
              redundant SR utterance). MovieCard posters keep alt=title. */}
          <Image
            src={hero.backdropUrl as string}
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroScrim} aria-hidden="true" />
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>{hero.title}</h1>
            {heroMeta.length > 0 && (
              <p className={styles.heroMeta}>
                {heroMeta.map((part, index) => (
                  <Fragment key={index}>
                    {index > 0 && (
                      <span className={styles.heroSep}>·</span>
                    )}
                    {part}
                  </Fragment>
                ))}
              </p>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* Exactly one document h1 at all times: visible hero title when the
              hero exists, this sr-only stand-in otherwise. */}
          <h1 className={styles.visuallyHidden}>Trending</h1>
          {heroLoading && <div className={styles.heroSkeleton} aria-hidden="true" />}
        </>
      )}

      <MovieRail
        title="Trending"
        movies={trending.data ?? []}
        loading={trending.loading}
        error={trending.error ?? undefined}
        onRetry={trending.retry}
      />
      <MovieRail
        title="På bio nu"
        movies={nowPlaying.data ?? []}
        loading={nowPlaying.loading}
        error={nowPlaying.error ?? undefined}
        onRetry={nowPlaying.retry}
      />
      <MovieRail
        title="Toppbetygsatta"
        movies={topRated.data ?? []}
        loading={topRated.loading}
        error={topRated.error ?? undefined}
        onRetry={topRated.retry}
      />
    </div>
  );
}
