const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'dca_user'], required: true },
    dca_id: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    last_login_at: { type: Date, default: null },
}, { timestamps: true });

userSchema.index({ role: 1 });
userSchema.index({ dca_id: 1 });

module.exports = mongoose.model('User', userSchema);
