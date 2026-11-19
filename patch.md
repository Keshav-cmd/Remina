# REMINA — Patch Log

Every change to the app is recorded here, newest first. Format: date · files touched · what changed · why.

**Current release: Patch 1.1.1**

---

## Patch 1.1.1 — 2026-11-20 — Clean wordmark release

**Files:** `index.html`, `styles.css`, `patch.md`

- Recorded the current mobile-first version of REMINA as **Patch 1.1.1**.
- Removed the leaf logo mark from the left of the **remina.** name in the sidebar.
- Kept only the clean `remina.` wordmark for a simpler, more minimal brand header.
- Removed the now-unused `.brand-mark` styles from `styles.css`.
- The browser favicon remains unchanged; only the logo beside the sidebar name was removed.

---

## Patch 002 — 2026-11-19 — Mobile first-class upgrade

**Files:** `styles.css`, `index.html`, `app.js`

**Goal:** make the app as good on phones as it is on desktop. Desktop (>900px) is untouched — every rule added is scoped inside `@media (max-width:900px)` / `(max-width:650px)` / `(hover:none)` / landscape blocks.

### What changed

**Navigation → bottom tab bar (phones ≤650px)**
- The sidebar is re-purposed as a fixed **bottom tab bar** (Calendar / Study log / Review queue), like a native app: icon above label, active pill highlight, review-count badges kept, frosted blur background, `env(safe-area-inset-bottom)` padding for notched phones.
- `.content` gets bottom padding so nothing hides behind the bar; `#dayPanel` gets `scroll-margin` so tapping a calendar day scrolls the day panel fully into view.
- Tablet (651–900px) keeps the horizontal sidebar, unchanged.

**Sticky topbar (≤900px)**
- The topbar (Saved label, help, theme, avatar) is now `position:sticky` with a backdrop blur, so theme/help/name stay reachable while scrolling.

**Dialogs → bottom sheets (≤650px)**
- Dialogs (theme picker, name ask, entry form, details, guide, delete) dock to the bottom, full width, rounded top corners, with a grab-handle pill, `92dvh` max height, internal scrolling, and safe-area bottom padding.
- Action buttons become a full-width 2-column grid, min-height 46px; single-button rows span the full width.

**Touch targets enlarged (≤650px)**
- Review **check buttons 22→26px plus an invisible ±11px hit area** (≈48px effective) — marking a review complete is the core morning action.
- Help/avatar buttons, table edit/delete buttons, month arrows, Today button, queue filters, review-footer links, empty-day links and the "what should I call you?" link all get bigger boxes or expanded hit areas (44px-class).
- `touch-action:manipulation` on buttons (no double-tap-zoom lag); tap-highlight removed; `@media (hover:none)` resets hover transforms so buttons don't stay "lifted" after a tap.

**iOS/Android input behavior**
- All text inputs (quick-add topic, subject, search, entry form, name form) use **font-size:16px on phones** — this stops iOS Safari from auto-zooming the page on focus. Inputs are 46px tall.
- `-webkit-text-size-adjust:100%` added globally; `100dvh`/`92dvh` used (with `vh` fallback) so mobile browser chrome doesn't clip the layout.

**Readability & layout fixes (≤650px)**
- Stat-card captions wrap to two lines (9px) instead of being clipped with ellipsis at 8.5px; cards grow to fit.
- Daily pace question ("Yes, let's study / Not today") buttons become two thumb-sized 40px halves of the row.
- Toast is centered full-width and floats **above the bottom tab bar**.
- Queue rows re-gridded for the larger check button.

**Theme-color sync (`index.html` + `app.js`)**
- The browser's `theme-color` meta now matches the active theme (paper `#f9f7f2`, frost `#eef3ee`, obsidian `#131316`) — the phone's URL bar/status bar tints with the theme. Applied in the inline boot script (no flash) and in `applyTheme()`.
- Viewport meta gains `viewport-fit=cover` so safe-area insets work.

### Not changed
- All desktop styling, the greeting system, the first-visit flow (theme picker → name), data model, scheduling logic, themes' color systems, the logo/brand mark.

---

## Patch 001 — 2026-11-19 — Rollback to the "greetings" state

**Files:** `app.js`, `index.html`, `styles.css`, deleted `assets/logo.png`, `assets/logo.svg`, `assets/logo-editorial.svg`

Rolled the app back to the state right after the greeting system was built, per request:
- Logo restored to the original inline CSS/SVG leaf mark + data-URI favicon; all generated logo files deleted.
- Theme picker order restored (Modern Editorial → Frosted Glass → Obsidian & Champagne), "Founder's Choice" badge and Obsidian-first ordering removed, default button back to "Keep it simple" (editorial).
- Obsidian-as-default landing reverted; app opens in Modern Editorial unless a theme was chosen.
- Greeting emojis restored (☀️ 🌤️ 🌙 ✨) — the removal was undone.
- Kept: greeting system, first-visit flow (**theme selection → then name**), daily pace question, "Saved" label, "Keshav" example, Keshav Jha founder credit.

---

## Baseline (pre-patch-log)

REMINA spaced-revision app as it stood before this log started: daily study log; reviews scheduled at days 3, 7, 15, 30 then every +30 days; calendar + day panel + study log + review queue views; three themes; first-visit theme picker then name dialog; warm time-of-day companion greetings; localStorage persistence ("Saved"); single "Example" seed entry; credit to Keshav Jha (Founder, CEO & the entire C-suite).
