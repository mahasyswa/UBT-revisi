const jwt = require('jsonwebtoken');

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        // Simpan intended URL
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    next();
};

// Role-based authorization middleware
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({
                error: 'Unauthorized: Insufficient permissions'
            });
        }
        next();
    };
};

// User data middleware
const loadUser = async (req, res, next) => {
    if (req.session && req.session.userId) {
        try {
            const user = await db.get(
                'SELECT id, username, full_name, role FROM users WHERE id = ?',
                [req.session.userId]
            );
            req.user = user;
        } catch (error) {
            console.error('Error loading user:', error);
        }
    }
    next();
};

module.exports = {
    requireAuth,
    requireRole,
    loadUser
};