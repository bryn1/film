// /discover — Upptäck (ARCHITECT-PLAN Rev 4.1 §4h, MC 10333 T9).
//
// h1 mechanism (DA P2-1, STRICT one-h1 invariant): this SERVER component
// owns the page's single <h1>, so every delivered response carries it —
// the client body (Discover.tsx) renders NO heading of its own.
//
// The page now READS searchParams (all seven filter params, §3): that
// opts /discover into request-time SSR (build λ) — the accepted decision
// logged with the rendering-model rows in docs/ARCHITECTURE.md. The old
// header's "stays a static prerender" (C3-6g) is retired WITH the w4 W3
// arm-split and tests/README.md in this same commit: /discover now paints
// the LIVE Nav field like /search, not the prerender fallback.
//
// FilterBar renders here (SERVER, outside any Suspense) — the named F-1
// mechanism the S5 gate pins: five controls + labels + count options are
// in the SERVED bytes. <Suspense> still wraps the client body: it keeps
// reading /api/genres + /api/discover client-side (useApi), fed its URL
// state as props — first paint stays the skeleton grid.

import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { COPY } from "@/lib/format";
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
  const values = {
    filter: one(searchParams.filter),
    minScore: one(searchParams.min_score),
    maxScore: one(searchParams.max_score),
    yearFrom: one(searchParams.year_from),
    yearTo: one(searchParams.year_to),
    count: one(searchParams.count),
    company: one(searchParams.company),
  };
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{COPY.discoverH1}</h1>
      <FilterBar values={values} />
      <Suspense>
        <Discover params={values} />
      </Suspense>
    </div>
  );
}
