/**
 * EmptyState — calm centered "no results" block (comp-empty-state.png:
 * quiet motif, bold title, muted description, one action; the comp's own
 * rendered Swedish is garbled, so copy comes from the caller per the
 * COMP-NOTES canon, e.g. "Inga träffar" + "Prova en annan sökning eller ett
 * annat filter.").
 *
 * children renders the page-owned action slot: the PAGES own the clear
 * button ("Rensa sökning" / "Visa alla") because only they know which
 * action clears their state — this component only lays it out.
 *
 * The title is an <h2>: every call-site of EmptyState sits INSIDE a page
 * whose single <h1> is rendered by that route's SERVER page.tsx (the
 * one-h1 invariant of DA P2-1 — W4 moved the page-level h1 there, so no
 * EmptyState may emit an h1 itself; the former headingLevel="h1" prop was
 * orphaned by that move and removed).
 */

import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <div className={styles.motif} aria-hidden="true">
        <span className={styles.motifFrame} />
      </div>
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {children && <div className={styles.action}>{children}</div>}
    </div>
  );
}

export default EmptyState;
