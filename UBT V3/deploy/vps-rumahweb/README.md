# Setup VPS Baru Rumahweb - Panduan Lengkap

Script ini untuk setup VPS baru dari Rumahweb dengan aplikasi UBT.

## Prasyarat

1. ✅ VPS Rumahweb sudah aktif
2. ✅ Ubuntu 22.04 atau 24.04 LTS
3. ✅ Akses SSH root
4. ✅ Domain ubt-medtech.online sudah pointing ke IP VPS baru

## Langkah-langkah Setup

### 1. Setup VPS Baru (15 menit)

SSH ke VPS baru, lalu jalankan:

```bash
# Upload script ke VPS
# Dari komputer lokal:
scp -r deploy/vps-rumahweb root@[IP_VPS_BARU]:/root/

# SSH ke VPS
ssh root@[IP_VPS_BARU]

# Jalankan setup awal
cd /root/vps-rumahweb
chmod +x *.sh
bash setup-new-vps.sh
```

Script ini akan install:
- ✅ Node.js 18.x
- ✅ Nginx
- ✅ PM2
- ✅ Certbot (Let's Encrypt)
- ✅ Firewall (UFW)
- ✅ Fail2Ban

### 2. Deploy Aplikasi (10 menit)

```bash
bash deploy-app.sh
```

Script ini akan:
- ✅ Clone repository dari GitHub
- ✅ Install dependencies
- ✅ Setup PM2
- ✅ Start aplikasi

### 3. Setup Nginx + Domain (5 menit)

```bash
bash setup-nginx.sh
```

Script ini akan:
- ✅ Configure Nginx reverse proxy
- ✅ Setup domain ubt-medtech.online
- ✅ Enable gzip compression
- ✅ Security headers

Cek apakah sudah bisa diakses:
```bash
curl -I http://ubt-medtech.online
```

### 4. Update DNS A Record

Di Hostinger (domain provider):
1. Login ke panel Hostinger
2. Buka DNS Management untuk ubt-medtech.online
3. Update A record dari IP lama (203.83.46.48) ke IP VPS baru
4. Tunggu 5-10 menit untuk propagasi DNS

Cek DNS:
```bash
nslookup ubt-medtech.online
```

### 5. Install SSL Certificate (5 menit)

**EDIT EMAIL DULU** di file `setup-ssl.sh`:
```bash
nano setup-ssl.sh
# Ganti: EMAIL="your-email@example.com"
# Dengan: EMAIL="email-anda@domain.com"
```

Lalu jalankan:
```bash
bash setup-ssl.sh
```

Script ini akan:
- ✅ Install SSL certificate Let's Encrypt
- ✅ Setup auto-renewal
- ✅ Configure HTTPS redirect
- ✅ Enable HSTS

### 6. Migrasi Data (Optional - 5 menit)

Jika ada data di VPS lama yang perlu dipindahkan:

```bash
bash migrate-data.sh
```

Script ini akan:
- ✅ Download database dari VPS lama
- ✅ Backup database baru (jika ada)
- ✅ Restore database dari VPS lama
- ✅ Restart aplikasi

## Verifikasi

### Cek Aplikasi Berjalan

```bash
# Status PM2
pm2 status

# Logs aplikasi
pm2 logs ubt-app --lines 50

# Nginx status
systemctl status nginx

# Firewall status
ufw status
```

### Cek Website

```bash
# Test HTTP (should redirect to HTTPS)
curl -I http://ubt-medtech.online

# Test HTTPS
curl -I https://ubt-medtech.online

# Test dari browser
# https://ubt-medtech.online
```

### Cek SSL Certificate

```bash
# Certificate info
certbot certificates

# Test SSL rating
# https://www.ssllabs.com/ssltest/analyze.html?d=ubt-medtech.online
```

## Timeline Total

```
⏱️  Setup VPS baru:       15 menit
⏱️  Deploy aplikasi:      10 menit
⏱️  Setup Nginx:           5 menit
⏱️  Update DNS:            5-10 menit (propagasi)
⏱️  Install SSL:           5 menit
⏱️  Migrasi data:          5 menit (optional)
─────────────────────────────────────
✅  TOTAL:                 40-45 menit
```

## Testing Aplikasi

### Login Admin
```
URL: https://ubt-medtech.online/login
Username: admin
Password: admin
```

### Test Scanner (Camera Access)
```
URL: https://ubt-medtech.online/scanner
- Login sebagai user manapun
- Klik "Start Scanning"
- Browser akan meminta izin camera
- ✅ Camera access granted (karena HTTPS)
```

## Maintenance

### Update Aplikasi

```bash
cd /opt/ubt
git pull origin main
npm install --production
pm2 restart ubt-app
```

### Backup Database

```bash
# Manual backup
cp /opt/ubt/data/database.db /opt/ubt/data/database.db.backup.$(date +%Y%m%d)

# Setup automatic backup (crontab)
crontab -e

# Add this line (backup daily at 2 AM):
0 2 * * * cp /opt/ubt/data/database.db /opt/ubt/data/backup-$(date +\%Y\%m\%d).db
```

### View Logs

```bash
# Application logs
pm2 logs ubt-app

# Nginx access logs
tail -f /var/log/nginx/ubt-access.log

# Nginx error logs
tail -f /var/log/nginx/ubt-error.log

# SSL renewal logs
journalctl -u certbot.timer
```

### SSL Certificate Renewal

Certificate akan auto-renew setiap 60 hari.

Manual renewal (jika diperlukan):
```bash
certbot renew
systemctl reload nginx
```

## Troubleshooting

### Aplikasi tidak berjalan

```bash
pm2 logs ubt-app --lines 100
pm2 restart ubt-app
```

### Nginx error

```bash
nginx -t
tail -f /var/log/nginx/error.log
systemctl restart nginx
```

### DNS tidak resolve

```bash
# Check DNS
nslookup ubt-medtech.online
dig ubt-medtech.online

# Wait 5-10 minutes for DNS propagation
```

### SSL certificate gagal

```bash
# Check DNS first
nslookup ubt-medtech.online

# Check if port 80 accessible
curl -I http://ubt-medtech.online

# Retry SSL installation
certbot --nginx -d ubt-medtech.online -d www.ubt-medtech.online
```

## Security Checklist

- ✅ Firewall enabled (UFW)
- ✅ Only ports 22, 80, 443 open
- ✅ Fail2Ban active (SSH brute-force protection)
- ✅ SSL certificate installed
- ✅ HTTPS redirect enabled
- ✅ Security headers configured
- ✅ Gzip compression enabled

## Support

Jika ada masalah:
1. Cek logs: `pm2 logs ubt-app`
2. Cek Nginx: `tail -f /var/log/nginx/error.log`
3. Restart services: `pm2 restart ubt-app && systemctl restart nginx`

---

**Selamat! Aplikasi UBT sudah berjalan di VPS Rumahweb dengan HTTPS!** 🎉

Access URL: **https://ubt-medtech.online/** (tanpa port!)
