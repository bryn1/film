// /discover — Upptäck (ARCHITECT-PLAN Rev 4.1 §4h, MC 10333 T9; the
// media axis MC 10610 §2: ?type= is the eighth param, read via the SAME
// one() as the seven; anything-not-tv PAINTS as movie — the API stays
// strict-400 via parseMediaType, pages paint, APIs fail closed).
//
// h1 mechanism (DA P2-1, STRICT one-h1 invariant): this SERVER component
// owns the page's single <h1>, so every delivered response carries it —
// the client body (Discover.tsx) renders NO heading of its own. The h1
// reflects the type via COPY.discoverH1 (the URL-reflecting mechanism
// /search uses for q).
//
// The page now READS searchParams (all eight filter params, §3): that
// opts /discover into request-time SSR (build λ) — the accepted decision
// logged with the rendering-model rows in docs/ARCHITECTURE.md. The old
// header's "stays a static prerender" (C3-6g) is retired WITH the w4 W3
// arm-split and tests/README.md in this same commit: /discover now paints
// the LIVE Nav field like /search, not the prerender fallback.
//
// FilterBar renders here (SERVER, outside any Suspense) — the named F-1
// mechanism the S5 gate pins: the controls + labels + count options are
// in the SERVED bytes. <Suspense> still wraps the client body: it keeps
// reading /api/genres + /api/discover client-side (useApi), fed its URL
// state as props — first paint stays the skeleton grid.

import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { COPY } from "@/lib/format";
import type { MediaType } from "@/lib/tmdb/types";
import { Discover } from "./Discover";
import styles from "./Discover.module.css";

interface DiscoverPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

/** First value of a possibly-repeated param, trimmed ("" ⇒ absent). */
function one(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
}

export default function DiscoverPage({ searchParams }: DiscoverPageProps) {
  // Pages paint (§2): anything-not-tv is the movie tier here; the strict
  // 400 for ?type=bogus belongs to the API (query.ts parseMediaType).
  const type: MediaType = one(searchParams.type) === "tv" ? "tv" : "movie";
  const values = {
    filter: one(searchParams.filter),
    minScore: one(searchParams.min_score),
    maxScore: one(searchParams.max_score),
    yearFrom: one(searchParams.year_from),
    yearTo: one(searchParams.year_to),
    count: one(searchParams.count),
    company: one(searchParams.company),
    type,
  };
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{COPY.discoverH1[type]}</h1>
      <FilterBar values={values} />
      <Suspense>
        <Discover params={values} />
      </Suspense>
    </div>
  );
}
