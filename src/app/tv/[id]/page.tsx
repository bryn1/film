// /tv/[id] — TV-seriedetail (MC 10610 §3): the tv twin of
// /movie/[id], a SERVER component mirroring its guard+loader shape —
// same /^\d+$/ segment guard, notFound() on TMDB 404, COPY error block
// for any other failure, dynamic λ (reading `params` opts out of the
// prerender). The RENDER is the SHARED DetailContent component (one
// detail render, two loaders): name-title and first_air_date arrive
// already folded by normalizeMovie, episode_run_time/number_of_seasons
// render through its data-driven rows. fetchDetail("tv", id) keeps the
// Bearer key server-side (detail.ts → client.ts, the one HTTP seam).

import { notFound } from "next/navigation";
import { DetailContent } from "@/components/DetailContent";
import { TmdbError } from "@/lib/tmdb/client";
import { fetchDetail } from "@/lib/tmdb/detail";
import { COPY } from "@/lib/format";
import styles from "@/app/movie/[id]/Detail.module.css";

interface TvPageProps {
  params: { id: string };
}

export default async function TvDetailPage({ params }: TvPageProps) {
  if (!/^\d+$/.test(params.id)) {
    notFound();
  }
  try {
    const show = await fetchDetail("tv", params.id);
    return <DetailContent detail={show} />;
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
