const express = require('express');
const fs = require('fs');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bwipjs = require('bwip-js');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const rateLimit = require('express-rate-limit');

// Add socket.io for real-time updates
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Trust proxy for Nginx reverse proxy
app.set('trust proxy', 1);

// Default to 3000 so URLs like http://localhost:3000 work out of the box
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Timezone Helper Functions for WIB (GMT+7)
const WIB_OFFSET = 7 * 60 * 60 * 1000; // 7 hours in milliseconds

function getWIBDate(date = new Date()) {
  // Convert to WIB (GMT+7)
  const utcTime = date.getTime();
  const wibTime = new Date(utcTime + WIB_OFFSET);
  return wibTime;
}

function formatWIBTimestamp(date = new Date()) {
  // Format: YYYY-MM-DD HH:mm:ss in WIB
  const wibDate = getWIBDate(date);
  return wibDate.toISOString().replace('T', ' ').substring(0, 19);
}

function formatWIBDate(date = new Date()) {
  // Format: YYYY-MM-DD in WIB
  const wibDate = getWIBDate(date);
  return wibDate.toISOString().substring(0, 10);
}

function getWIBTimestamp() {
  // Get current timestamp in WIB format for database
  return formatWIBTimestamp();
}

// Global error logging to diagnose crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs (increased from 5)
  message: 'Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  // store: new rateLimit.MemoryStore(), // gunakan default store bawaan
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs (increased from 100)
  standardHeaders: true,
  legacyHeaders: false,
});

// Views and static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Manifest route
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
// Enable CORS for requests from frontend. Set PUBLIC_FRONTEND_ORIGIN to the
// exact origin of your frontend (e.g. https://your-frontend.vercel.app).
// Default is '*' to allow development/testing. For production, set a specific origin.
app.use(cors({ origin: process.env.PUBLIC_FRONTEND_ORIGIN || '*' }));

// Global error logging
const errorLogPath = path.join(__dirname, 'error.log');
function logFatal(prefix, err) {
  const line = `[${formatWIBTimestamp()}] ${prefix}: ${err && err.stack ? err.stack : err}\n`;
  try { fs.appendFileSync(errorLogPath, line); } catch (_) {}
  console.error(prefix, err);
}

// Keep a single set of global error handlers
process.on('uncaughtException', (err) => logFatal('uncaughtException', err));
process.on('unhandledRejection', (reason, promise) => logFatal('unhandledRejection', reason));

// Single health check endpoint (no auth)
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', pid: process.pid, uptime: process.uptime(), port: PORT });
});

// Apply rate limiting to specific routes only
app.use('/api/', apiLimiter);

app.use(session({
  secret: 'replace-with-secure-secret-in-production',
  resave: false,
  saveUninitialized: true, // Changed to true to ensure session is created even for unauthenticated users
  cookie: {
    secure: process.env.NODE_ENV === 'production', // auto-detect HTTPS in production
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/', // Ensure cookie is available for all paths
    domain: undefined // Let Express auto-detect domain
  },
  name: 'connect.sid', // Default session cookie name
  proxy: true // Trust the reverse proxy (Nginx)
}));

// Debug middleware - log all requests to help diagnose issues
app.use((req, res, next) => {
  // Only log non-static files
  if (!req.path.startsWith('/icons/') && !req.path.startsWith('/sw.js') && !req.path.match(/\.(css|js|png|jpg|ico)$/)) {
    console.log(`[${formatWIBTimestamp()}] ${req.method} ${req.path} - Session: ${req.session?.userId || 'none'} - IP: ${req.ip}`);
  }
  next();
});

// Add timezone helper to all views
app.use((req, res, next) => {
  res.locals.formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return formatWIBTimestamp(date);
    } catch (e) {
      return dateString;
    }
  };
  
  res.locals.formatDateOnly = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return formatWIBDate(date);
    } catch (e) {
      return dateString.substring(0, 10);
    }
  };
  
  next();
});

// Authentication middleware
function requireAuth(req, res, next) {
  // Check for legacy admin session
  if (req.session && req.session.user === ADMIN_USER && req.session.userId === 0) {
    req.user = { 
      id: 0, 
      username: ADMIN_USER, 
      full_name: 'Legacy Admin', 
      role: 'admin', 
      is_active: 1 
    };
    return next();
  }
  
  // Check for regular user session
  if (req.session && req.session.userId && req.session.userId > 0) {
    // Get user from database to ensure they're still active
    db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [req.session.userId], (err, user) => {
      if (err || !user) {
        req.session.destroy();
        // Check if it's an AJAX/API request
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
          return res.status(401).json({ error: 'Session expired', redirect: '/login' });
        }
        return res.redirect('/login');
      }
      req.user = user;
      next();
    });
  } else {
    // No valid session
    // Check if it's an AJAX/API request
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({ error: 'Authentication required', redirect: '/login' });
    }
    return res.redirect('/login');
  }
}

