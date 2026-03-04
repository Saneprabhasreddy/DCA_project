const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
    interaction_id: { type: String, required: true, unique: true },
    case_id: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, default: '' },
    event_type: { type: String, default: '' },
    channel: { type: String, default: '' },
    notes: { type: String, default: '' },
    outcome: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Interaction', interactionSchema);
