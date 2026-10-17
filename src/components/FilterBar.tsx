/**
 * FilterBar — the /discover filter form (ARCHITECT-PLAN Rev 4.1 §4g/§7b,
 * MC 10333 T9; the tier-1 media pills MC 10610 §2). SERVER component
 * (no "use client", no useSearchParams — props come from the page),
 * rendered OUTSIDE the Suspense boundary, so the controls are in the
 * SERVED HTML (S5 gate; the F-1 named mechanism).
 *
 * Native GET form — no client JS mechanism was invented beside the one
 * that exists (URL is the source of truth, same as the chips). The form
 * carries NO `role` attribute on purpose (C3-4): W3 pins EXACTLY ONE
 * role="search" form per document — Nav's SearchField; this is a filter.
 * No headings either (§7b; the page owns the single h1).
 *
 * defaultValue (not value/onChange): uncontrolled inputs, the URL (via
 * page props) is the state. "Rensa filter" is a Link and renders only
 * when the URL carries at least one non-default value.
 *
 * THE FINAL §2 FORM-DATA RULE (verbatim, do not "improve"):
 *  1. NO hidden type input + named pills (spec ADDS the submitter's pair
 *     too ⇒ type=tv&type=movie double-emit — DA-echo-proved). EVERY
 *     submitter names `type`; inputs (hidden filter included) are not
 *     submitters and stay un-named.
 *  2. IMPLICIT SUBMISSION (F-A): Enter in any number input submits with
 *     the default button = FIRST submit button in TREE order. So the
 *     "Visa …" button is the FIRST submit button in the DOM and carries
 *     name="type" value={type} (the PLAIN-value prop — the default-value
 *     one is input/select-only and react-dom@18.2.0 DROPS it on
 *     <button>, F-G probe) ⇒ Enter ships the CURRENT type.
 *  3. The pills follow in the DOM; CSS `order` places the pill row
 *     visually as tier 1 (DOM ≠ visual order — the order rule is on the
 *     TREE, never on the pixels).
 *  Net: pill click, Visa click and Enter all emit EXACTLY ONE
 *  current-or-chosen `type`, JS on or off. Server-checkable = T9.
 *
 *  "Rensa filter" PRESERVES type (F-B): the Link swaps to
 *  /discover?type=tv under tv — clearing filters never switches the
 *  media tier (tier 1 is context, not a filter).
 */

import Link from "next/link";
import { BASE } from "@/lib/basePath";
import { COPY } from "@/lib/format";
import type { MediaType } from "@/lib/tmdb/types";
import styles from "./FilterBar.module.css";

/** The page's raw ?params (first values, "" when absent — §4h props;
 *  `type` is the NORMALIZED axis: page.tsx maps anything-not-tv to movie). */
export interface FilterValues {
  filter: string;
  minScore: string;
  maxScore: string;
  yearFrom: string;
  yearTo: string;
  count: string;
  type: MediaType;
}

export interface FilterBarProps {
  values: FilterValues;
}

/** select name=count: 20/40/…/200, default 20 (§7b). */
const COUNT_OPTIONS = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200];

export function FilterBar({ values }: FilterBarProps) {
  // default state = movie tier, no chips, no numerics, count absent or 20.
  // F-B: the tv tier is NOT default — under tv the clear link always
  // stands (it preserves the tier, per the F-B ruling above).
  const isDefault =
    values.type === "movie" &&
    values.filter === "" &&
    values.minScore === "" &&
    values.maxScore === "" &&
    values.yearFrom === "" &&
    values.yearTo === "" &&
    (values.count === "" || values.count === "20");

  return (
    <form action={`${BASE}/discover`} method="get" className={styles.bar}>
      {/* chip state rides along through the GET submit (§7b hidden filter;
          "" ≡ absent is query.ts's own ruling, so an empty value is inert).
          NOT name="type" — rule 1: inputs are not submitters. */}
      <input type="hidden" name="filter" defaultValue={values.filter} />
      {/* RULE 2: FIRST submit button in tree order = the implicit-submit
          (Enter) shipper; ships the CURRENT type via the plain value prop. */}
      <button
        type="submit"
        name="type"
        value={values.type}
        className={styles.submit}
      >
        {COPY.filters.submit[values.type]}
      </button>
      {/* RULE 3: tier-1 pills follow in the DOM; CSS order puts the row
          visually first. aria-pressed is server-computed (SSR HTML). */}
      <div className={styles.typeGroup} aria-label="Mediatyp">
        <button
          type="submit"
          name="type"
          value="movie"
          aria-pressed={values.type === "movie"}
          className={styles.typePill}
        >
          {COPY.filters.typeMovie}
        </button>
        <button
          type="submit"
          name="type"
          value="tv"
          aria-pressed={values.type === "tv"}
          className={styles.typePill}
        >
          {COPY.filters.typeTv}
        </button>
      </div>
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
        <label htmlFor="count">{COPY.filters.count[values.type]}</label>
        <select id="count" name="count" defaultValue={values.count || "20"}>
          {COUNT_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {!isDefault && (
        <Link
          href={values.type === "tv" ? "/discover?type=tv" : "/discover"}
          className={styles.clear}
        >
          {COPY.filters.clear}
        </Link>
      )}
    </form>
  );
}
