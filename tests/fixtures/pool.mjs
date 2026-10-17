/**
 * tests/fixtures/pool.mjs — the fixture-side TMDB query mechanics of
 * /discover/movie (ARCHITECT-PLAN Rev 4.1 §6, MC 10333 T9). Imported by
 * server.mjs AND both new suite files: gate expectations DERIVE from this
 * module (never hand-tuned), while the literal breakers stay in gate text.
 *
 * Contract pinned by §6: matches sort by `id` ASCENDING (contiguous pool
 * ids make windows literal: page 2 starts at item 19 = id 15019); page
 * size 20 (TMDB parity); page k≥2 starts at item (k−1)·18+1 (1-based) ⇒
 * overlap = items 18k+1 and 18k+2 exactly; out-of-range page ⇒ empty
 * window; `page` absent ⇒ page 1. Filtering (genre ∩ vote/date/company)
 * happens BEFORE paging. The date selector is injectable (MC 10610 §6:
 * TV_DATES for /discover/tv) — movie mechanics byte-identical.
 * Fixture-helper file — line-cap exempt.
 */

/**
 * filterPool(items, params, dateKeys?) → matches sorted id-ascending.
 * `params` carries raw TMDB selector strings (URLSearchParams#get output or
 * the plain-object twin); absent/empty selectors are inactive.
 *
 * `dateKeys` (MC 10610 §6) generalizes the ONE hardcoded-date assumption:
 * the movie default (primary_release_date.* params matched against
 * item.release_date) stays byte-identical for every 2-arg caller — the
 * tv pool passes TV_DATES (first_air_date.* against item.first_air_date).
 * Mechanics otherwise: genre ∩ vote ∩ date ∩ company, filter BEFORE page.
 */
export const MOVIE_DATES = {
  gte: "primary_release_date.gte",
  lte: "primary_release_date.lte",
  field: "release_date",
};
export const TV_DATES = {
  gte: "first_air_date.gte",
  lte: "first_air_date.lte",
  field: "first_air_date",
};

export function filterPool(items, params, dateKeys = MOVIE_DATES) {
  const genre = params.get ? params.get("with_genres") : params.with_genres;
  const company = params.get ? params.get("with_companies") : params.with_companies;
  const pick = (name) => (params.get ? params.get(name) : params[name]);
  const gte = num(pick("vote_average.gte"));
  const lte = num(pick("vote_average.lte"));
  const dGte = pick(dateKeys.gte) || null;
  const dLte = pick(dateKeys.lte) || null;
  return items
    .filter((item) => {
      if (genre && !item.genre_ids.includes(Number(genre))) return false;
      if (company) {
        const ids = (item.production_companies ?? []).map((c) => c.id);
        if (!ids.includes(Number(company))) return false;
      }
      if (gte !== null && item.vote_average < gte) return false;
      if (lte !== null && item.vote_average > lte) return false;
      const date = item[dateKeys.field] ?? "";
      if (dGte && date < dGte) return false;
      if (dLte && date > dLte) return false;
      return true;
    })
    .sort((a, b) => a.id - b.id);
}

/** pageWindow(items, page): the §6 window over an already-sorted list. */
export function pageWindow(items, page) {
  const k = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const start = k === 1 ? 0 : (k - 1) * 18;
  return items.slice(start, start + 20);
}

/** distinctUnion(items, pageCount): merged ids of pages 1..pageCount,
 *  first occurrence wins — the app-side merge's expected value. */
export function distinctUnion(items, pageCount) {
  const seen = new Set();
  const ids = [];
  for (let page = 1; page <= pageCount; page += 1) {
    for (const item of pageWindow(items, page)) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        ids.push(item.id);
      }
    }
  }
  return ids;
}

function num(value) {
  return value === null || value === undefined || value === "" ? null : Number(value);
}
