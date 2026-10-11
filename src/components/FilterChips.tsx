/**
 * FilterChips — the genre filter row of /discover (DESIGN.md §5:
 * nav[aria-label="Filtrera genrer"] > buttons with aria-pressed; "Alla"
 * first, then one chip per genre name from /api/genres — never a
 * hardcoded list). Chips are <button type="button">, not links: writing
 * ?filter= to the URL is the PAGE's job (onSelect reports the chosen
 * slug; "" = Alla).
 *
 * Exactly-one-active is structural here: a chip is pressed iff its slug
 * equals activeSlug, and duplicate slugs are dropped (first owner wins),
 * so keys are unique and at most one chip can ever render pressed. When
 * no chip owns activeSlug none is pressed — the page owns that case
 * (unknown filter / genres unavailable) and never lets two compete.
 *
 * slugify() lives here because a chip's slug IS its identity: the page
 * builds its slug→genre-id map from the SAME /api/genres response with
 * this same function, so chip label, pressed state and the URL parameter
 * round-trip through one definition.
 */

import type { Genre } from "@/lib/tmdb/types";
import styles from "./FilterChips.module.css";

export interface FilterChipsProps {
  genres: Genre[];
  /** Slug of the active filter ("" = Alla). A slug owned by no rendered
   *  chip presses nothing — see the unknown-filter reading in Discover. */
  activeSlug: string;
  /** Called with the chosen slug ("" = Alla); the page writes the URL. */
  onSelect: (slug: string) => void;
}

/**
 * Swedish-safe genre slug: lowercase, then NFD + strip combining marks,
 * which folds Å→a, Ä→a, Ö→o exactly as required and every other
 * diacritic the same way (é→e, ç→c, …). Non-alphanumeric runs collapse
 * to "-", leading/trailing "-" trimmed. Idempotent, so slug→URL→slug
 * lookups are exact string matches.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function FilterChips({ genres, activeSlug, onSelect }: FilterChipsProps) {
  const seen = new Set<string>();
  const chips = [{ slug: "", label: "Alla" }];
  for (const genre of genres) {
    const slug = slugify(genre.name);
    // "" would collide with the Alla chip (a name that slugs away to
    // nothing is unusable data); duplicate slugs: first chip owns it.
    if (slug === "" || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    chips.push({ slug, label: genre.name });
  }

  return (
    <nav aria-label="Filtrera genrer" className={styles.chips}>
      {chips.map((chip) => (
        <button
          key={chip.slug || "alla"}
          type="button"
          className={styles.chip}
          aria-pressed={chip.slug === activeSlug}
          onClick={() => onSelect(chip.slug)}
        >
          {chip.label}
        </button>
      ))}
    </nav>
  );
}