// Role-based authorization middleware
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Activity logging middleware
function logActivity(action, targetType = 'system', targetId = null, details = null) {
  return (req, res, next) => {
    if (req.session && (req.session.user || req.session.userId !== undefined)) {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      
      // Handle both legacy admin (userId: 0) and regular users
      const userId = req.session.userId !== undefined ? req.session.userId : (req.user ? req.user.id : 0);
      
      db.run(
        `INSERT INTO activity_logs (user_id, action, target_type, target_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, action, targetType, targetId, details, ip, userAgent, getWIBTimestamp()],
        function(err) {
          if (err) {
            console.error('Activity log error:', err);
          }
        }
      );
    }
    next();
  };
}

// Simple DB (SQLite) in file. Use DATA_DIR env var (e.g. mounted persistent disk)
const dbDir = process.env.DATA_DIR || process.env.DATA_PATH || path.join(__dirname);
try { fs.mkdirSync(dbDir, { recursive: true }); } catch (e) { /* ignore */ }
const dbPath = path.join(dbDir, 'data.db');
console.log('Using SQLite DB at:', dbPath);
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  // Partners table (Mitra)
  db.run(
    `CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('klinik', 'puskesmas', 'rumah_sakit')),
      code TEXT UNIQUE NOT NULL,
      province_code TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )`
  );
  
  // Check if partner_id column exists in protocols table, if not add it
  db.all("PRAGMA table_info(protocols)", (err, columns) => {
    if (!err && columns) {
      const hasPartnerId = columns.some(col => col.name === 'partner_id');
      if (!hasPartnerId) {
        console.log('Adding partner_id column to protocols table...');
        db.run('ALTER TABLE protocols ADD COLUMN partner_id INTEGER REFERENCES partners(id)', (alterErr) => {
          if (alterErr) {
            console.log('Note: Could not add partner_id column (may already exist):', alterErr.message);
          } else {
            console.log('Successfully added partner_id column to protocols table');
          }
        });
      } else {
        console.log('partner_id column already exists in protocols table');
      }
    }
  });
  
  // Protocols table (updated with partner_id)
  db.run(
    `CREATE TABLE IF NOT EXISTS protocols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      province_code TEXT,
      partner_id INTEGER,
      created_at TEXT,
      status TEXT,
      created_by INTEGER,
      updated_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users (id),
      FOREIGN KEY (updated_by) REFERENCES users (id),
      FOREIGN KEY (partner_id) REFERENCES partners (id)
    )`
  );
  
  // Stock tracking table
  db.run(
    `CREATE TABLE IF NOT EXISTS stock_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      total_allocated INTEGER DEFAULT 0,
      total_used INTEGER DEFAULT 0,
      total_available INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (partner_id) REFERENCES partners (id)
    )`
  );
  
  // Users table
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )`
  );
  
  // Activity logs table
  db.run(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`
  );
  
  // Analytics data table
  db.run(
    `CREATE TABLE IF NOT EXISTS analytics_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      total_protocols INTEGER DEFAULT 0,
      created_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      terpakai_count INTEGER DEFAULT 0,
      unique_users INTEGER DEFAULT 0,
      scan_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  );
  
  // Migrate old roles to new roles
  db.run(`UPDATE users SET role = 'operator' WHERE role = 'viewer'`, (err) => {
    if (err) console.log('Role migration note:', err.message);
  });
  
  // Create default admin user if not exists
  db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const bcrypt = require('bcrypt');
      const adminPassword = bcrypt.hashSync('admin', 10);
      db.run(
        `INSERT INTO users (username, email, password_hash, full_name, role, is_active) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin', 'admin@system.local', adminPassword, 'System Administrator', 'admin', 1]
      );
    }
  });
});

// Legacy admin credentials (will be removed)
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';

// Legacy auth function (for backwards compatibility)
function ensureAuth(req, res, next) {
  if (req.session && (req.session.user === ADMIN_USER || req.session.userId)) {
    return next();
  }
  return res.redirect('/login');
}

// Province codes (3 letters) - updated to use 3-letter codes
const provinces = [
  { code: 'ACE', name: 'Aceh' },
  { code: 'SUT', name: 'Sumatera Utara' },
  { code: 'SUB', name: 'Sumatera Barat' },
  { code: 'RIA', name: 'Riau' },
  { code: 'JAM', name: 'Jambi' },
  { code: 'SUS', name: 'Sumatera Selatan' },
  { code: 'BBL', name: 'Bangka Belitung' },
  { code: 'BEN', name: 'Bengkulu' },
  { code: 'LAM', name: 'Lampung' },
  { code: 'DKI', name: 'DKI Jakarta' },
  { code: 'JAB', name: 'Jawa Barat' },
  { code: 'JAT', name: 'Jawa Tengah' },
  { code: 'JAI', name: 'Jawa Timur' },
  { code: 'YOG', name: 'DI Yogyakarta' },
  { code: 'BAN', name: 'Banten' },
  { code: 'BAL', name: 'Bali' },
  { code: 'NTB', name: 'Nusa Tenggara Barat' },
  { code: 'NTT', name: 'Nusa Tenggara Timur' },
  { code: 'KAB', name: 'Kalimantan Barat' },
  { code: 'KAT', name: 'Kalimantan Tengah' },
  { code: 'KAI', name: 'Kalimantan Timur' },
  { code: 'KAS', name: 'Kalimantan Selatan' },
  { code: 'KAU', name: 'Kalimantan Utara' },
  { code: 'SUS', name: 'Sulawesi Selatan' },
  { code: 'SUT', name: 'Sulawesi Tengah' },
  { code: 'SUG', name: 'Sulawesi Tenggara' },
  { code: 'SUB', name: 'Sulawesi Barat' },
  { code: 'SUN', name: 'Sulawesi Utara' },
  { code: 'MAL', name: 'Maluku' },
  { code: 'MAU', name: 'Maluku Utara' },
  { code: 'PAP', name: 'Papua' },
  { code: 'PAB', name: 'Papua Barat' }
];

app.get('/', requireAuth, requireRole('admin', 'operator'), logActivity('view_dashboard'), (req, res) => {
  const { period, start_date, end_date } = req.query;
  
  try {
    // Calculate date filter based on period using WIB timezone
    let dateFilter = '';
    let params = [];
    
    const now = getWIBDate(); // Use WIB timezone
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (period === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      dateFilter = ' WHERE p.created_at >= ?';
      params.push(formatWIBTimestamp(weekStart));
    } else if (period === 'month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      dateFilter = ' WHERE p.created_at >= ?';
      params.push(formatWIBTimestamp(monthStart));
    } else if (period === 'custom' && start_date && end_date) {
      // Parse dates in WIB timezone
      const startDateTime = formatWIBTimestamp(new Date(start_date + 'T00:00:00'));
      const endDateTime = formatWIBTimestamp(new Date(end_date + 'T23:59:59'));
      dateFilter = ' WHERE p.created_at >= ? AND p.created_at <= ?';
      params.push(startDateTime, endDateTime);
    } else {
      // Today (default) in WIB
      const todayStart = formatWIBTimestamp(today);
      const todayEnd = formatWIBTimestamp(new Date(today.getTime() + 24 * 60 * 60 * 1000));
      dateFilter = ' WHERE p.created_at >= ? AND p.created_at < ?';
      params.push(todayStart, todayEnd);
    }
    
    // Get filtered protocols for display with partner information
    db.all(
      `SELECT p.*, pt.name as partner_name, pt.type as partner_type, pt.code as partner_code 
       FROM protocols p 
       LEFT JOIN partners pt ON p.partner_id = pt.id` + 
       dateFilter + ' ORDER BY p.id DESC LIMIT 100', 
      params, 
      (err, filteredProtocols) => {
        if (err) {
          console.error('Error fetching protocols:', err);
          filteredProtocols = [];
        }
        
        // Get all protocols for statistics with same filter
        db.all(
          `SELECT p.status, p.province_code, pt.name as partner_name 
           FROM protocols p 
           LEFT JOIN partners pt ON p.partner_id = pt.id` + dateFilter, 
          params, 
          (err, statsData) => {
            if (err) {
              console.error('Error fetching stats data:', err);
              statsData = [];
            }
            
            // Calculate statistics
            const stats = {
              total: statsData.length,
              created: statsData.filter(p => p.status === 'created').length,
              delivered: statsData.filter(p => p.status === 'delivered').length,
              terpakai: statsData.filter(p => p.status === 'terpakai').length,
              topProvinces: []
            };
            
            // Calculate top provinces
            const provinceCount = {};
            statsData.forEach(p => {
              provinceCount[p.province_code] = (provinceCount[p.province_code] || 0) + 1;
            });
            
            stats.topProvinces = Object.entries(provinceCount)
              .map(([province_code, count]) => ({ 
                province_code, 
                count,
                name: provinces.find(prov => prov.code === province_code)?.name || province_code
              }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5);
            
            // Get stock summary
            db.all(
              `SELECT 
                 SUM(total_allocated) as total_allocated,
                 SUM(total_used) as total_used,
                 SUM(total_available) as total_available,
                 COUNT(*) as active_partners
               FROM stock_tracking st
               JOIN partners p ON st.partner_id = p.id
               WHERE p.is_active = 1`,
              (err, stockSummary) => {
                const stock = stockSummary?.[0] || {
                  total_allocated: 0,
                  total_used: 0,
                  total_available: 0,
                  active_partners: 0
                };
                
                // Get advanced analytics data with fallback
                getAdvancedAnalytics((analyticsData) => {
                  try {
                    res.render('dashboard', { 
                      user: req.user || { full_name: req.session.user }, 
                      protocols: filteredProtocols, 
                      provinces,
                      stats,
                      analytics: analyticsData || getDefaultAnalytics(),
                      stock,
                      req
                    });
                  } catch (renderError) {
                    console.error('Error rendering dashboard:', renderError);
                    res.status(500).send('Dashboard rendering error');
                  }
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Dashboard route error:', error);
    res.status(500).send('Internal server error');
  }
});

// Default analytics fallback
function getDefaultAnalytics() {
  return {
    dailyTrends: [],
    hourlyDistribution: [],
    metrics: {
      total_protocols: 0,
      unique_provinces: 0,
      active_days: 0,
      first_protocol: null,
      latest_protocol: null
    }
  };
}

// Advanced Analytics Function
function getAdvancedAnalytics(callback) {
  const analytics = {
    dailyTrends: [],
    hourlyDistribution: [],
    partnerPerformance: [],
    statusTrends: [],
    metrics: {
      total_protocols: 0,
      unique_provinces: 0,
      active_partners: 0,
      avg_per_day: 0,
      completion_rate: 0,
      first_protocol: null,
      latest_protocol: null
    }
  };
  
  // Get daily trends for last 30 days with partner data
  db.all(`
    SELECT 
      DATE(p.created_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN p.status = 'created' THEN 1 ELSE 0 END) as created,
      SUM(CASE WHEN p.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) as terpakai,
      COUNT(DISTINCT p.partner_id) as unique_partners
    FROM protocols p 
    LEFT JOIN partners pt ON p.partner_id = pt.id
    WHERE p.created_at >= date('now', '-30 days')
    GROUP BY DATE(p.created_at)
    ORDER BY date DESC
  `, (err, dailyTrends) => {
    if (err) {
      console.error('Error fetching daily trends:', err);
      dailyTrends = [];
    }
    analytics.dailyTrends = dailyTrends || [];
    
    // Get hourly distribution
    db.all(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as count
      FROM protocols 
      WHERE created_at >= date('now', '-7 days')
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `, (err, hourlyDistribution) => {
      if (err) {
        console.error('Error fetching hourly distribution:', err);
        hourlyDistribution = [];
      }
      analytics.hourlyDistribution = hourlyDistribution || [];
      
      // Get partner performance
      db.all(`
        SELECT 
          pt.name as partner_name,
          pt.type as partner_type,
          pt.code as partner_code,
          pt.province_code,
          COUNT(p.id) as total_protocols,
          SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) as used_protocols,
          ROUND(
            (SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(p.id), 0)), 2
          ) as usage_rate,
          DATE(MAX(p.created_at)) as last_activity
        FROM partners pt
        LEFT JOIN protocols p ON pt.id = p.partner_id
        WHERE pt.is_active = 1
        GROUP BY pt.id, pt.name, pt.type, pt.code, pt.province_code
        HAVING COUNT(p.id) > 0
        ORDER BY total_protocols DESC
        LIMIT 10
      `, (err, partnerPerformance) => {
        if (err) {
          console.error('Error fetching partner performance:', err);
          partnerPerformance = [];
        }
        analytics.partnerPerformance = partnerPerformance || [];
        
        // Get province performance
        db.all(`
          SELECT 
            p.province_code,
            COUNT(p.id) as count,
            SUM(CASE WHEN p.status = 'created' THEN 1 ELSE 0 END) as created,
            SUM(CASE WHEN p.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) as terpakai,
            ROUND(
              (SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(p.id), 0)), 2
            ) as usage_rate,
            COUNT(DISTINCT p.partner_id) as active_partners
          FROM protocols p
          LEFT JOIN partners pt ON p.partner_id = pt.id
          WHERE p.province_code IS NOT NULL
          GROUP BY p.province_code
          ORDER BY count DESC
          LIMIT 10
        `, (err, provincePerformance) => {
          if (err) {
            console.error('Error fetching province performance:', err);
            provincePerformance = [];
          }
          analytics.provincePerformance = provincePerformance || [];
          
          // Get status trends over time
          db.all(`
            SELECT 
              DATE(created_at) as date,
              status,
              COUNT(*) as count
            FROM protocols 
            WHERE created_at >= date('now', '-14 days')
            GROUP BY DATE(created_at), status
            ORDER BY date DESC, status
          `, (err, statusTrends) => {
          if (err) {
            console.error('Error fetching status trends:', err);
            statusTrends = [];
          }
          analytics.statusTrends = statusTrends || [];
          
          // Get comprehensive metrics
          db.get(`
            SELECT 
              COUNT(p.id) as total_protocols,
              COUNT(DISTINCT p.province_code) as unique_provinces,
              COUNT(DISTINCT p.partner_id) as active_partners,
              ROUND(COUNT(p.id) * 1.0 / NULLIF(COUNT(DISTINCT DATE(p.created_at)), 0), 2) as avg_per_day,
              ROUND(
                SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(p.id), 0), 2
              ) as completion_rate,
              MIN(p.created_at) as first_protocol,
              MAX(p.created_at) as latest_protocol
            FROM protocols p
            LEFT JOIN partners pt ON p.partner_id = pt.id
          `, (err, metrics) => {
            if (err) {
              console.error('Error fetching metrics:', err);
              metrics = {
                total_protocols: 0,
                unique_provinces: 0,
                active_partners: 0,
                avg_per_day: 0,
                completion_rate: 0,
                first_protocol: null,
                latest_protocol: null
              };
            }
            analytics.metrics = metrics || analytics.metrics;
            
            callback(analytics);
          });
        });
      });
    });
  });
  });
}

