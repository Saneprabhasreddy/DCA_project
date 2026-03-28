const fs = require('fs');
const path = require('path');

function loadEnvironment() {
    const envPath = path.resolve(__dirname, '../.env');

    try {
        require('dotenv').config({ path: envPath });
        return;
    } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
            console.warn('⚠️  dotenv could not be initialized:', err.message);
            return;
        }
        console.warn('ℹ️  dotenv is not installed; continuing with process env only');
    }

    if (!fs.existsSync(envPath)) {
        return;
    }

    const file = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of file.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) {
            continue;
        }

        const idx = line.indexOf('=');
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

loadEnvironment();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const config = require('./config');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/ml', require('./routes/ml'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Seed default users on startup (reads from SEED_USERS env var)
async function seedDefaultUsers() {
    const User = require('./models/User');

    let defaults = [];
    try {
        if (config.SEED_USERS) {
            defaults = JSON.parse(config.SEED_USERS);
        }
    } catch (e) {
        console.warn('⚠️  Could not parse SEED_USERS env var:', e.message);
        return;
    }

    if (!defaults.length) {
        console.log('ℹ️  No SEED_USERS defined — skipping user seeding');
        return;
    }

    for (const u of defaults) {
        const exists = await User.findOne({ username: u.username });
        if (!exists) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(u.password, salt);
            await User.create({
                username: u.username,
                password_hash: hash,
                role: u.role,
                dca_id: u.dca_id || null,
                is_active: true,
            });
            console.log(`  🔑 Seeded user: ${u.username} (${u.role})`);
        }
    }
}

// Connect to MongoDB and start server
connectDB().then(async () => {
    await seedDefaultUsers();
    const port = config.PORT || 5000;
    app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 SmartDCA backend running on port ${port}`);
    });
});
