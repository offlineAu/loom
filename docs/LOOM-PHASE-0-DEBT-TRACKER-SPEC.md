# LOOM — Debt Tracker Domain Specification (Phase 0)

Status: **Specification — not yet implemented.** Depends on the platform architecture in `LOOM-PHASE-0-PLATFORM-ARCHITECTURE.md`.

---

## 1. Domain Model

### 1.1 Debt

| Field | Required? | Notes |
|---|---|---|
| `id` | yes | client-generated ULID |
| `tracker_id` | yes | owning tracker |
| `name` | yes | e.g. "Visa Card" |
| `creditor` | no | e.g. "BPI" |
| `original_amount` | yes | the debt's full original principal, stored as integer minor units (centavos) to avoid float error |
| `original_date` | no | when the debt actually began (can predate LOOM by years) |
| `tracking_start_date` | yes | defaults to creation date; when LOOM tracking begins |
| `starting_balance` | no* | see §2 — presence of this field determines the onboarding/calculation mode |
| `interest_rate` | no | APR %, informational for MVP (not used to auto-accrue interest) |
| `minimum_payment` | no | informational |
| `due_day` | no | day-of-month (1–31); a specific `next_due_date` is a possible v2 refinement |
| `status` | derived + one explicit value | `active` / `paid_off` / `overpaid` are derived (§3); `archived` is the only explicit user-set status |
| `notes` | no | free text |

\* `starting_balance` is optional but its presence is load-bearing — see onboarding modes below.

### 1.2 Validation rules

