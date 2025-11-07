const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Buat koneksi database
const db = new sqlite3.Database(path.join(__dirname, '../data.db'), (err) => {
    if (err) {
        console.error('Database connection error:', err);
    }
});

// Timezone Helper Functions for WIB (GMT+7)
const WIB_OFFSET = 7 * 60 * 60 * 1000;

function getWIBDate(date = new Date()) {
    const utcTime = date.getTime();
    const wibTime = new Date(utcTime + WIB_OFFSET);
    return wibTime;
}

// Route dashboard
router.get('/', requireAuth, requireRole('admin', 'operator'), async (req, res) => {
    try {
        // Get partners dengan status stok
        const partnersQuery = `
            SELECT 
                p.id,
                p.name,
                p.type,
                p.province_code as province,
                COUNT(s.id) as total,
                SUM(CASE WHEN s.status = 'created' THEN 1 ELSE 0 END) as created,
                SUM(CASE WHEN s.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN s.status = 'used' THEN 1 ELSE 0 END) as used,
                MAX(s.updated_at) as last_activity,
                ROUND(
                    (SUM(CASE WHEN s.status = 'used' THEN 1 ELSE 0 END) * 100.0 / 
                    NULLIF(COUNT(s.id), 0)), 1
                ) as usage_rate
            FROM partners p
            LEFT JOIN stocks s ON s.partner_id = p.id
            GROUP BY p.id, p.name, p.type, p.province_code
            ORDER BY p.name ASC`;

        db.all(partnersQuery, [], (err, partners) => {
            if (err) {
                console.error('Error fetching partners:', err);
                return res.status(500).send('Database error');
            }

            // Get analytics data
            db.all(`
                SELECT 
                    COUNT(*) as total_protocols,
                    COUNT(DISTINCT province_code) as unique_provinces,
                    COUNT(DISTINCT partner_id) as active_partners
                FROM stocks
            `, (err, stats) => {
                if (err) stats = [{ total_protocols: 0, unique_provinces: 0, active_partners: 0 }];

                // Render dashboard dengan semua data yang diperlukan
                res.render('dashboard', {
                    user: req.user,
                    partners: partners || [],
                    analytics: {
                        metrics: stats[0] || { total_protocols: 0, unique_provinces: 0, active_partners: 0 }
                    },
                    provinces: [], // Tambahkan array provinces jika diperlukan
                    req: req,
                    title: 'Dashboard'
                });
            });
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;