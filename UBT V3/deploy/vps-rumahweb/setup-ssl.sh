#!/bin/bash

# ============================================
# SETUP SSL CERTIFICATE (LET'S ENCRYPT)
# ============================================
# Script ini akan:
# - Install SSL certificate menggunakan Certbot
# - Configure auto-renewal
# - Update Nginx config untuk HTTPS
# ============================================

set -e

DOMAIN="ubt-medtech.online"
EMAIL="ubtmedtech@gmail.com"

echo "=========================================="
echo "🔒 INSTALLING SSL CERTIFICATE"
echo "=========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Prompt for email if default
if [ "$EMAIL" = "your-email@example.com" ]; then
    echo "⚠️  WARNING: Please edit this script and set your email address"
    echo ""
    read -p "Enter your email address: " EMAIL
fi

# Check if Nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "❌ Nginx is not running. Starting Nginx..."
    systemctl start nginx
fi

# Check DNS
echo "🔍 Checking DNS..."
CURRENT_IP=$(curl -s ifconfig.me)
echo "Your VPS IP: $CURRENT_IP"
echo ""
echo "Make sure your DNS A record points to this IP:"
echo "  $DOMAIN -> $CURRENT_IP"
echo ""
read -p "Press Enter to continue when DNS is ready..."

# Install SSL certificate
echo "🔒 Installing SSL certificate..."
certbot --nginx \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --redirect

# Test auto-renewal
echo "🧪 Testing auto-renewal..."
certbot renew --dry-run

# Check certificate
echo "📋 Certificate information:"
certbot certificates

echo ""
echo "=========================================="
echo "✅ SSL CERTIFICATE INSTALLED!"
echo "=========================================="
echo ""
echo "Your site is now accessible at:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo "Certificate will auto-renew every 60 days"
echo ""
echo "Nginx configuration updated with:"
echo "  - HTTPS on port 443"
echo "  - HTTP to HTTPS redirect"
echo "  - Security headers"
echo "  - HSTS enabled"
echo ""