app.get('/login', (req, res) => {
  // Check if already logged in - be more specific
  if (req.session && req.session.user === ADMIN_USER && req.session.userId === 0) {
    return res.redirect('/');
  }
  if (req.session && req.session.userId && req.session.userId > 0) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

// Test route to debug
app.get('/test-session', (req, res) => {
  res.json({
    session: req.session,
    cookies: req.headers.cookie,
    body: req.body
  });
});

// Development route to reset rate limiting (remove in production)
app.get('/reset-limits', (req, res) => {
  authLimiter.resetKey(req.ip);
  res.json({ 
    message: 'Rate limits berhasil direset untuk IP Anda',
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
});

app.post('/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', { username, hasPassword: !!password });
  console.log('Current session before login:', req.session);
  
  // Legacy admin login (backwards compatibility)
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    console.log('Legacy admin login successful');
    req.session.user = ADMIN_USER;
    req.session.userId = 0; // Legacy admin ID
    console.log('Session after legacy login:', req.session);
    return res.redirect('/'); // Legacy admin always goes to dashboard
  }
  
  // New user authentication
  if (!username || !password) {
    console.log('Missing username or password');
    return res.render('login', { error: 'Username dan password harus diisi' });
  }
  
  db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
    if (err) {
      return res.render('login', { error: 'Database error' });
    }
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.render('login', { error: 'Invalid username or password' });
    }
    
    // Update last login with WIB timestamp
    db.run('UPDATE users SET last_login = ? WHERE id = ?', [getWIBTimestamp(), user.id]);
    
    // Log login activity
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    db.run(
      `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [user.id, 'login', ip, userAgent, getWIBTimestamp()]
    );
    
    // Set session
    req.session.userId = user.id;
    req.session.user = user.username; // For backwards compatibility
    
    // Redirect based on role
    if (user.role === 'distribusi') {
      return res.redirect('/scanner');
    }
    
    res.redirect('/');
  });
});

// User Management Routes
app.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  // Get all users
  db.all('SELECT * FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) users = [];
    
    // Get recent activity
    db.all(`
      SELECT al.*, u.username 
      FROM activity_logs al 
      JOIN users u ON al.user_id = u.id 
      ORDER BY al.created_at DESC 
      LIMIT 20
    `, (err, recentActivity) => {
      if (err) recentActivity = [];
      
      res.render('users', { 
        user: req.user, 
        users, 
        recentActivity 
      });
    });
  });
});

app.post('/users', requireAuth, requireRole('admin'), logActivity('create_user', 'user'), (req, res) => {
  const { username, email, full_name, role, password, confirm_password } = req.body;
  
  // Validation
  if (!username || !email || !full_name || !role || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (!['operator', 'distribusi', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  // Check if username or email already exists
  db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, existing) => {
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);
    
    // Create user
    db.run(
      `INSERT INTO users (username, email, password_hash, full_name, role, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, passwordHash, full_name, role, req.user.id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create user' });
        }
        res.redirect('/users');
      }
    );
  });
});

