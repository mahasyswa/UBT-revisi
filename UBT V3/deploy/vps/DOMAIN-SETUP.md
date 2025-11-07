# Setup Domain dan HTTPS untuk UBT Application

Domain: **ubt-medtech.online**

## Prerequisites
- ✅ VPS sudah running (Ubuntu 22.04)
- ✅ Aplikasi sudah berjalan di port 8080
- ✅ Nginx sudah terinstall
- ✅ Domain sudah dibeli

---

## Step 1: Setup DNS Records

Di DNS Provider Anda, tambahkan records ini:

```
Type: A
Name: @
Content: 203.83.46.48
TTL: 300 atau Auto

Type: A  
Name: www
Content: 203.83.46.48
TTL: 300 atau Auto
```

Atau bisa pakai CNAME untuk www:
```
Type: CNAME
Name: www
Content: ubt-medtech.online
TTL: 300
```

**Tunggu 5-30 menit** untuk DNS propagation.

---

## Step 2: Verifikasi DNS

Test apakah domain sudah pointing:

```bash
# Dari komputer lokal
ping ubt-medtech.online

# Atau gunakan nslookup
nslookup ubt-medtech.online

# Atau dig
dig ubt-medtech.online +short
```

Harusnya return IP: **203.83.46.48**

---

## Step 3: Setup Domain di VPS

SSH ke VPS dan jalankan script setup domain:

```bash
ssh -p 7399 root@ip.atlantic-server.com

# Masuk ke direktori deploy
cd /opt/ubt/deploy/vps

# Berikan permission execute
chmod +x setup-domain.sh setup-ssl.sh

# Jalankan setup domain
sudo bash setup-domain.sh
```

Script ini akan:
- Update nginx config dengan domain Anda
- Test config
- Reload nginx

---

## Step 4: Test HTTP Access

Test apakah domain sudah accessible via HTTP:

```bash
# Dari VPS atau komputer lokal
curl -I http://ubt-medtech.online

# Harusnya return HTTP 200 OK
```

Atau buka di browser: `http://ubt-medtech.online:13831`

> **Note:** Karena VPS di belakang NAT, mungkin perlu akses via port 13831

---

## Step 5: Setup Port Forwarding (Jika Perlu)

Jika tidak bisa akses, tambahkan port forwarding di **atlantic-server.com control panel**:

```
Internal Port 80  → Public Port 80 (atau 13831)
Internal Port 443 → Public Port 443 (atau 13832)
```

Atau bisa langsung akses via IP internal dari browser:
`http://10.20.30.48`

---

## Step 6: Install SSL Certificate

Setelah HTTP accessible, install SSL:

```bash
# Masih di VPS
cd /opt/ubt/deploy/vps

# Jalankan setup SSL
sudo bash setup-ssl.sh
```

Script ini akan:
- Install certbot (jika belum ada)
- Generate SSL certificate dari Let's Encrypt
- Auto-configure nginx untuk HTTPS
- Setup auto-renewal
- Test renewal

**Penting:** Ganti email di script dengan email Anda yang valid!

---

## Step 7: Test HTTPS

Test apakah HTTPS sudah berjalan:

```bash
# Test dari terminal
curl -I https://ubt-medtech.online

# Atau buka di browser
https://ubt-medtech.online
```

---

## Step 8: Test Scanner Camera

1. Login ke aplikasi: `https://ubt-medtech.online`
2. Buka menu **Scanner**
3. Klik **"Start Scanning"**
4. Izinkan akses kamera
5. ✅ Kamera seharusnya sudah bisa digunakan!

---

## Troubleshooting

### DNS Belum Propagate
```bash
# Check DNS
dig ubt-medtech.online +short

# Jika belum return 203.83.46.48, tunggu lebih lama
# Atau gunakan DNS Checker: https://dnschecker.org
```

### Port 80/443 Tidak Accessible
```bash
# Check nginx status
systemctl status nginx

# Check nginx error log
tail -f /var/log/nginx/error.log

# Check if port is listening
netstat -tlnp | grep :80
netstat -tlnp | grep :443

# Test direct access to app
curl http://localhost:8080
```

### SSL Installation Failed
```bash
# Manual SSL setup
certbot --nginx -d ubt-medtech.online -d www.ubt-medtech.online

# Jika masih error, cek:
1. DNS sudah benar pointing
2. Port 80 accessible dari internet
3. Nginx config benar
```

### Camera Still Not Working
1. Pastikan menggunakan **HTTPS** (bukan HTTP)
2. Clear browser cache
3. Test di browser lain (Chrome/Firefox)
4. Check browser console untuk error

---

## Maintenance

### Check SSL Certificate Status
```bash
certbot certificates
```

### Manual SSL Renewal
```bash
certbot renew
```

### Update Nginx Config
```bash
nano /etc/nginx/sites-available/ubt
nginx -t
systemctl reload nginx
```

### Check Application Logs
```bash
pm2 logs ubt
```

---

## URLs Setelah Setup

- **HTTP:** http://ubt-medtech.online (auto redirect ke HTTPS)
- **HTTPS:** https://ubt-medtech.online
- **With WWW:** https://www.ubt-medtech.online
- **Scanner:** https://ubt-medtech.online/scanner

---

## Security Notes

1. ✅ SSL Certificate auto-renews every 90 days
2. ✅ HTTP auto-redirects to HTTPS
3. ✅ Security headers enabled
4. ✅ Camera access only works on HTTPS

---

## Support

Jika ada masalah:
1. Check nginx error log: `tail -f /var/log/nginx/error.log`
2. Check app log: `pm2 logs ubt`
3. Check SSL: `certbot certificates`
4. Restart services: `pm2 restart ubt && systemctl reload nginx`
