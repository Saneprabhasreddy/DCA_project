const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
    case_id: { type: String, required: true, unique: true, index: true },
    customer_id: { type: String, default: '' },
    company_name: { type: String, default: '' },
    contact_person_name: { type: String, default: '' },
    phone: { type: String, default: '' },
    alternate_phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    preferred_contact_channel: { type: String, default: 'Email' },
    timezone: { type: String, default: 'UTC' },
    region: { type: String, default: '' },
    industry: { type: String, default: '' },
    invoice_amount_usd: { type: Number, default: 0 },
    num_open_invoices: { type: Number, default: 0 },
    overdue_days_at_allocation: { type: Number, default: 0 },
    previous_default_count: { type: Number, default: 0 },
    previous_recovery_rate: { type: Number, default: 0 },
    payment_history_score: { type: Number, default: 0 },
    credit_score_band: { type: String, default: '' },
    contact_attempts_last_30d: { type: Number, default: 0 },
    last_contact_channel: { type: String, default: '' },
    dispute_flag: { type: Number, default: 0 },
    promised_to_pay_flag: { type: Number, default: 0 },
    assigned_dca_id: { type: String, default: null },
    assigned_date: { type: Date, default: null },
    assigned_by: { type: String, default: null },
    sla_days: { type: Number, default: 14 },
    sla_due_date: { type: Date, default: null },
    current_stage_snapshot: {
        type: String,
        enum: ['Allocated', 'In Progress', 'PTP', 'Dispute', 'Escalated', 'Closed'],
        default: 'Allocated'
    },
    // Labels for training / demo
    recovered_flag: { type: Number, default: 0 },
    recovered_within_60d: { type: Number, default: 0 },
    recovered_within_30d: { type: Number, default: 0 },
    recovered_amount_usd: { type: Number, default: 0 },
    recovery_days_from_allocation: { type: Number, default: null },
    recovery_date: { type: Date, default: null },
    closed_at: { type: Date, default: null },
    closed_by: { type: String, default: null },
    close_reason: { type: String, default: '' },
    escalation_flag: { type: Number, default: 0 },
    model_collectability_bucket_hint: { type: String, default: '' },
    // AI fields
    ai_prob_60d: { type: Number, default: null },
    ai_exp_amt: { type: Number, default: null },
    ai_exp_days: { type: Number, default: null },
    ai_scored_at: { type: Date, default: null },
}, { timestamps: true });

caseSchema.index({ assigned_dca_id: 1 });
caseSchema.index({ current_stage_snapshot: 1 });
caseSchema.index({ region: 1, industry: 1 });

module.exports = mongoose.model('Case', caseSchema);
