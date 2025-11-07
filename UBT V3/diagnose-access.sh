#!/bin/bash
# Script untuk diagnosa kenapa orang lain tidak bisa akses website
# Jalankan di VPS: bash diagnose-access.sh

echo "========================================="
echo "🔍 DIAGNOSIS AKSES WEBSITE"
echo "========================================="
echo ""

echo "1️⃣ Checking UFW Firewall Status..."
sudo ufw status verbose
echo ""

echo "2️⃣ Checking iptables rules..."
sudo iptables -L -n -v | grep -E "(80|443|8080)"
echo ""

echo "3️⃣ Checking Nginx Status..."
sudo systemctl status nginx --no-pager | head -20
echo ""

echo "4️⃣ Checking Nginx Configuration..."
echo "--- Main Nginx Config ---"
sudo nginx -t
echo ""
echo "--- Site Configuration ---"
sudo cat /etc/nginx/sites-enabled/ubt-medtech 2>/dev/null || echo "File not found!"
echo ""

echo "5️⃣ Checking PM2 Status..."
pm2 status
echo ""
pm2 info ubt-app 2>/dev/null || echo "ubt-app not found in PM2"
echo ""

echo "6️⃣ Checking if Node.js app is listening..."
sudo netstat -tlnp | grep -E ":(80|443|8080)"
echo ""
sudo lsof -i :8080 2>/dev/null || echo "Nothing listening on port 8080"
echo ""

echo "7️⃣ Checking DNS Resolution..."
echo "--- Local DNS ---"
nslookup ubt-medtech.online 8.8.8.8
echo ""
echo "--- External DNS (from VPS) ---"
curl -s "https://dns.google/resolve?name=ubt-medtech.online&type=A" | grep -o '"data":"[^"]*"'
echo ""

echo "8️⃣ Checking SSL Certificate..."
echo "--- Certificate Info ---"
sudo certbot certificates 2>/dev/null | grep -A 5 "ubt-medtech.online" || echo "No certificate found"
echo ""

echo "9️⃣ Testing Local Access..."
echo "--- HTTP Test (localhost) ---"
curl -I http://localhost:8080 2>/dev/null | head -5
echo ""
echo "--- HTTPS Test (domain) ---"
curl -I https://ubt-medtech.online 2>/dev/null | head -5
echo ""

echo "🔟 Checking Server Logs (last 20 lines)..."
echo "--- Nginx Error Log ---"
sudo tail -20 /var/log/nginx/error.log
echo ""
echo "--- PM2 App Log ---"
pm2 logs ubt-app --lines 20 --nostream 2>/dev/null || echo "No PM2 logs available"
echo ""

echo "========================================="
echo "✅ DIAGNOSIS COMPLETE!"
echo "========================================="
echo ""
echo "📋 Quick Fixes:"
echo "1. If UFW is blocking: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp"
echo "2. If Nginx not running: sudo systemctl start nginx"
echo "3. If PM2 not running: pm2 restart ubt-app"
echo "4. If DNS not pointing: Check Hostinger DNS settings"
echo "5. If SSL expired: sudo certbot renew --nginx"
echo ""