app.post('/users/:id/toggle-status', requireAuth, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT is_active, username FROM users WHERE id = ?', [id], (err, user) => {
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const newStatus = user.is_active ? 0 : 1;
    
    db.run('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update user status' });
      }
      
      // Log activity
      db.run(
        `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, newStatus ? 'activate_user' : 'deactivate_user', 'user', id, `User ${user.username} ${newStatus ? 'activated' : 'deactivated'} by admin`]
      );
      
      res.json({ 
        success: true, 
        message: `User ${newStatus ? 'activated' : 'deactivated'} successfully` 
      });
    });
  });
});

app.post('/users/:id/reset-password', requireAuth, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  
  // Validate password
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to reset password' });
    }
    
    // Log activity
    db.run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'reset_password', 'user', id, `Password reset by admin (${req.user.username})`]
    );
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Partners Management Routes
app.get('/partners', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  db.all(
    `SELECT p.*, u.username as created_by_username, 
     (SELECT COUNT(*) FROM protocols WHERE partner_id = p.id) as protocol_count
     FROM partners p 
     LEFT JOIN users u ON p.created_by = u.id 
     ORDER BY p.created_at DESC`,
    (err, partners) => {
      if (err) {
        console.error('Error fetching partners:', err);
        return res.status(500).send('Database error');
      }
      
      res.render('partners', { 
        user: req.session.user || req.user, 
        partners: partners || [],
        provinces: provinces
      });
    }
  );
});

app.post('/partners', requireAuth, requireRole('admin', 'operator'), logActivity('create_partner', 'partner'), (req, res) => {
  const { name, type, code, province_code, address, phone, email } = req.body;
  
  // Validate input
  if (!name || !type || !code || !province_code) {
    return res.status(400).send('Nama, jenis, kode, dan provinsi harus diisi');
  }
  
  if (!['klinik', 'puskesmas', 'rumah_sakit'].includes(type)) {
    return res.status(400).send('Jenis mitra tidak valid');
  }
  
  if (!validator.isAlphanumeric(code.replace(/[-_]/g, ''))) {
    return res.status(400).send('Kode harus berupa alfanumerik');
  }
  
  db.run(
    'INSERT INTO partners (name, type, code, province_code, address, phone, email, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, type, code.toUpperCase(), province_code, address, phone, email, req.session.userId],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).send('Kode mitra sudah digunakan');
        }
        console.error('Error creating partner:', err);
        return res.status(500).send('Database error');
      }
      
      // Initialize stock tracking for new partner
      db.run(
        'INSERT INTO stock_tracking (partner_id, total_allocated, total_used, total_available) VALUES (?, 0, 0, 0)',
        [this.lastID],
        (stockErr) => {
          if (stockErr) {
            console.error('Error initializing stock tracking:', stockErr);
          }
          res.redirect('/partners');
        }
      );
    }
  );
});

app.post('/partners/:id/toggle-status', requireAuth, requireRole('admin'), (req, res) => {
  const partnerId = req.params.id;
  
  db.get('SELECT is_active FROM partners WHERE id = ?', [partnerId], (err, partner) => {
    if (err || !partner) {
      return res.status(404).send('Mitra tidak ditemukan');
    }
    
    const newStatus = partner.is_active ? 0 : 1;
    
    db.run(
      'UPDATE partners SET is_active = ?, updated_at = ? WHERE id = ?',
      [newStatus, getWIBTimestamp(), partnerId],
      (err) => {
        if (err) {
          console.error('Error updating partner status:', err);
          return res.status(500).send('Database error');
        }
        res.redirect('/partners');
      }
    );
  });
});

// API endpoint to get partners by province (for AJAX)
app.get('/api/partners/:provinceCode', requireAuth, (req, res) => {
  const provinceCode = req.params.provinceCode;
  
  db.all(
    'SELECT id, name, type, code FROM partners WHERE province_code = ? AND is_active = 1 ORDER BY name',
    [provinceCode],
    (err, partners) => {
      if (err) {
        console.error('Error fetching partners:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(partners || []);
    }
  );
});

// API endpoint to add partner via AJAX
app.post('/api/partners', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const { name, type, code, province_code, phone, address } = req.body;
  
  // Validate input
  if (!name || !type || !code || !province_code) {
    return res.status(400).json({ error: 'Nama, jenis, kode, dan provinsi harus diisi' });
  }
  
  if (!['klinik', 'puskesmas', 'rumah_sakit'].includes(type)) {
    return res.status(400).json({ error: 'Jenis mitra tidak valid' });
  }
  
  if (!validator.isAlphanumeric(code.replace(/[-_]/g, ''))) {
    return res.status(400).json({ error: 'Kode harus berupa alfanumerik' });
  }
  
  db.run(
    'INSERT INTO partners (name, type, code, province_code, address, phone, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, type, code.toUpperCase(), province_code, address, phone, req.session.userId],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Kode mitra sudah digunakan' });
        }
        console.error('Error creating partner:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Initialize stock tracking for new partner
      db.run(
        'INSERT INTO stock_tracking (partner_id, total_allocated, total_used, total_available) VALUES (?, 0, 0, 0)',
        [this.lastID],
        (stockErr) => {
          if (stockErr) {
            console.error('Error initializing stock tracking:', stockErr);
          }
          
          res.json({
            success: true,
            partner: {
              id: this.lastID,
              name: name,
              type: type,
              code: code.toUpperCase(),
              province_code: province_code
            }
          });
        }
      );
    }
  );
});

// API endpoint to get stock status
app.get('/api/stock', requireAuth, (req, res) => {
  db.all(
    `SELECT 
       p.id,
       p.name,
       p.type,
       p.code,
       p.province_code,
       st.total_allocated,
       st.total_used,
       st.total_available,
       st.last_updated
     FROM partners p
     LEFT JOIN stock_tracking st ON p.id = st.partner_id
     WHERE p.is_active = 1
     ORDER BY p.name`,
    (err, stockData) => {
      if (err) {
        console.error('Error fetching stock data:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(stockData || []);
    }
  );
});

// Create protocol form (admin and operator only)
app.post('/protocols', requireAuth, requireRole('admin', 'operator'), logActivity('create_protocol'), (req, res) => {
  const { province, partner_id, quantity } = req.body;
  
  // Validate inputs
  const prov = provinces.find(p => p.code === province);
  if (!prov) return res.status(400).send('Invalid province');
  
  if (!partner_id) return res.status(400).send('Partner is required');
  
  // Validate quantity
  const qty = parseInt(quantity) || 1;
  if (qty < 1 || qty > 100) {
    return res.status(400).send('Quantity must be between 1 and 100');
  }
  
  // Verify partner exists and is active
  db.get('SELECT * FROM partners WHERE id = ? AND is_active = 1', [partner_id], (err, partner) => {
    if (err || !partner) {
      return res.status(400).send('Invalid or inactive partner');
    }
    
    // Build code base: YYYYMMDD + province code (3 chars) + partner code + timestamp
    // Use WIB timezone
    const now = getWIBDate();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Add timestamp to ensure uniqueness (last 6 digits of timestamp)
    const timestamp = Date.now().toString().slice(-6);
    const codeBase = `${dateStr}${province}${partner.code}${timestamp}`;
    
    // Create protocols in batch
    const protocols = [];
    const createdAt = getWIBTimestamp(); // Use WIB timestamp
    const stmt = db.prepare(
      'INSERT INTO protocols (code, province_code, partner_id, created_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    );
    
    for (let i = 1; i <= qty; i++) {
      const code = qty === 1 ? codeBase : `${codeBase}_${String(i).padStart(3, '0')}`;
      protocols.push(code);
      
      stmt.run([code, province, partner_id, createdAt, 'created', req.session.userId || 0], function(err) {
        if (err) {
          console.error('Error creating protocol:', err);
        }
      });
    }
    
    stmt.finalize((err) => {
      if (err) {
        console.error('Error finalizing protocol creation:', err);
        return res.status(500).send('Database error');
      }
      
      // Update stock tracking with quantity
      db.run(
        `UPDATE stock_tracking 
         SET total_allocated = total_allocated + ?,
             total_available = total_available + ?,
             last_updated = ? 
         WHERE partner_id = ?`,
        [qty, qty, getWIBTimestamp(), partner_id],
        (stockErr) => {
          if (stockErr) {
            console.error('Error updating stock:', stockErr);
          }
          
          // Emit real-time update
          io.emit('protocol_created', {
            codes: protocols,
            quantity: qty,
            partner: partner.name,
            province: province
          });
          
          res.redirect('/?success=' + encodeURIComponent(`${qty} protocol(s) created successfully! Codes: ${protocols.join(', ')}`));
        }
      );
    });
  });
});

// Update status
app.post('/protocols/:id/status', requireAuth, requireRole('admin', 'operator'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // Get current protocol data
  db.get('SELECT * FROM protocols WHERE id = ?', [id], (err, oldProtocol) => {
    if (err || !oldProtocol) {
      return res.status(404).send('Protocol not found');
    }
    
    db.run('UPDATE protocols SET status = ?, updated_by = ? WHERE id = ?', [status, req.session.userId || 0, id], function (err) {
      if (err) return res.status(500).send('Failed to update status');
      
      // Update stock tracking if status changed to/from 'terpakai'
      if (oldProtocol.partner_id) {
        let stockChange = 0;
        
        // If changing from non-terpakai to terpakai
        if (oldProtocol.status !== 'terpakai' && status === 'terpakai') {
          stockChange = 1; // Increase used count
        }
        // If changing from terpakai to non-terpakai
        else if (oldProtocol.status === 'terpakai' && status !== 'terpakai') {
          stockChange = -1; // Decrease used count
        }
        
        if (stockChange !== 0) {
          db.run(
            `UPDATE stock_tracking 
             SET total_used = total_used + ?,
                 total_available = total_available - ?,
                 last_updated = ? 
             WHERE partner_id = ?`,
            [stockChange, stockChange, getWIBTimestamp(), oldProtocol.partner_id],
            (stockErr) => {
              if (stockErr) {
                console.error('Error updating stock:', stockErr);
              }
            }
          );
        }
      }
      
      // Emit real-time update
      io.emit('status_updated', {
        protocol: {
          id: oldProtocol.id,
          code: oldProtocol.code,
          newStatus: status,
          oldStatus: oldProtocol.status
        }
      });
      
      res.redirect('/');
    });
  });
});

// Barcode image endpoint (QR Code for better mobile scanning)
app.get('/barcode/:code.png', ensureAuth, (req, res) => {
  const { code } = req.params;
  try {
    bwipjs.toBuffer({
      bcid: 'qrcode',       // Changed from code128 to qrcode
      text: code,
      scale: 4,
      // QR-specific options. Do not pass width/height which are for 1D barcodes.
      eclevel: 'M',         // Error correction level (L,M,Q,H)
    }, function (err, png) {
      if (err) {
        console.error('bwip-js qrcode error:', err);
        return res.status(500).send('Barcode generation error: ' + (err.message || err));
      }
      res.type('png');
      res.send(png);
    });
  } catch (e) {
    console.error('Barcode generation exception:', e);
    res.status(500).send('Barcode generation exception: ' + (e.message || e));
  }
});

// Download barcode endpoint (QR Code for better mobile scanning)
app.get('/download/barcode/:code.png', ensureAuth, (req, res) => {
  const { code } = req.params;
  try {
    bwipjs.toBuffer({
      bcid: 'qrcode',       // Changed from code128 to qrcode
      text: code,
      scale: 8,             // Larger scale for download
      eclevel: 'M',
    }, function (err, png) {
      if (err) {
        console.error('bwip-js qrcode download error:', err);
        return res.status(500).send('Barcode generation error: ' + (err.message || err));
      }
      res.setHeader('Content-Disposition', `attachment; filename="qrcode-${code}.png"`);
      res.type('png');
      res.send(png);
    });
  } catch (e) {
    console.error('Barcode generation exception (download):', e);
    res.status(500).send('Barcode generation exception: ' + (e.message || e));
  }
});

// Lookup code endpoint - returns JSON (authenticated users only)
app.get('/scan/:code', requireAuth, (req, res) => {
  const { code } = req.params;
  db.get('SELECT * FROM protocols WHERE code = ?', [code], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    
    // Format the response with readable time
    const response = {
      ...row,
      created_at_formatted: new Date(row.created_at).toLocaleString('id-ID', { 
        dateStyle: 'full', 
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta'
      })
    };
    
    res.json(response);
  });
});

// Scanner page (accessible by all authenticated users)
app.get('/scanner', requireAuth, (req, res) => {
  res.render('scanner', { user: req.user });
});

// API endpoint to confirm status change from scanner (all authenticated users)
app.post('/api/confirm-usage/:code', requireAuth, (req, res) => {
  const { code } = req.params;
  const { action } = req.body; // 'mark_terpakai' or 'mark_delivered'
  
  // First check if code exists
  db.get('SELECT * FROM protocols WHERE code = ?', [code], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Code not found' });
    
    let newStatus = 'terpakai';
    if (action === 'mark_delivered') newStatus = 'delivered';
    
    // Update status
    db.run('UPDATE protocols SET status = ? WHERE code = ?', [newStatus, code], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to update status' });
      
      // Log activity
      if (req.user && req.user.id) {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        db.run(
          `INSERT INTO activity_logs (user_id, action, target_type, target_id, details, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [req.user.id, `scan_${newStatus}`, 'protocol', code, `Scanned and marked as ${newStatus}`, ip, userAgent]
        );
      }
      
      // Emit real-time update to dashboard
      io.emit('status_updated', { 
        code: code, 
        newStatus: newStatus,
        protocol: { ...row, status: newStatus }
      });
      
      res.json({ 
        success: true, 
        message: `Status updated to ${newStatus}`,
        protocol: { ...row, status: newStatus }
      });
    });
  });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected for real-time updates');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Optional: redirect agar tautan /dashboard tidak 404
app.get('/dashboard', (req, res) => res.redirect('/'));

// Start server (using existing server instance)
// Listen on 0.0.0.0 to bind to all network interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Server also available on http://127.0.0.1:${PORT}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Access the app at: http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Optional: redirect agar tautan /dashboard tidak 404
app.get('/dashboard', (req, res) => res.redirect('/'));
