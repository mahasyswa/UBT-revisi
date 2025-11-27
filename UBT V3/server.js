const express = require("express");
const fs = require("fs");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const bwipjs = require("bwip-js");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const rateLimit = require("express-rate-limit");

// Add socket.io for real-time updates
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Trust proxy for Nginx reverse proxy
app.set("trust proxy", 1);

const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

// Timezone Helper Functions for WIB (GMT+7)
const WIB_OFFSET = 7 * 60 * 60 * 1000;

function getWIBDate(date = new Date()) {
  const utcTime = date.getTime();
  const wibTime = new Date(utcTime + WIB_OFFSET);
  return wibTime;
}

function formatWIBTimestamp(date = new Date()) {
  const wibDate = getWIBDate(date);
  return wibDate.toISOString().replace("T", " ").substring(0, 19);
}

function formatWIBDate(date = new Date()) {
  const wibDate = getWIBDate(date);
  return wibDate.toISOString().substring(0, 10);
}

function getWIBTimestamp() {
  return formatWIBTimestamp();
}

// Global error logging - SINGLE SET ONLY
const errorLogPath = path.join(__dirname, "error.log");
function logFatal(prefix, err) {
  const line = `[${formatWIBTimestamp()}] ${prefix}: ${err && err.stack ? err.stack : err}\n`;
  try {
    fs.appendFileSync(errorLogPath, line);
  } catch (_) {}
  console.error(prefix, err);
}

process.on("uncaughtException", (err) => logFatal("uncaughtException", err));
process.on("unhandledRejection", (reason, promise) =>
  logFatal("unhandledRejection", reason)
);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message:
    "Terlalu banyak percobaan login. Silakan coba lagi setelah 15 menit.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// Views and static
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "manifest.json"));
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: process.env.PUBLIC_FRONTEND_ORIGIN || "*" }));

// Apply rate limiting
app.use("/api/", apiLimiter);

// Session configuration - FIXED for development
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "replace-with-secure-secret-in-production",
    resave: false,
    saveUninitialized: true, // true untuk development
    cookie: {
      secure: false, // false untuk HTTP development
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    },
    name: "connect.sid",
    proxy: true,
    rolling: true,
  })
);

// Debug middleware
app.use((req, res, next) => {
  if (
    !req.path.startsWith("/icons/") &&
    !req.path.startsWith("/sw.js") &&
    !req.path.match(/\.(css|js|png|jpg|ico)$/)
  ) {
    console.log(
      `[${formatWIBTimestamp()}] ${req.method} ${req.path} - Session: ${req.session?.userId || "none"} - IP: ${req.ip}`
    );
  }
  next();
});

// Timezone helpers
app.use((req, res, next) => {
  res.locals.formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return formatWIBTimestamp(date);
    } catch (e) {
      return dateString;
    }
  };

  res.locals.formatDateOnly = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return formatWIBDate(date);
    } catch (e) {
      return dateString.substring(0, 10);
    }
  };

  next();
});

// Database setup
const dbDir =
  process.env.DATA_DIR || process.env.DATA_PATH || path.join(__dirname);
try {
  fs.mkdirSync(dbDir, { recursive: true });
} catch (e) {}
const dbPath = path.join(dbDir, "data.db");
console.log("Using SQLite DB at:", dbPath);
const db = new sqlite3.Database(dbPath);

// Database initialization
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS partner (
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

  db.all("PRAGMA table_info(protocols)", (err, columns) => {
    if (!err && columns) {
      const hasPartnerId = columns.some((col) => col.name === "partner_id");
      if (!hasPartnerId) {
        console.log("Adding partner_id column to protocols table...");
        db.run(
          "ALTER TABLE protocols ADD COLUMN partner_id INTEGER REFERENCES partner(id)",
          (alterErr) => {
            if (alterErr) {
              console.log(
                "Note: Could not add partner_id column:",
                alterErr.message
              );
            } else {
              console.log("Successfully added partner_id column");
            }
          }
        );
      }

      // Add patient data columns if they don't exist
      const patientColumns = [
        "patient_name",
        "healthcare_facility",
        "occupation",
        "marital_status",
        "gpa",
        "address",
        "phone",
        "age",
        "notes",
        "used_date",
      ];

      patientColumns.forEach((columnName) => {
        const hasColumn = columns.some((col) => col.name === columnName);
        if (!hasColumn) {
          let columnDef = "TEXT";
          if (columnName === "used_date")
            columnDef = "TEXT DEFAULT CURRENT_TIMESTAMP";

          console.log(`Adding ${columnName} column to protocols table...`);
          db.run(
            `ALTER TABLE protocols ADD COLUMN ${columnName} ${columnDef}`,
            (alterErr) => {
              if (alterErr) {
                console.log(
                  `Note: Could not add ${columnName} column:`,
                  alterErr.message
                );
              } else {
                console.log(`Successfully added ${columnName} column`);
              }
            }
          );
        }
      });
    }
  });

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
      FOREIGN KEY (partner_id) REFERENCES partner (id)
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS stock_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL,
      total_allocated INTEGER DEFAULT 0,
      total_used INTEGER DEFAULT 0,
      total_available INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (partner_id) REFERENCES partner (id)
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )`
  );

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

  db.run(`UPDATE users SET role = 'operator' WHERE role = 'viewer'`, (err) => {
    if (err) console.log("Role migration note:", err.message);
  });

  db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const adminPassword = bcrypt.hashSync("admin", 10);
      db.run(
        `INSERT INTO users (username, email, password_hash, full_name, role, is_active) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "admin",
          "admin@system.local",
          adminPassword,
          "System Administrator",
          "admin",
          1,
        ]
      );
    }
  });
});

