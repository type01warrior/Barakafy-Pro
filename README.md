# Barakafy Pro

A personal finance tracker built as a single-file HTML web app, designed to run inside an Android WebView with a native Java bridge — but equally usable as a standalone browser app.

![Barakafy Pro Logo](logo.png)

---

## Features

- **Dashboard** — Summary cards, spending charts (Chart.js), and quick stats
- **Daily Tracker** — Log income and expenses with category, payment type, notes, geo-tag, and emoji
- **Overview** — Monthly/date-range spending overview with filter chips
- **Bank Cards** — Manage multiple bank accounts and credit cards
- **EMI Calculator** — Loan and EMI planning tool
- **Personal** — Personal budget and savings goals
- **Reports** — Visual spending reports by category and period
- **Bills** — Upcoming bill tracking extracted from SMS (via native bridge)
- **Recurring Subscriptions** — Auto-detected from transaction history
- **PIN Lock** — 4-digit PIN screen on app open
- **Dark / Light Mode** — Theme toggle with smooth transitions
- **Voice Add** — Dictate transactions via native speech recognition
- **Receipt Scan (OCR)** — Scan receipts to auto-fill transaction details
- **Google Drive Backup** — AES-256-GCM encrypted backup/restore to your private Drive folder
- **Daily Reminders** — Notification reminder to log transactions (Android AlarmManager + Web Notifications fallback)
- **Geo-tagging** — Attach location to transactions via GPS (native or browser)

---

## Project Structure

```
.
├── index.html       # Complete app — all UI, styles, and logic in one file
├── features.js      # Drop-in module: Quick Add, Subscriptions, Bills, Backup panel
├── patch-index.js   # Node.js patch script — applies targeted bug fixes to index.html
├── index.html.bak   # Auto-generated backup before patch is applied
└── logo.png         # App logo
```

---

## Getting Started

### Browser / Desktop

Just open `index.html` in any modern browser. All core features work without a native bridge. Features that require the Android bridge (SMS-based bills, voice, OCR, Drive backup) will show "Native bridge unavailable" and are silently skipped.

### Android WebView

Serve `index.html` and `features.js` from your app's assets folder. Register a `JavascriptInterface` named `AndroidFeatures` in `MainActivity.java` to expose the native bridge methods listed below.

---

## Applying Patches (`patch-index.js`)

Run once from your project root after pulling updates:

```bash
node patch-index.js
```

This script applies five targeted fixes to `index.html` and writes a backup to `index.html.bak` before making any changes.

| Fix | Description |
|-----|-------------|
| **FIX 1** | Sync button uses CSS theme variables instead of hardcoded `#ffffff` |
| **FIX 2** | Removes duplicate "Restore Data" from the User Menu dropdown |
| **FIX 3** | Geo-tag row: cross-platform `handleGeoRowTap()` — tries Android bridge first, falls back to `navigator.geolocation` |
| **FIX 4** | Footer social icons: `border-radius` changed from `50%` (circle) to `16px` (squircle) |
| **FIX 5** | Daily reminder: dedup guard prevents multiple firings per minute; `saveReminderTime()` handles both Android AlarmManager and Web Notifications API |

If a patch string is not found (already applied or diverged), the script prints a warning and skips that fix — it never crashes or corrupts the file.

---

## `features.js` Integration

`features.js` is a self-contained, zero-dependency drop-in that adds a bottom-sheet panel with four tabs: **Quick Add**, **Subscriptions**, **Bills**, and **Backup**.

### 1. Include the script

```html
<script src="features.js"></script>
```

Place this just before `</body>` in `index.html`.

### 2. Open the panel

```js
window.AppFeatures.openPanel();        // opens on Quick Add tab
window.AppFeatures.openSubscriptions(); // jump straight to Subscriptions
window.AppFeatures.openBills();         // jump straight to Bills
window.AppFeatures.openBackup();        // jump straight to Backup
window.AppFeatures.voiceAdd();          // open panel + start voice capture
window.AppFeatures.scanReceipt();       // open panel + start OCR scan
```

### 3. Wire it to your data

```js
window.AppFeatures.config({
    // Required: feed your saved transactions to the subscription detector
    getSavedTxns: () => myTxnArray, // [{amount, merchant, dateMs, type, category}]

    // Required: called when Voice/OCR resolves a new transaction
    onAddTxn: (txn) => addTransactionToMyApp(txn),

    // Optional: snapshot embedded in the encrypted Drive backup
    getJsState: () => ({
        txnDatabase, accDatabase, emiDatabase, bankDatabase, ccDatabase, appSettings
    }),

    // Optional: called after a successful Drive restore
    onRestore: (snapshot) => {
        // Write snapshot.jsData back to localStorage and reload
    }
});
```

---

## Android Native Bridge

`features.js` communicates with native Android code via `window.AndroidFeatures`. Register a `JavascriptInterface` in your `WebViewClient` with the following methods:

| Method | Description |
|--------|-------------|
| `analyzeRecurring(txnsJson)` | Returns JSON array of detected recurring patterns |
| `getBills()` | Returns JSON array of upcoming bills parsed from SMS |
| `isSignedInWithDrive()` | Returns `true` if the user has a Drive session |
| `describeLatestBackup()` | Calls `window.onBackupDescribe(meta)` asynchronously |
| `backupToDrive(passphrase, stateJson)` | Triggers encrypted backup; result via `window.onBackupResult(r)` |
| `restoreFromDrive(passphrase)` | Triggers restore; result via `window.onRestoreResult(r)` |

For geo-tagging, `window.AndroidBridge.getLocation()` is called; the native side must call `window._geoCallback(lat, lng)` when the location is ready.

For reminders, `window.AndroidBridge.setDailyReminder(hour, minute)` schedules an Android AlarmManager alarm.

---

## Backup & Security

- Backups are stored in the user's **private Drive appdata folder** — not visible in Google Drive UI.
- Encryption: **AES-256-GCM** with **PBKDF2** (200,000 rounds).
- The passphrase never leaves the device. If lost, the backup is unrecoverable — there is no reset.

---

## Data Storage (localStorage keys)

| Key | Contents |
|-----|----------|
| `type01_finance_txns` | Transaction database |
| `type01_finance_accs` | Accounts database |
| `type01_finance_db_v6` | EMI database |
| `type01_finance_banks` | Bank cards database |
| `type01_finance_ccs` | Credit cards database |
| `type01_finance_settings` | App settings |
| `reminder_enabled` | `"true"` / `"false"` |
| `reminder_time` | `"HH:MM"` |
| `reminder_last_fired` | `"YYYY-MM-DD"` (dedup guard) |

---

## Dependencies (CDN)

All loaded via CDN — no build step required.

| Library | Version | Purpose |
|---------|---------|---------|
| [Chart.js](https://www.chartjs.org/) | 4.4.1 | Dashboard and report charts |
| [Font Awesome](https://fontawesome.com/) | 6.4.0 | Icons |
| [Lexend](https://fonts.google.com/specimen/Lexend) | — | Typography |
| [emoji-mart](https://github.com/missive/emoji-mart) | latest | Emoji picker for transaction notes |

---

## Currency

All amounts are displayed in **Indian Rupees (₹)** using `en-IN` locale formatting.
