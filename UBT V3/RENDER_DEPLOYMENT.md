# 🚀 Cara Deploy Barcode Protocol ke Render.com

## ✅ Keuntungan Render.com:
- **GRATIS** 750 jam/bulan (cukup untuk 24/7)
- SQLite berfungsi sempurna
- Socket.io real-time updates bekerja
- Auto SSL certificate (HTTPS gratis)
- Deploy dalam 5 menit

---

## 📋 Langkah-Langkah Deploy:

### 1️⃣ **Persiapan - Push Code ke GitHub**

```bash
# Initialize Git (jika belum)
git init

# Add semua file
git add .

# Commit
git commit -m "Ready for Render deployment"

# Buat repository di GitHub, lalu:
git remote add origin https://github.com/USERNAME/REPO-NAME.git
git branch -M main
git push -u origin main
```

### 2️⃣ **Deploy di Render**

1. **Buka** https://render.com
2. **Sign Up/Login** dengan akun GitHub Anda
3. Klik tombol **"New +"** di kanan atas
4. Pilih **"Web Service"**
5. Klik **"Connect GitHub"** dan authorize Render
6. Pilih **repository** Anda
7. Klik **"Connect"**

### 3️⃣ **Konfigurasi Web Service**

Render akan auto-detect settings, tapi pastikan:

- **Name**: `barcode-protocol` (atau nama lain)
- **Region**: Singapore (closest to Indonesia)
- **Branch**: `main`
- **Root Directory**: (kosongkan)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: `Free`

### 4️⃣ **Environment Variables (Optional)**

Klik **"Advanced"** → **"Add Environment Variable"**

Tambahkan (opsional):
```
NODE_ENV = production
PORT = 8080
JWT_SECRET = your-super-secret-key-change-this
```

### 5️⃣ **Deploy!**

1. Klik **"Create Web Service"**
2. Render akan mulai build (tunggu 3-5 menit)
3. Status akan berubah jadi **"Live"** 🟢
4. URL Anda: `https://barcode-protocol.onrender.com`

---

## 🎯 Akses Aplikasi:

Setelah deploy selesai, Anda akan mendapat URL seperti:
```
https://barcode-protocol-xxxx.onrender.com
```

**Login:**
- Username: `admin`
- Password: `admin`

---

## 📱 Camera Access di Mobile:

✅ **HTTPS otomatis enabled** di Render
✅ Camera akan bekerja di semua device
✅ Tidak perlu self-signed certificate

---

## 🔄 Auto Deploy:

Setiap kali Anda push ke GitHub `main` branch, Render akan **otomatis re-deploy**!

```bash
git add .
git commit -m "Update feature"
git push
```

Tunggu 2-3 menit, perubahan akan live! 🚀

---

## ⚙️ File Penting untuk Render:

✅ `package.json` - Dependencies & scripts
✅ `server.js` - Main application
✅ `render.yaml` - Build configuration (optional)
✅ `Procfile` - Start command (optional, tapi sudah ada npm start)

---

## 🐛 Troubleshooting:

### Database kosong setelah deploy?
Render menggunakan ephemeral filesystem. Data akan hilang jika service restart.

**Solusi:** Gunakan Render Disk untuk persistent storage:
1. Di dashboard service → Settings
2. Scroll ke "Disks"
3. Add Disk: Mount path = `/app` atau `/data`

### Port sudah digunakan?
Render otomatis set `PORT` environment variable. 
`process.env.PORT` di code sudah handle ini.

### Real-time tidak bekerja?
Socket.io butuh WebSocket support. Pastikan:
- Tidak ada reverse proxy yang block WebSocket
- Render free tier support WebSocket ✅

---

## 💰 Biaya:

- **Free Tier**: 750 jam/bulan (24/7 satu app = 720 jam)
- Service akan "sleep" setelah 15 menit tidak ada traffic
- First request setelah sleep butuh 30 detik (cold start)

**Upgrade ke Paid ($7/bulan):**
- No sleep
- Faster performance
- More resources

---

## 📞 Support:

Jika ada masalah, cek:
- Render Dashboard → Logs
- GitHub Actions (jika pakai)
- https://render.com/docs

---

**Selamat! Aplikasi Anda sekarang online dan bisa diakses dari mana saja! 🎉**

---

## 🗄️ Persistent disk untuk SQLite (opsional tapi direkomendasikan)

Untuk menyimpan `data.db` secara persisten antar-deploy, gunakan Render Disks. Langkah singkat:

1. Buka service Anda di Render → Settings → Disks → Add Disk.
2. Isi: Name: `data-disk`, Size: `5` GB (contoh), Mount path: `/data`.
3. Di Service → Environment, tambahkan env var: `DATA_DIR = /data`.
4. Pastikan `render.yaml` di repo (atau dashboard) menunjuk mount yang sama. Repo ini sudah menyertakan contoh `render.yaml` yang menambahkan disk dan `DATA_DIR`.

Di kode aplikasi (`server.js`) telah diperbarui untuk membaca `DATA_DIR` dan menyimpan `data.db` di lokasi itu. Setelah disk di-mount dan service dideploy ulang, file database akan berada di `/data/data.db`.

Jika Anda ingin saya siapkan semuanya (commit + panduan langkah demi langkah screenshot), bilang saja — saya akan bantu deploy dan verifikasi logs.