// Legacy admin credentials
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin";

// Authentication middleware
function requireAuth(req, res, next) {
  if (
    req.session &&
    req.session.user === ADMIN_USER &&
    req.session.userId === 0
  ) {
    req.user = {
      id: 0,
      username: ADMIN_USER,
      full_name: "Legacy Admin",
      role: "admin",
      is_active: 1,
    };
    return next();
  }

  if (req.session && req.session.userId && req.session.userId > 0) {
    db.get(
      "SELECT * FROM users WHERE id = ? AND is_active = 1",
      [req.session.userId],
      (err, user) => {
        if (err || !user) {
          req.session.destroy();
          if (req.xhr || req.headers.accept?.indexOf("json") > -1) {
            return res
              .status(401)
              .json({ error: "Session expired", redirect: "/login" });
          }
          return res.redirect("/login");
        }
        req.user = user;
        next();
      }
    );
  } else {
    if (req.xhr || req.headers.accept?.indexOf("json") > -1) {
      return res
        .status(401)
        .json({ error: "Authentication required", redirect: "/login" });
    }
    return res.redirect("/login");
  }
}

// Legacy auth function
function ensureAuth(req, res, next) {
  if (req.session && req.session.user === ADMIN_USER) {
    return next();
  }

  if (req.session && req.session.userId) {
    db.get(
      "SELECT * FROM users WHERE id = ? AND is_active = 1",
      [req.session.userId],
      (err, user) => {
        if (err || !user) {
          return res.redirect("/login");
        }
        req.user = user;
        next();
      }
    );
  } else {
    return res.redirect("/login");
  }
}

