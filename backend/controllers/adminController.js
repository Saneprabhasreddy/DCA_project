const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const DcaOrg = require('../models/DcaOrg');
const Case = require('../models/Case');
const Interaction = require('../models/Interaction');
const AuditLog = require('../models/AuditLog');
const config = require('../config');

function resolveDataDirectory() {
    const backendRoot = path.resolve(__dirname, '..');
    const repoRoot = path.resolve(__dirname, '../..');

    const configuredDataDir = config.DATA_DIR
        ? (path.isAbsolute(config.DATA_DIR)
            ? config.DATA_DIR
            : path.resolve(backendRoot, config.DATA_DIR))
        : null;

    const candidates = [
        configuredDataDir,
        path.resolve(backendRoot, 'data/fedex_dca_synthetic_dataset'),
        path.resolve(repoRoot, 'data/fedex_dca_synthetic_dataset'),
    ].filter(Boolean);

    const existing = candidates.find((dir) =>
        fs.existsSync(path.join(dir, 'cases.csv'))
    );

    return {
        dataDir: existing || candidates[0],
        candidates,
    };
}

// POST /api/admin/ingest — load dataset into Mongo
exports.ingest = async (req, res) => {
    try {
        const { dataDir, candidates } = resolveDataDirectory();
        if (!dataDir) {
            throw new Error('No data directory candidates available');
        }

        const casesPath = path.join(dataDir, 'cases.csv');
        const interactionsPath = path.join(dataDir, 'interactions.csv');

        console.log(`Data directory: ${dataDir}`);

        if (!fs.existsSync(casesPath)) {
            return res.status(400).json({
                error: 'cases.csv not found',
                searched_paths: candidates,
            });
        }

        // 1) Seed DCA orgs DCA-01..DCA-10
        const regions = ['NA', 'EMEA', 'APAC', 'LATAM', 'NA', 'EMEA', 'APAC', 'LATAM', 'NA', 'EMEA'];
        for (let i = 1; i <= 10; i++) {
            const dca_id = `DCA-${String(i).padStart(2, '0')}`;
            await DcaOrg.findOneAndUpdate(
                { dca_id },
                {
                    dca_id,
                    dca_name: `Recovery Agency ${i}`,
                    region_coverage: regions[i - 1],
                    contact_email: `contact@dca${i}.com`,
                    is_active: true,
                },
                { upsert: true, new: true }
            );
        }

        // 2) Seed users
        const salt = await bcrypt.genSalt(10);
        const users = [
            { username: 'admin', password: 'admin123', role: 'admin', dca_id: null },
            { username: 'manager', password: 'manager123', role: 'manager', dca_id: null },
        ];

        // Seed one login account per DCA org.
        for (let i = 1; i <= 10; i++) {
            users.push({
                username: `dca_user_${String(i).padStart(2, '0')}`,
                password: '123456',
                role: 'dca_user',
                dca_id: `DCA-${String(i).padStart(2, '0')}`,
            });
        }

        for (const u of users) {
            const hash = await bcrypt.hash(u.password, salt);
            await User.findOneAndUpdate(
                { username: u.username },
                { username: u.username, password_hash: hash, role: u.role, dca_id: u.dca_id, is_active: true },
                { upsert: true, new: true }
            );
        }

        // 3) Load cases.csv
        const casesData = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(casesPath)
                .pipe(csv())
                .on('data', (row) => {
                    casesData.push({
                        case_id: row.case_id,
                        customer_id: row.customer_id || '',
                        region: row.region || '',
                        industry: row.industry || '',
                        invoice_amount_usd: parseFloat(row.invoice_amount_usd) || 0,
                        num_open_invoices: parseInt(row.num_open_invoices) || 0,
                        overdue_days_at_allocation: parseInt(row.overdue_days_at_allocation) || 0,
                        previous_default_count: parseInt(row.previous_default_count) || 0,
                        previous_recovery_rate: parseFloat(row.previous_recovery_rate) || 0,
                        payment_history_score: parseFloat(row.payment_history_score) || 0,
                        credit_score_band: row.credit_score_band || '',
                        contact_attempts_last_30d: parseInt(row.contact_attempts_last_30d) || 0,
                        last_contact_channel: row.last_contact_channel || '',
                        dispute_flag: parseInt(row.dispute_flag) || 0,
                        promised_to_pay_flag: parseInt(row.promised_to_pay_flag) || 0,
                        assigned_dca_id: row.assigned_dca_id || null,
                        assigned_date: row.assigned_date ? new Date(row.assigned_date) : null,
                        sla_days: parseInt(row.sla_days) || 14,
                        sla_due_date: row.sla_due_date ? new Date(row.sla_due_date) : null,
                        current_stage_snapshot: row.current_stage_snapshot || 'Allocated',
                        recovered_flag: parseInt(row.recovered_flag) || 0,
                        recovered_within_60d: parseInt(row.recovered_within_60d) || 0,
                        recovered_within_30d: parseInt(row.recovered_within_30d) || 0,
                        recovered_amount_usd: parseFloat(row.recovered_amount_usd) || 0,
                        recovery_days_from_allocation: row.recovery_days_from_allocation ? parseFloat(row.recovery_days_from_allocation) : null,
                        recovery_date: row.recovery_date ? new Date(row.recovery_date) : null,
                        escalation_flag: parseInt(row.escalation_flag) || 0,
                        model_collectability_bucket_hint: row.model_collectability_bucket_hint || '',
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Bulk upsert cases
        if (casesData.length > 0) {
            const bulkOps = casesData.map((c) => ({
                updateOne: {
                    filter: { case_id: c.case_id },
                    update: { $set: c },
                    upsert: true,
                },
            }));
            await Case.bulkWrite(bulkOps);
        }

        // 4) Load interactions.csv
        let interactionsCount = 0;
        if (fs.existsSync(interactionsPath)) {
            const interactionsData = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(interactionsPath)
                    .pipe(csv())
                    .on('data', (row) => {
                        interactionsData.push({
                            interaction_id: row.interaction_id,
                            case_id: row.case_id,
                            timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
                            actor: row.actor || '',
                            event_type: row.event_type || '',
                            channel: row.channel || '',
                            notes: row.notes || '',
                        });
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            if (interactionsData.length > 0) {
                const bulkOps = interactionsData.map((i) => ({
                    updateOne: {
                        filter: { interaction_id: i.interaction_id },
                        update: { $set: i },
                        upsert: true,
                    },
                }));
                await Interaction.bulkWrite(bulkOps);
                interactionsCount = interactionsData.length;
            }
        }

        // Audit log
        await AuditLog.create({
            actor_user: req.user.username,
            action: 'INGEST_DATASET',
            entity_type: 'system',
            entity_id: 'ingest',
            after: { cases: casesData.length, interactions: interactionsCount, dcas: 10, users: users.length },
        });

        res.json({
            message: 'Ingestion complete',
            cases: casesData.length,
            interactions: interactionsCount,
            dcas: 10,
            users: users.length,
        });
    } catch (err) {
        console.error('Ingest error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/admin/dcas
exports.createDca = async (req, res) => {
    try {
        const { dca_id, dca_name, region_coverage, contact_email, dca_password } = req.body;
        if (!dca_id || !dca_name) {
            return res.status(400).json({ error: 'dca_id and dca_name required' });
        }
        const nextPassword = String(dca_password || '').trim();
        if (nextPassword.length !== 6) {
            return res.status(400).json({ error: 'DCA password must be exactly 6 characters' });
        }
        const existing = await DcaOrg.findOne({ dca_id });
        if (existing) {
            return res.status(400).json({ error: 'DCA already exists' });
        }

        const digitsMatch = String(dca_id).match(/(\d+)$/);
        const sanitizedDcaId = String(dca_id).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const baseUsername = digitsMatch
            ? `dca_user_${digitsMatch[1].padStart(2, '0')}`
            : `dca_user_${sanitizedDcaId || 'new'}`;

        let dcaUsername = baseUsername;
        let suffix = 1;
        while (await User.findOne({ username: dcaUsername })) {
            dcaUsername = `${baseUsername}_${suffix}`;
            suffix += 1;
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(nextPassword, salt);

        const dca = await DcaOrg.create({
            dca_id,
            dca_name,
            region_coverage: region_coverage || '',
            contact_email: contact_email || '',
        });

        try {
            await User.create({
                username: dcaUsername,
                password_hash,
                role: 'dca_user',
                dca_id,
                is_active: true,
            });
        } catch (userErr) {
            await DcaOrg.deleteOne({ _id: dca._id });
            throw userErr;
        }

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'CREATE_DCA',
            entity_type: 'dca_org',
            entity_id: dca_id,
            after: dca.toObject(),
        });

        res.status(201).json({
            ...dca.toObject(),
            dca_user_credentials: {
                username: dcaUsername,
            },
        });
    } catch (err) {
        console.error('Create DCA error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/admin/dcas
exports.listDcas = async (req, res) => {
    try {
        const dcas = await DcaOrg.find().sort({ dca_id: 1 });
        res.json(dcas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/admin/dcas/:id
exports.updateDca = async (req, res) => {
    try {
        // Try finding by dca_id first, then _id
        let dca = await DcaOrg.findOne({ dca_id: req.params.id });
        if (!dca && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            dca = await DcaOrg.findById(req.params.id);
        }
        if (!dca) return res.status(404).json({ error: 'DCA not found' });

        const { dca_name, region_coverage, contact_email, is_active } = req.body;

        const before = dca.toObject();
        if (dca_name) dca.dca_name = dca_name;
        if (region_coverage !== undefined) dca.region_coverage = region_coverage;
        if (contact_email !== undefined) dca.contact_email = contact_email;
        if (typeof is_active === 'boolean') dca.is_active = is_active;

        await dca.save();

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'UPDATE_DCA',
            entity_type: 'dca_org',
            entity_id: dca.dca_id,
            after: dca.toObject(),
        });

        res.json(dca);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/admin/dcas/:id
exports.deleteDca = async (req, res) => {
    try {
        let dca = await DcaOrg.findOne({ dca_id: req.params.id });
        if (!dca && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            dca = await DcaOrg.findById(req.params.id);
        }
        if (!dca) return res.status(404).json({ error: 'DCA not found' });

        // Before deleting the DCA org:
        // 1) remove all DCA user accounts linked to this DCA
        // 2) release all non-closed cases so they can be reassigned
        const [usersDeleteResult, releasedCasesResult] = await Promise.all([
            User.deleteMany({ role: 'dca_user', dca_id: dca.dca_id }),
            Case.updateMany(
                { assigned_dca_id: dca.dca_id, current_stage_snapshot: { $ne: 'Closed' } },
                {
                    $set: {
                        assigned_dca_id: null,
                        assigned_date: null,
                        assigned_by: null,
                        current_stage_snapshot: 'Allocated',
                    },
                }
            ),
        ]);

        const before = dca.toObject();
        await DcaOrg.deleteOne({ _id: dca._id });

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'DELETE_DCA',
            entity_type: 'dca_org',
            entity_id: dca.dca_id,
            before,
            after: {
                deleted_dca_users: usersDeleteResult.deletedCount || 0,
                released_open_cases: releasedCasesResult.modifiedCount || 0,
            },
        });

        res.json({
            message: 'DCA deleted',
            deleted_dca_users: usersDeleteResult.deletedCount || 0,
            released_open_cases: releasedCasesResult.modifiedCount || 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/admin/managers
exports.createManagerUser = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'username required' });
        }

        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: 'Username already exists' });

        const finalPassword = password || crypto.randomBytes(4).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(finalPassword, salt);

        const user = await User.create({
            username,
            password_hash: hash,
            role: 'manager',
            dca_id: null,
            is_active: true,
        });

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'CREATE_MANAGER_USER',
            entity_type: 'user',
            entity_id: user._id.toString(),
            after: { username, role: 'manager' },
        });

        res.status(201).json({
            id: user._id,
            username: user.username,
            role: user.role,
            is_active: user.is_active,
            temp_password: password ? null : finalPassword,
        });
    } catch (err) {
        console.error('Create manager user error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/admin/managers
exports.listManagers = async (req, res) => {
    try {
        const managers = await User.find({ role: 'manager' }).select('-password_hash').sort({ username: 1 });
        res.json(managers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/admin/dca-users
exports.createDcaUser = async (req, res) => {
    try {
        const { username, dca_id, password } = req.body;
        if (!username || !dca_id) {
            return res.status(400).json({ error: 'username and dca_id required' });
        }

        const dcaOrg = await DcaOrg.findOne({ dca_id });
        if (!dcaOrg) return res.status(400).json({ error: 'DCA org not found' });

        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: 'Username already exists' });

        const finalPassword = password || crypto.randomBytes(4).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(finalPassword, salt);

        const user = await User.create({
            username,
            password_hash: hash,
            role: 'dca_user',
            dca_id,
            is_active: true,
        });

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'CREATE_DCA_USER',
            entity_type: 'user',
            entity_id: user._id.toString(),
            after: { username, dca_id, role: 'dca_user' },
        });

        res.status(201).json({
            id: user._id,
            username: user.username,
            dca_id: user.dca_id,
            temp_password: password ? null : finalPassword,
        });
    } catch (err) {
        console.error('Create DCA user error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/admin/managers/:id/reset
exports.resetManagerPassword = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'manager') {
            return res.status(404).json({ error: 'Manager user not found' });
        }

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(tempPassword, salt);
        await user.save();

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'RESET_MANAGER_PASSWORD',
            entity_type: 'user',
            entity_id: user._id.toString(),
        });

        res.json({ temp_password: tempPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/admin/dca-users
exports.listDcaUsers = async (req, res) => {
    try {
        const query = { role: 'dca_user' };
        if (req.query.dca_id) query.dca_id = req.query.dca_id;
        const users = await User.find(query).select('-password_hash').sort({ username: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/admin/dca-users/:id/reset
exports.resetDcaUserPassword = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'dca_user') {
            return res.status(404).json({ error: 'DCA user not found' });
        }

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(tempPassword, salt);
        await user.save();

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'RESET_PASSWORD',
            entity_type: 'user',
            entity_id: user._id.toString(),
        });

        res.json({ temp_password: tempPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/admin/dca-users/:id
exports.updateDcaUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'dca_user') {
            return res.status(404).json({ error: 'DCA user not found' });
        }

        const before = user.toObject();

        if (typeof req.body.is_active === 'boolean') {
            user.is_active = req.body.is_active;
        }

        if (req.body.username && req.body.username !== user.username) {
            const existing = await User.findOne({ username: req.body.username });
            if (existing) return res.status(400).json({ error: 'Username already taken' });
            user.username = req.body.username;
        }

        if (req.body.dca_id) {
            const dcaDiff = await DcaOrg.findOne({ dca_id: req.body.dca_id });
            if (!dcaDiff) return res.status(400).json({ error: 'Invalid DCA ID' });
            user.dca_id = req.body.dca_id;
        }

        if (req.body.password) {
            if (String(req.body.password).trim().length !== 6) {
                return res.status(400).json({ error: 'DCA user password must be exactly 6 characters' });
            }
            const salt = await bcrypt.genSalt(10);
            user.password_hash = await bcrypt.hash(req.body.password, salt);
        }

        await user.save();

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'UPDATE_',
            entity_type: 'user',
            entity_id: user._id.toString(),
            before,
            after: user.toObject(),
        });

        res.json({ id: user._id, username: user.username, is_active: user.is_active, dca_id: user.dca_id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/admin/managers/:id
exports.updateManagerUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'manager') {
            return res.status(404).json({ error: 'Manager user not found' });
        }

        const before = user.toObject();

        if (typeof req.body.is_active === 'boolean') {
            user.is_active = req.body.is_active;
        }

        if (req.body.username && req.body.username !== user.username) {
            const existing = await User.findOne({ username: req.body.username });
            if (existing) return res.status(400).json({ error: 'Username already taken' });
            user.username = req.body.username;
        }

        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            user.password_hash = await bcrypt.hash(req.body.password, salt);
        }

        await user.save();

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'UPDATE_MANAGER_USER',
            entity_type: 'user',
            entity_id: user._id.toString(),
            before,
            after: user.toObject(),
        });

        res.json({
            id: user._id,
            username: user.username,
            role: user.role,
            is_active: user.is_active,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/admin/dca-users/:id
exports.deleteDcaUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'dca_user') {
            return res.status(404).json({ error: 'DCA user not found' });
        }

        const before = user.toObject();
        await User.deleteOne({ _id: user._id });

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'DELETE_DCA_USER',
            entity_type: 'user',
            entity_id: user._id.toString(),
            before,
        });

        res.json({ message: 'DCA user deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/admin/managers/:id
exports.deleteManagerUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'manager') {
            return res.status(404).json({ error: 'Manager user not found' });
        }

        const before = user.toObject();
        await User.deleteOne({ _id: user._id });

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'DELETE_MANAGER_USER',
            entity_type: 'user',
            entity_id: user._id.toString(),
            before,
        });

        res.json({ message: 'Manager deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
