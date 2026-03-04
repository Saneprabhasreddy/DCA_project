const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
    case_id: { type: String, required: true, index: true },
    recommended: [{
        dca_id: String,
        final_score: Number,
        prob_60d: Number,
        exp_amt: Number,
        exp_days: Number,
        reason: String,
    }],
    assigned_dca_id: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Allocation', allocationSchema);
