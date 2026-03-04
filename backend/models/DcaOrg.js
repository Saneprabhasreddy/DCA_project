const mongoose = require('mongoose');

const dcaOrgSchema = new mongoose.Schema({
    dca_id: { type: String, required: true, unique: true },
    dca_name: { type: String, required: true },
    region_coverage: { type: String, default: '' },
    contact_email: { type: String, default: '' },
    is_active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('DcaOrg', dcaOrgSchema);
