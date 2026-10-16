# LOOM

A public, mobile-first tracker platform. This repo is currently in **Phase 1A — Project Foundation + LOOM Design System + Public App Shell**. See `docs/` for the full architecture and spec:

- `docs/LOOM-PHASE-0-PLATFORM-ARCHITECTURE.md` — platform architecture
- `docs/LOOM-PHASE-0-DEBT-TRACKER-SPEC.md` — Debt Tracker domain spec
- `docs/LOOM-PHASE-0-DECISION-REGISTER.md` — closed architectural decisions
- `docs/LOOM-PHASE-0-IMPLEMENTATION-PLAN.md` — phase roadmap
- `docs/LOOM-PHASE-1A-IMPLEMENTATION.md` — what's built so far

## Development

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
npm run lint      # eslint
npm run typecheck # tsc --noEmit
npm run test      # vitest (unit + component)
npm run test:e2e  # playwright (requires: npx playwright install chromium)
```

## Status

No backend (Supabase), authentication, local persistence (IndexedDB), synchronization, or Debt domain logic exists yet — this phase is the frontend platform shell only. See the implementation plan doc for what's next.
