# DESIGN — compileit-filmsida (design-system pin)

> **What this file is:** the pinned design system for this app — direction, tokens, type, spacing,
> layout skeleton, copy language. It is the DESIGN pin only; the architecture statement (modules,
> entrypoints, ports, deps, data stores) lives in [ARCHITECTURE.md](ARCHITECTURE.md), not here.
> >150 lines by necessity: a token pin must carry FULL literal values or each child re-invents them
> (workspace-convention allows this with a stated reason — this line is the reason).
> **Provenance:** tokens are copied from `workflow-frontend/design-baseline.md` (Tailwind-zinc ramp,
> indigo accent, Major-Third scale, 4px spacing). Deviations are marked **⚠ DELTA** with a reason.
> **Comp dependency:** the Figma file is unreachable (403); owner ruling "images as base" — the
> orchestrator drops generated design comps into `docs/design/` after this phase. Build waves W1–W3
> build to THIS file; the W4 polish wave reconciles visuals against the comps. If a comp contradicts
> a token, the comp wins on visuals and this file is re-pinned in the same wave — never silently.

## DIRECTION

**Dark, poster/backdrop-first cinematic UI at Linear density: zinc-950 canvas, edge-to-edge hero
backdrop with scrim-legible title, horizontal movie rails on the start page, chip row + poster grid
on Upptäck. Chrome recedes (zinc surfaces, hairline borders, indigo only for actions/active state);
the artwork IS the colour. "Images as base" — every module earns its height with posters, never
text blocks.**

## 1. Colour tokens (CSS custom properties, globals.css `:root`)

Light block = baseline verbatim (kept so the token mechanism stays one-file-complete; the app
renders dark — see handling note below).

```css
:root {
  /* LIGHT (baseline verbatim — not the shipped look) */
  --bg-primary:#ffffff; --bg-secondary:#f9fafb; --bg-tertiary:#f3f4f7;
  --surface:#ffffff; --surface-hover:#f9fafb; --surface-active:#f3f4f7;
  --border-subtle:#e9ebef; --border-default:#dfe1e6; --border-strong:#c6c9d0;
  --text-primary:#16171a; --text-secondary:#6e737c; --text-tertiary:#9b9fa8;
  --accent:#564ef3; --accent-hover:#4332d5; --accent-active:#3425a8; --accent-surface:#eef2ff;
  --success:#0e8127; --success-hover:#045c1c; --success-surface:#dcfce7;
  --warning:#af6300; --warning-hover:#8a4e00; --warning-surface:#fef3c7;
  --danger:#e7000b; --danger-hover:#c10007; --danger-surface:#fee2e2;
  --info:#008697; --info-hover:#005f6b; --info-surface:#cffafe;
  --focus-ring:#564ef3;
  --shadow-sm:0 1px 2px rgba(0,0,0,.04); --shadow-md:0 2px 6px rgba(0,0,0,.06); --shadow-lg:0 4px 12px rgba(0,0,0,.08);
}
```

Dark block = the shipped, cinematic theme (baseline dark + marked deltas):

