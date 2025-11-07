VPS deployment guide (Ubuntu/Debian)
=================================

This folder contains helper scripts and templates to deploy the UBT backend onto a VPS (Ubuntu/Debian).

Prerequisites
-------------
- A VPS running Ubuntu 20.04/22.04 or Debian with root access
- A domain name (recommended) pointing to the VPS IP (for TLS)

Quick automated setup (recommended for testing)
----------------------------------------------
1. SSH into your VPS as root or a user with sudo:

```bash
ssh root@your.vps.ip.address
```

2. Download and run the setup script (this will clone the repo into /opt/ubt):

```bash
mkdir -p /opt/ubt && cd /opt/ubt
curl -fsSL https://raw.githubusercontent.com/rizzdkp/UBT/main/deploy/vps/setup.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

3. Edit `/opt/ubt/.env` and set secure values for `JWT_SECRET` and `SESSION_SECRET`. Ensure `DATA_DIR=/data` is present.

4. Create an nginx site using the provided template:

```bash
sudo cp /opt/ubt/deploy/vps/nginx_ubt.conf.template /etc/nginx/sites-available/ubt
sudo sed -i 's/your.domain.tld/your.domain.tld/g' /etc/nginx/sites-available/ubt
sudo ln -s /etc/nginx/sites-available/ubt /etc/nginx/sites-enabled/ubt
sudo nginx -t && sudo systemctl reload nginx
```

5. (If you have a domain) obtain TLS certs with Certbot:

```bash
sudo certbot --nginx -d your.domain.tld
```

6. Verify the app is running:

```bash
pm2 status
pm2 logs ubt
curl -sS https://your.domain.tld/healthz
```

Manual steps (if you prefer not to use the script)
------------------------------------------------
1. Install packages:

```bash
sudo apt update
sudo apt install -y curl gnupg build-essential git nginx sqlite3 python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2@5
```

2. Clone repo and install dependencies:

```bash
sudo mkdir -p /opt/ubt
sudo chown $USER:$USER /opt/ubt
git clone https://github.com/rizzdkp/UBT.git /opt/ubt
cd /opt/ubt
npm install --production
```

3. Create `/data` and set env var `DATA_DIR=/data` in `.env`.

4. Start app with pm2:

```bash
pm2 start server.js --name ubt --cwd /opt/ubt --time
pm2 save
pm2 startup systemd
```

5. Configure nginx and certbot as described above.

Security notes
--------------
- After initial setup, change `JWT_SECRET` and `SESSION_SECRET` in `/opt/ubt/.env` to strong random values.
- Consider creating a non-root user to run the app for security.
- Configure UFW to allow only necessary ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

If you get errors during any step, copy the failing command output and paste it here and I will help debug.
