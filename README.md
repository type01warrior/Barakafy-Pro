# Barakafy Pro

A single-file HTML/CSS/JS personal finance app (dark/light themed, mobile-first, ~9.8k lines) for tracking EMIs, daily transactions, bank accounts, credit cards, and personal finances — with Firebase-backed cloud sync and an optional `features.js` add-on module.

## Tech Stack

- **Fonts/Icons:** Google Fonts (Lexend), Font Awesome 6.4
- **Charts:** Chart.js 4.4.1
- **Emoji picker:** emoji-mart (CDN)
- **Auth/Cloud sync:** Firebase (Auth + Firestore, compat SDK 9.23.0), Google sign-in
- **Local persistence:** `localStorage` (mirrors every Firestore collection so the app works offline)
- **Security:** PIN lock with optional WebAuthn/biometric unlock
- **No build step** — plain HTML/CSS/JS, everything except `features.js` lives in one file

## App Structure

A 7-tab single-page app, controlled by `handleTabClick(tabId)`:

| Tab | data-tab | Purpose |
|---|---|---|
| EMIs | `dashboard` | Loan/EMI dashboard, payment tracking, advance payments |
| Daily Tracker | `daily` | Day-to-day income/expense transactions |
| CC Loop | `overview` | Credit card usage/repayment cycle overview |
| Bank & Cards | `bank-cards` | Bank accounts and credit card management |
| Calculator | `emi-calc` | EMI calculator |
| Personal | `personal` | Personal finance records |
| Reports | `reports` | Charts/analytics (Chart.js) |

## Data Model (all persisted to `localStorage`, synced to Firestore per-user)

| localStorage key | Holds |
|---|---|
| `type01_finance_db_v6` | `emiDatabase` — EMIs/loans |
| `type01_finance_accs` | `accDatabase` — accounts |
| `type01_finance_txns` | `txnDatabase` — transactions |
| `type01_finance_banks` | `bankDatabase` — bank records |
| `type01_finance_ccs` | `ccDatabase` — credit cards |
| `type01_finance_personal` | `personalDatabase` — personal records |
| `type01_finance_settings` | `appSettings` |
| `type01_cats` | `categoryDatabase` |
| `type01_budgets` | `budgetDatabase` |
| `type01_bills` | `billDatabase` |
| `type01_pin` | PIN hash + biometric flag |
| `type01_deleted_sms`, `type01_payments` | supporting/misc state |

`saveToCloud()` (debounced ~1.2s) and `saveToCloudNow()` (immediate) both write all of the above to `localStorage` and then upsert a single Firestore document at `users/{uid}` when a user is signed in.

## Cloud Sync Notes

- Firebase project: `finance-tracker-7a239`
- Sign-in is Google-based; app works fully offline/local when signed out
- There's an explicit self-write-loop guard (comment at line ~2873) to stop Firestore snapshot listeners from re-triggering `saveToCloud()`

## `features.js` Integration

The main file loads an external `features.js` and wires it up via `AppFeatures.config({...})` at the bottom of the page, bridging the app's existing schema to that module:

- **`getSavedTxns()`** — exposes `txnDatabase` in a normalized shape (merchant/amount/date/type/category) for recurring-transaction detection
- **`onAddTxn(parsed)`** — receives parsed transactions from voice entry or receipt OCR and appends them to `txnDatabase`
- **`getJsState()` / `onRestore(snapshot)`** — packages/restores an encrypted backup (EMIs, accounts, txns, banks, cards, settings) via Google Drive

In-app entry point: a "🎤 Voice add transaction" button calls `AppFeatures.voiceAdd()`.

**Note:** `features.js` itself was not included in the upload — this README describes the integration contract the main file expects from it (recurring detection, bills, voice/OCR entry, encrypted Drive backup).

## Security

- Optional PIN lock (SHA-hashed, stored in `type01_pin`)
- Optional biometric unlock via `PublicKeyCredential`/WebAuthn, tried before falling back to PIN
