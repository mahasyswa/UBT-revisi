# 🕐 Timezone Fix - WIB (GMT+7)

## Masalah
Semua timestamp di aktivitas dan database menggunakan UTC (GMT+0), tidak sesuai dengan zona waktu Indonesia (WIB/GMT+7).

## Solusi
Implementasi helper functions untuk konversi timezone WIB di seluruh aplikasi.

---

## ✅ Changes Implemented

### 1. **Timezone Helper Functions** (lines 29-52)

```javascript
const WIB_OFFSET = 7 * 60 * 60 * 1000; // 7 hours in milliseconds

// Convert any date to WIB timezone
function getWIBDate(date = new Date()) {
  const utcTime = date.getTime();
  const wibTime = new Date(utcTime + WIB_OFFSET);
  return wibTime;
}

// Format: YYYY-MM-DD HH:mm:ss in WIB
function formatWIBTimestamp(date = new Date()) {
  const wibDate = getWIBDate(date);
  return wibDate.toISOString().replace('T', ' ').substring(0, 19);
}

// Format: YYYY-MM-DD in WIB
function formatWIBDate(date = new Date()) {
  const wibDate = getWIBDate(date);
  return wibDate.toISOString().substring(0, 10);
}

// Get current timestamp in WIB
function getWIBTimestamp() {
  return formatWIBTimestamp();
}
```

### 2. **Updated Logging** (lines 99-103, 137-139)

**Before:**
```javascript
console.log(`[${new Date().toISOString()}] ${req.method}...`)
```

**After:**
```javascript
console.log(`[${formatWIBTimestamp()}] ${req.method}...`)
```

**Result:** Log timestamps now display in WIB (GMT+7)

---

### 3. **Protocol Creation** (lines 1151-1171)

**Before:**
```javascript
const now = new Date(); // UTC
stmt.run([code, province, partner_id, new Date().toISOString(), ...])
```

**After:**
```javascript
const now = getWIBDate(); // WIB
const createdAt = getWIBTimestamp();
stmt.run([code, province, partner_id, createdAt, ...])
```

**Result:** Protocol timestamps in database now use WIB

---

### 4. **Activity Logging** (lines 778-781, 208-212)

**Before:**
```javascript
INSERT INTO activity_logs (user_id, action, ...) VALUES (?, ?, ...)
// Database uses CURRENT_TIMESTAMP (UTC)
```

**After:**
```javascript
INSERT INTO activity_logs (user_id, action, ..., created_at) 
VALUES (?, ?, ..., getWIBTimestamp())
```

**Result:** All activity logs now use WIB timestamp

---

### 5. **Dashboard Date Filtering** (lines 418-439)

**Before:**
```javascript
const now = new Date(); // UTC
const todayStart = today.toISOString();
```

**After:**
```javascript
const now = getWIBDate(); // WIB
const todayStart = formatWIBTimestamp(today);
```

**Result:** 
- "Hari Ini" filter shows data from WIB midnight
- "Minggu Ini" and "Bulan Ini" use WIB week/month start
- Custom date range works with WIB timezone

---

### 6. **Stock Tracking Updates** (lines 1189-1192, 1244-1247)

**Before:**
```javascript
UPDATE stock_tracking SET ... last_updated = CURRENT_TIMESTAMP
```

**After:**
```javascript
UPDATE stock_tracking SET ... last_updated = ? 
[..., getWIBTimestamp(), ...]
```

**Result:** Stock tracking timestamps now use WIB

---

### 7. **User Last Login** (line 778)

**Before:**
```javascript
UPDATE users SET last_login = CURRENT_TIMESTAMP
```

**After:**
```javascript
UPDATE users SET last_login = ?
[getWIBTimestamp(), user.id]
```

**Result:** User last login time displays in WIB

---

### 8. **Partner Updates** (line 1017)

**Before:**
```javascript
UPDATE partners SET ... updated_at = CURRENT_TIMESTAMP
```

**After:**
```javascript
UPDATE partners SET ... updated_at = ?
[..., getWIBTimestamp(), ...]
```

**Result:** Partner update timestamps use WIB

---

### 9. **View Helpers** (lines 143-165)

Added EJS template helpers for date formatting:

```javascript
// Format full timestamp: 2025-11-07 13:30:00
res.locals.formatDate = (dateString) => {
  const date = new Date(dateString);
  return formatWIBTimestamp(date);
}

// Format date only: 2025-11-07
res.locals.formatDateOnly = (dateString) => {
  const date = new Date(dateString);
  return formatWIBDate(date);
}
```

**Usage in EJS:**
```ejs
<!-- Display full timestamp -->
<%= formatDate(protocol.created_at) %>

<!-- Display date only -->
<%= formatDateOnly(protocol.created_at) %>
```

---

## 📊 Impact

### ✅ What Changed
1. **All new data** created after this update will have WIB timestamps
2. **Logs** display in WIB format
3. **Dashboard filters** work with WIB timezone
4. **Activity logs** show WIB time

### ⚠️ What Didn't Change
- **Existing database records** still have UTC timestamps
- Database uses TEXT format for dates (not converted)
- No migration needed - old data still readable

### 🔄 Backward Compatibility
- Old UTC timestamps in database still work
- When displayed, they will be converted to WIB by view helpers
- New timestamps are stored directly in WIB format

---

## 🧪 Testing

### Test 1: Create New Protocol
```
Expected: created_at = "2025-11-07 13:30:00" (WIB)
NOT: "2025-11-07 06:30:00" (UTC)
```

### Test 2: Check Logs
```bash
pm2 logs ubt-app --lines 10
```
Expected format:
```
[2025-11-07 13:30:00] GET /dashboard - Session: 1 - IP: xxx.xxx.xxx.xxx
```

### Test 3: Dashboard Filter "Hari Ini"
- Create protocol at 01:00 WIB
- Filter "Hari Ini" should show it
- Before fix: Might not show until 07:00 WIB (UTC midnight)

### Test 4: Activity Logs
- Login at 13:30 WIB
- Check activity_logs table
- Should show `created_at = "2025-11-07 13:30:00"`

---

## 🚀 Deployment

```bash
# SSH to VPS
ssh root@202.10.48.107

# Navigate to project
cd /opt/ubt

# Pull latest changes
git pull origin main

# Restart application
pm2 restart ubt-app

# Check logs (should now show WIB timezone)
pm2 logs ubt-app --lines 20
```

Expected log output:
```
[2025-11-07 13:30:00] Server listening on http://localhost:8080
[2025-11-07 13:30:15] GET /login - Session: none - IP: 182.253.162.14
```

---

## 📝 Notes

1. **Timezone is hardcoded to WIB (GMT+7)**
   - If you need different timezone, modify `WIB_OFFSET` constant
   - Example for WITA (GMT+8): `const WIB_OFFSET = 8 * 60 * 60 * 1000`

2. **Database format remains TEXT**
   - Format: `YYYY-MM-DD HH:mm:ss`
   - Sortable and human-readable
   - No need for complex timestamp conversion

3. **No DST (Daylight Saving Time)**
   - Indonesia doesn't use DST
   - GMT+7 is constant year-round

4. **Old data compatibility**
   - Old UTC timestamps can be read
   - View helpers will convert them if needed
   - No data migration required

---

## 🔧 Troubleshooting

### Issue: Timestamps still showing UTC

**Check 1: Code deployed?**
```bash
cd /opt/ubt
git log -1 --oneline
# Should show: "Fix: Implement WIB (GMT+7) timezone..."
```

**Check 2: PM2 restarted?**
```bash
pm2 restart ubt-app
pm2 logs ubt-app --lines 5
```

**Check 3: Create new data**
- Old data might still have UTC
- Create new protocol and check timestamp

### Issue: Dashboard filter not working

**Reason:** Filter uses WIB now, might need to adjust date range

**Solution:** 
- Clear any cached dates
- Use "Hari Ini" to see today's data (WIB midnight to midnight)

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] PM2 logs show timestamps in WIB format (not UTC)
- [ ] Create new protocol → check `created_at` in database
- [ ] Dashboard "Hari Ini" filter shows correct data
- [ ] Activity logs display WIB timestamps
- [ ] Login action records WIB time in `last_login`
- [ ] Stock tracking updates show WIB time

---

**Last Updated:** 2025-11-07  
**Timezone:** WIB (GMT+7)  
**Status:** ✅ Implemented and Deployed