```css
[data-theme="dark"] { /* app default; see handling note */
  --bg-primary:#060708; --bg-secondary:#16171a; --bg-tertiary:#25272b;      /* baseline */
  --surface:#16171a; --surface-hover:#25272b; --surface-active:#303238;
  --border-subtle:#25272b; --border-default:#303238; --border-strong:#50545c;
  --text-primary:#f3f4f7; --text-secondary:#c6c9d0; --text-tertiary:#9b9fa8;
  --accent:#7682ff; --accent-hover:#939eff; --accent-active:#a5adff; --accent-surface:rgba(86,78,243,.15);
  --success:#22c55e; --warning:#fbbf24; --danger:#ef4444; --info:#22d3ee;   /* + baseline -hover/-surface */
  --focus-ring:#7682ff;
  --shadow-sm:0 1px 2px rgba(0,0,0,.3); --shadow-md:0 2px 6px rgba(0,0,0,.4); --shadow-lg:0 4px 12px rgba(0,0,0,.5);

  /* ⚠ DELTA — cinematic additions (dark-only mechanisms the baseline has no tokens for) */
  --text-on-image:#ffffff;                    /* title copy on poster/hero scrim */
  --poster-scrim:linear-gradient(to top, rgba(6,7,8,.95) 0%, rgba(6,7,8,.85) 42%, rgba(6,7,8,0) 100%);
  --backdrop-scrim:linear-gradient(to right, rgba(6,7,8,.94) 0%, rgba(6,7,8,.62) 45%, rgba(6,7,8,0) 100%),
                   linear-gradient(to top, var(--bg-primary) 0%, rgba(6,7,8,0) 34%);
  --rating-gold:#fbbf24;                      /* semantic alias of --warning for vote badges */
  --poster-radius:var(--radius-lg);           /* 8px — Linear card radius, not 16px */
  --rail-scroll:var(--space-6);               /* rail side gutter on mobile */
}
```

**Light+dark handling:** the token blocks above carry both modes per baseline; the shipped site is
**dark-pinned** (`data-theme="dark"` on `<html>`). Reason: a cinema UI must guarantee scrim
legibility over arbitrary poster luminance, which is deterministic only on the dark canvas; the
Figma design could not be reached to confirm a light variant. If the owner later supplies light
comps, swap the pin — the mechanism is a one-attribute change.

## 2. Contrast — every pair defined here, computed (WCAG 2.x, ≥4.5 normal text)

| # | Pair (fg on bg) | Ratio | Status |
|---|---|---:|---|
| 1 | `--text-primary` #f3f4f7 on `--bg-primary` #060708 | 18.33 | PASS |
| 2 | #f3f4f7 on `--surface` #16171a (cards, chips, rails) | 16.30 | PASS |
| 3 | `--text-secondary` #c6c9d0 on #060708 | 12.16 | PASS |
| 4 | #c6c9d0 on #16171a | 10.81 | PASS |
| 5 | `--text-tertiary` #9b9fa8 on #060708 (meta, hints) | 7.60 | PASS |
| 6 | #9b9fa8 on #16171a | 6.76 | PASS |
| 7 | `--accent` #7682ff on #060708 (links, active chip text) | 6.15 | PASS |
| 8 | #7682ff on #16171a | 5.47 | PASS |
| 9 | `--accent-active` #a5adff on #060708 (hover text) | 9.62 | PASS |
| 10 | `--rating-gold` #fbbf24 on #060708 | 12.08 | PASS |
| 11 | #fbbf24 on #16171a (badge on card) | 10.74 | PASS |
| 12 | `--text-on-image` #ffffff on `--poster-scrim` ≥85% over a WHITE poster (worst case #2b2c2d) | 13.95 | PASS |
| 13 | #ffffff on scrim 95% over white poster (#1a1b1c) | 17.28 | PASS |
| 14 | #f3f4f7 on active-chip bg (accent-surface over #16171a ⇒ #201f3b) | 14.45 | PASS |
| 15 | `--accent-hover` #939eff on #201f3b | 6.49 | PASS |
| 16 | `--accent-active` #a5adff on #201f3b | 7.59 | PASS |
| 17 | `--accent` #7682ff on #201f3b (default pressed-chip text on accent-surface over #16171a) | 4.85 | PASS |

Row 17 note (DA P4-4, added W4): the DEFAULT pressed chip (`--accent` text on `--accent-surface`,
the FilterChips `[aria-pressed="true"]` state) is the pair 7/8 and 14–16 left undocumented — passes.

**Scrim rule (binding):** copy may only sit where scrim alpha ≥ 0.85 behind it (row 12's worst case;
at 0.55 alpha it drops to 4.51 — too tight, so no text on the soft edge). Poster meta text below the
image sits on solid surfaces (rows 2–6), never on artwork. Borders/scrim edges are non-text (3:1) —
border-strong #50545c on #060708 = 3.9:1.