// Role-based authorization
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Activity logging
function logActivity(
  action,
  targetType = "system",
  targetId = null,
  details = null
) {
  return (req, res, next) => {
    if (req.session && (req.session.user || req.session.userId !== undefined)) {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("User-Agent");
      const userId =
        req.session.userId !== undefined
          ? req.session.userId
          : req.user
            ? req.user.id
            : 0;

      db.run(
        `INSERT INTO activity_logs (user_id, action, target_type, target_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          action,
          targetType,
          targetId,
          details,
          ip,
          userAgent,
          getWIBTimestamp(),
        ],
        function (err) {
          if (err) console.error("Activity log error:", err);
        }
      );
    }
    next();
  };
}

// Province codes - FIXED DUPLICATES
const provinces = [
  { code: "ACE", name: "Aceh" },
  { code: "SUT", name: "Sumatera Utara" },
  { code: "SUB", name: "Sumatera Barat" },
  { code: "RIA", name: "Riau" },
  { code: "KEP", name: "Kepulauan Riau" },
  { code: "JAM", name: "Jambi" },
  { code: "SUS", name: "Sumatera Selatan" },
  { code: "BBL", name: "Bangka Belitung" },
  { code: "BEN", name: "Bengkulu" },
  { code: "LAM", name: "Lampung" },
  { code: "DKI", name: "DKI Jakarta" },
  { code: "JAB", name: "Jawa Barat" },
  { code: "JAT", name: "Jawa Tengah" },
  { code: "JAI", name: "Jawa Timur" },
  { code: "YOG", name: "DI Yogyakarta" },
  { code: "BAN", name: "Banten" },
  { code: "BAL", name: "Bali" },
  { code: "NTB", name: "Nusa Tenggara Barat" },
  { code: "NTT", name: "Nusa Tenggara Timur" },
  { code: "KAB", name: "Kalimantan Barat" },
  { code: "KAT", name: "Kalimantan Tengah" },
  { code: "KAI", name: "Kalimantan Timur" },
  { code: "KAS", name: "Kalimantan Selatan" },
  { code: "KAU", name: "Kalimantan Utara" },
  { code: "SLS", name: "Sulawesi Selatan" },
  { code: "SLT", name: "Sulawesi Tengah" },
  { code: "SLG", name: "Sulawesi Tenggara" },
  { code: "SLB", name: "Sulawesi Barat" },
  { code: "SLU", name: "Sulawesi Utara" },
  { code: "GOR", name: "Gorontalo" },
  { code: "MAL", name: "Maluku" },
  { code: "MAU", name: "Maluku Utara" },
  { code: "PAP", name: "Papua" },
  { code: "PAB", name: "Papua Barat" },
  { code: "PPS", name: "Papua Selatan" },
  { code: "PPT", name: "Papua Tengah" },
  { code: "PPG", name: "Papua Pegunungan" },
];

// Health check (no auth)
app.get("/healthz", (req, res) => {
  res.json({ status: "ok", pid: process.pid, uptime: process.uptime() });
});

// ===========================================
// LOGIN ROUTES (MUST BE FIRST)
// ===========================================
app.get("/login", (req, res) => {
  // If already logged in, redirect to dashboard
  if (
    req.session &&
    req.session.user === ADMIN_USER &&
    req.session.userId === 0
  ) {
    return res.redirect("/dashboard");
  }
  if (req.session && req.session.userId && req.session.userId > 0) {
    return res.redirect("/dashboard");
  }
  res.render("login", { error: null });
});

app.post("/login", authLimiter, (req, res) => {
  const { username, password } = req.body;

  console.log("Login attempt:", { username, hasPassword: !!password });

  // Legacy admin login
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    console.log("Legacy admin login successful");
    req.session.user = ADMIN_USER;
    req.session.userId = 0;
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      return res.redirect("/dashboard");
    });
    return;
  }

  if (!username || !password) {
    return res.render("login", { error: "Username dan password harus diisi" });
  }

  db.get(
    "SELECT * FROM users WHERE username = ? AND is_active = 1",
    [username],
    (err, user) => {
      if (err) {
        console.error("Database error during login:", err);
        return res.render("login", { error: "Database error" });
      }

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.render("login", { error: "Invalid username or password" });
      }

      db.run("UPDATE users SET last_login = ? WHERE id = ?", [
        getWIBTimestamp(),
        user.id,
      ]);

      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("User-Agent");
      db.run(
        `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?)`,
        [user.id, "login", ip, userAgent, getWIBTimestamp()]
      );

      req.session.userId = user.id;
      req.session.user = user.username;

      req.session.save((err) => {
        if (err) console.error("Session save error:", err);

        if (user.role === "distribusi") {
          return res.redirect("/scanner");
        }

        res.redirect("/dashboard");
      });
    }
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/test-session", (req, res) => {
  res.json({
    session: req.session,
    cookies: req.headers.cookie,
  });
});

app.get("/reset-limits", (req, res) => {
  authLimiter.resetKey(req.ip);
  res.json({
    message: "Rate limits berhasil direset",
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
});

// ===========================================
// ROOT ROUTE (After login routes)
// ===========================================
app.get("/", (req, res) => {
  // Check if logged in
  if (
    !req.session ||
    (!req.session.userId && req.session.user !== ADMIN_USER)
  ) {
    return res.redirect("/login");
  }
  res.redirect("/dashboard");
});

// ===========================================
// DASHBOARD ROUTE
// ===========================================
app.get(
  "/dashboard",
  requireAuth,
  requireRole("admin", "operator"),
  logActivity("view_dashboard"),
  (req, res) => {
    const { period, start_date, end_date } = req.query;

    try {
      let dateFilter = "";
      let params = [];

      const now = getWIBDate();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (period === "week") {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        dateFilter = " WHERE p.created_at >= ?";
        params.push(formatWIBTimestamp(weekStart));
      } else if (period === "month") {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFilter = " WHERE p.created_at >= ?";
        params.push(formatWIBTimestamp(monthStart));
      } else if (period === "custom" && start_date && end_date) {
        const startDateTime = formatWIBTimestamp(
          new Date(start_date + "T00:00:00")
        );
        const endDateTime = formatWIBTimestamp(
          new Date(end_date + "T23:59:59")
        );
        dateFilter = " WHERE p.created_at >= ? AND p.created_at <= ?";
        params.push(startDateTime, endDateTime);
      } else {
        const todayStart = formatWIBTimestamp(today);
        const todayEnd = formatWIBTimestamp(
          new Date(today.getTime() + 24 * 60 * 60 * 1000)
        );
        dateFilter = " WHERE p.created_at >= ? AND p.created_at < ?";
        params.push(todayStart, todayEnd);
      }

      db.all(
        `SELECT p.*, pt.name as partner_name, pt.type as partner_type, pt.code as partner_code 
       FROM protocols p 
       LEFT JOIN partner pt ON p.partner_id = pt.id` +
          dateFilter +
          " ORDER BY p.id DESC LIMIT 100",
        params,
        (err, filteredProtocols) => {
          if (err) {
            console.error("Error fetching protocols:", err);
            filteredProtocols = [];
          }

          db.all(
            `SELECT p.status, p.province_code, pt.name as partner_name 
           FROM protocols p 
           LEFT JOIN partner pt ON p.partner_id = pt.id` + dateFilter,
            params,
            (err, statsData) => {
              if (err) {
                console.error("Error fetching stats data:", err);
                statsData = [];
              }

              const stats = {
                total: statsData.length,
                created: statsData.filter((p) => p.status === "created").length,
                delivered: statsData.filter((p) => p.status === "delivered")
                  .length,
                terpakai: statsData.filter((p) => p.status === "terpakai")
                  .length,
                topProvinces: [],
              };

              const provinceCount = {};
              statsData.forEach((p) => {
                provinceCount[p.province_code] =
                  (provinceCount[p.province_code] || 0) + 1;
              });

              stats.topProvinces = Object.entries(provinceCount)
                .map(([province_code, count]) => ({
                  province_code,
                  count,
                  name:
                    provinces.find((prov) => prov.code === province_code)
                      ?.name || province_code,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

              db.all(
                `SELECT 
                 SUM(total_allocated) as total_allocated,
                 SUM(total_used) as total_used,
                 SUM(total_available) as total_available,
                 COUNT(*) as active_partner
               FROM stock_tracking st
               JOIN partner p ON st.partner_id = p.id
               WHERE p.is_active = 1`,
                (err, stockSummary) => {
                  const stock = stockSummary?.[0] || {
                    total_allocated: 0,
                    total_used: 0,
                    total_available: 0,
                    active_partner: 0,
                  };

                  getAdvancedAnalytics((analyticsData) => {
                    try {
                      res.render("dashboard", {
                        user: req.user || { full_name: req.session.user },
                        protocols: filteredProtocols,
                        provinces,
                        stats,
                        analytics: analyticsData || getDefaultAnalytics(),
                        stock,
                        partners: [],
                        req,
                      });
                    } catch (renderError) {
                      console.error("Error rendering dashboard:", renderError);
                      res.status(500).send("Dashboard rendering error");
                    }
                  });
                }
              );
            }
          );
        }
      );
    } catch (error) {
      console.error("Dashboard route error:", error);
      res.status(500).send("Internal server error");
    }
  }
);

// ===========================================
// CREATE PROTOCOL PAGE ROUTE
// ===========================================
app.get(
  "/create-protocol",
  requireAuth,
  requireRole("admin", "operator"),
  logActivity("view_create_protocol"),
  (req, res) => {
    try {
      const successMessage = req.query.success
        ? decodeURIComponent(req.query.success)
        : null;

      res.render("create-protocol", {
        user: req.user || { full_name: req.session.user },
        provinces,
        successMessage,
        req,
      });
    } catch (error) {
      console.error("Create protocol route error:", error);
      res.status(500).send("Internal server error");
    }
  }
);

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
      latest_protocol: null,
    },
  };
}

// Advanced Analytics Function
function getAdvancedAnalytics(callback) {
  const analytics = {
    dailyTrends: [],
    hourlyDistribution: [],
    partnerPerformance: [],
    provincePerformance: [],
    statusTrends: [],
    metrics: {
      total_protocols: 0,
      unique_provinces: 0,
      active_partner: 0,
      avg_per_day: 0,
      completion_rate: 0,
      first_protocol: null,
      latest_protocol: null,
    },
  };

  db.all(
    `
    SELECT 
      DATE(p.created_at) as date,
      COUNT(*) as total,
      SUM(CASE WHEN p.status = 'created' THEN 1 ELSE 0 END) as created,
      SUM(CASE WHEN p.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) as terpakai,
      COUNT(DISTINCT p.partner_id) as unique_partner
    FROM protocols p 
    LEFT JOIN partner pt ON p.partner_id = pt.id
    WHERE p.created_at >= date('now', '-30 days')
    GROUP BY DATE(p.created_at)
    ORDER BY date DESC
  `,
    (err, dailyTrends) => {
      if (err) console.error("Error fetching daily trends:", err);
      analytics.dailyTrends = dailyTrends || [];

      db.all(
        `
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as count
      FROM protocols 
      WHERE created_at >= date('now', '-7 days')
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `,
        (err, hourlyDistribution) => {
          if (err) console.error("Error fetching hourly distribution:", err);
          analytics.hourlyDistribution = hourlyDistribution || [];

          db.all(
            `
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
        FROM partner pt
        LEFT JOIN protocols p ON pt.id = p.partner_id
        WHERE pt.is_active = 1
        GROUP BY pt.id, pt.name, pt.type, pt.code, pt.province_code
        HAVING COUNT(p.id) > 0
        ORDER BY total_protocols DESC
        LIMIT 10
      `,
            (err, partnerPerformance) => {
              if (err)
                console.error("Error fetching partner performance:", err);
              analytics.partnerPerformance = partnerPerformance || [];

              db.all(
                `
          SELECT 
            p.province_code,
            COUNT(p.id) as count,
            SUM(CASE WHEN p.status = 'created' THEN 1 ELSE 0 END) as created,
            SUM(CASE WHEN p.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
            SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) as terpakai,
            ROUND(
              (SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(p.id), 0)), 2
            ) as usage_rate,
            COUNT(DISTINCT p.partner_id) as active_partner
          FROM protocols p
          LEFT JOIN partner pt ON p.partner_id = pt.id
          WHERE p.province_code IS NOT NULL
          GROUP BY p.province_code
          ORDER BY count DESC
          LIMIT 10
        `,
                (err, provincePerformance) => {
                  if (err)
                    console.error("Error fetching province performance:", err);
                  analytics.provincePerformance = provincePerformance || [];

                  db.all(
                    `
            SELECT 
              DATE(created_at) as date,
              status,
              COUNT(*) as count
            FROM protocols 
            WHERE created_at >= date('now', '-14 days')
            GROUP BY DATE(created_at), status
            ORDER BY date DESC, status
          `,
                    (err, statusTrends) => {
                      if (err)
                        console.error("Error fetching status trends:", err);
                      analytics.statusTrends = statusTrends || [];

                      db.get(
                        `
              SELECT 
                COUNT(p.id) as total_protocols,
                COUNT(DISTINCT p.province_code) as unique_provinces,
                COUNT(DISTINCT p.partner_id) as active_partner,
                ROUND(COUNT(p.id) * 1.0 / NULLIF(COUNT(DISTINCT DATE(p.created_at)), 0), 2) as avg_per_day,
                ROUND(
                  SUM(CASE WHEN p.status = 'terpakai' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(p.id), 0), 2
                ) as completion_rate,
                MIN(p.created_at) as first_protocol,
                MAX(p.created_at) as latest_protocol
              FROM protocols p
              LEFT JOIN partner pt ON p.partner_id = pt.id
            `,
                        (err, metrics) => {
                          if (err)
                            console.error("Error fetching metrics:", err);
                          analytics.metrics = metrics || analytics.metrics;
                          callback(analytics);
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

// ===========================================
// USER MANAGEMENT ROUTES
// ===========================================
app.get("/users", requireAuth, requireRole("admin"), (req, res) => {
  db.all("SELECT * FROM users ORDER BY created_at DESC", (err, users) => {
    if (err) {
      console.error("Error fetching users:", err);
      users = [];
    }

    db.all(
      `
      SELECT al.*, u.username 
      FROM activity_logs al 
      JOIN users u ON al.user_id = u.id 
      ORDER BY al.created_at DESC 
      LIMIT 20
    `,
      (err, recentActivity) => {
        if (err) {
          console.error("Error fetching activity logs:", err);
          recentActivity = [];
        }

        res.render("users", {
          user: req.user,
          users,
          recentActivity,
        });
      }
    );
  });
});

app.post(
  "/users",
  requireAuth,
  requireRole("admin"),
  logActivity("create_user", "user"),
  (req, res) => {
    const { username, email, full_name, role, password, confirm_password } =
      req.body;

    if (!username || !email || !full_name || !role || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!["operator", "distribusi", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    db.get(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email],
      (err, existing) => {
        if (err) {
          console.error("Error checking existing user:", err);
          return res.status(500).json({ error: "Database error" });
        }

        if (existing) {
          return res
            .status(400)
            .json({ error: "Username or email already exists" });
        }

        const passwordHash = bcrypt.hashSync(password, 10);

        db.run(
          `INSERT INTO users (username, email, password_hash, full_name, role, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
          [username, email, passwordHash, full_name, role, req.user.id],
          function (err) {
            if (err) {
              console.error("Error creating user:", err);
              return res.status(500).json({ error: "Failed to create user" });
            }
            res.redirect("/users");
          }
        );
      }
    );
  }
);

