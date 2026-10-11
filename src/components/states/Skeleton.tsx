/**
 * Skeleton — loading placeholder blocks (PLAN §5: poster-shaped shimmer,
 * exact MovieCard aspect/radius, no layout shift; prefers-reduced-motion ⇒
 * static blocks, no shimmer). Purely decorative: aria-hidden — the loading
 * announcement is the PARENT's aria-busy="true" container (set by
 * MovieRail/PosterGrid in their loading branches, DA P4-3); the role=status
 * count line announces the RESULT once loaded. Nothing announced twice.
 *
 * Variants: "card" (plain wrap row), "rail" (horizontal strip matching
 * MovieRail density), "grid" (same column formula as PosterGrid — the two
 * modules repeat that one line on purpose, each owning its own layout).
 */

import styles from "./Skeleton.module.css";

export type SkeletonVariant = "card" | "rail" | "grid";

export interface SkeletonProps {
  /** Number of poster blocks; defaults per variant (grid fills ≈2 rows). */
  count?: number;
  variant?: SkeletonVariant;
}

const DEFAULT_COUNTS: Record<SkeletonVariant, number> = {
  card: 1,
  rail: 6,
  grid: 12,
};

export function Skeleton({ count, variant = "card" }: SkeletonProps) {
  const total = Math.max(0, count ?? DEFAULT_COUNTS[variant]);

  return (
    <div
      className={`${styles.wrapper} ${styles[variant]}`}
      aria-hidden="true"
    >
      {Array.from({ length: total }, (_, index) => (
        <div key={index} className={styles.block}>
          <div className={styles.poster} />
          <div className={styles.titleLine} />
          <div className={styles.metaLine} />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
