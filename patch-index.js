/**
 * patch-index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Run ONCE from your project root (where index.html lives):
 *
 *   node patch-index.js
 *
 * This script applies all five targeted fixes to index.html:
 *   FIX 1 — Sync button theme (remove hardcoded white bg)
 *   FIX 2 — Remove duplicate "Restore Data" from User Menu
 *   FIX 3 — Geolocation: cross-platform tagLocation() + handleGeoRowTap()
 *   FIX 4 — Footer icon shape: circle → sqcircle
 *   FIX 5 — Daily reminder: reliable startReminderCheck + saveReminderTime
 *
 * A backup is written to index.html.bak before any changes are made.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, 'index.html');
const BAK  = SRC + '.bak';

if (!fs.existsSync(SRC)) {
    console.error('❌  index.html not found in', __dirname);
    process.exit(1);
}

// Back up first
fs.copyFileSync(SRC, BAK);
console.log('📦  Backup written to index.html.bak');

let html = fs.readFileSync(SRC, 'utf8');
let changeCount = 0;

// ─── Helper ──────────────────────────────────────────────────────────────────
function replace(label, search, replacement) {
    if (!html.includes(search)) {
        console.warn(`⚠️   [${label}] Search string NOT FOUND — skipped`);
        return;
    }
    html = html.replace(search, replacement);
    changeCount++;
    console.log(`✅  [${label}] Applied`);
}

// ═════════════════════════════════════════════════════════════════════════════
//  FIX 1 — Sync button: remove hardcoded white background, use CSS variables
// ═════════════════════════════════════════════════════════════════════════════
replace(
    'FIX 1 — sqcircle-btn background',
    // SEARCH (exact block from your file)
    `.sqcircle-btn {
            width: 42px; height: 42px;
            border-radius: 12px;
            background: #ffffff;
            border: none;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06);
            transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s;
            -webkit-tap-highlight-color: transparent;
            padding: 0;
            position: relative; overflow: hidden;
        }
        .sqcircle-btn:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.22); transform: translateY(-1px); }
        .sqcircle-btn:active { transform: scale(0.93); box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
        .sqcircle-btn img {
            width: 26px; height: 26px;
            object-fit: contain;
            filter: invert(1);          /* PNG is white-on-black → flip to black-on-white */
            mix-blend-mode: multiply;   /* blend against white bg for clean edges */
            display: block;
        }
        /* Refresh button — spinning state */
        .sqcircle-btn.syncing .refresh-icon { animation: spinBtn 0.7s linear infinite; }
        @keyframes spinBtn { to { transform: rotate(360deg); } }
        .refresh-icon { font-size: 17px; color: #1e1e1e; transition: color 0.2s; display: block; }
        .sqcircle-btn.sync-ok   .refresh-icon { color: #16a34a; }
        .sqcircle-btn.sync-err  .refresh-icon { color: #dc2626; }`,

    // REPLACEMENT — theme-aware
    `.sqcircle-btn {
            width: 42px; height: 42px;
            border-radius: 12px;
            background: var(--card-bg);            /* FIX 1: theme-aware, was #ffffff */
            border: 1px solid var(--border-color); /* matches other header icon buttons */
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; flex-shrink: 0;
            box-shadow: 0 2px 6px rgba(0,0,0,0.10);
            transition: transform 0.15s ease, box-shadow 0.15s ease,
                        background 0.3s, border-color 0.3s;
            -webkit-tap-highlight-color: transparent;
            padding: 0;
            position: relative; overflow: hidden;
        }
        .sqcircle-btn:hover {
            border-color: var(--accent-blue);
            box-shadow: 0 4px 14px rgba(0,0,0,0.18);
            transform: translateY(-1px);
        }
        .sqcircle-btn:active { transform: scale(0.93); box-shadow: 0 1px 4px rgba(0,0,0,0.10); }
        .sqcircle-btn img {
            width: 26px; height: 26px;
            object-fit: contain;
            display: block;
        }
        /* Refresh button — spinning state */
        .sqcircle-btn.syncing .refresh-icon { animation: spinBtn 0.7s linear infinite; }
        @keyframes spinBtn { to { transform: rotate(360deg); } }
        /* FIX 1: icon color follows theme */
        .refresh-icon { font-size: 17px; color: var(--text-primary); transition: color 0.2s; display: block; }
        .sqcircle-btn.sync-ok   .refresh-icon { color: #16a34a; }
        .sqcircle-btn.sync-err  .refresh-icon { color: #dc2626; }`
);

// ═════════════════════════════════════════════════════════════════════════════
//  FIX 2 — Remove "Restore Data" from User Menu dropdown only
// ═════════════════════════════════════════════════════════════════════════════
replace(
    'FIX 2 — Remove Restore Data from User Menu',
    `                        <!-- Restore -->
                        <button class="um-item" style="color:var(--text-primary);" onclick="closeUserMenu(); openImportModal();">
                            <div class="um-item-icon" style="background:rgba(20,184,166,0.10);color:#14b8a6;"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <span>Restore Data</span>
                        </button>

                        <div class="um-divider"></div>`,

    // Keep only the divider, remove the button
    `                        <!-- FIX 2: "Restore Data" removed from User Menu. Use Settings instead. -->

                        <div class="um-divider"></div>`
);

// ═════════════════════════════════════════════════════════════════════════════
//  FIX 3 — Geolocation: make geo-tag row tap handler smart
// ═════════════════════════════════════════════════════════════════════════════

// 3a — Change the onclick on the geo-tag row div
replace(
    'FIX 3 — geoTagRow onclick',
    `<div class="geo-tag-row" id="geoTagRow" onclick="tagLocation()">`,
    `<div class="geo-tag-row" id="geoTagRow" onclick="handleGeoRowTap()">`
);

// 3b — Replace the tagLocation() JS function + add handleGeoRowTap()
replace(
    'FIX 3 — tagLocation() function body',
    `    // ── 4. GEO-TAGGING ─────────────────────────────────────
    function tagLocation() {
        if (!navigator.geolocation) { alert('Geolocation not supported on this device.'); return; }
        const row = document.getElementById('geoTagRow');
        const lbl = document.getElementById('geoTagLabel');
        lbl.innerText = 'Getting location…';
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude.toFixed(5);
            const lng = pos.coords.longitude.toFixed(5);
            document.getElementById('txnLat').value = lat;
            document.getElementById('txnLng').value = lng;
            // Reverse geocode using OpenStreetMap Nominatim
            fetch(\`https://nominatim.openstreetmap.org/reverse?lat=\${lat}&lon=\${lng}&format=json\`)
                .then(r => r.json())
                .then(d => {
                    const name = d.address ? (d.address.suburb || d.address.neighbourhood || d.address.city_district || d.address.city || 'Location tagged') : 'Location tagged';
                    document.getElementById('txnLocName').value = name;
                    lbl.innerText = \`📍 \${name}\`;
                    row.className = 'geo-tag-row tagged';
                }).catch(() => {
                    document.getElementById('txnLocName').value = \`\${lat}, \${lng}\`;
                    lbl.innerText = \`📍 \${lat}, \${lng}\`;
                    row.className = 'geo-tag-row tagged';
                });
        }, () => { lbl.innerText = 'Tap to tag location'; alert('Could not get location. Enable GPS and try again.'); });
    }`,

    `    // ── 4. GEO-TAGGING  (FIX 3) ────────────────────────────
    /**
     * handleGeoRowTap()
     * • If already tagged  → open the saved coordinates in Google Maps
     * • If not yet tagged  → start the location-acquisition flow
     */
    function handleGeoRowTap() {
        const lat = document.getElementById('txnLat').value;
        const lng = document.getElementById('txnLng').value;
        if (lat && lng) {
            // Already tagged — open in Google Maps
            const url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
            if (window.AndroidBridge && typeof window.AndroidBridge.openUrl === 'function') {
                window.AndroidBridge.openUrl(url);
            } else {
                window.open(url, '_blank');
            }
        } else {
            tagLocation();
        }
    }

    /**
     * tagLocation()
     * Cross-platform geolocation:
     *   Android WebView → calls AndroidBridge.getLocation()
     *                      result comes back via window._geoCallback(lat, lng)
     *   Desktop / browser-enabled WebView → navigator.geolocation standard API
     */
    function tagLocation() {
        const row = document.getElementById('geoTagRow');
        const lbl = document.getElementById('geoTagLabel');
        lbl.innerText = 'Getting location…';

        function onSuccess(lat, lng) {
            document.getElementById('txnLat').value = lat;
            document.getElementById('txnLng').value = lng;
            // Reverse geocode via OpenStreetMap Nominatim
            fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json')
                .then(r => r.json())
                .then(d => {
                    const name = d.address
                        ? (d.address.suburb || d.address.neighbourhood ||
                           d.address.city_district || d.address.city || 'Location tagged')
                        : 'Location tagged';
                    document.getElementById('txnLocName').value = name;
                    lbl.innerText = '📍 ' + name;
                    row.className = 'geo-tag-row tagged';
                })
                .catch(() => {
                    document.getElementById('txnLocName').value = lat + ', ' + lng;
                    lbl.innerText = '📍 ' + lat + ', ' + lng;
                    row.className = 'geo-tag-row tagged';
                });
        }

        function onFail(msg) {
            lbl.innerText = 'Tap to tag location';
            alert(msg || 'Could not get location. Enable GPS and try again.');
        }

        // ── Android WebView path ──────────────────────────────────────
        if (window.AndroidBridge && typeof window.AndroidBridge.getLocation === 'function') {
            // One-shot callback; Java calls window._geoCallback(lat, lng)
            window._geoCallback = function(lat, lng) {
                window._geoCallback = null; // clear after use
                if (lat && lng) {
                    onSuccess(parseFloat(lat).toFixed(5), parseFloat(lng).toFixed(5));
                } else {
                    onFail('Location unavailable. Please enable GPS and grant Location permission, then try again.');
                }
            };
            window.AndroidBridge.getLocation();
            return;
        }

        // ── Desktop / standard browser path ──────────────────────────
        if (!navigator.geolocation) {
            onFail('Geolocation is not supported on this device.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => onSuccess(pos.coords.latitude.toFixed(5),
                             pos.coords.longitude.toFixed(5)),
            ()  => onFail('Could not get location. Enable GPS and try again.')
        );
    }`
);

// ═════════════════════════════════════════════════════════════════════════════
//  FIX 4 — Footer social icons: circle → sqcircle
// ═════════════════════════════════════════════════════════════════════════════
replace(
    'FIX 4 — social-icon border-radius',
    `.social-icon { width: 54px; height: 54px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 24px; text-decoration: none; transition: 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }`,
    `.social-icon { width: 54px; height: 54px; border-radius: 16px; /* FIX 4: sqcircle, was 50% */ display: flex; justify-content: center; align-items: center; font-size: 24px; text-decoration: none; transition: 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }`
);

// ═════════════════════════════════════════════════════════════════════════════
//  FIX 5 — Daily reminder: startReminderCheck with dedup guard
// ═════════════════════════════════════════════════════════════════════════════

// 5a — Replace startReminderCheck()
replace(
    'FIX 5 — startReminderCheck()',
    `function startReminderCheck() {
    if (reminderInterval) clearInterval(reminderInterval);
    
    reminderInterval = setInterval(() => {
        const isEnabled = localStorage.getItem('reminder_enabled') === 'true';
        const setTime = localStorage.getItem('reminder_time');
        
        if (isEnabled && setTime) {
            const now = new Date();
            const currentTime = now.getHours().toString().padStart(2, '0') + ":" + 
                              now.getMinutes().toString().padStart(2, '0');
            
            if (currentTime === setTime) {
                sendReminderNotification();
            }
        }
    }, 60000); 
}`,

    `function startReminderCheck() {
    if (reminderInterval) clearInterval(reminderInterval);

    function checkNow() {
        const isEnabled = localStorage.getItem('reminder_enabled') === 'true';
        const setTime   = localStorage.getItem('reminder_time');
        if (!isEnabled || !setTime) return;

        const now = new Date();
        const currentTime = now.getHours().toString().padStart(2,'0') + ':' +
                            now.getMinutes().toString().padStart(2,'0');

        if (currentTime === setTime) {
            // FIX 5: guard against firing multiple times within the same minute
            const lastFired = localStorage.getItem('reminder_last_fired');
            const todayKey  = now.toISOString().slice(0, 10); // YYYY-MM-DD
            if (lastFired !== todayKey) {
                localStorage.setItem('reminder_last_fired', todayKey);
                sendReminderNotification();
            }
        }
    }

    checkNow(); // check immediately on enable
    reminderInterval = setInterval(checkNow, 30000); // every 30 s for fast pick-up
}`
);

// 5b — Replace saveReminderTime() with platform-aware version
replace(
    'FIX 5 — saveReminderTime()',
    `function saveReminderTime() {
    const time = document.getElementById('reminderTime').value;
    localStorage.setItem('reminder_time', time);
    
    if (time && window.AndroidBridge && window.AndroidBridge.setDailyReminder) {
        const [hour, minute] = time.split(':');
        // This triggers the Java code in MainActivity
        window.AndroidBridge.setDailyReminder(parseInt(hour), parseInt(minute));
    }
}`,

    `function saveReminderTime() {
    const time = document.getElementById('reminderTime').value;
    if (!time) { alert('Please select a time first.'); return; }
    localStorage.setItem('reminder_time', time);

    // ── Android: delegate entirely to AlarmManager via Java bridge ──────
    if (window.AndroidBridge && typeof window.AndroidBridge.setDailyReminder === 'function') {
        const [hour, minute] = time.split(':').map(Number);
        window.AndroidBridge.setDailyReminder(hour, minute);
        // Toast is shown by Java; restart JS check as lightweight fallback
        startReminderCheck();
        return;
    }

    // ── Desktop / web: use Web Notifications API ─────────────────────────
    if (typeof Notification === 'undefined') {
        alert('Notifications are not supported in this browser.');
        return;
    }
    if (Notification.permission === 'granted') {
        startReminderCheck();
        alert('✅ Reminder set for ' + time);
    } else {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                startReminderCheck();
                alert('✅ Reminder set for ' + time);
            } else {
                alert('Please allow notifications in your browser settings to receive reminders.');
            }
        });
    }
}`
);

// ═════════════════════════════════════════════════════════════════════════════
//  Write output
// ═════════════════════════════════════════════════════════════════════════════
fs.writeFileSync(SRC, html, 'utf8');
console.log('\n────────────────────────────────────────────');
console.log(`✅  Done — ${changeCount} of 7 changes applied to index.html`);
if (changeCount < 7) {
    console.warn('⚠️   Some patches were skipped (strings not found).');
    console.warn('     Check the ⚠️  warnings above and apply those changes manually.');
}
console.log('────────────────────────────────────────────\n');