app.post(
  "/users/:id/toggle-status",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: "Cannot disable your own account" });
    }

    db.get(
      "SELECT is_active, username FROM users WHERE id = ?",
      [id],
      (err, user) => {
        if (err) {
          console.error("Error fetching user:", err);
          return res.status(500).json({ error: "Database error" });
        }

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const newStatus = user.is_active ? 0 : 1;

        db.run(
          "UPDATE users SET is_active = ? WHERE id = ?",
          [newStatus, id],
          (err) => {
            if (err) {
              console.error("Error updating user status:", err);
              return res
                .status(500)
                .json({ error: "Failed to update user status" });
            }

            db.run(
              `INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
              [
                req.user.id,
                newStatus ? "activate_user" : "deactivate_user",
                "user",
                id,
                `User ${user.username} ${newStatus ? "activated" : "deactivated"}`,
                getWIBTimestamp(),
              ]
            );

            res.json({
              success: true,
              message: `User ${newStatus ? "activated" : "deactivated"} successfully`,
            });
          }
        );
      }
    );
  }
);

app.post(
  "/users/:id/reset-password",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);

    db.run(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [passwordHash, id],
      (err) => {
        if (err) {
          console.error("Error resetting password:", err);
          return res.status(500).json({ error: "Failed to reset password" });
        }

        db.run(
          `INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            "reset_password",
            "user",
            id,
            `Password reset by admin (${req.user.username})`,
            getWIBTimestamp(),
          ]
        );

        res.json({
          success: true,
          message: "Password reset successfully",
        });
      }
    );
  }
);

