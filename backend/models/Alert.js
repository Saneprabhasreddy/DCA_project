const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    case_id: { type: String, required: true, index: true },
    type: { type: String, default: 'info' },
    message: { type: String, default: '' },
    is_resolved: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
