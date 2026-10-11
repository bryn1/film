/**
 * SearchResults.tsx — the /search view's state machine (copy canon
 * COMP-NOTES.md verbatim; sections per ARCHITECT-PLAN §7c, MC 10333 T9):
 * no q → EmptyState prompt to search or discover;
 * loading → PosterGrid's skeleton grid;
 * TMDB_NOT_CONFIGURED (503) → honest missing-key state, no retry (it cannot help);
 * any other error → ErrorState with retry;
 * ok + ALL THREE sections empty → "Inga träffar" + "Rensa sökning";
 * ok + anything → three sections, each rendered ONLY when it has items
 *   (§7c): h2 "Filmer" → count line (role="status" — films ONLY) +
 *   PosterGrid; h2 "Personer" → name + knownFor chips linking /movie/<id>;
 *   h2 "Produktionsbolag" → name + country, "" origin_country OMITS the
 *   country span entirely (F-11d), each links /discover?company=<id>.
 *
 * h1 invariant (DA P2-1): q arrives as a PROP from page.tsx (the server
 * component that also renders the single <h1> into the SSR HTML), so this
 * body renders NO heading above h2 — the three section h2s are headings
 * BELOW it, so server HTML and hydrated DOM still hold exactly one h1.
 *
 * useApi is only mounted for a non-empty query (ResultsForQuery), so an
 * empty search never fires a request the API would reject with 400.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { PosterGrid } from "@/components/PosterGrid";
import { COPY, TMDB_KEY_MARKER } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { SearchSections } from "@/lib/tmdb/types";
import styles from "./SearchResults.module.css";

export function SearchResults({ q }: { q: string }) {
  if (q === "") {
    return (
      <>
        <EmptyState title="Skriv in något för att söka.">
          <p className={styles.discoverHint}>
            Eller bläddra efter genre under{" "}
            <Link href="/discover">Upptäck</Link>.
          </p>
        </EmptyState>
      </>
    );
  }

  return <ResultsForQuery q={q} />;
}

function ResultsForQuery({ q }: { q: string }) {
  const router = useRouter();
  const { data, loading, error, retry } = useApi<SearchSections>(
    `/api/search?q=${encodeURIComponent(q)}`,
  );

  // useApi surfaces the envelope's message, not its code; the
  // TMDB_NOT_CONFIGURED message is the only envelope error naming the key
  // marker, so the missing-key state is matched on TMDB_KEY_MARKER.
  const notConfigured = error !== null && error.includes(TMDB_KEY_MARKER);

  return (
    <>
      {loading ? (
        <PosterGrid movies={[]} loading />
      ) : notConfigured ? (
        <ErrorState
          title={COPY.error503.title}
          description={COPY.error503.description}
        />
      ) : error !== null ? (
        <ErrorState
          title={COPY.errorGeneric.title}
          description={COPY.errorGeneric.description}
          onRetry={retry}
        />
      ) : data !== null && isEmpty(data) ? (
        <EmptyState
          title="Inga träffar"
          description="Prova en annan sökning eller ett annat filter."
        >
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => router.replace("/search")}
          >
            Rensa sökning
          </button>
        </EmptyState>
      ) : data !== null ? (
        <>
          {data.movies.length > 0 && (
            <section aria-labelledby="section-movies">
              <h2 id="section-movies" className={styles.sectionHeading}>
                {COPY.sections.movies}
              </h2>
              <p role="status" className={styles.count}>
                {data.movies.length === 1
                  ? "1 träff"
                  : `${data.movies.length} träffar`}
              </p>
              <PosterGrid movies={data.movies} loading={false} />
            </section>
          )}
          {data.people.length > 0 && (
            <section aria-labelledby="section-people">
              <h2 id="section-people" className={styles.sectionHeading}>
                {COPY.sections.people}
              </h2>
              <ul className={styles.entryList} role="list">
                {data.people.map((person) => (
                  <li key={person.id} className={styles.entry}>
                    <span className={styles.entryName}>{person.name}</span>
                    {person.knownFor.map((film) => (
                      <Link
                        key={film.id}
                        href={`/movie/${film.id}`}
                        className={styles.chip}
                      >
                        {film.title}
                      </Link>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.companies.length > 0 && (
            <section aria-labelledby="section-companies">
              <h2 id="section-companies" className={styles.sectionHeading}>
                {COPY.sections.companies}
              </h2>
              <ul className={styles.entryList} role="list">
                {data.companies.map((company) => (
                  <li key={company.id} className={styles.entry}>
                    <Link
                      href={`/discover?company=${company.id}`}
                      className={styles.entryName}
                    >
                      {company.name}
                    </Link>
                    {/* "" origin_country was OMITTED server-side (§7c
                        F-11d) — there is nothing to render, never a
                        bare bullet or empty chip. */}
                    {company.originCountry !== undefined && (
                      <span className={styles.country}>
                        {company.originCountry}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : null}
    </>
  );
}

function isEmpty(sections: SearchSections): boolean {
  return (
    sections.movies.length === 0 &&
    sections.people.length === 0 &&
    sections.companies.length === 0
  );
}
