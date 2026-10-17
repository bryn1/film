/**
 * DetailContent.tsx — the SHARED server render of a detail page (MC 10610
 * §3): EXTRACTED from src/app/movie/[id]/page.tsx's JSX (one detail
 * render, two loaders — extraction, not a copy). The movie page and the
 * tv page stay thin guard+loader shells; everything below the guard
 * paints through here. SERVER component (no "use client"): the delivered
 * HTML carries h1 + meta + Handling + Rollista (D1) for BOTH types.
 *
 * h1 mechanism (DA P2-1, STRICT one-h1 invariant): this component owns
 * the single <h1> of the page it is rendered into (title = movie.title,
 * which normalizeMovie already folds from `title` OR `name` — client.ts
 * L138, do not re-add); everything below is h2.
 *
 * The movie→tv field breaks (§3 table) live HERE, data-driven:
 *  - duration: movie `runtime` (scalar) vs tv `episodeRunTime` (the
 *    episode_run_time[0] ARRAY, folded by normalizeDetail — empty/
 *    missing ⇒ null ⇒ the row is OMITTED, never "0 min"); label twin
 *    "Avsnittslängd" vs "Speltid" (COPY).
 *  - seasons: "Säsonger: N" renders ONLY when numberOfSeasons is set.
 * Detail.module.css is REUSED verbatim (the movie route keeps the file).
 */

import Image from "next/image";
import Link from "next/link";
import type { MovieDetail } from "@/lib/tmdb/types";
import { COPY, formatRating, formatReleaseYear } from "@/lib/format";
import styles from "@/app/movie/[id]/Detail.module.css";

export interface DetailContentProps {
  detail: MovieDetail;
}

export function DetailContent({ detail }: DetailContentProps) {
  const year = formatReleaseYear(detail.releaseDate);
  const duration =
    detail.mediaType === "tv" ? detail.episodeRunTime : detail.runtime;
  const durationLabel =
    detail.mediaType === "tv"
      ? COPY.detail.episodeRuntime
      : COPY.detail.runtime;

  return (
    <div className={styles.page}>
      {detail.backdropUrl && (
        <Image
          className={styles.hero}
          src={detail.backdropUrl}
          alt=""
          width={1280}
          height={720}
          priority
        />
      )}
      <h1 className={styles.heading}>{detail.title}</h1>
      {detail.tagline !== "" && (
        <p className={styles.tagline}>{detail.tagline}</p>
      )}
      <ul className={styles.meta} role="list">
        <li>{formatRating(detail.voteAverage)}</li>
        {year !== null && <li>{year}</li>}
        {duration !== null && (
          <li>
            {durationLabel} {duration} min
          </li>
        )}
        {detail.numberOfSeasons !== null && (
          <li>
            {COPY.detail.seasons}: {detail.numberOfSeasons}
          </li>
        )}
        {detail.genres.map((genre) => (
          <li key={genre.id}>{genre.name}</li>
        ))}
      </ul>

      <h2 className={styles.sectionHeading}>{COPY.detail.handling}</h2>
      <p>
        {detail.overview === "" ? COPY.detail.notAvailable : detail.overview}
      </p>

      {detail.director !== null && (
        <p>
          {COPY.detail.director}:{" "}
          <Link href={`/search?q=${encodeURIComponent(detail.director)}`}>
            {detail.director}
          </Link>
        </p>
      )}

      {detail.cast.length > 0 && (
        <>
          <h2 className={styles.sectionHeading}>{COPY.detail.cast}</h2>
          <ul className={styles.cast}>
            {detail.cast.map((member) => (
              <li key={member.id} className={styles.castMember}>
                {member.profileUrl !== null && (
                  <Image
                    className={styles.portrait}
                    src={member.profileUrl}
                    alt=""
                    width={185}
                    height={278}
                  />
                )}
                <Link href={`/search?q=${encodeURIComponent(member.name)}`}>
                  {member.name}
                </Link>
                {member.character !== "" && (
                  <span className={styles.character}>{member.character}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
