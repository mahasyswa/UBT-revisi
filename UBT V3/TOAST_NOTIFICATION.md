# 🔔 Toast Notification System

Sistem notifikasi cantik dan modern untuk semua tindakan user di aplikasi.

---

## ✨ Features

### 1. **4 Tipe Notifikasi**
- ✅ **Success** (hijau) - Aksi berhasil
- ❌ **Error** (merah) - Terjadi kesalahan
- ⚠️ **Warning** (kuning) - Peringatan
- ℹ️ **Info** (biru) - Informasi

### 2. **Desain Modern**
- Gradient background sesuai tipe
- Smooth slide-in/out animation
- Icon cantik dengan shadow
- Progress bar otomatis
- Hover effect
- Responsive mobile
- Dark mode support

### 3. **Auto Integration**
- Otomatis membaca URL parameters (`?success=`, `?error=`, dll)
- Clean URL setelah show notification
- Intercept form submissions
- Auto-detect AJAX responses
- Socket.io real-time updates support

---

## 🚀 Usage

### Basic Usage

```javascript
// Success notification
showSuccessToast('Berhasil!', 'Data berhasil disimpan');

// Error notification
showErrorToast('Error!', 'Gagal menyimpan data');

// Warning notification
showWarningToast('Peringatan!', 'Data sudah ada');

// Info notification
showInfoToast('Info', 'Proses sedang berjalan');
```

### Advanced Usage

```javascript
// Custom duration (in milliseconds)
toast.success('Berhasil!', 'Data tersimpan', 3000);

// No auto-hide (duration = 0)
toast.error('Error Fatal!', 'Hubungi admin', 0);

// Clear all toasts
toast.clearAll();
```

---

## 🎨 Design Specs

### Toast Structure
```
┌──────────────────────────────────────┐
│  [Icon]  Title                    [×]│
│          Message...                  │
│  ════════════════════ (progress bar) │
└──────────────────────────────────────┘
```

### Colors
- **Success**: `#10b981` (green)
- **Error**: `#ef4444` (red)
- **Warning**: `#f59e0b` (orange)
- **Info**: `#3b82f6` (blue)

### Animations
- **Slide-in**: 0.3s ease-out (from right on desktop, from top on mobile)
- **Slide-out**: 0.3s ease-in
- **Progress bar**: Linear animation based on duration
- **Hover**: Scale up shadow, translate -2px

### Positioning
- **Desktop**: Top-right (20px from top/right)
- **Mobile**: Top-center (10px from top, full width - 20px)

---

## 📱 Mobile Responsive

### Desktop (>480px)
- Slide from right
- Max width: 400px
- Position: top-right
- Icon: 40px
- Font: 15px/13px

### Mobile (≤480px)
- Slide from top
- Full width (with 10px padding)
- Position: top-center
- Icon: 36px
- Font: 14px/12px

---

## 🔧 Integration Examples

### 1. **Server Redirect with Toast**

**Server (Node.js):**
```javascript
// Success
res.redirect('/?success=' + encodeURIComponent('Protocol berhasil dibuat!'));

// Error
res.redirect('/login?error=' + encodeURIComponent('Username atau password salah'));

// Warning
res.redirect('/users?warning=' + encodeURIComponent('User sudah ada'));

// Info
res.redirect('/?info=' + encodeURIComponent('Proses sedang berjalan'));
```

**Client (auto-detected):**
Toast will automatically show and clean the URL!

### 2. **Form Submission**

**HTML:**
```html
<form action="/protocols" method="POST">
  <!-- Form fields -->
  <button type="submit">Create Protocol</button>
</form>
```

**Auto-behavior:**
- Button text changes to "Memproses..."
- Button becomes disabled
- Info toast shows "Memproses..."
- After response, success/error toast auto-shows

**Disable auto-toast for specific form:**
```html
<form action="/api/data" method="POST" data-no-toast>
  <!-- This form won't show auto-toast -->
</form>
```

### 3. **AJAX/Fetch Requests**

**Client:**
```javascript
fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin' })
})
.then(response => response.json())
.then(data => {
  // Auto-detected if response has:
  // { success: true, message: '...' } → success toast
  // { error: '...' } → error toast
});
```

**Server response format (auto-detected):**
```javascript
// Success
res.json({ success: true, message: 'User created!' });

// Error
res.status(400).json({ error: 'User already exists' });
```

### 4. **Socket.IO Real-time Updates**

**Server:**
```javascript
io.emit('protocol_created', {
  codes: ['ABC123'],
  quantity: 10,
  partner: 'Partner Name'
});
```

**Client:**
```javascript
socket.on('protocol_created', (data) => {
  showSuccessToast(
    'Protocol Created!',
    `${data.quantity} protocols for ${data.partner}`
  );
});
```

