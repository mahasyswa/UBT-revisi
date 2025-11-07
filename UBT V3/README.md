# 🏥 UBT MedTech - Barcode Protocol System

Sistem manajemen protokol medis menggunakan **QR Code** untuk tracking dan monitoring distribusi peralatan medis ke mitra kesehatan (klinik, puskesmas, rumah sakit). Aplikasi ini membantu memantau status distribusi dengan sistem role-based access control.

## ✨ Features

- 👥 **3-Role System** - Admin, Operator, Distribusi dengan akses berbeda
- 🏢 **Partner Management** - Kelola mitra kesehatan per provinsi
- 📊 **Real-time Dashboard** - Analytics, charts, dan live stock tracking
- 🔲 **QR Code Generation** - Generate QR code untuk setiap protokol
- 📷 **Mobile Scanner** - Scan QR code dengan kamera HP (HTTPS required)
- � **Status Tracking** - Created → Delivered → Terpakai
- � **Analytics & Reports** - Daily trends, hourly distribution, partner performance
- 📱 **Mobile-First Design** - Optimized UI/UX untuk smartphone
- 🔒 **Enterprise Security** - Rate limiting, trust proxy, SSL/TLS ready
- 📋 **Activity Logs** - Audit trail lengkap
- ⚡ **Real-time Updates** - Socket.io untuk notifikasi instant

## 🚀 Quick Start (Local Development)

**Prerequisites:** 
- Node.js v18 or higher
- npm or yarn

```bash
# Clone repository
git clone https://github.com/rizzdkp/UBT.git
cd UBT

# Install dependencies
npm install

# Start development server
npm start
```

Server berjalan di **http://localhost:8080**

**Default Login:**
- Username: `admin`
- Password: `admin123`
- ⚠️ **PENTING:** Ubah password default setelah login pertama kali!

## 📦 Production Deployment

### Option 1: VPS / Cloud VM (Recommended for Full Features)

Aplikasi ini sudah production-ready dengan deployment scripts untuk Ubuntu/Debian.

**Features yang memerlukan VPS:**
- ✅ SQLite database dengan persistent storage
- ✅ Real-time socket.io connections
- ✅ Camera/QR scanner (butuh HTTPS)
- ✅ File upload & download QR codes
- ✅ Full control atas server

**Deployment Steps:**

1. **Prepare VPS** (Ubuntu 20.04+ / Debian 11+)
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18.x
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install PM2, Nginx, Certbot
   sudo npm install -g pm2
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Clone & Setup Application**
   ```bash
   # Clone repository
   git clone https://github.com/rizzdkp/UBT.git /opt/ubt
   cd /opt/ubt
   
   # Install dependencies
   npm ci --production
   
   # Set environment
   export NODE_ENV=production
   
   # Start with PM2
   pm2 start server.js --name ubt-app
   pm2 save
   pm2 startup
   ```

3. **Configure Nginx**
   ```nginx
   # /etc/nginx/sites-available/ubt
   server {
       listen 80;
       server_name your-domain.com;
       
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
       }
   }
   ```
   
   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/ubt /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Setup SSL (Required for Camera/Scanner)**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

5. **Firewall Configuration**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

**Automated Deployment Scripts:**

Repository includes pre-configured deployment scripts di folder `deploy/vps-rumahweb/`:
- `setup-new-vps.sh` - Initial VPS setup
- `deploy-app.sh` - Application deployment
- `setup-nginx.sh` - Nginx configuration
- `setup-ssl.sh` - SSL/Certbot setup

### Option 2: Render.com (Easy & Free Tier Available)

Lihat panduan lengkap di **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)**

**Pros:**
- ✅ Free tier available
- ✅ Auto SSL/HTTPS
- ✅ Auto deploy from Git
- ✅ Zero configuration

**Cons:**
- ⚠️ Free tier spins down after inactivity
- ⚠️ Limited resources

### Option 3: Railway / Heroku

File konfigurasi tersedia:
- `Procfile` - Process definition
- `package.json` - Build scripts ready

## 🗂️ Project Structure

```
UBT/
├── server.js                 # Main Express application
├── data.db                   # SQLite database (auto-created)
├── package.json             # Dependencies & scripts
├── Procfile                 # Railway/Heroku config
├── render.yaml              # Render.com config
│
├── deploy/                  # Deployment automation
│   └── vps-rumahweb/       # VPS deployment scripts
│       ├── setup-new-vps.sh
│       ├── deploy-app.sh
│       ├── setup-nginx.sh
│       └── setup-ssl.sh
│
├── public/                  # Static assets
│   ├── styles.css          # Main stylesheet
│   ├── mobile-responsive.css  # Mobile optimizations
│   ├── scanner.css         # QR scanner styles
│   ├── manifest.json       # PWA manifest
│   ├── sw.js              # Service Worker (optional)
│   └── icons/             # PWA icons
│
└── views/                   # EJS templates
    ├── login.ejs           # Login page (mobile-optimized)
    ├── dashboard.ejs       # Admin dashboard
    ├── partners.ejs        # Partner management
    ├── scanner.ejs         # QR code scanner
    └── users.ejs           # User management
```

## 🔧 Configuration

**Environment Variables:**
```env
# Server
PORT=8080
NODE_ENV=production

# Security (CHANGE THESE!)
JWT_SECRET=your-secret-key-change-this
SESSION_SECRET=your-session-secret-change-this

# Optional: Database path
DB_PATH=./data.db
```

**Important Notes:**
- ⚠️ **Ganti JWT_SECRET dan SESSION_SECRET** di production!
- ⚠️ **Ubah password default admin** setelah deployment
- ⚠️ **Enable trust proxy** jika di belakang Nginx/reverse proxy (sudah di-set di code)

