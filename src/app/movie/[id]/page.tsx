// /movie/[id] — filmdetail (ARCHITECT-PLAN Rev 4.1 §4a/§7a, MC 10333 T9;
// the shared render moved to src/components/DetailContent.tsx MC 10610 §3
// — this page is now guard + loader + <DetailContent>, extraction not a
// copy: /tv/[id] renders the SAME component through fetchDetail("tv", …)).
//
// SERVER component, dynamic λ exactly like /search (reading `params` opts
// the route out of the prerender). NO "use client": the delivered HTML
// carries h1 + meta + Handling + Rollista (D1), and the Bearer key stays
// server-side (fetchMovieDetail → lib/tmdb/detail.ts → client.ts).
// h1 mechanism (DA P2-1, STRICT one-h1 invariant): the h1 is the film
// title inside DetailContent (the page's single heading); sections below
// it render only h2s. Guards (§7a/§9 D3): raw segment must be /^\d+$/ —
// anything else is a notFound() 404 (F-7), and so is a TMDB 404. Any
// OTHER upstream failure renders the COPY error block — never a
// half-painted shell.

import { notFound } from "next/navigation";
import { DetailContent } from "@/components/DetailContent";
import { TmdbError } from "@/lib/tmdb/client";
import { fetchMovieDetail } from "@/lib/tmdb/detail";
import { COPY } from "@/lib/format";
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
    return <DetailContent detail={movie} />;
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
