const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    actor_user: { type: String, required: true },
    action: { type: String, required: true },
    entity_type: { type: String, default: '' },
    entity_id: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ entity_type: 1, entity_id: 1 });
auditLogSchema.index({ actor_user: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
