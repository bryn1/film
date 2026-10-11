/**
 * SearchField.tsx — the site search field, rendered inside Nav in every
 * view (PLAN §5 URL state). The URL is the single source of truth:
 * the input syncs its value from `?q=` and submit pushes
 * `/search?q=<trimmed>` (empty submit → `/search`, the no-query state).
 * Requires a <Suspense> boundary above it (App Router useSearchParams).
 *
 * SearchFieldFallback is the SSR/prerender paint of the SAME field
 * (DA P2-1): the live field needs useSearchParams, which forces the
 * Suspense boundary that keeps it out of the server HTML — so Nav passes
 * this fallback to that boundary, and every curl'd page ships a real
 * <form role="search"> + <input type="search">. It reads NO search
 * params (that is why it can prerender) and carries a plain GET action
 * to /search?q= so even the no-JS path works. The action carries BASE
 * (src/lib/basePath.ts) — basePath rewrites <Link> hrefs but NOT raw form
 * actions, so unprefixed a JS-off submit would leave the app on the hosted
 * /film copy ("/search" unchanged in local builds). The hydrated
 * SearchField replaces it (Suspense swaps fallback → child), so the live
 * DOM has exactly one search field, never two.
 */

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { BASE } from "@/lib/basePath";
import styles from "./SearchField.module.css";

export function SearchField() {
  const router = useRouter();
  const q = useSearchParams().get("q") ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = new FormData(event.currentTarget).get("q");
    const trimmed = (typeof raw === "string" ? raw : "").trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    // Re-keying on q remounts the input when the URL query changes (submit,
    // back/forward, "Rensa sökning"), so the field always mirrors the URL.
    <form
      key={q}
      role="search"
      onSubmit={handleSubmit}
      className={styles.form}
    >
      <label htmlFor="site-search" className={styles.hiddenLabel}>
        Sök film
      </label>
      <div className={styles.field}>
        <SearchIcon />
        <input
          id="site-search"
          className={styles.input}
          type="search"
          name="q"
          placeholder="Sök film…"
          defaultValue={q}
        />
      </div>
    </form>
  );
}

/** The magnifier glyph, shared by the live field and its SSR fallback. */
function SearchIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <line x1="13" y1="13" x2="17" y2="17" />
    </svg>
  );
}

/**
 * SearchFieldFallback — Nav's Suspense fallback (DA P2-1): static SSR paint
 * of the search field, same SearchField.module.css classes. Renders no
 * useSearchParams, so it prerenders into every route's HTML; the plain
 * GET form action keeps it functional pre-hydration and without JS
 * (browser navigates to /search?q=…, where the server page answers with
 * its h1). No id on the input: it must never collide with the live
 * field's label target, and the accessible name here is the aria-label.
 */
export function SearchFieldFallback() {
  return (
    <form
      role="search"
      action={`${BASE}/search`}
      method="get"
      className={styles.form}
    >
      <div className={styles.field}>
        <SearchIcon />
        <input
          className={styles.input}
          type="search"
          name="q"
          placeholder="Sök film…"
          aria-label="Sök film"
        />
      </div>
    </form>
  );
}