## 📱 Mobile Features & UI/UX

### Mobile-First Design
- ✅ **Responsive Breakpoints:** 320px, 480px, 768px, 1024px, 1920px
- ✅ **Touch-Optimized:** Minimum 44x44px touch targets (Apple guidelines)
- ✅ **Hamburger Menu:** Slide-in navigation untuk mobile
- ✅ **PWA Support:** Install ke home screen, offline-capable
- ✅ **Camera Access:** Native QR scanner dengan html5-qrcode

### Scanner Requirements
- 📱 **HTTPS Required:** Camera API memerlukan SSL/TLS
- 📷 **Browser Support:** Chrome/Safari mobile (recommended)
- 🔲 **QR Format:** Standard QR codes dengan protocol code

### Mobile UI Improvements
- Icon positioning yang presisi (login page)
- Checkbox spacing optimization
- Password toggle (eye icon) centered & accessible
- Full-width buttons untuk easy tap
- Vertical layout untuk form controls
- Smooth animations & transitions

## 🛠️ Tech Stack

**Backend:**
- Node.js v18.x
- Express.js 4.x
- SQLite3 (persistent storage)

**Authentication & Security:**
- JWT tokens
- bcrypt password hashing
- express-session
- express-rate-limit (100 req/15min)
- Input validation (validator.js)
- Trust proxy support for Nginx

**Real-time:**
- Socket.io v4.x (live updates)

**Frontend:**
- EJS templates
- Vanilla JavaScript (no framework overhead)
- Chart.js (analytics)
- html5-qrcode (scanner)

**Barcode/QR:**
- bwip-js v2.x (QR generation server-side)
- QR Code format dengan error correction level M

**Styling:**
- Custom CSS dengan CSS Variables
- Mobile-responsive design
- Touch-friendly UI components

## 🔒 Security Features

- ✅ **Rate Limiting:** 100 requests per 15 minutes per IP
- ✅ **Password Hashing:** bcrypt dengan salt rounds 10
- ✅ **JWT Authentication:** Secure token-based auth
- ✅ **Session Management:** express-session dengan secure cookies
- ✅ **Input Validation:** validator.js untuk sanitasi input
- ✅ **Trust Proxy:** Support untuk Nginx/reverse proxy (X-Forwarded-For)
- ✅ **HTTPS Ready:** SSL/TLS configuration included
- ✅ **CORS Protection:** Configured untuk production
- ✅ **SQL Injection Prevention:** Parameterized queries
- ✅ **XSS Protection:** Input sanitization & output encoding

**Security Best Practices:**
1. Ganti `JWT_SECRET` dan `SESSION_SECRET` dengan random string
2. Ubah password default admin
3. Enable HTTPS di production (wajib untuk camera)
4. Set `NODE_ENV=production`
5. Review activity logs secara berkala
6. Backup database secara rutin

## 🎯 Use Cases

### Admin Role
- Kelola semua user (create, edit, delete, toggle status)
- Manage partners (klinik, puskesmas, rumah sakit)
- Create protocols dan generate QR codes
- View analytics & reports
- Access activity logs

### Operator Role
- Create protocols untuk partners
- Manage partners
- Update protocol status
- View dashboard & analytics
- Limited user management

### Distribusi Role (Viewer)
- View protocols & stock
- Scan QR codes untuk update status
- View analytics (read-only)
- No edit permissions

## � Features Overview

### Protocol Management
- Generate QR codes dengan timestamp unik
- Batch creation (1-100 protocols at once)
- Status tracking: Created → Delivered → Terpakai
- Real-time stock updates
- Download QR as PNG

### Partner Management
- Add/edit partners per province
- Partner types: Klinik, Puskesmas, Rumah Sakit
- Stock tracking per partner
- Usage rate monitoring
- Activity history

### Dashboard & Analytics
- Live metrics (total protocols, provinces, partners)
- Daily trends (last 30 days)
- Hourly distribution (last 7 days)
- Status distribution pie charts
- Province performance charts
- Partner performance table dengan usage rates

### QR Scanner
- Mobile camera integration
- Auto-focus & continuous scan
- Result validation
- Status update form
- History tracking

## 🐛 Troubleshooting

### Camera tidak bisa diakses
- ✅ Pastikan menggunakan **HTTPS** (bukan HTTP)
- ✅ Check browser permissions untuk camera
- ✅ Gunakan Chrome/Safari terbaru
- ✅ Test di https://your-domain.com/scanner

### QR Code tidak generate
- ✅ Check PM2 logs: `pm2 logs ubt-app`
- ✅ Verify bwip-js installed: `npm list bwip-js`
- ✅ Check server errors di console
- ✅ Test endpoint: `curl http://localhost:8080/barcode/TEST.png`

### Login gagal
- ✅ Pastikan default admin ada di database
- ✅ Check JWT_SECRET di environment
- ✅ Clear browser cookies/cache
- ✅ Verify bcrypt installed correctly

### Socket.io tidak connect
- ✅ Check Nginx websocket configuration
- ✅ Verify `proxy_set_header Upgrade $http_upgrade`
- ✅ Check firewall rules
- ✅ Test socket di browser console

### Mobile UI berantakan
- ✅ Hard refresh (Ctrl+Shift+R)
- ✅ Clear browser cache
- ✅ Check mobile-responsive.css loaded
- ✅ Verify viewport meta tag

## 📄 License

ISC License - Open source

## 🤝 Contributing

Contributions welcome! Please:
1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📧 Support & Contact

- **Issues:** Open issue di GitHub repository
- **Documentation:** Lihat file RENDER_DEPLOYMENT.md dan CLEANUP_SUMMARY.md
- **Updates:** Check commits untuk latest changes

---

**Built with ❤️ for healthcare distribution management**