// ===========================================
// PARTNER MANAGEMENT ROUTES
// ===========================================
app.get(
  "/partner",
  requireAuth,
  requireRole("admin", "operator"),
  (req, res) => {
    db.all(
      `SELECT p.*, u.username as created_by_username, 
     (SELECT COUNT(*) FROM protocols WHERE partner_id = p.id) as protocol_count
     FROM partner p 
     LEFT JOIN users u ON p.created_by = u.id 
     ORDER BY p.created_at DESC`,
      (err, partner) => {
        if (err) {
          console.error("Error fetching partner:", err);
          return res.status(500).send("Database error");
        }

        res.render("partners", {
          user: req.user,
          partner: partner || [],
          provinces: provinces,
        });
      }
    );
  }
);

app.post(
  "/partner",
  requireAuth,
  requireRole("admin", "operator"),
  logActivity("create_partner", "partner"),
  (req, res) => {
    const { name, type, code, province_code, address, phone, email } = req.body;

    if (!name || !type || !code || !province_code) {
      return res
        .status(400)
        .send("Nama, jenis, kode, dan provinsi harus diisi");
    }

    if (!["klinik", "puskesmas", "rumah_sakit"].includes(type)) {
      return res.status(400).send("Jenis mitra tidak valid");
    }

    if (!validator.isAlphanumeric(code.replace(/[-_]/g, ""))) {
      return res.status(400).send("Kode harus berupa alfanumerik");
    }

    db.run(
      "INSERT INTO partner (name, type, code, province_code, address, phone, email, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        type,
        code.toUpperCase(),
        province_code,
        address,
        phone,
        email,
        req.user.id,
        getWIBTimestamp(),
      ],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).send("Kode mitra sudah digunakan");
          }
          console.error("Error creating partner:", err);
          return res.status(500).send("Database error");
        }

        db.run(
          "INSERT INTO stock_tracking (partner_id, total_allocated, total_used, total_available, last_updated) VALUES (?, 0, 0, 0, ?)",
          [this.lastID, getWIBTimestamp()],
          (stockErr) => {
            if (stockErr) {
              console.error("Error initializing stock tracking:", stockErr);
            }
            res.redirect("/partner");
          }
        );
      }
    );
  }
);

