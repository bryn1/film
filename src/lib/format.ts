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
  /** Discover h1 PER TYPE (MC 10610 §2): the URL-reflecting-h1 mechanism
   *  /search uses for q; movie canon unchanged, tv twin added. */
  discoverH1: {
    movie: "Upptäck filmer",
    tv: "Upptäck TV-serier",
  },
  searchH1: {
    /** q present ⇒ h1 is `${forQuery} "${q}"`; q absent/blank ⇒ `bare`. */
    forQuery: "Sökresultat för",
    bare: "Sökresultat",
  },
  /** /movie/[id] + /tv/[id] labels (§7a, MC 10333 T9; tv twins §3). */
  detail: {
    handling: "Handling",
    cast: "Rollista",
    director: "Regissör",
    runtime: "Speltid",
    /** tv meta row label — the episode_run_time[0] twin of "Speltid". */
    episodeRuntime: "Avsnittslängd",
    /** tv meta row label — "Säsonger: N". */
    seasons: "Säsonger",
    notAvailable: "Inte tillgänglig",
    /** Detail meta external links (MC 10612): the score badge links to the
     *  TMDB page, IMDb renders only when the id is known. "IMDb" is COMP-
     *  NOTES canon visible; the other two compose aria-labels only. */
    ratingOnTmdb: "Betyg på TMDB",
    imdb: "IMDb",
    newTab: "öppnas i ny flik",
  },
  /** /search section headings (§7c + MC 10610 §5 tv twin). */
  sections: {
    movies: "Filmer",
    tvShows: "TV-serier",
    people: "Personer",
    companies: "Produktionsbolag",
  },
  /** /discover FilterBar labels + buttons (§7b; tv twins MC 10610 §2 —
   *  label ids stay, only the visible strings twin). */
  filters: {
    minScore: "Betyg från",
    maxScore: "Betyg till",
    yearFrom: "År från",
    yearTo: "År till",
    count: { movie: "Antal filmer", tv: "Antal serier" },
    submit: { movie: "Visa filmer", tv: "Visa serier" },
    clear: "Rensa filter",
    /** Tier-1 pills (MC 10610 §2). */
    typeMovie: "Filmer",
    typeTv: "TV-serier",
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
