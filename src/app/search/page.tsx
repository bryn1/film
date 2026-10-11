// /search — Sökresultat (PLAN §5: URL state `/search?q=<query>`).
//
// h1 mechanism (DA P2-1, STRICT one-h1 invariant): this SERVER component
// reads searchParams directly (server components may — no client boundary,
// no useSearchParams) and renders the page's single <h1> ITSELF, so the
// curl'd HTML already carries it: q present ⇒ `Sökresultat för "<q>"`
// (React escapes the text node), q absent/blank ⇒ "Sökresultat" (canon
// COMP-NOTES, via COPY). The client body receives the SAME trimmed q as a
// prop and renders NO heading of its own — server HTML and hydrated DOM
// both hold exactly one h1, and the h1 text and the fetch query come from
// one value, so they can never disagree. No <Suspense> here either: with
// q passed down, the body touches no useSearchParams, so it server-renders
// too (skeleton grid in the HTML on load, zero client-only shell).
// Copy chrome classes are the same SearchResults.module.css the body uses.

import { COPY } from "@/lib/format";
import { SearchResults } from "./SearchResults";
import styles from "./SearchResults.module.css";

interface SearchPageProps {
  searchParams: { q?: string | string[] };
}

/** First value of a possibly-repeated ?q=, trimmed ("" ⇒ no query). */
function firstQ(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim();
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const q = firstQ(searchParams.q);
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>
        {q ? `${COPY.searchH1.forQuery} "${q}"` : COPY.searchH1.bare}
      </h1>
      <SearchResults q={q} />
    </div>
  );
}