app.post(
  "/partner/:id/toggle-status",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const partnerId = req.params.id;

    db.get(
      "SELECT is_active FROM partner WHERE id = ?",
      [partnerId],
      (err, partner) => {
        if (err) {
          console.error("Error fetching partner:", err);
          return res.status(500).send("Database error");
        }

        if (!partner) {
          return res.status(404).send("Mitra tidak ditemukan");
        }

        const newStatus = partner.is_active ? 0 : 1;

        db.run(
          "UPDATE partner SET is_active = ?, updated_at = ? WHERE id = ?",
          [newStatus, getWIBTimestamp(), partnerId],
          (err) => {
            if (err) {
              console.error("Error updating partner status:", err);
              return res.status(500).send("Database error");
            }
            res.redirect("/partner");
          }
        );
      }
    );
  }
);

// ===========================================
// API ENDPOINTS
// ===========================================
app.get("/api/partner/:provinceCode", requireAuth, (req, res) => {
  const provinceCode = req.params.provinceCode;

  db.all(
    "SELECT id, name, type, code FROM partner WHERE province_code = ? AND is_active = 1 ORDER BY name",
    [provinceCode],
    (err, partner) => {
      if (err) {
        console.error("Error fetching partner:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(partner || []);
    }
  );
});

app.post(
  "/api/partner",
  requireAuth,
  requireRole("admin", "operator"),
  (req, res) => {
    const { name, type, code, province_code, phone, address } = req.body;

    if (!name || !type || !code || !province_code) {
      return res
        .status(400)
        .json({ error: "Nama, jenis, kode, dan provinsi harus diisi" });
    }

    if (!["klinik", "puskesmas", "rumah_sakit"].includes(type)) {
      return res.status(400).json({ error: "Jenis mitra tidak valid" });
    }

    if (!validator.isAlphanumeric(code.replace(/[-_]/g, ""))) {
      return res.status(400).json({ error: "Kode harus berupa alfanumerik" });
    }

    db.run(
      "INSERT INTO partner (name, type, code, province_code, address, phone, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        type,
        code.toUpperCase(),
        province_code,
        address,
        phone,
        req.user.id,
        getWIBTimestamp(),
      ],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res
              .status(400)
              .json({ error: "Kode mitra sudah digunakan" });
          }
          console.error("Error creating partner:", err);
          return res.status(500).json({ error: "Database error" });
        }

        db.run(
          "INSERT INTO stock_tracking (partner_id, total_allocated, total_used, total_available, last_updated) VALUES (?, 0, 0, 0, ?)",
          [this.lastID, getWIBTimestamp()],
          (stockErr) => {
            if (stockErr) {
              console.error("Error initializing stock tracking:", stockErr);
            }

            res.json({
              success: true,
              partner: {
                id: this.lastID,
                name: name,
                type: type,
                code: code.toUpperCase(),
                province_code: province_code,
              },
            });
          }
        );
      }
    );
  }
);

