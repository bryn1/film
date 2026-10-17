# COMP-NOTES — design comps + copy canon (binding for W2–W4)

Comps (all five tracked in this folder; generated locally, Qwen-Image, provenance embedded in
each PNG; owner ruling "images as base" 2026-10-07): `comp-start-1440.png` +
`comp-start-390.png` (startsida desktop/mobile), `comp-upptack-1440.png` + `comp-upptack-390.png`
(Upptäck desktop/mobile — the 390 comps anchor mobile layout: wrapping chip row, single-column
density), and `comp-empty-state.png` (empty-state anchor: quiet motif, bold title, muted
description, one action — consumed by `states/EmptyState.tsx`, whose own copy comes from the
canon below, not from the comp's garbled render). The Figma file (Compileit-Case) is unreachable
from this seat (403); if screenshots arrive later, a fidelity pass re-anchors W4 to them.

**Authority split:** comps anchor LAYOUT, DENSITY, PALETTE, MOOD only. Every visible string comes
from the copy canon below + real API data — the comps' own rendered Swedish is partly garbled
("Toppbetygsiitta", "Uprtäck filler", "Skruckfilm") and is NOT copy source. Tokens: docs/DESIGN.md.

## Copy canon (exact strings)

- Brand: **Filmsidan** · Nav links: **Startsida**, **Upptäck** · Search placeholder: **Sök film…**
- Startsida section headings: **Trending**, **På bio nu**, **Toppbetygsatta**
- Upptäck page h1: **Upptäck filmer** · Filter chips: **Alla** + genre names from
  `/api/genres` (TMDB sv-SE names verbatim — never hardcoded lists)
- Search results h1: **Sökresultat** + `<h1>…</h1>` shows query via visually hidden span or
  `Sökresultat för "<q>"`; count line: **N träffar** / **1 träff** / **Inga träffar** (`role="status"`)
- Search view WITHOUT a query (`/search`, empty submit, "Rensa sökning"): h1 **Sökresultat** +
  description **Skriv in något för att söka.** + hint line "Eller bläddra efter genre under
  Upptäck." (Upptäck = next/link; added to canon 2026-10-08 per DA P3-4 — the code's strings are
  good Swedish and govern)
- States: loading = skeletons (no spinner-only) · empty: **Inga träffar** +
  **Prova en annan sökning eller ett annat filter.** + button **Rensa sökning** (clears `q`;
  on discover, the same button reads **Visa alla**) · error: **Något gick fel** +
  **Vi kunde inte hämta filmerna just nu.** + retry button **Försök igen**
- TMDB_NOT_CONFIGURED (503): title **Kan inte visa filmer**, description
  **Ingen TMDB-nyckel är konfigurerad. Sätt TMDB_API_KEY för att visa filmer.** (honest state,
  never a fake poster)
- Poster card: title (1-line clamp) + release **year** small muted; rating badge **★ 7,8**
  (comma decimal, only when voteAverage > 0)
- Meta row (hero): **ÅR · GENRE · ★ BETYG** style: `2026 · Drama · ★ 8,4`
- a11y: skip link **Hoppa till innehåll**; every icon-only control gets `aria-label`
- Filmdetail `/movie/[id]` (MC 10333 T9): h1 = the movie's own title (no new static copy) ·
  section h2 **Handling**, **Rollista** · director line **Regissör** · runtime line
  **Speltid <n> min** · empty overview: **Inte tillgänglig**
- Detail meta score links (MC 10612): the score badge LINKS to the title's TMDB page (visible
  text stays the bare sv-SE rating — no new visible string); label **IMDb** (detail meta, shown
  ONLY when TMDB carries the id) · aria-labels **Betyg på TMDB <rating>, öppnas i ny flik** /
  **IMDb, öppnas i ny flik**
- Upptäck filter bar (T9): labels **Betyg från**, **Betyg till**, **År från**, **År till**,
  **Antal filmer** · submit **Visa filmer** · clear link **Rensa filter** (renders only when
  the URL carries a non-default filter)
- Search sections (T9): h2 **Filmer** (the count line stays **N träffar**, `role="status"`
  on the FILM section only) · **Personer** · **Produktionsbolag**

## Deliberate deltas vs comps (do not build these)

- **No "Se nu" / "Mer info" hero buttons** — still true after MC 10333 T9 added the
  `/movie/[id]` route: hero = backdrop + scrim + title + meta row only; the way INTO a film is
  the poster card itself (MovieCard links to `/movie/[id]`). The no-fake-content rule stands;
  only its old reason ("no detail page in scope") retired.
- Hero source on startsida = first trending item with a backdrop; fallback first now-playing.
- Rail arrows in comps are decoration; implement rails as native horizontal scroll
  (`ul` + overflow-x, keyboard-reachable cards) — no fake carousel.
