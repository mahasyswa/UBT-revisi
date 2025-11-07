#!/bin/bash
# Setup SSL Certificate with Let's Encrypt
# Run this AFTER DNS is working and domain is accessible via HTTP

DOMAIN="ubt-medtech.online"
EMAIL="admin@ubt-medtech.online"  # Change this to your real email for SSL notifications

echo "🔒 Setting up SSL for: $DOMAIN"
echo ""

# Check if domain is accessible
echo "🔍 Checking if domain is accessible..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN 2>/dev/null)

if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "301" ] && [ "$HTTP_STATUS" != "302" ]; then
    echo "⚠️  Warning: Domain is not accessible yet (HTTP Status: $HTTP_STATUS)"
    echo "Please make sure:"
    echo "  1. DNS A record is set to: 203.83.46.48"
    echo "  2. Wait 5-30 minutes for DNS propagation"
    echo "  3. Test with: curl -I http://$DOMAIN"
    echo ""
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt update
    apt install certbot python3-certbot-nginx -y
fi

# Generate SSL certificate
echo ""
echo "🔐 Generating SSL certificate..."
echo "This will:"
echo "  - Create SSL certificate for $DOMAIN and www.$DOMAIN"
echo "  - Auto-configure nginx"
echo "  - Setup auto-renewal"
echo ""

certbot --nginx \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --redirect

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL Certificate installed successfully!"
    echo ""
    echo "🎉 Your site is now secure:"
    echo "   https://ubt-medtech.online"
    echo "   https://www.ubt-medtech.online"
    echo ""
    echo "📱 Camera access is now enabled for scanner!"
    echo ""
    echo "🔄 SSL certificate will auto-renew every 90 days"
    echo ""
    
    # Test auto-renewal
    echo "🧪 Testing auto-renewal..."
    certbot renew --dry-run
    
    echo ""
    echo "✅ Setup complete! Please test your site:"
    echo "   1. Open https://ubt-medtech.online"
    echo "   2. Login and test scanner camera access"
    echo ""
else
    echo ""
    echo "❌ SSL installation failed!"
    echo "Common issues:"
    echo "  1. DNS not propagated yet - wait longer and try again"
    echo "  2. Port 80/443 not accessible - check firewall"
    echo "  3. Domain not pointing to this server"
    echo ""
    echo "Debug commands:"
    echo "  dig $DOMAIN"
    echo "  curl -I http://$DOMAIN"
    echo ""
    exit 1
fi
