const mongoose = require('mongoose');

const mlMetricSchema = new mongoose.Schema({
    trained_at: { type: Date, default: Date.now },
    metrics: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('MlMetric', mlMetricSchema);
