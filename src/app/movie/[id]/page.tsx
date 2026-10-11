// /movie/[id] — filmdetail (ARCHITECT-PLAN Rev 4.1 §4a/§7a, MC 10333 T9).
//
// SERVER component, dynamic λ exactly like /search (reading `params` opts
// the route out of the prerender). NO "use client": the delivered HTML
// carries h1 + meta + Handling + Rollista (D1), and the Bearer key stays
// server-side (fetchMovieDetail → lib/tmdb/detail.ts → client.ts).
// h1 mechanism (DA P2-1, STRICT one-h1 invariant): this page owns the
// single <h1> (the film title); the sections below render only h2s.
// Guards (§7a/§9 D3): raw segment must be /^\d+$/ — anything else is a
// notFound() 404 (F-7), and so is a TMDB 404. Any OTHER upstream failure
// renders the COPY error block — never a half-painted shell.

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TmdbError } from "@/lib/tmdb/client";
import { fetchMovieDetail } from "@/lib/tmdb/detail";
import { COPY, formatRating, formatReleaseYear } from "@/lib/format";
import styles from "./Detail.module.css";

interface MoviePageProps {
  params: { id: string };
}

export default async function MovieDetailPage({ params }: MoviePageProps) {
  if (!/^\d+$/.test(params.id)) {
    notFound();
  }
  try {
    const movie = await fetchMovieDetail(params.id);
    const year = formatReleaseYear(movie.releaseDate);
    return (
      <div className={styles.page}>
        {movie.backdropUrl && (
          <Image
            className={styles.hero}
            src={movie.backdropUrl}
            alt=""
            width={1280}
            height={720}
            priority
          />
        )}
        <h1 className={styles.heading}>{movie.title}</h1>
        {movie.tagline !== "" && (
          <p className={styles.tagline}>{movie.tagline}</p>
        )}
        <ul className={styles.meta} role="list">
          <li>{formatRating(movie.voteAverage)}</li>
          {year !== null && <li>{year}</li>}
          {movie.runtime !== null && (
            <li>
              {COPY.detail.runtime} {movie.runtime} min
            </li>
          )}
          {movie.genres.map((genre) => (
            <li key={genre.id}>{genre.name}</li>
          ))}
        </ul>

        <h2 className={styles.sectionHeading}>{COPY.detail.handling}</h2>
        <p>
          {movie.overview === "" ? COPY.detail.notAvailable : movie.overview}
        </p>

        {movie.director !== null && (
          <p>
            {COPY.detail.director}:{" "}
            <Link href={`/search?q=${encodeURIComponent(movie.director)}`}>
              {movie.director}
            </Link>
          </p>
        )}

        {movie.cast.length > 0 && (
          <>
            <h2 className={styles.sectionHeading}>{COPY.detail.cast}</h2>
            <ul className={styles.cast}>
              {movie.cast.map((member) => (
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
  } catch (error) {
    if (error instanceof TmdbError && error.upstreamStatus === 404) {
      notFound();
    }
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>{COPY.errorGeneric.title}</h1>
        <p>{COPY.errorGeneric.description}</p>
      </div>
    );
  }
}
