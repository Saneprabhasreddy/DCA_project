const Case = require('../models/Case');
const Interaction = require('../models/Interaction');
const AuditLog = require('../models/AuditLog');

// GET /api/cases
exports.listCases = async (req, res) => {
    try {
        const query = {};

        // RBAC:  only sees assigned cases
        if (req.user.role === 'dca_user') {
            query.assigned_dca_id = req.user.dca_id;
        }

        // Filtering
        if (req.query.region) query.region = req.query.region;
        if (req.query.industry) query.industry = req.query.industry;
        if (req.query.assigned_dca_id) query.assigned_dca_id = req.query.assigned_dca_id;
        if (req.query.current_stage_snapshot) query.current_stage_snapshot = req.query.current_stage_snapshot;

        // Search by case_id
        if (req.query.search) {
            query.case_id = { $regex: req.query.search, $options: 'i' };
        }

        // Smart filters for DCA My Cases
        if (req.query.filter === 'overdue_sla') {
            query.sla_due_date = { $lt: new Date() };
            query.current_stage_snapshot = { $ne: 'Closed' };
        } else if (req.query.filter === 'open') {
            query.current_stage_snapshot = { $ne: 'Closed' };
        } else if (req.query.filter === 'closed') {
            query.current_stage_snapshot = 'Closed';
        } else if (req.query.filter === 'ptp') {
            query.$or = [{ promised_to_pay_flag: 1 }, { current_stage_snapshot: 'PTP' }];
        } else if (req.query.filter === 'dispute') {
            query.$or = [{ dispute_flag: 1 }, { current_stage_snapshot: 'Dispute' }];
        }

        // Sorting
        let sortObj = { createdAt: -1 };
        if (req.query.sort === 'prob') {
            sortObj = { ai_prob_60d: -1 };
        } else if (req.query.sort === 'amount') {
            sortObj = { invoice_amount_usd: -1 };
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const [cases, total] = await Promise.all([
            Case.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
            Case.countDocuments(query),
        ]);

        res.json({ cases, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error('List cases error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/cases
exports.createCase = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload.invoice_amount_usd || payload.invoice_amount_usd <= 0) {
            return res.status(400).json({ error: 'Invoice amount must be > 0' });
        }
        if (payload.overdue_days_at_allocation < 0) {
            return res.status(400).json({ error: 'Overdue days cannot be negative' });
        }
        if (!payload.customer_id || !payload.company_name || !payload.contact_person_name) {
            return res.status(400).json({ error: 'Customer ID, Company Name, and Contact Person are required' });
        }

        const count = await Case.countDocuments();
        const case_id = `C${String(count + 1).padStart(6, '0')}`;
        const slaDays = Number.isFinite(Number(payload.sla_days)) ? Number(payload.sla_days) : 14;
        const slaDueDate = new Date(Date.now() + (slaDays * 24 * 60 * 60 * 1000));

        const newCase = await Case.create({
            ...payload,
            case_id,
            current_stage_snapshot: 'New',
            sla_days: slaDays,
            sla_due_date: slaDueDate,
        });

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'CREATE_CASE',
            entity_type: 'case',
            entity_id: case_id,
            after: newCase.toObject()
        });

        res.status(201).json(newCase);
    } catch (err) {
        console.error('Create case error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};

// GET /api/cases/:case_id
exports.getCase = async (req, res) => {
    try {
        const c = await Case.findOne({ case_id: req.params.case_id }).lean();
        if (!c) return res.status(404).json({ error: 'Case not found' });

        // RBAC: dca_user can only see their assigned cases
        if (req.user.role === 'dca_user' && c.assigned_dca_id !== req.user.dca_id) {
            return res.status(403).json({ error: 'Not authorized to view this case' });
        }

        res.json(c);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/cases/:case_id/contact
exports.updateCaseContact = async (req, res) => {
    try {
        const c = await Case.findOne({ case_id: req.params.case_id });
        if (!c) return res.status(404).json({ error: 'Case not found' });

        const editableFields = [
            'contact_person_name',
            'company_name',
            'phone',
            'alternate_phone',
            'email',
            'address',
            'preferred_contact_channel',
            'timezone',
        ];

        const before = {};
        const after = {};

        for (const field of editableFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                before[field] = c[field] || '';
                const nextValue = typeof req.body[field] === 'string' ? req.body[field].trim() : '';
                c[field] = nextValue;
                after[field] = nextValue;
            }
        }

        if (Object.prototype.hasOwnProperty.call(after, 'email') && after.email) {
            const emailRegex = /^\S+@\S+\.\S+$/;
            if (!emailRegex.test(after.email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }
        }

        await c.save();

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'UPDATE_CASE_CONTACT',
            entity_type: 'case',
            entity_id: c.case_id,
            before,
            after,
        });

        res.json(c);
    } catch (err) {
        console.error('Update contact error:', err);
        res.status(500).json({ error: err.message });
    }
};

// GET /api/cases/:case_id/interactions
exports.getCaseInteractions = async (req, res) => {
    try {
        const c = await Case.findOne({ case_id: req.params.case_id });
        if (!c) return res.status(404).json({ error: 'Case not found' });

        if (req.user.role === 'dca_user' && c.assigned_dca_id !== req.user.dca_id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const interactions = await Interaction.find({ case_id: req.params.case_id }).sort({ timestamp: -1 }).lean();
        res.json(interactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/cases/:case_id/interactions
exports.addInteraction = async (req, res) => {
    try {
        const c = await Case.findOne({ case_id: req.params.case_id });
        if (!c) return res.status(404).json({ error: 'Case not found' });

        if (req.user.role === 'dca_user' && c.assigned_dca_id !== req.user.dca_id) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (c.current_stage_snapshot === 'Closed') {
            return res.status(400).json({ error: 'Cannot add interactions to a closed case' });
        }

        const { event_type, channel, notes, outcome, close_reason } = req.body;
        const count = await Interaction.countDocuments();
        const interaction_id = `I${String(count + 1).padStart(7, '0')}`;

        const interaction = await Interaction.create({
            interaction_id,
            case_id: req.params.case_id,
            timestamp: new Date(),
            actor: req.user.username,
            event_type: event_type || 'Note Added',
            channel: channel || 'Portal',
            notes: notes || '',
            outcome: outcome || '',
        });

        // Update case stage if provided
        if (req.body.stage && req.body.stage !== c.current_stage_snapshot) {
            const before = c.current_stage_snapshot;
            c.current_stage_snapshot = req.body.stage;

            if (req.body.stage === 'Closed') {
                c.closed_at = new Date();
                c.closed_by = req.user.username;
                c.close_reason = close_reason || outcome || 'Closed via interaction';

                // If it was closed with settlement or full payment, set recovered flag 
                if (['Settled', 'Paid in Full', 'Payment Received'].includes(outcome) || ['Settled', 'Paid in Full', 'Payment Received'].includes(close_reason)) {
                    c.recovered_flag = 1;
                    c.recovery_date = new Date();
                }
            }

            await c.save();

            await AuditLog.create({
                actor_user: req.user.username,
                action: 'UPDATE_CASE_STAGE',
                entity_type: 'case',
                entity_id: c.case_id,
                before: { current_stage_snapshot: before },
                after: { current_stage_snapshot: req.body.stage },
            });
        }

        res.status(201).json(interaction);
    } catch (err) {
        console.error('Add interaction error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/cases/:case_id/assign
exports.assignCase = async (req, res) => {
    try {
        const c = await Case.findOne({ case_id: req.params.case_id });
        if (!c) return res.status(404).json({ error: 'Case not found' });
        if (c.current_stage_snapshot === 'Closed') {
            return res.status(400).json({ error: 'Cannot assign a closed case' });
        }

        const { assigned_dca_id } = req.body;
        if (!assigned_dca_id) return res.status(400).json({ error: 'assigned_dca_id required' });

        const before = { assigned_dca_id: c.assigned_dca_id };
        c.assigned_dca_id = assigned_dca_id;
        c.assigned_date = new Date();
        c.assigned_by = req.user.username;
        if (['Allocated', 'New'].includes(c.current_stage_snapshot)) {
            c.current_stage_snapshot = 'In Progress';
        }
        await c.save();

        await AuditLog.create({
            actor_user: req.user.username,
            action: 'ASSIGN_DCA',
            entity_type: 'case',
            entity_id: c.case_id,
            before,
            after: { assigned_dca_id },
        });

        res.json(c);
    } catch (err) {
        console.error('Assign error:', err);
        res.status(500).json({ error: err.message });
    }
};
