/**
 * format.ts — shared display formatters + canon error copy, the ONE home
 * for strings/values that were duplicated across the pages (DA P3-1).
 * Client-safe by contract: no env reads, no fetch — client components
 * import this freely (the TMDB seam stays in src/lib/tmdb/client.ts).
 * All copy values are COMP-NOTES canon (docs/design/COMP-NOTES.md)
 * verbatim; changing one here is a canon change, not a code change.
 */

/**
 * Marker inside the TMDB_NOT_CONFIGURED (503) envelope message, which
 * src/lib/tmdb/client.ts is the only emitter of. useApi surfaces the
 * envelope MESSAGE, not its code, so the missing-key state is matched on
 * this substring (accepted reading — see ARCHITECTURE ledger).
 */
export const TMDB_KEY_MARKER = "TMDB_API_KEY";

/** Canon error copy + page <h1>s (COMP-NOTES "States", "TMDB_NOT_CONFIGURED"
 *  and per-page h1 pins). The h1s render from each route's SERVER page.tsx
 *  (DA P2-1: the SSR HTML must carry the single h1); they live here because
 *  this is the canon's ONE home for shared copy, and the existing client
 *  COPY consumers keep the strings in the built client chunks too. */
export const COPY = {
  error503: {
    title: "Kan inte visa filmer",
    description:
      "Ingen TMDB-nyckel är konfigurerad. Sätt TMDB_API_KEY för att visa filmer.",
  },
  errorGeneric: {
    title: "Något gick fel",
    description: "Vi kunde inte hämta filmerna just nu.",
  },
  discoverH1: "Upptäck filmer",
  searchH1: {
    /** q present ⇒ h1 is `${forQuery} "${q}"`; q absent/blank ⇒ `bare`. */
    forQuery: "Sökresultat för",
    bare: "Sökresultat",
  },
  /** /movie/[id] labels (§7a, MC 10333 T9). */
  detail: {
    handling: "Handling",
    cast: "Rollista",
    director: "Regissör",
    runtime: "Speltid",
    notAvailable: "Inte tillgänglig",
  },
  /** /search section headings (§7c). */
  sections: {
    movies: "Filmer",
    people: "Personer",
    companies: "Produktionsbolag",
  },
  /** /discover FilterBar labels + buttons (§7b). */
  filters: {
    minScore: "Betyg från",
    maxScore: "Betyg till",
    yearFrom: "År från",
    yearTo: "År till",
    count: "Antal filmer",
    submit: "Visa filmer",
    clear: "Rensa filter",
  },
} as const;

/** Release year from "ÅÅÅÅ-MM-DD"; null or non-standard date ⇒ null (no fake year). */
export function formatReleaseYear(releaseDate: string | null): string | null {
  return releaseDate && /^\d{4}/.test(releaseDate)
    ? releaseDate.slice(0, 4)
    : null;
}

/** "8,4" — comma decimal per the copy canon: sv-SE, exactly one fraction digit. */
const ratingFormatter = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatRating(voteAverage: number): string {
  return ratingFormatter.format(voteAverage);
}
