const axios = require('axios');
const config = require('../config');
const Case = require('../models/Case');
const Allocation = require('../models/Allocation');
const MlMetric = require('../models/MlMetric');

const ML_URL = config.ML_SERVICE_URL;

// POST /api/cases/:case_id/predict
exports.predict = async (req, res) => {
    try {
        const c = await Case.findOne({ case_id: req.params.case_id });
        if (!c) return res.status(404).json({ error: 'Case not found' });

        const caseJson = {
            region: c.region || 'UNKNOWN',
            industry: c.industry || 'UNKNOWN',
            invoice_amount_usd: c.invoice_amount_usd || 0,
            num_open_invoices: c.num_open_invoices || 0,
            overdue_days_at_allocation: c.overdue_days_at_allocation || 0,
            previous_default_count: c.previous_default_count || 0,
            previous_recovery_rate: c.previous_recovery_rate || 0,
            payment_history_score: c.payment_history_score || 0,
            credit_score_band: c.credit_score_band || 'UNKNOWN',
            contact_attempts_last_30d: c.contact_attempts_last_30d || 0,
            last_contact_channel: c.last_contact_channel || 'UNKNOWN',
            dispute_flag: c.dispute_flag || 0,
            promised_to_pay_flag: c.promised_to_pay_flag || 0,
            assigned_dca_id: c.assigned_dca_id || 'UNKNOWN',
            sla_days: c.sla_days || 14,
        };

        const response = await axios.post(`${ML_URL}/ml/predict`, caseJson, { timeout: 30000 });
        const { prob_60d, exp_amt, exp_days } = response.data;

        // Update case with AI scores
        c.ai_prob_60d = prob_60d;
        c.ai_exp_amt = exp_amt;
        c.ai_exp_days = exp_days;
        c.ai_scored_at = new Date();
        await c.save();

        res.json({
            case_id: c.case_id,
            prob_60d,
            exp_amt,
            exp_days,
            scored_at: c.ai_scored_at,
        });
    } catch (err) {
        console.error('Predict error:', err.message);
        if (err.response) {
            return res.status(502).json({ error: 'ML service error', details: err.response.data });
        }
        res.status(500).json({ error: err.message });
    }
};

// POST /api/cases/:case_id/recommend
exports.recommend = async (req, res) => {
    try {
        const c = await Case.findOne({ case_id: req.params.case_id });
        if (!c) return res.status(404).json({ error: 'Case not found' });

        const caseJson = {
            region: c.region || 'UNKNOWN',
            industry: c.industry || 'UNKNOWN',
            invoice_amount_usd: c.invoice_amount_usd || 0,
            num_open_invoices: c.num_open_invoices || 0,
            overdue_days_at_allocation: c.overdue_days_at_allocation || 0,
            previous_default_count: c.previous_default_count || 0,
            previous_recovery_rate: c.previous_recovery_rate || 0,
            payment_history_score: c.payment_history_score || 0,
            credit_score_band: c.credit_score_band || 'UNKNOWN',
            contact_attempts_last_30d: c.contact_attempts_last_30d || 0,
            last_contact_channel: c.last_contact_channel || 'UNKNOWN',
            dispute_flag: c.dispute_flag || 0,
            promised_to_pay_flag: c.promised_to_pay_flag || 0,
            assigned_dca_id: c.assigned_dca_id || 'UNKNOWN',
            sla_days: c.sla_days || 14,
        };

        const response = await axios.post(`${ML_URL}/ml/recommend-dca`, caseJson, { timeout: 60000 });
        const { recommendations, best_dca } = response.data;

        // Store allocation
        const allocation = await Allocation.create({
            case_id: c.case_id,
            recommended: recommendations.map((r) => ({
                dca_id: r.dca_id,
                final_score: r.final_score,
                prob_60d: r.prob_60d,
                exp_amt: r.exp_amt,
                exp_days: r.exp_days,
                reason: r.reason,
            })),
            assigned_dca_id: null,
        });

        res.json({
            case_id: c.case_id,
            recommendations,
            best_dca,
            allocation_id: allocation._id,
        });
    } catch (err) {
        console.error('Recommend error:', err.message);
        if (err.response) {
            return res.status(502).json({ error: 'ML service error', details: err.response.data });
        }
        res.status(500).json({ error: err.message });
    }
};

// POST /api/ml/train
exports.train = async (req, res) => {
    try {
        const response = await axios.post(`${ML_URL}/ml/train`, {}, { timeout: 120000 });
        const metrics = response.data;

        // Store metrics in Mongo
        await MlMetric.create({
            trained_at: new Date(),
            metrics: metrics,
        });

        res.json(metrics);
    } catch (err) {
        console.error('Train error:', err.message);
        if (err.response) {
            return res.status(502).json({ error: 'ML service error', details: err.response.data });
        }
        res.status(500).json({ error: err.message });
    }
};

// GET /api/ml/metrics — get latest training metrics
exports.getMetrics = async (req, res) => {
    try {
        const latest = await MlMetric.findOne().sort({ trained_at: -1 }).lean();
        if (!latest) {
            return res.json({ message: 'No training metrics yet' });
        }
        res.json(latest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/ml/metrics/history — get all training runs
exports.getMetricsHistory = async (req, res) => {
    try {
        const history = await MlMetric.find().sort({ trained_at: -1 }).limit(20).lean();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
