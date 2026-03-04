const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

// Verify JWT token
const auth = async (req, res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password_hash');
        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Role-based access
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

module.exports = { auth, requireRole };
