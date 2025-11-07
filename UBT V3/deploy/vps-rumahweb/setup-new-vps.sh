#!/bin/bash

# ============================================
# SCRIPT SETUP VPS BARU (RUMAHWEB)
# ============================================
# Script ini akan setup VPS baru dengan:
# - Firewall (UFW)
# - Security hardening
# - Node.js 18.x
# - Nginx
# - PM2
# - Git
# ============================================

set -e

echo "=========================================="
echo "🚀 SETUP VPS BARU - RUMAHWEB"
echo "=========================================="
echo ""

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
echo "📦 Installing essential packages..."
apt install -y curl wget git ufw fail2ban

# Setup Firewall
echo "🔒 Setting up firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

echo "✅ Firewall configured:"
ufw status

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo "✅ Node.js installed:"
node --version
npm --version

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx

echo "✅ Nginx installed and running"

# Install PM2
echo "📦 Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root
systemctl enable pm2-root

echo "✅ PM2 installed"

# Install Certbot for SSL
echo "📦 Installing Certbot for Let's Encrypt..."
apt install -y certbot python3-certbot-nginx

echo "✅ Certbot installed"

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /opt/ubt
chown -R root:root /opt/ubt

# Setup Fail2Ban for SSH protection
echo "🔒 Setting up Fail2Ban..."
systemctl enable fail2ban
systemctl start fail2ban

echo ""
echo "=========================================="
echo "✅ VPS SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "Installed:"
echo "  - Node.js: $(node --version)"
echo "  - npm: $(npm --version)"
echo "  - Nginx: $(nginx -v 2>&1)"
echo "  - PM2: $(pm2 --version)"
echo "  - Certbot: $(certbot --version)"
echo ""
echo "Firewall (UFW) Status:"
ufw status numbered
echo ""
echo "Next steps:"
echo "  1. Deploy your application to /opt/ubt"
echo "  2. Configure Nginx"
echo "  3. Install SSL certificate"
echo ""
