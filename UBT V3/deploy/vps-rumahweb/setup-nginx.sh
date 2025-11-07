#!/bin/bash

# ============================================
# SETUP NGINX + DOMAIN (RUMAHWEB VPS)
# ============================================
# Script ini akan:
# - Configure Nginx reverse proxy
# - Setup domain
# - Enable gzip compression
# - Security headers
# ============================================

set -e

DOMAIN="ubt-medtech.online"
APP_PORT="8080"

echo "=========================================="
echo "🌐 SETTING UP NGINX + DOMAIN"
echo "=========================================="
echo ""
echo "Domain: $DOMAIN"
echo "App Port: $APP_PORT"
echo ""

# Backup existing config if exists
if [ -f "/etc/nginx/sites-available/$DOMAIN" ]; then
    echo "📋 Backing up existing config..."
    cp /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-available/$DOMAIN.backup.$(date +%Y%m%d_%H%M%S)
fi

# Create Nginx configuration
echo "📝 Creating Nginx configuration..."
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ubt-medtech.online www.ubt-medtech.online;

    # Logs
    access_log /var/log/nginx/ubt-access.log;
    error_log /var/log/nginx/ubt-error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Client max body size (for file uploads)
    client_max_body_size 50M;

    # Proxy settings
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support for Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Static files cache
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:8080;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
echo "🔗 Enabling site..."
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
nginx -t

# Reload Nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo ""
echo "=========================================="
echo "✅ NGINX CONFIGURED!"
echo "=========================================="
echo ""
echo "Your site should now be accessible at:"
echo "  http://$DOMAIN"
echo ""
echo "Next step:"
echo "  - Make sure DNS A record points to this VPS IP"
echo "  - Run setup-ssl.sh to install SSL certificate"
echo ""
echo "Check your VPS IP:"
curl -s ifconfig.me
echo ""
