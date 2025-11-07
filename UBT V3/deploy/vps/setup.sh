#!/usr/bin/env bash
set -euo pipefail

# Basic unattended setup script for Ubuntu/Debian VPS to run the UBT app
# Run this as root (or via sudo) on the VPS. It will:
# - install Node.js 18, nginx, sqlite3, certbot, pm2
# - create directories (/opt/ubt and /data)
# - clone repository (you can change GIT_REPO)
# - install node dependencies and start app with pm2

GIT_REPO="https://github.com/rizzdkp/UBT.git"
APP_DIR="/opt/ubt"
DATA_DIR="/data"
USER="root"
BRANCH="main"

echo "Starting VPS setup for UBT..."

apt-get update
apt-get install -y curl gnupg build-essential git nginx sqlite3 python3-certbot-nginx

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install pm2
npm install -g pm2@5

# Create app and data directories
mkdir -p "$APP_DIR"
mkdir -p "$DATA_DIR"
chown -R "$USER":"$USER" "$APP_DIR" "$DATA_DIR"

echo "Cloning repository into $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo already exists, pulling latest..."
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$GIT_REPO" "$APP_DIR"
fi

cd "$APP_DIR"

echo "Installing npm dependencies..."
npm install --production

# Prepare .env file
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "# You must edit .env and set secrets before starting the app" >> .env
  else
    cat > .env <<EOF
PORT=8080
NODE_ENV=production
DATA_DIR=$DATA_DIR
JWT_SECRET=change-me
SESSION_SECRET=change-me
EOF
  fi
  echo "Created .env from example. Edit .env to set secure secrets (JWT_SECRET, SESSION_SECRET)."
fi

echo "Ensure DATA_DIR is set in .env"
grep -q "DATA_DIR" .env || echo "DATA_DIR=$DATA_DIR" >> .env

# Start the app with pm2
echo "Starting app with pm2..."
pm2 start server.js --name ubt --cwd "$APP_DIR" --time
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "Reloading nginx configuration placeholder. You'll need to place the nginx site config and obtain Let's Encrypt certs."
systemctl restart nginx || true

echo "Setup complete. Edit /opt/ubt/.env to set secure secrets and adjust config. Then visit the server IP in browser (http://<server-ip>:8080) or configure nginx to proxy port 80/443 to the app."

echo "Helpful next steps:"
echo " - Configure nginx site file (see deploy/vps/nginx_ubt.conf.template) and enable it." 
echo " - Set up DNS and run: certbot --nginx -d your.domain.tld"
echo " - Check pm2 logs: pm2 logs ubt"

exit 0