### 5. **Manual JavaScript**

```javascript
// In dashboard or any page
document.querySelector('#deleteBtn').addEventListener('click', async () => {
  if (confirm('Are you sure?')) {
    try {
      const response = await fetch('/api/delete/123', { method: 'DELETE' });
      if (response.ok) {
        showSuccessToast('Deleted!', 'Item has been removed');
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      showErrorToast('Error!', error.message);
    }
  }
});
```

---

## 🎯 Use Cases

### ✅ Success Toast Examples
```javascript
// User actions
showSuccessToast('Login Berhasil!', 'Selamat datang kembali');
showSuccessToast('Data Tersimpan!', 'Perubahan berhasil disimpan');
showSuccessToast('Protocol Dibuat!', '10 barcode berhasil digenerate');
showSuccessToast('User Diaktifkan!', 'User sekarang bisa login');

// Background tasks
showSuccessToast('Sync Complete!', 'Data berhasil di-sync');
showSuccessToast('Export Ready!', 'File CSV siap didownload');
```

### ❌ Error Toast Examples
```javascript
// Validation errors
showErrorToast('Input Invalid!', 'Username harus 3-20 karakter');
showErrorToast('Field Required!', 'Semua field harus diisi');

// Server errors
showErrorToast('Database Error!', 'Gagal menyimpan ke database');
showErrorToast('Network Error!', 'Tidak dapat menghubungi server');

// Auth errors
showErrorToast('Unauthorized!', 'Session expired, login lagi');
showErrorToast('Access Denied!', 'Anda tidak punya akses ke halaman ini');
```

### ⚠️ Warning Toast Examples
```javascript
// Data warnings
showWarningToast('Data Duplikat!', 'Partner dengan kode ini sudah ada');
showWarningToast('Low Stock!', 'Stok barcode tinggal 5');

// Action warnings
showWarningToast('Belum Tersimpan!', 'Anda punya perubahan yang belum tersimpan');
showWarningToast('Pending Changes!', 'Ada data yang menunggu approval');
```

### ℹ️ Info Toast Examples
```javascript
// Process info
showInfoToast('Processing...', 'Generating barcodes...');
showInfoToast('Loading...', 'Mengambil data dari server');

// Status updates
showInfoToast('Real-time Update', 'Protocol ABC123 di-scan oleh distribusi');
showInfoToast('Sync Started', 'Sinkronisasi otomatis dimulai');
```

---

## 📂 File Structure

```
public/
├── toast.css          # Toast styling (gradients, animations, responsive)
└── toast.js           # Toast logic (class, auto-integration, helpers)

views/
├── dashboard.ejs      # ✅ Toast integrated
├── login.ejs          # ✅ Toast integrated
├── users.ejs          # ✅ Toast integrated
├── partners.ejs       # ✅ Toast integrated
└── scanner.ejs        # ✅ Toast integrated
```

---

## 🧪 Testing

### Test 1: URL Parameters
```
Visit: http://localhost:8080/?success=Test+Success
Expected: Green success toast with "Test Success"

Visit: http://localhost:8080/?error=Test+Error
Expected: Red error toast with "Test Error"
```

### Test 2: Form Submission
```
1. Go to dashboard
2. Create a new protocol
3. Expected: 
   - Info toast "Memproses..."
   - After submit: Success toast "Protocol created!"
```

### Test 3: Manual Toast
```
1. Open browser console (F12)
2. Run: showSuccessToast('Test', 'This is a test')
3. Expected: Green success toast appears
```

### Test 4: Multiple Toasts
```javascript
showSuccessToast('Toast 1', 'First');
setTimeout(() => showErrorToast('Toast 2', 'Second'), 500);
setTimeout(() => showWarningToast('Toast 3', 'Third'), 1000);
setTimeout(() => showInfoToast('Toast 4', 'Fourth'), 1500);

// Expected: 4 toasts stacked vertically
```

### Test 5: Mobile Responsive
```
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone 12 Pro
4. Trigger toast
5. Expected: Toast slides from top, full width
```

---

## 🎨 Customization

### Change Duration
```javascript
// Global default durations (in toast.js)
success: 5000,  // 5 seconds
error: 7000,    // 7 seconds
warning: 6000,  // 6 seconds
info: 5000      // 5 seconds

// Or per-toast
showSuccessToast('Quick!', 'This disappears fast', 2000);
```

### Change Position (toast.css)
```css
.toast-container {
  /* Desktop - top-right */
  top: 20px;
  right: 20px;
  
  /* Change to top-left */
  /* top: 20px; left: 20px; */
  
  /* Change to bottom-right */
  /* bottom: 20px; right: 20px; */
}
```