## 3. Type — baseline Major Third, family = Inter (template's existing mechanism)

⚠ DELTA: baseline stack is system fonts; the template ALREADY ships Inter via `next/font/google`
(self-hosted, zero-CLIP). Reusing it beats a new change with no gain; sizes/scale stay baseline.

```css
--text-xs:12.8px; --text-sm:16px; --text-md:20px; --text-lg:25px; --text-xl:31.2px; --text-2xl:39.1px;
--text-3xl:48.8px; /* ⚠ DELTA t+5: cinematic hero title needs one more step; same 1.25 ratio */
--lh-tight:1.2; --lh-normal:1.45; --lh-relaxed:1.5;
--font-normal:400; --font-medium:500; --font-semibold:600; --font-bold:700;
```

Usage: hero `--text-3xl/400-600` (comp decides weight); rail/section headings `--text-md` semibold;
card titles `--text-sm` medium; meta `--text-xs` (year · rating · genre), `--text-secondary`.

## 4. Space / radius / shadow — baseline verbatim

4px scale: `--space-1..24` = 4/8/12/16/20/24/32/40/48/64/80/96px. Rail grid gap `--space-4` (16px),
section rhythm `--space-12/16`, hero height ≈ 60vh desktop / 420px mobile. Radii: cards `--radius-lg`
(8px), chips/inputs `--radius-md` (6px), pills `--radius-full` (rating badge). Shadows: dark-mode set
(light over dark, no glow); hover elevation = `--surface-hover` + `--shadow-md`, posters get a 1px
`--border-subtle` hairline, never a heavy drop shadow.

## 5. Layout skeleton (comps refine; structure/elements are pinned)

- **Nav (sticky, every view):** `header > nav` — wordmark left; links `Startsida` · `Upptäck`
  (`aria-current="page"`); right: `SearchField` (`form` + `input[type=search]`, accessible name
  "Sök film", submits to `/search?q=`; ⌘K/`/` focus shortcut optional, comp-dependent).
- **Startsida (`main`):** `section[hero]` — backdrop 16:9 full-bleed + `--backdrop-scrim`, `h1`
  title, meta row, NO hero CTA (MC 10333 T9 added the /movie/[id] route: the
  way into a film is the poster card — MovieCard links; COMP-NOTES delta holds).
  Then three `section`s, each `h2` + `MovieRail` (horizontal scroll-snap `ul/li`, 2.2 posters
  visible mobile, 6 desktop): headings per copy canon ("Trending", "På bio nu", "Toppbetygsatta").
- **Upptäck:** `h1` + `nav[aria-label=Filtrera genrer] > FilterChips` (buttons, `aria-pressed`,
  "Alla" + genres, exactly one active) + result-count `p[role=status]` + `PosterGrid`
  (`ul`, 2 cols 375px → 6 cols ≥1440px). ⚠ re-pinned: first result page (~20) + count line,
  NO pagination controls — not in case scope, no mechanism beside the grid.
- **Sök (`/search`):** `h1` "Sökresultat för \"…\"" + same grid; empty/error states below.
- **States (all views):** skeleton (poster-sized shimmer blocks, no layout shift); empty, error
  and missing-key-503 strings per copy canon (honest state, never a crash); focus ring
  `--focus-ring` everywhere, `:hover`/`:active` per baseline checklist.

## 6. Copy language — Swedish (canon = COMP-NOTES.md)

All UI copy Swedish (site audience); TMDB queries always `language=sv-SE` (pinned in client.ts).
**Every visible string is governed by [design/COMP-NOTES.md](design/COMP-NOTES.md) — the single
copy canon** (re-pinned 2026-10-07, orchestrator, explicit per PLAN §8: it supersedes this
section's earlier word list, which contained the misspelling "Toppbetade" and pre-comp labels).
Dates `sv-SE` (ÅÅÅÅ-MM-DD → "14 mar 2024" via `Intl.DateTimeFormat('sv-SE')`). `lang="sv"`.
