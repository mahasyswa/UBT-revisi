#!/bin/bash
# Setup Domain and SSL for UBT Application
# Run this after DNS is pointing to VPS

DOMAIN="ubt-medtech.online"
EMAIL="admin@ubt-medtech.online"  # Change this to your email

echo "🌐 Setting up domain: $DOMAIN"

# Update nginx config
echo "📝 Updating nginx configuration..."
cat > /etc/nginx/sites-available/ubt << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ubt-medtech.online www.ubt-medtech.online;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/ubt_access.log;
    error_log /var/log/nginx/ubt_error.log;

    # Proxy to Node.js app
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

    # Static files
    location /public {
        alias /opt/ubt/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Barcode images
    location /barcode {
        alias /opt/ubt/public/barcodes;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Health check
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Test nginx config
echo "🔍 Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx config is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    systemctl reload nginx
    
    echo ""
    echo "✅ Nginx updated successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Wait 5-10 minutes for DNS propagation"
    echo "2. Test: curl -I http://ubt-medtech.online"
    echo "3. If working, run SSL setup:"
    echo "   sudo bash /opt/ubt/deploy/vps/setup-ssl.sh"
    echo ""
else
    echo "❌ Nginx config has errors. Please check the output above."
    exit 1
fi
