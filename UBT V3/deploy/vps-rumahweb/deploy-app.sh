#!/bin/bash

# ============================================
# DEPLOY APPLICATION TO VPS RUMAHWEB
# ============================================
# Script ini akan:
# - Clone repository dari GitHub
# - Install dependencies
# - Setup database
# - Configure PM2
# - Start application
# ============================================

set -e

# Configuration
APP_DIR="/opt/ubt"
REPO_URL="https://github.com/rizzdkp/UBT.git"
BRANCH="main"

echo "=========================================="
echo "🚀 DEPLOYING APPLICATION"
echo "=========================================="
echo ""

# Navigate to app directory
cd /opt

# Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    echo "📦 Updating repository..."
    cd $APP_DIR
    git pull origin $BRANCH
else
    echo "📦 Cloning repository..."
    rm -rf $APP_DIR
    git clone -b $BRANCH $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create data directory for SQLite
echo "📁 Creating data directory..."
mkdir -p /opt/ubt/data

# Check if database exists
if [ ! -f "/opt/ubt/data/database.db" ]; then
    echo "🗄️ Database not found. Will be created on first run."
fi

# Setup PM2
echo "🚀 Setting up PM2..."
pm2 delete ubt-app 2>/dev/null || true
pm2 start server.js --name ubt-app --time
pm2 save

echo ""
echo "=========================================="
echo "✅ APPLICATION DEPLOYED!"
echo "=========================================="
echo ""
echo "Application running on:"
echo "  - Port: 8080"
echo "  - Directory: $APP_DIR"
echo ""
echo "PM2 Status:"
pm2 status
echo ""
echo "View logs:"
echo "  pm2 logs ubt-app"
echo ""
echo "Next step:"
echo "  - Configure Nginx reverse proxy"
echo "  - Install SSL certificate"
echo ""
