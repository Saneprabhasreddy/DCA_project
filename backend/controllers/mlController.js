const config = require('../config');
const Case = require('../models/Case');
const Allocation = require('../models/Allocation');
const MlMetric = require('../models/MlMetric');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_PYTHON = path.resolve(__dirname, '../../.venv/bin/python3');
const PYTHON_BIN = config.PYTHON_BIN || (fs.existsSync(PROJECT_PYTHON) ? PROJECT_PYTHON : 'python3');

function buildMlErrorPayload(baseMessage, stderr) {
    const details = (stderr || '').trim();
    const mismatch =
        details.includes('_RemainderColsList') ||
        details.includes('InconsistentVersionWarning') ||
        details.includes('No module named');
    const missingModel =
        details.includes('No such file or directory') && details.includes('model_recovery_');

    if (mismatch || missingModel) {
        return {
            error: `${baseMessage}: model artifacts are missing/incompatible. Run POST /api/ml/train (or Dashboard -> Train Again) and retry.`,
            details,
        };
    }

    return { error: baseMessage, details };
}

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

        const scriptPath = path.join(__dirname, '../ml-scripts/predict.py');
        const pythonProcess = spawn(PYTHON_BIN, [scriptPath, '--input_json', JSON.stringify(caseJson), '--artifacts_dir', path.join(__dirname, '../../artifacts')]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                console.error('Python script error:', stderr);
                return res.status(500).json(buildMlErrorPayload('ML prediction failed', stderr));
            }

            try {
                const { prob_60d, exp_amt, exp_days } = JSON.parse(stdout.trim());

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
            } catch (parseErr) {
                console.error('JSON parse error:', parseErr, 'stdout:', stdout);
                res.status(500).json({ error: 'Failed to parse ML output' });
            }
        });
    } catch (err) {
        console.error('Predict error:', err.message);
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

        const scriptPath = path.join(__dirname, '../ml-scripts/recommend.py');
        const pythonProcess = spawn(PYTHON_BIN, [scriptPath, '--input_json', JSON.stringify(caseJson), '--mongo_uri', config.MONGO_URI, '--artifacts_dir', path.join(__dirname, '../../artifacts')]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                console.error('Python script error:', stderr);
                return res.status(500).json(buildMlErrorPayload('ML recommendation failed', stderr));
            }

            try {
                const { recommendations, best_dca } = JSON.parse(stdout.trim());

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
            } catch (parseErr) {
                console.error('JSON parse error:', parseErr, 'stdout:', stdout);
                res.status(500).json({ error: 'Failed to parse ML output' });
            }
        });
    } catch (err) {
        console.error('Recommend error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/ml/train
exports.train = async (req, res) => {
    try {
        const scriptPath = path.join(__dirname, '../ml-scripts/train.py');
        const pythonProcess = spawn(PYTHON_BIN, [scriptPath, '--dataset_path', path.join(__dirname, '../../data/fedex_dca_synthetic_dataset/cases.csv'), '--artifacts_dir', path.join(__dirname, '../../artifacts')]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('Python script error:', stderr);
                return res.status(500).json(buildMlErrorPayload('ML training failed', stderr));
            }

            try {
                const metrics = JSON.parse(stdout.trim());

                // Store metrics in Mongo
                MlMetric.create({
                    trained_at: new Date(),
                    metrics: metrics,
                });

                res.json(metrics);
            } catch (parseErr) {
                console.error('JSON parse error:', parseErr, 'stdout:', stdout);
                res.status(500).json({ error: 'Failed to parse ML output' });
            }
        });
    } catch (err) {
        console.error('Train error:', err.message);
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
