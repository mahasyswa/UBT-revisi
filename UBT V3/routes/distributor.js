const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');

// Middleware to ensure distributor role
router.use(requireAuth, requireRole('distribusi'));

// Get daily delivery statistics
router.get('/daily-stats', async (req, res) => {
    try {
        const stats = await getDailyStats(req.user.id);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Handle protocol scan
router.post('/scan-protocol', async (req, res) => {
    const { protocol_id, timestamp } = req.body;
    
    try {
        // Validate protocol exists
        const protocol = await db.get(
            'SELECT * FROM protocols WHERE id = ?',
            [protocol_id]
        );
        
        if (!protocol) {
            return res.status(404).json({
                error: 'Protocol tidak ditemukan'
            });
        }
        
        // Update protocol status
        await db.run(
            `UPDATE protocols 
             SET status = 'in_delivery', 
                 updated_at = ?,
                 distributor_id = ?
             WHERE id = ?`,
            [timestamp, req.user.id, protocol_id]
        );
        
        // Log activity
        await db.run(
            `INSERT INTO activity_logs 
             (user_id, action, details, created_at)
             VALUES (?, 'scan_protocol', ?, ?)`,
            [req.user.id, `Scanned protocol ${protocol_id}`, timestamp]
        );
        
        res.json({
            success: true,
            message: 'Status protocol berhasil diperbarui'
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Gagal memproses scan protocol'
        });
    }
});

// Helper function to get daily statistics
async function getDailyStats(distributorId) {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await db.get(
        `SELECT 
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'in_delivery' THEN 1 END) as inProcess,
            COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered
         FROM protocols 
         WHERE distributor_id = ? 
         AND DATE(created_at) = ?`,
        [distributorId, today]
    );
    
    return stats;
}

module.exports = router;