### Change Colors (toast.css)
```css
.toast.success { border-left-color: #10b981; } /* Green */
.toast.error { border-left-color: #ef4444; }   /* Red */
.toast.warning { border-left-color: #f59e0b; } /* Orange */
.toast.info { border-left-color: #3b82f6; }    /* Blue */
```

### Custom Icon
```javascript
// In toast.js, line ~40
const icons = {
  success: '✓',  // Change to '✅' or '<svg>...</svg>'
  error: '✕',    // Change to '❌'
  warning: '⚠',  // Change to '⚠️'
  info: 'ℹ'      // Change to 'ℹ️'
};
```

---

## 🔌 API Reference

### ToastNotification Class

```javascript
const toast = new ToastNotification();

// Methods
toast.show(type, title, message, duration)  // Show toast with custom type
toast.success(title, message, duration)     // Show success toast
toast.error(title, message, duration)       // Show error toast
toast.warning(title, message, duration)     // Show warning toast
toast.info(title, message, duration)        // Show info toast
toast.hide(toastElement)                    // Hide specific toast
toast.clearAll()                            // Clear all toasts
```

### Global Helpers

```javascript
// Available everywhere (window scope)
showSuccessToast(title, message, duration)
showErrorToast(title, message, duration)
showWarningToast(title, message, duration)
showInfoToast(title, message, duration)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `'info'` | Toast type: `'success'`, `'error'`, `'warning'`, `'info'` |
| `title` | string | `''` | Bold title text (required) |
| `message` | string | `''` | Secondary message text (optional) |
| `duration` | number | `5000` | Auto-hide duration in ms (0 = manual close only) |

---

## 🐛 Troubleshooting

### Toast not showing
**Check:**
1. `toast.css` and `toast.js` loaded in `<head>`
2. Console for JavaScript errors
3. Z-index conflicts (toast uses `z-index: 9999`)

### Toast appears but no animation
**Check:**
1. CSS animations enabled in browser
2. No conflicting CSS from other libraries

### URL not cleaning after toast
**Check:**
1. `window.history.replaceState()` supported in browser
2. No JavaScript errors preventing cleanup

### Multiple toasts overlap
**Expected behavior!** Toasts stack vertically with 12px gap.
Use `toast.clearAll()` if needed to clear all.

---

## 📊 Performance

- **CSS size**: ~8KB (unminified)
- **JS size**: ~5KB (unminified)
- **No dependencies**: Pure vanilla JS
- **Memory**: ~1-2MB per toast (cleaned up on close)
- **Animation**: GPU-accelerated (transform, opacity)

---

## 🚀 Deployment

```bash
# SSH to VPS
ssh root@202.10.48.107

# Pull latest changes
cd /opt/ubt
git pull origin main

# Restart PM2
pm2 restart ubt-app

# Test
# Open browser, trigger any action (create protocol, login, etc.)
# Expected: Beautiful toast notifications appear!
```

---

## ✅ Checklist After Deploy

- [ ] Toast shows on successful login
- [ ] Toast shows on protocol creation
- [ ] Toast shows on partner creation
- [ ] Toast shows on user management actions
- [ ] Toast shows on scanner scan success/error
- [ ] Toast is responsive on mobile
- [ ] Toast has smooth animations
- [ ] Toast auto-hides after duration
- [ ] Multiple toasts stack properly
- [ ] Close button works

---

## 🎉 Examples in Action

### Dashboard
```
✅ "Protocol Created!" - "10 barcodes generated for Partner ABC"
✅ "Status Updated!" - "Protocol ABC123 marked as delivered"
ℹ️ "Real-time Update" - "New protocol scanned by distribusi team"
```

### Login
```
✅ "Login Berhasil!" - "Selamat datang kembali, Admin"
❌ "Login Gagal!" - "Username atau password salah"
⚠️ "Session Expired" - "Silakan login kembali"
```

### Users Management
```
✅ "User Created!" - "User 'operator1' berhasil dibuat"
✅ "User Activated!" - "User 'operator1' sekarang aktif"
❌ "Delete Failed!" - "User masih memiliki data terkait"
```

### Partners Management
```
✅ "Partner Added!" - "Partner 'ABC Corp' berhasil ditambahkan"
⚠️ "Duplicate Code!" - "Partner dengan kode 'ABC' sudah ada"
✅ "Partner Deactivated!" - "Partner 'ABC Corp' dinonaktifkan"
```

### Scanner
```
✅ "Scan Success!" - "Protocol ABC123 berhasil di-scan"
❌ "Invalid Code!" - "Barcode tidak ditemukan di database"
ℹ️ "Processing..." - "Mengirim data ke server..."
```

---

**Status:** ✅ Implemented and Ready to Deploy  
**Last Updated:** 2025-11-07  
**Version:** 1.0.0