app.get("/api/stock", requireAuth, (req, res) => {
  db.all(
    `SELECT 
       p.id,
       p.name,
       p.type,
       p.code,
       p.province_code,
       COALESCE(st.total_allocated, 0) as total_allocated,
       COALESCE(st.total_used, 0) as total_used,
       COALESCE(st.total_available, 0) as total_available,
       st.last_updated
     FROM partner p
     LEFT JOIN stock_tracking st ON p.id = st.partner_id
     WHERE p.is_active = 1
     ORDER BY p.name`,
    (err, stockData) => {
      if (err) {
        console.error("Error fetching stock data:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(stockData || []);
    }
  );
});

// ===========================================
// PROTOCOL ROUTES
// ===========================================
app.post(
  "/protocols",
  requireAuth,
  requireRole("admin", "operator"),
  logActivity("create_protocol"),
  (req, res) => {
    const { province, partner_id, quantity } = req.body;

    const prov = provinces.find((p) => p.code === province);
    if (!prov) return res.status(400).send("Invalid province");

    if (!partner_id) return res.status(400).send("Partner is required");

    const qty = parseInt(quantity) || 1;
    if (qty < 1 || qty > 100) {
      return res.status(400).send("Quantity must be between 1 and 100");
    }

    db.get(
      "SELECT * FROM partner WHERE id = ? AND is_active = 1",
      [partner_id],
      (err, partner) => {
        if (err) {
          console.error("Error fetching partner:", err);
          return res.status(500).send("Database error");
        }

        if (!partner) {
          return res.status(400).send("Invalid or inactive partner");
        }

        const now = getWIBDate();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const dateStr = `${year}${month}${day}`;
        const timestamp = Date.now().toString().slice(-6);
        const codeBase = `${dateStr}${province}${partner.code}${timestamp}`;

        const protocols = [];
        const createdAt = getWIBTimestamp();
        const stmt = db.prepare(
          "INSERT INTO protocols (code, province_code, partner_id, created_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?)"
        );

        for (let i = 1; i <= qty; i++) {
          const code =
            qty === 1 ? codeBase : `${codeBase}_${String(i).padStart(3, "0")}`;
          protocols.push(code);

          stmt.run(
            [code, province, partner_id, createdAt, "created", req.user.id],
            function (err) {
              if (err) {
                console.error("Error creating protocol:", err);
              }
            }
          );
        }

        stmt.finalize((err) => {
          if (err) {
            console.error("Error finalizing protocol creation:", err);
            return res.status(500).send("Database error");
          }

          db.run(
            `UPDATE stock_tracking 
         SET total_allocated = total_allocated + ?,
             total_available = total_available + ?,
             last_updated = ? 
         WHERE partner_id = ?`,
            [qty, qty, getWIBTimestamp(), partner_id],
            (stockErr) => {
              if (stockErr) {
                console.error("Error updating stock:", stockErr);
              }

              io.emit("protocol_created", {
                codes: protocols,
                quantity: qty,
                partner: partner.name,
                province: province,
              });

              res.redirect(
                "/dashboard?success=" +
                  encodeURIComponent(`${qty} protocol(s) created successfully!`)
              );
            }
          );
        });
      }
    );
  }
);

app.post(
  "/protocols/:id/status",
  requireAuth,
  requireRole("admin", "operator"),
  (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["created", "delivered", "terpakai"].includes(status)) {
      return res.status(400).send("Invalid status");
    }

    db.get("SELECT * FROM protocols WHERE id = ?", [id], (err, oldProtocol) => {
      if (err) {
        console.error("Error fetching protocol:", err);
        return res.status(500).send("Database error");
      }

      if (!oldProtocol) {
        return res.status(404).send("Protocol not found");
      }

      db.run(
        "UPDATE protocols SET status = ?, updated_by = ? WHERE id = ?",
        [status, req.user.id, id],
        function (err) {
          if (err) {
            console.error("Error updating status:", err);
            return res.status(500).send("Failed to update status");
          }

          if (oldProtocol.partner_id) {
            let stockChange = 0;

            if (oldProtocol.status !== "terpakai" && status === "terpakai") {
              stockChange = 1;
            } else if (
              oldProtocol.status === "terpakai" &&
              status !== "terpakai"
            ) {
              stockChange = -1;
            }

            if (stockChange !== 0) {
              db.run(
                `UPDATE stock_tracking 
             SET total_used = total_used + ?,
                 total_available = total_available - ?,
                 last_updated = ? 
             WHERE partner_id = ?`,
                [
                  stockChange,
                  stockChange,
                  getWIBTimestamp(),
                  oldProtocol.partner_id,
                ],
                (stockErr) => {
                  if (stockErr) {
                    console.error("Error updating stock:", stockErr);
                  }
                }
              );
            }
          }

          io.emit("status_updated", {
            protocol: {
              id: oldProtocol.id,
              code: oldProtocol.code,
              newStatus: status,
              oldStatus: oldProtocol.status,
            },
          });

          res.redirect("/dashboard");
        }
      );
    });
  }
);

// ===========================================
// BARCODE & SCANNER ROUTES
// ===========================================
app.get("/barcode/:code.png", ensureAuth, (req, res) => {
  const { code } = req.params;
  try {
    bwipjs.toBuffer(
      {
        bcid: "qrcode",
        text: code,
        scale: 4,
        eclevel: "M",
      },
      function (err, png) {
        if (err) {
          console.error("QR code generation error:", err);
          return res.status(500).send("QR code generation error");
        }
        res.type("png");
        res.send(png);
      }
    );
  } catch (e) {
    console.error("QR code generation exception:", e);
    res.status(500).send("QR code generation exception");
  }
});

app.get("/download/barcode/:code.png", ensureAuth, (req, res) => {
  const { code } = req.params;
  try {
    bwipjs.toBuffer(
      {
        bcid: "qrcode",
        text: code,
        scale: 8,
        eclevel: "M",
      },
      function (err, png) {
        if (err) {
          console.error("QR code download error:", err);
          return res.status(500).send("QR code generation error");
        }
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="qrcode-${code}.png"`
        );
        res.type("png");
        res.send(png);
      }
    );
  } catch (e) {
    console.error("QR code generation exception:", e);
    res.status(500).send("QR code generation exception");
  }
});

app.get("/scan/:code", requireAuth, (req, res) => {
  const { code } = req.params;
  db.get(
    "SELECT p.*, pt.name as partner_name, pt.type as partner_type FROM protocols p LEFT JOIN partner pt ON p.partner_id = pt.id WHERE p.code = ?",
    [code],
    (err, row) => {
      if (err) {
        console.error("Error scanning code:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (!row) return res.status(404).json({ error: "Not found" });

      const response = {
        ...row,
        created_at_formatted: new Date(row.created_at).toLocaleString("id-ID", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: "Asia/Jakarta",
        }),
      };

      res.json(response);
    }
  );
});

app.get("/scanner", requireAuth, (req, res) => {
  res.render("scanner", { user: req.user });
});

app.post("/api/confirm-usage/:code", requireAuth, (req, res) => {
  const { code } = req.params;
  const { action } = req.body;

  if (!["mark_terpakai", "mark_delivered"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  db.get(
    "SELECT p.*, pt.name as partner_name FROM protocols p LEFT JOIN partner pt ON p.partner_id = pt.id WHERE p.code = ?",
    [code],
    (err, row) => {
      if (err) {
        console.error("Error fetching protocol:", err);
        return res.status(500).json({ error: "Database error" });
      }
      if (!row) return res.status(404).json({ error: "Code not found" });

      const newStatus = action === "mark_delivered" ? "delivered" : "terpakai";
      const oldStatus = row.status;

      db.run(
        "UPDATE protocols SET status = ?, updated_by = ? WHERE code = ?",
        [newStatus, req.user.id, code],
        function (err) {
          if (err) {
            console.error("Error updating status:", err);
            return res.status(500).json({ error: "Failed to update status" });
          }

          if (row.partner_id) {
            let stockChange = 0;
            if (oldStatus !== "terpakai" && newStatus === "terpakai") {
              stockChange = 1;
            } else if (oldStatus === "terpakai" && newStatus !== "terpakai") {
              stockChange = -1;
            }

            if (stockChange !== 0) {
              db.run(
                `UPDATE stock_tracking 
             SET total_used = total_used + ?,
                 total_available = total_available - ?,
                 last_updated = ? 
             WHERE partner_id = ?`,
                [stockChange, stockChange, getWIBTimestamp(), row.partner_id]
              );
            }
          }

          const ip = req.ip || req.connection.remoteAddress;
          const userAgent = req.get("User-Agent");
          db.run(
            `INSERT INTO activity_logs (user_id, action, target_type, target_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.user.id,
              `scan_${newStatus}`,
              "protocol",
              code,
              `Scanned and marked as ${newStatus}`,
              ip,
              userAgent,
              getWIBTimestamp(),
            ]
          );

          io.emit("status_updated", {
            code: code,
            newStatus: newStatus,
            protocol: { ...row, status: newStatus },
          });

          res.json({
            success: true,
            message: `Status updated to ${newStatus}`,
            protocol: { ...row, status: newStatus },
          });
        }
      );
    }
  );
});

