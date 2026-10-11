/**
 * FilterBar — the /discover numeric filter form (ARCHITECT-PLAN Rev 4.1
 * §4g/§7b, MC 10333 T9). SERVER component (no "use client", no
 * useSearchParams — props come from the page), rendered OUTSIDE the
 * Suspense boundary, so the five controls + labels + count options are in
 * the SERVED HTML (S5 gate; the F-1 named mechanism).
 *
 * Native GET form — no client JS mechanism was invented beside the one
 * that exists (URL is the source of truth, same as the chips). The form
 * carries NO `role` attribute on purpose (C3-4): W3 pins EXACTLY ONE
 * `role="search"` form per document — Nav's SearchField is that one; a
 * search-role on a filter form would turn W3 red (this is a filter, not
 * a site search). No headings either (§7b; the page owns the single h1).
 *
 * defaultValue (not value/onChange): uncontrolled inputs, the URL (via
 * page props) is the state — exactly how the chips already treat slugs.
 * "Rensa filter" is a Link to /discover and renders only when the URL
 * carries at least one non-default value.
 */

import Link from "next/link";
import { COPY } from "@/lib/format";
import styles from "./FilterBar.module.css";

/** The page's raw ?params (first values, "" when absent — §4h props). */
export interface FilterValues {
  filter: string;
  minScore: string;
  maxScore: string;
  yearFrom: string;
  yearTo: string;
  count: string;
}

export interface FilterBarProps {
  values: FilterValues;
}

/** select name=count: 20/40/…/200, default 20 (§7b). */
const COUNT_OPTIONS = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];

export function FilterBar({ values }: FilterBarProps) {
  // default state = no chips, no numerics, count absent or the default 20.
  const isDefault =
    values.filter === "" &&
    values.minScore === "" &&
    values.maxScore === "" &&
    values.yearFrom === "" &&
    values.yearTo === "" &&
    (values.count === "" || values.count === "20");

  return (
    <form action="/discover" method="get" className={styles.bar}>
      {/* chip state rides along through the GET submit (§7b hidden filter;
          "" ≡ absent is query.ts's own ruling, so an empty value is inert) */}
      <input type="hidden" name="filter" defaultValue={values.filter} />
      <div className={styles.field}>
        <label htmlFor="min-score">{COPY.filters.minScore}</label>
        <input
          id="min-score"
          type="number"
          name="min_score"
          step="0.1"
          min="0"
          max="10"
          defaultValue={values.minScore}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="max-score">{COPY.filters.maxScore}</label>
        <input
          id="max-score"
          type="number"
          name="max_score"
          step="0.1"
          min="0"
          max="10"
          defaultValue={values.maxScore}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="year-from">{COPY.filters.yearFrom}</label>
        <input
          id="year-from"
          type="number"
          name="year_from"
          step="1"
          defaultValue={values.yearFrom}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="year-to">{COPY.filters.yearTo}</label>
        <input
          id="year-to"
          type="number"
          name="year_to"
          step="1"
          defaultValue={values.yearTo}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="count">{COPY.filters.count}</label>
        <select id="count" name="count" defaultValue={values.count || "20"}>
          {COUNT_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={styles.submit}>
        {COPY.filters.submit}
      </button>
      {!isDefault && (
        <Link href="/discover" className={styles.clear}>
          {COPY.filters.clear}
        </Link>
      )}
    </form>
  );
}
