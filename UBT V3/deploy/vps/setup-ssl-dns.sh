#!/bin/bash
# Setup SSL using DNS Challenge (Alternative when port 80/443 not accessible)

DOMAIN="ubt-medtech.online"
EMAIL="admin@ubt-medtech.online"

echo "🔒 Setting up SSL using DNS Challenge for: $DOMAIN"
echo ""
echo "⚠️  This method requires manual DNS TXT record addition"
echo ""

# Install certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt update
    apt install certbot -y
fi

echo "🔐 Generating SSL certificate with DNS challenge..."
echo ""
echo "Follow these steps:"
echo "1. Certbot will show you a TXT record to add"
echo "2. Add the TXT record to your DNS provider:"
echo "   Type: TXT"
echo "   Name: _acme-challenge"
echo "   Value: (value shown by certbot)"
echo "   TTL: 300"
echo "3. Wait 5 minutes for DNS propagation"
echo "4. Press Enter in certbot to continue verification"
echo ""

# Run certbot with manual DNS challenge
certbot certonly \
    --manual \
    --preferred-challenges dns \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL Certificate generated successfully!"
    echo ""
    echo "📝 Now configuring nginx..."
    
    # Update nginx config with SSL
    cat > /etc/nginx/sites-available/ubt << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ubt-medtech.online www.ubt-medtech.online;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ubt-medtech.online www.ubt-medtech.online;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/ubt-medtech.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ubt-medtech.online/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
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

    location /barcode {
        alias /opt/ubt/public/barcodes;
        expires 7d;
        add_header Cache-Control "public";
    }
}
EOF
    
    # Test and reload nginx
    nginx -t && systemctl reload nginx
    
    echo ""
    echo "✅ SSL Setup Complete!"
    echo ""
    echo "🎉 Your site is now available at:"
    echo "   https://ubt-medtech.online (via port forwarding)"
    echo ""
    echo "⚠️  Note: You need port 443 forwarding in atlantic-server control panel"
    echo ""
else
    echo ""
    echo "❌ SSL certificate generation failed!"
    echo "Please check the error messages above"
    exit 1
fi
