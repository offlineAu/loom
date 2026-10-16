# LOOM — Phase 1A Implementation Report

Status: **Implemented and validated.** Scope: Project Foundation + LOOM Design System + Public App Shell only, per the Phase 1A brief. Nothing described here includes Supabase, authentication, IndexedDB, sync, migration, or real Debt Tracker domain logic — those are explicitly deferred (see §7).

---

## 1. What Was Created

### Project foundation
- Next.js 16.3.4 (App Router, Turbopack), React 19.2.8, TypeScript, npm (per D-001).
- Tailwind CSS v4 (CSS-first `@theme` configuration, no `tailwind.config.js`).
- shadcn/ui foundation (`components.json`, style `base-nova`), built on `@base-ui/react` primitives (this shadcn generation uses Base UI, the Radix authors' newer primitive library, rather than Radix directly) + `class-variance-authority` + the `cn` package for the className helper.
- `lucide-react` for icons.

### Environment note (not part of the app, but relevant to reproducing this setup)
This machine's global npm user config (`allow-scripts=opencode-ai` in the npm userconfig) causes `create-next-app` and `shadcn init`'s own internal `npm install` calls to fail with `EALLOWSCRIPTS` ("--allow-scripts is not allowed in project-scoped installs"). Both tools still write their scaffold files correctly before that failing install step; the workaround used throughout was to let the tool write its files, then run a plain `npm install` (or `npm install <pkg>`) directly, which succeeds. `shadcn add <component>` succeeds outright once its peer packages are already installed, since it then has nothing new to install. This is an environment quirk, not a LOOM architecture decision — noting it here so it doesn't need rediscovering.

### Project structure

```text
app/
  layout.tsx              # ThemeProvider + AppShell wrapper, metadata, manifest link
  page.tsx                # Homepage: hero, highlights, full tracker gallery
  not-found.tsx           # 404 using the platform EmptyState pattern
  globals.css             # LOOM design tokens (light/dark), base layer
  trackers/page.tsx       # Dedicated tracker gallery route
  trackers/debt/page.tsx  # Debt Tracker entry point (platform shell only)
  account/page.tsx        # Optional account entry point (honest "not built yet")
components/
  ui/                     # shadcn primitives: button, card, badge, separator,
                           # skeleton, dialog, sheet
  loom/                   # LOOM design-system primitives (typography, empty-state,
                           # error-state, loading-skeleton, confirm-dialog,
                           # bottom-sheet, status-badge, stat-tile, theme-provider,
                           # theme-toggle)
  navigation/             # site-header, bottom-nav, app-shell
  tracker/                # tracker-card, tracker-gallery, category-nav
lib/
  platform/               # ids.ts (ULID), tracker-instance.ts (TrackerMember/
                           # TrackerInstance model + factory)
  tracker/                # catalog.ts (TrackerTemplate catalog — the "Tracker
                           # Template" concept from Phase 0)
  utils/                  # format.ts (date formatting, pluralize)
tests/
  unit/                   # ids, tracker-instance, catalog
  component/              # empty-state, tracker-card (React Testing Library)
e2e/                      # homepage, tracker-gallery, theme (Playwright)
docs/                     # Phase 0 + Phase 1A documentation
public/                   # manifest.json, icon.svg, favicon.ico
```

This makes the platform/tracker boundary from the Phase 0 architecture doc literal: `components/loom` and `lib/platform` are platform code; `components/tracker` and `lib/tracker` are the generic tracker-catalog layer; nothing Debt-specific exists yet (the Debt route is a placeholder that imports only platform components).

### LOOM Design System (`app/globals.css`)
Semantic color tokens (not raw hex scattered through components): `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `info`, `border`, `input`, `ring` — each with light and dark values. Dark mode responds to `prefers-color-scheme` by default and can be forced via `data-theme="light"|"dark"` on `<html>` (managed by `ThemeProvider`). Radius scale (`--radius-sm/md/lg/xl`) derives from one base `--radius`. Shadow tokens are deliberately subtle (`--shadow-sm/md/lg`) — no glassmorphism, heavy blur, or decorative gradients, per the design quality bar in the brief. `prefers-reduced-motion` is respected globally in the base layer.

Typography primitives (`components/loom/typography.tsx`): `PageTitle`, `SectionTitle`, `CardTitle`, `Body`, `SecondaryText`, `FieldLabel`, `Caption`, `NumericValue` (monospace, tabular-nums, tone-aware for future financial figures) — every page in this phase uses these instead of ad hoc text utility classes.

### Mobile-first shell
- `AppShell` = `SiteHeader` (sticky, blurred-on-scroll, desktop nav + theme toggle + "Start a tracker" CTA) + page content + `BottomNav` (mobile-only, 3 items: Home/Trackers/Account, fixed, safe-area-aware).
- Desktop nav in the header is a progressive enhancement (`hidden sm:flex`); the bottom nav is the real mobile navigation, not a shrunk desktop layout.
- `BottomSheet` (wraps shadcn `Sheet`, `side="bottom"`) and `ConfirmDialog` (wraps shadcn `Dialog`) are ready for future trackers' entry forms and destructive-action confirmations.

### Tracker gallery / generic tracker model
- `TrackerTemplate` (`lib/tracker/catalog.ts`): all 14 trackers from the brief, grouped into `personal-finance` / `business` / `productivity`, each with `status: "available" | "coming-soon"`. Only Debt Tracker is `available`.
- `TrackerCard`: renders an available template as a real link; a coming-soon template as a non-interactive, visually de-emphasized card (no `href`, `aria-disabled`) — verified by both a component test and an e2e test that it is *not* rendered as a link.
- `TrackerGallery` + `CategoryNav`: category-filterable grid, reused identically on the homepage and on `/trackers`.
- `TrackerInstance` / `TrackerMember` (`lib/platform/tracker-instance.ts`): models a tracker's ownership as `members: TrackerMember[]` (each `{ userId: string | null; role: "owner" | "editor" | "viewer" }`), never as a bare `tracker.user_id`. `createLocalTrackerInstance()` is a pure factory producing a `{ userId: null, role: "owner" }` member for an anonymous local tracker — this is the concrete proof (backed by a unit test) that the frontend model does not assume single-owner-by-user-id, per the Phase 0 decision register (D-006/D-007) and the architectural check in §23 of the brief.
- `Ulid` type + `generateId()`/`isUlid()` (`lib/platform/ids.ts`), backed by the `ulid` package — client-generatable, sortable IDs per D-002, ready to be the ID type once real persistence exists.

### Debt Tracker entry point
`/trackers/debt` exists, is linked from the homepage hero, the header CTA, and the gallery. It renders an honest `EmptyState` ("Debt tracking lands in the next phase") with a **disabled** "Add your first debt" button — no fake balances, payments, or calculations. This is the concrete seam Phase 2 will build into.

### Account entry point
`/account` exists and states plainly that sign-in isn't implemented yet, with a disabled button — consistent with "optional auth" and with not faking functionality that doesn't exist.

### PWA preparation
`public/manifest.json` (name, icons, theme/background color, `display: standalone`) and `public/icon.svg` (a simple LOOM mark; no PNG icon set was generated — see Limitations). `themeColor` and `appleWebApp` metadata are set in `app/layout.tsx`. **No service worker was implemented** — this is explicitly deferred to the dedicated PWA/persistence phase per the brief.

### Testing foundation
- **Unit** (Vitest + jsdom): `generateId`/`isUlid` behavior, `createLocalTrackerInstance` ownership modeling, catalog invariants (exactly one available template, every category populated, unique keys).
- **Component** (React Testing Library): `EmptyState` renders title/description/action; `TrackerCard` renders available vs. coming-soon states correctly.
- **E2E** (Playwright, `mobile-chrome` + `desktop-chrome` projects): homepage loads with the correct hero and gallery, no sign-in requirement is shown; gallery navigation into the Debt Tracker entry point; category filtering; coming-soon trackers are never links; bottom nav renders on a narrow viewport; theme toggle cycles system → light → dark and sets `data-theme` correctly.

---

## 2. Route Structure

| Route | Purpose |
|---|---|
| `/` | Homepage: hero, "why LOOM" highlights, full tracker gallery |
| `/trackers` | Dedicated, bookmarkable tracker gallery (same `TrackerGallery` component) |
| `/trackers/debt` | Debt Tracker entry point (platform shell only, no domain logic) |
| `/account` | Optional account entry point (honest "not available yet") |
| `/_not-found` (404) | Platform `EmptyState`-based not-found page |

---

## 3. Validation Performed

All commands were actually executed in this environment; results below are real, not assumed.

| Check | Command | Result |
|---|---|---|
| Install | `npm install` (+ targeted installs for peer deps, see §1 environment note) | ✅ Succeeds (one native postinstall script for `unrs-resolver` is blocked by the environment's script-allowlist policy — harmless, optional native optimization, not required for dev/build/test) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ No errors |
| Lint | `npm run lint` (`eslint .`) | ✅ No errors, no warnings |
| Build | `npm run build` (`next build`) | ✅ Succeeds; all 5 routes prerendered as static content |
| Unit + component tests | `npm run test` (`vitest run`) | ✅ 16/16 tests passed, 5/5 files |
| E2E tests | `npm run test:e2e` (`playwright test`, after `npx playwright install chromium`) | ✅ 16/16 tests passed across `mobile-chrome` and `desktop-chrome` |
| Runtime smoke test | `next start` + `curl` against every route | ✅ `/`, `/trackers`, `/trackers/debt`, `/account`, `/manifest.json`, `/icon.svg` → 200; unknown route → 404 |
| Mobile viewport | Playwright `mobile-chrome` project (Pixel 7) + explicit 375×812 test | ✅ Bottom nav renders, gallery is usable |
| Desktop viewport | Playwright `desktop-chrome` project | ✅ Header nav renders, gallery is usable |
| Dark mode | Playwright theme-toggle test asserting `data-theme` on `<html>` | ✅ Cycles system → light → dark → system correctly |
| Accessibility (baseline) | Manual review only — semantic landmarks (`header`/`main`/`nav`), `role="tablist"`/`role="tab"` on the category filter, `aria-current="page"` on active bottom-nav links, focus-visible rings on interactive elements, `aria-hidden` on decorative icons, disabled buttons use real `disabled` attribute | ⚠️ Not run through an automated accessibility scanner (e.g. axe) in this phase — see Limitations |

Two real bugs were found and fixed during validation, worth recording since they reflect genuine engineering (not just "everything passed first try"):
1. A missing `afterEach(cleanup())` in the Vitest setup caused component tests to leak DOM state between tests (a later test saw an earlier test's rendered output). Fixed by registering RTL's `cleanup()` in `vitest.setup.ts`.
2. Two Playwright peer dependencies (`@testing-library/dom`, `vite`) were not installed automatically alongside `vitest`/`@testing-library/react` due to peer-dependency resolution combined with `--legacy-peer-deps` (needed to work around an unrelated environment-specific `shadcn`/Babel version conflict). Installed explicitly.
3. Two of the hand-written Playwright assertions were themselves ambiguous (matched more than one element, or matched incidental prose text containing "Debt Tracker" rather than the intended gallery card). Fixed by scoping selectors more precisely — these were test bugs, not application bugs.

---

## 4. Design-System Decisions Worth Noting

- **Base UI, not Radix, under shadcn.** The installed shadcn generation (`style: "base-nova"`) uses `@base-ui/react` primitives. Composed components (`Button`, `Dialog`, `Sheet`, etc.) use Base UI's `render` prop pattern (e.g. `<Button render={<Link href="..." />}>`) rather than Radix's `asChild` — this is a real API difference from the more commonly-documented Radix-based shadcn examples and matters for anyone extending these components later.
- **Hand-rolled theme provider**, not `next-themes`. ~50 lines, localStorage-backed, system/light/dark cycle. Deliberately avoided adding a dependency for behavior this small.
- **Generic `StatusBadge`, not a `SyncStatusChip`.** The Phase 0 platform doc describes a future sync-state chip; building a component named for that concept now, before any sync engine exists, would imply functionality that isn't there. `StatusBadge` is genuinely generic (used today for "Available"/"Coming soon") and can be reused for real sync states later without renaming.

---

## 5. Architectural Check (per brief §23)

Verified that nothing built in this phase creates coupling that would block later phases:

| Future requirement | Status |
|---|---|
| Anonymous-first use | ✅ No route or component requires sign-in; `/account` explicitly states auth is optional and not yet built |
| IndexedDB persistence | ✅ No persistence was faked; only `localStorage` is used, and only for a cosmetic theme preference, not domain data |
| Local-generated ULIDs | ✅ `lib/platform/ids.ts` exists and is unit-tested; `TrackerInstance` uses it |
| Supabase persistence | ✅ Not referenced anywhere; no schema assumptions baked into the UI layer |
| Tracker membership | ✅ `TrackerInstance.members: TrackerMember[]`, never `tracker.user_id` — unit-tested explicitly |
| Multiple tracker types | ✅ `TrackerTemplate` catalog already models 14 distinct types across 3 categories |
| Future shared trackers | ✅ `TrackerRole` (`owner`/`editor`/`viewer`) already exists in the type model |
| Record-level synchronization | ✅ `StatusBadge` is generic, not sync-specific; no UI assumes a particular sync state shape yet |
| Export/import | ✅ Not built; nothing precludes the Export/Import Engine design from Phase 0 |
| Mobile PWA usage | ✅ Manifest + metadata in place; no service worker built (correctly deferred) |

No refactors were needed as a result of this review — nothing drifted into an assumption that would require rework later.

---

## 6. Known Limitations

- **PWA icon set is a single SVG placeholder**, not a full PNG icon set (192×192, 512×512, maskable variants) — sufficient for `manifest.json` validity but not production-final app-icon assets.
- **No automated accessibility scan was run** (e.g. axe-core/Playwright accessibility assertions) — only manual semantic/ARIA review. Recommend adding an automated a11y check in Phase 1B or Phase 3's reliability pass.
- **`unrs-resolver`'s native postinstall script is blocked** by this environment's npm script-allowlist policy. It's an optional performance optimization for a transitive dependency (not `unrs-resolver` itself being a direct dependency of anything we added intentionally) and does not affect correctness of install, build, lint, typecheck, or tests — all of which were verified to pass regardless.
- **No content exists for `/trackers/monthly-budget` etc.** — by design; those templates are `coming-soon` and intentionally non-navigable.
- **Environment-specific npm friction** (documented in §1) means a from-scratch `npx create-next-app` / `npx shadcn init` on this machine will hit the same `EALLOWSCRIPTS` error until either the global npm user config is changed or the same manual-install workaround is applied. This is worth flagging to whoever next sets up a clean clone.

---

## 7. Deferred Work (explicitly NOT built in this phase)

- Supabase project, schema, and client integration
- Authentication (sign-up/sign-in, session handling)
- Row Level Security policies
- IndexedDB/Dexie local persistence
- Sync engine (outbox, retry, conflict detection)
- Anonymous → authenticated migration RPC
- Real Debt Tracker domain logic (debts, payments, adjustments, calculations, CRUD)
- CSV import, XLSX/PDF export
- Service worker / real offline behavior
- Generic activity/history event table (documented in the Decision Register, D-010; not implemented)

---

## 8. Readiness

**READY FOR PHASE 1B**

Rationale: every Phase 1A deliverable in the brief exists, is wired together consistently (design tokens → typography → components → pages), and is validated by actually-executed typecheck/lint/build/unit/component/e2e runs plus a runtime HTTP smoke test — not just scaffolded and assumed. The architectural check found no coupling that would block Supabase, persistence, sync, membership, or additional tracker types. The only open items are the two limitations noted above (icon asset completeness, automated a11y scanning), neither of which blocks starting Phase 1B (Supabase/auth/persistence foundation) or Phase 2 (Debt Tracker domain).
