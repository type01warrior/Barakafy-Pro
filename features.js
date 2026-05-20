/**
 * features.js — Drop-in UI for Recurring / Bills / Voice / OCR / Backup
 * ──────────────────────────────────────────────────────────────────────
 * USAGE:
 *   1. Add <script src="features.js"></script> just before </body> in index.html.
 *   2. Add a button anywhere that calls window.AppFeatures.openPanel().
 *   3. Tell AppFeatures how to read your saved transactions:
 *        window.AppFeatures.config({
 *          getSavedTxns: () => YOUR_TXN_ARRAY,   // [{amount, merchant, dateMs, type, category}]
 *          onAddTxn:     (txn) => YOUR_ADD_FN(txn),
 *          getJsState:   () => ({...}),          // optional, will be embedded in backup
 *          onRestore:    (snapshot) => {...}     // optional, called after restore
 *        });
 *
 * No bundler, no framework. Vanilla JS + Bridge calls.
 * Bridge namespace = window.AndroidFeatures (registered in MainActivity.java).
 */
(function () {
    'use strict';

    if (window.AppFeatures) return;   // idempotent

    const Bridge = () => window.AndroidFeatures || null;
    const cfg = {
        getSavedTxns: () => [],
        onAddTxn:     null,
        getJsState:   () => ({}),
        onRestore:    null
    };

    // ── Styles (one-shot inject) ────────────────────────────────────────────
    const STYLE = `
    .ftpx-mask{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:flex-end;justify-content:center;}
    .ftpx{background:#fff;color:#111;width:100%;max-width:640px;max-height:92vh;border-radius:18px 18px 0 0;
          display:flex;flex-direction:column;overflow:hidden;animation:ftpx-up .25s ease-out;font-family:-apple-system,Segoe UI,Roboto,sans-serif;}
    @keyframes ftpx-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
    .ftpx h2{margin:0;font-size:18px;padding:14px 16px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;}
    .ftpx-x{background:none;border:none;font-size:22px;cursor:pointer;color:#666;}
    .ftpx-tabs{display:flex;border-bottom:1px solid #eee;overflow-x:auto;}
    .ftpx-tab{flex:1;min-width:90px;padding:12px 8px;font-size:13px;border:none;background:none;color:#666;cursor:pointer;border-bottom:2px solid transparent;}
    .ftpx-tab.on{color:#0a7;border-bottom-color:#0a7;font-weight:600;}
    .ftpx-body{flex:1;overflow-y:auto;padding:14px 16px;}
    .ftpx-card{background:#f7f7f8;border-radius:12px;padding:12px;margin-bottom:10px;}
    .ftpx-card .row{display:flex;justify-content:space-between;align-items:center;gap:8px;}
    .ftpx-card .merchant{font-weight:600;}
    .ftpx-muted{color:#777;font-size:12px;}
    .ftpx-btn{background:#0a7;color:#fff;border:none;padding:10px 14px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;}
    .ftpx-btn.alt{background:#eee;color:#333;}
    .ftpx-btn.danger{background:#e44;}
    .ftpx-btn:disabled{opacity:.5;cursor:default;}
    .ftpx-input{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin:6px 0;box-sizing:border-box;}
    .ftpx-overdue{color:#c00;font-weight:600;}
    .ftpx-pill{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;background:#ddd;color:#333;}
    .ftpx-pill.warn{background:#fde0c2;color:#a30;}
    .ftpx-pill.ok{background:#d4f5d4;color:#073;}
    .ftpx-empty{text-align:center;color:#888;padding:32px 16px;font-size:13px;}
    .ftpx-tile{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #e5e5e5;border-radius:12px;margin-bottom:10px;cursor:pointer;background:#fff;}
    .ftpx-tile:active{background:#f0f0f0;}
    .ftpx-tile .ico{font-size:24px;width:32px;text-align:center;}
    .ftpx-tile .meta{flex:1;}
    .ftpx-tile .meta b{display:block;font-size:14px;}
    .ftpx-tile .meta span{font-size:12px;color:#666;}
    @media (prefers-color-scheme: dark) {
      .ftpx{background:#1c1c1e;color:#eee;}
      .ftpx h2{border-color:#333;}
      .ftpx-tabs{border-color:#333;}
      .ftpx-card{background:#2a2a2c;}
      .ftpx-tile{background:#2a2a2c;border-color:#333;color:#eee;}
      .ftpx-input{background:#2a2a2c;border-color:#444;color:#eee;}
      .ftpx-btn.alt{background:#333;color:#eee;}
    }`;

    function injectStyle() {
        if (document.getElementById('ftpx-style')) return;
        const s = document.createElement('style');
        s.id = 'ftpx-style';
        s.textContent = STYLE;
        document.head.appendChild(s);
    }

    // ── DOM helpers ─────────────────────────────────────────────────────────
    const h = (tag, attrs, ...children) => {
        const el = document.createElement(tag);
        if (attrs) for (const k in attrs) {
            if (k === 'class') el.className = attrs[k];
            else if (k.startsWith('on') && typeof attrs[k] === 'function') el[k.toLowerCase()] = attrs[k];
            else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
        }
        for (const c of children) {
            if (c == null) continue;
            el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        }
        return el;
    };

    const fmtRupees = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const fmtDate   = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const daysFrom  = (ms) => Math.round((ms - Date.now()) / 86400000);

    // ── Tab content renderers ───────────────────────────────────────────────

    function renderSubscriptions(body) {
        body.innerHTML = '';
        const txns = cfg.getSavedTxns() || [];
        if (!txns.length) {
            body.appendChild(h('div', { class: 'ftpx-empty' }, 'No saved transactions yet — subscriptions are detected after a few months of data.'));
            return;
        }
        const b = Bridge();
        if (!b || !b.analyzeRecurring) {
            body.appendChild(h('div', { class: 'ftpx-empty' }, 'Native bridge unavailable.'));
            return;
        }
        const json = b.analyzeRecurring(JSON.stringify(txns));
        let subs = [];
        try { subs = JSON.parse(json); } catch (_) {}
        if (!subs.length) {
            body.appendChild(h('div', { class: 'ftpx-empty' }, 'No recurring patterns detected yet.\nNeeds at least 3 occurrences of the same merchant.'));
            return;
        }
        const totalMonthly = subs.reduce((s, x) => {
            const monthly = x.periodDays > 0 ? (x.avgAmount * 30 / x.periodDays) : 0;
            return s + monthly;
        }, 0);
        body.appendChild(h('div', { class: 'ftpx-card' },
            h('div', { class: 'row' },
                h('span', null, 'Estimated monthly cost'),
                h('span', { class: 'merchant' }, fmtRupees(totalMonthly)))));
        for (const s of subs) {
            const days = Math.round(s.daysUntilNext);
            const overdue = s.isOverdue;
            const pill = h('span', { class: 'ftpx-pill ' + (overdue ? 'warn' : 'ok') },
                overdue ? 'overdue' : days === 0 ? 'today' : days + 'd');
            body.appendChild(h('div', { class: 'ftpx-card' },
                h('div', { class: 'row' },
                    h('span', { class: 'merchant' }, s.merchant),
                    h('span', { class: 'merchant' }, fmtRupees(s.avgAmount))),
                h('div', { class: 'row' },
                    h('span', { class: 'ftpx-muted' }, s.period + ' • ' + s.occurrences + ' occurrences'),
                    pill),
                h('div', { class: 'ftpx-muted' }, 'Next: ' + fmtDate(s.nextDueMs))));
        }
    }

    function renderBills(body) {
        body.innerHTML = '';
        const b = Bridge();
        if (!b || !b.getBills) {
            body.appendChild(h('div', { class: 'ftpx-empty' }, 'Native bridge unavailable.'));
            return;
        }
        let bills = [];
        try { bills = JSON.parse(b.getBills()); } catch (_) {}
        bills = bills.filter(x => !x.paid).sort((a, b) => a.dueMs - b.dueMs);
        if (!bills.length) {
            body.appendChild(h('div', { class: 'ftpx-empty' }, 'No upcoming bills detected.\nThey\'re extracted from your bank/utility SMS automatically.'));
            return;
        }
        for (const bill of bills) {
            const days = daysFrom(bill.dueMs);
            const dueText = days < 0 ? Math.abs(days) + ' days overdue'
                            : days === 0 ? 'Due today'
                            : days === 1 ? 'Due tomorrow'
                            : 'Due in ' + days + ' days';
            const amount = bill.amount > 0 ? fmtRupees(bill.amount)
                          : bill.minAmount > 0 ? 'Min ' + fmtRupees(bill.minAmount)
                          : 'Amount unknown';
            const card = h('div', { class: 'ftpx-card' },
                h('div', { class: 'row' },
                    h('span', { class: 'merchant' }, bill.issuer + ' (' + bill.billType.replace('_',' ') + ')'),
                    h('span', { class: 'merchant' }, amount)),
                h('div', { class: 'row' },
                    h('span', { class: days < 0 ? 'ftpx-overdue' : 'ftpx-muted' }, dueText + ' • ' + fmtDate(bill.dueMs)),
                    bill.account ? h('span', { class: 'ftpx-pill' }, '…' + bill.account.slice(-4)) : null),
                h('div', { class: 'row', style: 'margin-top:10px;gap:8px;' },
                    h('button', {
                        class: 'ftpx-btn',
                        onclick: () => { b.markBillPaid(bill.id); renderBills(body); }
                    }, 'Mark paid'),
                    h('button', {
                        class: 'ftpx-btn alt',
                        onclick: () => { b.dismissBill(bill.id); renderBills(body); }
                    }, 'Dismiss')));
            body.appendChild(card);
        }
    }

    function renderQuickAdd(body) {
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'ftpx-tile', onclick: voiceCapture },
            h('span', { class: 'ico' }, '🎤'),
            h('div', { class: 'meta' },
                h('b', null, 'Voice add'),
                h('span', null, 'Speak: "spent 250 on coffee at Starbucks"'))));
        body.appendChild(h('div', { class: 'ftpx-tile', onclick: receiptScan },
            h('span', { class: 'ico' }, '🧾'),
            h('div', { class: 'meta' },
                h('b', null, 'Scan receipt'),
                h('span', null, 'Pick a photo, ML Kit extracts the amount'))));
        const status = h('div', { class: 'ftpx-muted', style: 'margin-top:14px;' });
        body.appendChild(status);
    }

    function voiceCapture() {
        const b = Bridge();
        if (!b || !b.startVoiceCapture) return alert('Voice capture not available.');
        window.onVoiceTxnParsed = (result) => {
            if (!result || !result.ok) {
                alert('Voice not understood: ' + (result && result.reason || 'unknown'));
                return;
            }
            confirmAndAdd(result, 'Voice');
        };
        b.startVoiceCapture();
    }

    function receiptScan() {
        const b = Bridge();
        if (!b || !b.pickReceiptForOcr) return alert('OCR not available.');
        window.onReceiptScanned = (result) => {
            if (!result || !result.ok) {
                alert('Couldn\'t read amount from this image.');
                return;
            }
            confirmAndAdd(result, 'Receipt');
        };
        b.pickReceiptForOcr();
    }

    function confirmAndAdd(parsed, source) {
        const txt = source + ' detected:\n\n'
            + 'Amount: ' + fmtRupees(parsed.amount) + '\n'
            + 'Merchant: ' + (parsed.merchant || '?') + '\n'
            + (parsed.category ? 'Category: ' + parsed.category + '\n' : '')
            + '\nAdd this transaction?';
        if (!confirm(txt)) return;
        if (typeof cfg.onAddTxn === 'function') {
            cfg.onAddTxn({
                amount: parsed.amount,
                merchant: parsed.merchant || source,
                category: parsed.category || 'Other',
                type: parsed.type || 'debit',
                txnType: parsed.txnType || 'Expense',
                dateMs: parsed.dateMs || Date.now(),
                source: source.toLowerCase()
            });
            alert('Transaction added.');
        } else {
            alert('No onAddTxn handler configured. Wire it via AppFeatures.config({onAddTxn:...}).');
        }
    }

    function renderBackup(body) {
        body.innerHTML = '';
        const b = Bridge();
        if (!b || !b.isSignedInWithDrive) {
            body.appendChild(h('div', { class: 'ftpx-empty' }, 'Native bridge unavailable.'));
            return;
        }

        const signedIn = !!b.isSignedInWithDrive();
        const status = h('div', { class: 'ftpx-card' },
            h('div', null, 'Google Drive: ' + (signedIn ? 'signed in ✓' : 'not signed in')),
            h('div', { class: 'ftpx-muted' }, signedIn
                ? 'Backups are stored encrypted in your private Drive appdata folder.'
                : 'Sign in via the existing Google Sign-In flow first, then return here.'));
        body.appendChild(status);

        const lastInfo = h('div', { class: 'ftpx-muted', style: 'margin:6px 0 12px;' }, 'Checking last backup…');
        body.appendChild(lastInfo);
        if (signedIn) {
            window.onBackupDescribe = (meta) => {
                if (!meta) { lastInfo.textContent = 'No previous backup on Drive.'; return; }
                lastInfo.textContent = 'Last backup: ' + new Date(meta.modifiedTime).toLocaleString()
                    + ' (' + Math.round((meta.size || 0) / 1024) + ' KB)';
            };
            try { b.describeLatestBackup(); } catch (_) { lastInfo.textContent = ''; }
        } else {
            lastInfo.textContent = '';
        }

        const pwd = h('input', { class: 'ftpx-input', type: 'password',
            placeholder: 'Passphrase (≥ 6 chars) — REMEMBER THIS' });
        body.appendChild(pwd);

        const log = h('div', { class: 'ftpx-muted', style: 'min-height:18px;margin-top:8px;' });

        const setupCallbacks = () => {
            window.onBackupResult = (r) => {
                if (r.ok) log.textContent = '✓ Backed up (' + Math.round((r.sizeBytes || 0) / 1024) + ' KB).';
                else log.textContent = '✗ ' + (r.reason || 'error') + (r.message ? ': ' + r.message : '');
            };
            window.onRestoreResult = (r) => {
                if (!r.ok) { log.textContent = '✗ ' + (r.reason || 'error'); return; }
                log.textContent = '✓ Restored.';
                if (typeof cfg.onRestore === 'function') {
                    try { cfg.onRestore(r.snapshot); } catch (e) { console.error(e); }
                }
            };
            window.onDriveAuthResolved = (ok) => {
                log.textContent = ok ? 'Drive consent granted — please tap Backup again.' : 'Consent declined.';
            };
        };

        const row = h('div', { class: 'row', style: 'margin-top:10px;gap:8px;' },
            h('button', { class: 'ftpx-btn', onclick: () => {
                const p = pwd.value || '';
                if (p.length < 6) { log.textContent = 'Passphrase must be ≥ 6 chars.'; return; }
                setupCallbacks();
                log.textContent = 'Backing up…';
                const state = (typeof cfg.getJsState === 'function') ? cfg.getJsState() : {};
                try { b.backupToDrive(p, JSON.stringify(state || {})); }
                catch (e) { log.textContent = 'Backup failed: ' + e.message; }
            } }, 'Backup now'),
            h('button', { class: 'ftpx-btn alt', onclick: () => {
                const p = pwd.value || '';
                if (!p) { log.textContent = 'Enter the same passphrase you used to back up.'; return; }
                if (!confirm('Restore overwrites local data with the latest Drive backup. Continue?')) return;
                setupCallbacks();
                log.textContent = 'Restoring…';
                try { b.restoreFromDrive(p); }
                catch (e) { log.textContent = 'Restore failed: ' + e.message; }
            } }, 'Restore'));
        body.appendChild(row);
        body.appendChild(log);

        body.appendChild(h('div', { class: 'ftpx-muted', style: 'margin-top:18px;font-size:11px;' },
            'Encryption: AES-256-GCM with PBKDF2 (200 000 rounds). The passphrase never leaves your device. ' +
            'Forget it and the backup is unrecoverable — there is no reset.'));
    }

    // ── Panel shell ─────────────────────────────────────────────────────────
    function openPanel(initialTab) {
        injectStyle();
        const tabs = [
            ['add',    'Quick add',     renderQuickAdd],
            ['subs',   'Subscriptions', renderSubscriptions],
            ['bills',  'Bills',         renderBills],
            ['backup', 'Backup',        renderBackup]
        ];
        let current = initialTab || 'add';

        const body = h('div', { class: 'ftpx-body' });
        const tabBar = h('div', { class: 'ftpx-tabs' });
        tabs.forEach(([id, label]) => {
            tabBar.appendChild(h('button', {
                class: 'ftpx-tab' + (id === current ? ' on' : ''),
                onclick: () => switchTab(id)
            }, label));
        });

        function switchTab(id) {
            current = id;
            Array.from(tabBar.children).forEach((b, i) => {
                b.className = 'ftpx-tab' + (tabs[i][0] === id ? ' on' : '');
            });
            const tab = tabs.find(t => t[0] === id);
            if (tab) tab[2](body);
        }

        const panel = h('div', { class: 'ftpx' },
            h('h2', null, 'Tools',
                h('button', { class: 'ftpx-x', onclick: close }, '×')),
            tabBar,
            body);
        const mask = h('div', { class: 'ftpx-mask', onclick: (e) => { if (e.target === mask) close(); } }, panel);
        document.body.appendChild(mask);
        switchTab(current);

        function close() {
            mask.remove();
            // Clear bridge callbacks so stale ones don't fire after close.
            ['onVoiceTxnParsed','onReceiptScanned','onBackupResult','onRestoreResult',
             'onBackupDescribe','onDriveAuthResolved'].forEach(k => { try { delete window[k]; } catch(_){} });
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────
    window.AppFeatures = {
        config(opts) {
            if (!opts) return;
            for (const k in opts) if (k in cfg) cfg[k] = opts[k];
        },
        openPanel,
        // Direct shortcuts for power users:
        openSubscriptions: () => openPanel('subs'),
        openBills:         () => openPanel('bills'),
        openBackup:        () => openPanel('backup'),
        voiceAdd:          () => { openPanel('add'); voiceCapture(); },
        scanReceipt:       () => { openPanel('add'); receiptScan(); },
        // Background helpers:
        analyzeRecurring(savedTxns) {
            const b = Bridge();
            if (!b || !b.analyzeRecurring) return [];
            try { return JSON.parse(b.analyzeRecurring(JSON.stringify(savedTxns || []))); }
            catch (_) { return []; }
        },
        getBills() {
            const b = Bridge();
            if (!b || !b.getBills) return [];
            try { return JSON.parse(b.getBills()); }
            catch (_) { return []; }
        }
    };
})();