- `original_amount ≥ 0`, stored as an integer (minor currency units), never a float.
- `starting_balance`, if provided, must be `≥ 0`.
- `tracking_start_date ≤` today; `original_date`, if provided, `≤ tracking_start_date` (a debt can't start tracking before it existed) — soft validation with a confirmation override, not a hard block, since users may mis-remember exact dates.
- Currency: one currency per tracker (a `tracker.settings.currency` value, default PHP given LOOM's initial audience), not per-debt. No multi-currency conversion in MVP.
- `name` required, 1–100 chars. All other text fields optional, reasonably length-capped.

---

## 2. Existing Debt Onboarding

Two supported approaches, both producing a valid, well-defined debt — the difference is which fields are populated and which calculation mode results (see §3).

### 2.1 Simple starting state (`starting_balance` mode)

User provides: `original_amount`, `starting_balance` (the balance *as of* `tracking_start_date`), and `tracking_start_date`. They do **not** need to enter any historical payments. From this point forward they record only new payments/adjustments.

Example: original ₱100,000, already paid ₱60,000 before LOOM, tracking starts 2026-09 → `original_amount=100000`, `starting_balance=40000`, `tracking_start_date=2026-09-01`. The ₱60,000 in prior payments is never reconstructed — it's implicitly captured by `starting_balance`.

### 2.2 Historical reconstruction (`full_ledger` mode)

User leaves `starting_balance` unset and instead enters individual historical payment records (each flagged `is_historical=true`, dated before `tracking_start_date`). Balance is derived from `original_amount` minus the *entire* payment ledger, historical and new alike.

### 2.3 Mode selection rule

`starting_balance IS NOT NULL` → **starting_balance mode** (historical payments, if any are entered anyway for record-keeping, are informational only and excluded from the balance formula — see §3 to avoid double-counting).
`starting_balance IS NULL` → **full_ledger mode** (all payments, including historical ones, count toward balance).

This is a derived mode, not a field the user sets directly — it falls out naturally from whether they chose to type a starting balance.

---

## 3. Payment Model

| Field | Required? | Notes |
|---|---|---|
| `id` | yes | client ULID |
| `debt_id` | yes | |
| `payment_date` | yes | |
| `amount` | yes | integer minor units, `> 0` |
| `principal` | no | optional allocation |
| `interest` | no | optional allocation |
| `fees` | no | optional allocation |
| `notes` | no | |
| `is_historical` | yes (default `false`) | marks a payment as pre-tracking-start, informational-only in starting_balance mode |
| `deleted_at` | system | soft delete |

**Allocation rule**: `principal`/`interest`/`fees` are all optional and independent. If all three are provided, they must sum to `amount` within a small rounding tolerance (validated, not silently corrected). If none are provided, the payment is simply an unallocated ₱X payment — this must work with zero friction, since most users won't know the breakdown. Partial allocation (e.g. only `fees` given) is allowed; the unallocated remainder is just not categorized.

---

## 4. Adjustment Model

| Field | Required? | Notes |
|---|---|---|
| `id` | yes | |
| `debt_id` | yes | |
| `adjustment_date` | yes | |
| `amount` | yes | always stored as a **positive magnitude** |
| `direction` | yes | `increase` \| `decrease` — explicit, not inferred from a signed amount |
| `type` | yes | `charge`, `fee`, `interest_capitalization`, `correction_increase`, `correction_decrease`, `other` |
| `reason` | no | short label |
| `notes` | no | free text |

Design decision: **explicit `direction` field + always-positive `amount`**, rather than a signed amount. This reads unambiguously in a ledger/export view ("+₱500 fee" vs "−₱200 correction") and avoids the classic sign-error bug class. `type` defaults `direction` in the UI (e.g. picking "fee" pre-selects `increase`) but `direction` is what the calculation actually uses.

---

## 5. Derived Financial Totals

**Authoritative** (user-entered, source of truth): `debt.original_amount`, `debt.starting_balance` (if set), every `payment`, every `adjustment`.

**Derived** (always computed, never directly editable): `current_balance`, `total_paid`, `progress_pct`, `payoff_state`, `overpaid_amount`.

### 5.1 Starting-balance mode

```
current_balance =
    starting_balance
  + Σ adjustments.amount where direction='increase' AND date ≥ tracking_start_date
  − Σ adjustments.amount where direction='decrease' AND date ≥ tracking_start_date
  − Σ payments.amount   where is_historical=false
```
(Historical payments are excluded here — they're already netted into `starting_balance`.)

### 5.2 Full-ledger mode

```
current_balance =
    original_amount
  + Σ all increase adjustments
  − Σ all decrease adjustments
  − Σ all payments (historical included)
```

### 5.3 Common derivations

```
total_paid      = Σ payments.amount                     (both modes; historical shown separately in UI)
effective_original = original_amount                     (used as the 100% reference point for progress)
progress_pct    = clamp(1 − current_balance / effective_original, 0, 1)   [for display; see overpayment below]
payoff_state    = 'overpaid'  if current_balance < 0
                = 'paid_off'  if current_balance == 0
                = 'active'    otherwise
overpaid_amount = abs(current_balance)  when payoff_state = 'overpaid'
```

These are computed at read time (a pure function over authoritative rows), never stored as a freely-editable column. They may be cached in a materialized/computed column later purely for query performance, but the API never accepts a direct write to `current_balance`.

---

## 6. Editing Behavior

### 6.1 Editing `original_amount` or `starting_balance`

Payments and adjustments are **never** touched or rewritten. Only the derived balance changes. Because this is an impactful edit, show a before/after preview prior to committing:

```
Current original amount:   ₱100,000
New original amount:       ₱120,000
Recorded payments:         ₱15,000
New calculated balance:    ₱105,000   (was ₱85,000)
```

### 6.2 Editing a payment

Updates that row only (`updated_at` bumped); recalculation is automatic and doesn't touch other payments. Changing `is_historical` on a payment can move it between formula buckets (§5.1) — this is expected and the preview should reflect the new balance before commit. An activity/history entry is logged ("Payment edited: ₱5,000 → ₱4,500 on 2026-08-12") using the platform's generic activity-log primitive (§9.1 of the platform doc).

### 6.3 Deleting a payment or adjustment

Soft delete (`deleted_at` set), excluded from all derivations and default list views, but preserved for audit/restore. A "restore" affordance is available from an activity/trash view for MVP simplicity (no need for a separate undo-toast system).

### 6.4 Deleting a debt

Two-tier:
- **Archive** (`archived_at` set): reversible, hides the debt from the active dashboard, preserves all payments/adjustments untouched. This is the default "remove a debt" action.
- **Permanently delete**: only offered from an already-archived debt, requires typed confirmation (e.g. type the debt name), cascades hard-delete of its payments/adjustments. Documented as intentionally destructive and rare.

---

## 7. Overpayment

`current_balance < 0` is **not** shown as a negative debt figure. It is shown as:

```
Paid off
₱20,000 over the original balance
```

with `payoff_state='overpaid'` and `overpaid_amount` computed per §5.3. The dashboard may optionally flag overpaid debts with a neutral "review?" badge (the user may have mis-entered a payment), but this never blocks or auto-corrects anything — it's informational.

---

## 8. Dashboard (list view)

Mobile-first summary, kept intentionally lean (this is a tracker, not a financial-planning analytics product):

- Total original debt (sum across active, non-archived debts)
- Total remaining balance
- Total paid
- Overall progress (single ring/bar)
- Count: active debts, paid-off debts
- Debt list (cards): name, remaining balance, progress bar, next due date if set
- Primary action: "Add Debt"

Explicitly **not** in MVP dashboard: interest projections, amortization schedules, payoff-date forecasting, charts beyond a simple progress indicator. These are legitimate future ideas but not part of a lean tracker MVP.

---

## 9. Debt Detail

Information hierarchy, top to bottom on mobile:

1. Remaining balance (large, primary)
2. Progress bar/ring + payoff state badge
3. **Record Payment** — sticky primary action button
4. Key facts: original amount, paid amount, interest rate, minimum payment, due date
5. Payment history (reverse chronological, paginated/virtualized for long lists)
6. Adjustments history
7. Activity/history log (edits, deletions, restores)
8. Secondary actions: Edit Debt, Archive, Export this debt

---

## 10. CRUD Summary

| Action | Behavior |
|---|---|
| Create debt | onboarding form supports both modes (§2); local-first write |
| View debt | detail page (§9) |
| Edit debt | preview-before-commit for `original_amount`/`starting_balance` changes (§6.1) |
| Archive debt | reversible, default "remove" action |
| Restore archived debt | un-sets `archived_at` |
| Permanently delete debt | only from archived state, typed confirmation, cascades |
| Record payment | primary action; unallocated by default, allocation optional |
| Edit payment | recalculates; logs activity |
| Delete payment | soft delete, restorable |
| Add adjustment | explicit type + direction |
| Edit/delete adjustment | same pattern as payments |

---

## 11. Export

Per the platform Export Engine (writers are generic; this tracker supplies the content):

- **CSV**: one row per payment (and a separate export option for adjustments): debt name, payment date, amount, principal, interest, fees, notes, historical flag.
- **XLSX**: sheets — `Summary` (per-debt totals + overall totals), `Debts` (one row per debt with all fields + derived balance), `Payments`, `Adjustments`.
- **PDF**: per-debt or whole-tracker summary — balance, progress, key facts, payment history table, adjustment history table. Uses the platform's shared PDF template (header, tracker name, generated-date footer) with this tracker's content sections plugged in.

---

## 12. Import (CSV, MVP)

Column mapping targets: `debt name` (matched or created), `payment_date`, `amount`, optionally `principal`/`interest`/`fees`/`notes`/`historical`. Duplicate detection heuristic: same debt + same date + same amount within the batch or against existing records → flagged in the preview as a likely duplicate, user decides to skip or import anyway (never silently deduped). Import runs as a single local transaction (Dexie `bulkAdd` in one transaction; if cloud-backed, the same batch is upserted server-side in one SQL transaction via the sync engine) — a failure partway rolls the whole batch back rather than leaving a partial import.

---

## 13. User Journeys

### 13.1 New user, no existing debt
Create tracker → Add Debt (original_amount only, starting_balance = original_amount implicitly, i.e. nothing paid yet) → Record Payment as it happens.

### 13.2 New user, existing debt, doesn't want to reconstruct history
Add Debt with `original_amount` + `starting_balance` + `tracking_start_date` → done, records new payments going forward.

### 13.3 New user, wants full history
Add Debt with `original_amount` only, `starting_balance` left blank → enters historical payments flagged `is_historical=true` → balance derives from the full ledger.

### 13.4 Correcting a mis-entered original amount
Edit Debt → change `original_amount` → sees before/after preview → confirms → payments untouched, balance recalculated.

### 13.5 Overpaying by mistake or on purpose
Record Payment pushes `current_balance` below zero → detail page shows "Paid off, ₱X over" → user can review/edit the offending payment if it was a mistake.

### 13.6 Offline payment entry
User records a payment with no connectivity → saved locally instantly, `sync_status='pending'` (if cloud-backed) → syncs automatically on reconnect, idempotently (§5.4 of platform doc).

### 13.7 Anonymous → account migration mid-use
User has been tracking 3 debts anonymously for weeks → signs up → all 3 debts + full payment/adjustment history migrate atomically (§5.5 of platform doc) → user continues without re-entering anything.

---

## 14. Edge Cases (must be covered by tests)

- Zero debt (`original_amount = 0`) — immediately `paid_off`.
- Zero payments recorded — `current_balance = original_amount` (or `starting_balance`).
- Partial payment, exact full payment, and overpayment.
- Multiple payments on the same date.
- Editing `original_amount` after payments already exist.
- Editing a payment's amount and its `is_historical` flag.
- Deleting a payment that was the only thing keeping a debt from being `paid_off` (balance should increase back to reflect its removal).
- Adjustment that fully offsets a payment (direction/type combinations).
- Historical payments entered in `starting_balance` mode (must not double-count — informational only).
- Existing-debt onboarding via both modes, verified against the same target balance.
- Offline payment entry followed by sync retry after a simulated network failure (idempotent, no duplicate).
- Anonymous → account migration retried after an interrupted first attempt (no duplicate tracker/debts/payments).
- Archiving and restoring a debt preserves all history untouched.