// Update patient data for a protocol
app.post("/api/update-patient-data/:code", requireAuth, (req, res) => {
  const { code } = req.params;
  const {
    patient_name,
    healthcare_facility,
    occupation,
    marital_status,
    gpa,
    address,
    phone,
    age,
    notes,
  } = req.body;

  // Validate required fields
  if (!patient_name || !healthcare_facility) {
    return res
      .status(400)
      .json({ error: "Patient name and healthcare facility are required" });
  }

  db.run(
    `UPDATE protocols SET 
       patient_name = ?,
       healthcare_facility = ?,
       occupation = ?,
       marital_status = ?,
       gpa = ?,
       address = ?,
       phone = ?,
       age = ?,
       notes = ?,
       updated_by = ?
     WHERE code = ?`,
    [
      patient_name,
      healthcare_facility,
      occupation || null,
      marital_status || null,
      gpa || null,
      address || null,
      phone || null,
      age || null,
      notes || null,
      req.user.id,
      code,
    ],
    function (err) {
      if (err) {
        console.error("Error updating patient data:", err);
        return res.status(500).json({ error: "Failed to update patient data" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Protocol not found" });
      }

      // Log activity
      db.run(
        `INSERT INTO activity_logs (user_id, action, target_type, target_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          "update_patient_data",
          "protocol",
          code,
          `Updated patient data: ${patient_name} at ${healthcare_facility}`,
          getWIBTimestamp(),
        ]
      );

      res.json({
        success: true,
        message: "Patient data updated successfully",
      });
    }
  );
});

// Get patient data for a protocol
app.get("/api/patient-data/:code", requireAuth, (req, res) => {
  const { code } = req.params;

  db.get(
    `SELECT 
       id, code, patient_name, healthcare_facility, occupation,
       marital_status, gpa, address, phone, age, notes, status, created_at
     FROM protocols
     WHERE code = ?`,
    [code],
    (err, row) => {
      if (err) {
        console.error("Error fetching patient data:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (!row) {
        return res.status(404).json({ error: "Protocol not found" });
      }

      res.json({
        success: true,
        data: row,
      });
    }
  );
});

// ===========================================
// SOCKET.IO
// ===========================================
io.on("connection", (socket) => {
  console.log("Client connected for real-time updates");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// ===========================================
// START SERVER
// ===========================================
const PORT = process.env.PORT || 8080;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Server also available on http://127.0.0.1:${PORT}`);
  console.log(`Process ID: ${process.pid}`);
  console.log(`Server started at: ${new Date().toISOString()}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    db.close((err) => {
      if (err) console.error("Error closing database:", err);
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    db.close((err) => {
      if (err) console.error("Error closing database:", err);
      process.exit(0);
    });
  });
});
