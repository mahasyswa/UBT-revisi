# 🔧 Troubleshooting Guide - Akses Website dari Browser Lain

## ❌ Masalah: Teman tidak bisa akses website

Error yang muncul: `{"error":"Insufficient permissions"}` atau tidak bisa connect sama sekali.

---

## 🔍 Diagnosis Cepat

### 1️⃣ Check dari berbagai device

**Test dari device/network yang berbeda:**

```bash
# Dari komputer lain/HP teman
https://ubt-medtech.online

# Dari HP Anda (menggunakan data seluler, BUKAN WiFi rumah)
https://ubt-medtech.online
```

**Hasil yang diharapkan:**
- ✅ Halaman login muncul
- ❌ Connection refused / Timeout = **Masalah firewall/network**
- ❌ Error JSON = **Masalah session/authentication** (sudah diperbaiki di commit terbaru)

---

## 🛠️ Solusi Berdasarkan Masalah

### 🔥 Masalah 1: Connection Refused / Timeout

**Penyebab:** Firewall VPS memblokir port 80 dan 443

**Solusi:**

1. SSH ke VPS:
   ```bash
   ssh root@202.10.48.107
   ```

2. Run script fix firewall:
   ```bash
   cd /opt/ubt
   bash fix-firewall.sh
   ```

3. Manual alternative:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 22/tcp  # SSH
   sudo ufw reload
   sudo ufw status
   ```

4. Check jika provider VPS juga punya firewall (Vultr/DigitalOcean/etc):
   - Login ke control panel VPS provider
   - Cari "Firewall" atau "Security Groups"
   - Pastikan port 80 dan 443 terbuka untuk ALL sources (0.0.0.0/0)

---

### 🌐 Masalah 2: DNS Not Resolving

**Penyebab:** DNS belum propagasi atau salah konfigurasi

**Check DNS:**
```bash
# Dari komputer manapun
nslookup ubt-medtech.online 8.8.8.8
```

**Output yang diharapkan:**
```
Name:    ubt-medtech.online
Address: 202.10.48.107
```

**Jika tidak resolve:**

1. Login ke **Hostinger** (DNS provider Anda)
2. Cari domain `ubt-medtech.online`
3. Check DNS Records:
   - **A Record**: `@` → `202.10.48.107`
   - **A Record**: `www` → `202.10.48.107` (optional)
4. Tunggu 5-30 menit untuk propagasi
5. Test lagi

---

### 🔐 Masalah 3: SSL Certificate Issue

**Penyebab:** Certificate expired atau tidak trusted

**Check di VPS:**
```bash
sudo certbot certificates
```

**Output yang diharapkan:**
```
Certificate Name: ubt-medtech.online
  Domains: ubt-medtech.online
  Expiry Date: [future date]
  Valid: Yes
```

**Jika expired atau invalid:**
```bash
sudo certbot renew --nginx
sudo systemctl reload nginx
```

---

### 🖥️ Masalah 4: Nginx atau PM2 Not Running

**Check status:**
```bash
cd /opt/ubt
bash diagnose-access.sh
```

**Fix Nginx:**
```bash
sudo nginx -t  # Test config
sudo systemctl start nginx
sudo systemctl status nginx
```

**Fix PM2:**
```bash
pm2 status
pm2 restart ubt-app
pm2 logs ubt-app --lines 50
```

---

### 🍪 Masalah 5: Session/Cookie Issue (Error JSON)

**Sudah diperbaiki di commit terbaru!** Deploy update:

```bash
cd /opt/ubt
git pull origin main
pm2 restart ubt-app
```

**Changes:**
- ✅ `saveUninitialized: true` - Session dibuat untuk semua user
- ✅ `proxy: true` - Trust Nginx reverse proxy
- ✅ Better error handling untuk AJAX/API requests
- ✅ Debug logging untuk track requests

---

## 📋 Complete Diagnosis Script

**Run di VPS untuk full diagnosis:**

```bash
cd /opt/ubt
bash diagnose-access.sh
```

Script ini akan check:
1. UFW Firewall status
2. iptables rules
3. Nginx status & config
4. PM2 status
5. Port listening (8080, 80, 443)
6. DNS resolution
7. SSL certificate
8. Local/external access test
9. Server logs

---

## 🌍 Testing dari External Network

### Method 1: Online Tools (paling mudah)

1. **Check DNS propagation:**
   - https://dnschecker.org
   - Masukkan: `ubt-medtech.online`
   - Harusnya semua region show: `202.10.48.107`

2. **Check website availability:**
   - https://downforeveryoneorjustme.com
   - Masukkan: `https://ubt-medtech.online`
   - Harusnya: "It's just you. [site] is up."

3. **Check SSL certificate:**
   - https://www.sslshopper.com/ssl-checker.html
   - Masukkan: `ubt-medtech.online`
   - Harusnya: All green checkmarks

### Method 2: Dari HP (pakai data seluler)

1. Matikan WiFi
2. Aktifkan data seluler (4G/5G)
3. Buka browser
4. Akses: `https://ubt-medtech.online`
5. Jika muncul halaman login → ✅ **BERHASIL!**

### Method 3: Pakai VPN

1. Install VPN di HP/laptop (ProtonVPN, TunnelBear, dll)
2. Connect ke server di negara lain
3. Akses: `https://ubt-medtech.online`
4. Jika muncul halaman login → ✅ **BERHASIL!**

---

## 🚨 Common Issues & Quick Fixes

| Issue | Symptom | Quick Fix |
|-------|---------|-----------|
| **Firewall blocking** | Connection timeout | `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp` |
| **Nginx down** | 502 Bad Gateway | `sudo systemctl restart nginx` |
| **PM2 down** | Nginx 502 or timeout | `pm2 restart ubt-app` |
| **DNS not set** | Can't resolve domain | Check Hostinger DNS records |
| **SSL expired** | Certificate warning | `sudo certbot renew --nginx` |
| **Port 8080 busy** | App won't start | `pm2 restart ubt-app` or `lsof -ti:8080 \| xargs kill -9` |
| **Session issue** | JSON error | `git pull && pm2 restart ubt-app` |

---

## 📞 Contact & Support

Jika semua sudah dicoba tapi masih tidak bisa:

1. **Collect evidence:**
   ```bash
   cd /opt/ubt
   bash diagnose-access.sh > diagnosis.txt
   ```

2. **Share diagnosis:**
   - Screenshot error dari browser teman
   - Output file `diagnosis.txt`
   - URL yang diakses
   - Browser & device info

3. **Common mistakes:**
   - ❌ Akses pakai HTTP (http://) bukan HTTPS (https://)
   - ❌ Typo domain name
   - ❌ Browser cache lama (clear cache!)
   - ❌ ISP blocking (coba pakai VPN)
   - ❌ Belum deploy update terbaru (`git pull`)

---

## ✅ Verification Checklist

Sebelum bilang "sudah bisa diakses", pastikan:

- [ ] Bisa akses dari HP dengan WiFi rumah
- [ ] Bisa akses dari HP dengan data seluler (4G/5G)
- [ ] Teman dari lokasi/ISP berbeda bisa akses
- [ ] HTTPS working (ada gembok hijau di browser)
- [ ] Login page muncul dengan benar
- [ ] Bisa login dan masuk dashboard
- [ ] Tidak ada error "Insufficient permissions"
- [ ] DNS checker menunjukkan IP yang benar di semua region

Jika semua checklist ✅, website Anda **sudah public** dan bisa diakses siapa saja! 🎉

---

**Last Updated:** 2025-11-07  
**Version:** 1.0
