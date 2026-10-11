/**
 * Nav.tsx — the sticky site header mounted in layout.tsx on every view
 * (DESIGN.md §5): skip link (first focusable element of the page),
 * wordmark, Startsida/Upptäck links with aria-current, and the SearchField.
 * SearchField is wrapped in <Suspense> because App Router requires a
 * boundary around useSearchParams IN STATICALLY PRERENDERED TREES (the
 * old claim that a boundary is needed everywhere over-stated it — MC
 * 10333 T9 / C3-6g): on dynamic routes (/search, and /discover since T9)
 * the boundary's CHILD server-renders and the LIVE field is already in
 * the HTML; on static / the boundary paints SearchFieldFallback (DA
 * P2-1), the static rendering of the same field. Either way every server
 * HTML response carries exactly one <form role="search"> + one
 * <input type="search" aria-label="Sök film">, and fallback and live
 * field never coexist (pinned by w4-ssr-shell W3).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SearchField, SearchFieldFallback } from "./SearchField";
import styles from "./Nav.module.css";

export function Nav() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <a href="#main" className={styles.skipLink}>
        Hoppa till innehåll
      </a>
      <nav aria-label="Huvudmeny" className={styles.nav}>
        <Link href="/" className={styles.wordmark}>
          Filmsidan
        </Link>
        <ul className={styles.links}>
          <li>
            <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
              Startsida
            </Link>
          </li>
          <li>
            <Link
              href="/discover"
              aria-current={pathname === "/discover" ? "page" : undefined}
            >
              Upptäck
            </Link>
          </li>
        </ul>
        <div className={styles.search}>
          <Suspense fallback={<SearchFieldFallback />}>
            <SearchField />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}
