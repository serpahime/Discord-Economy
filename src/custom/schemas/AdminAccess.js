const mongoose = require('mongoose');

const AdminAccessSchema = new mongoose.Schema({
    user_id: { type: String, required: true, unique: true },
    granted_by: { type: String, required: true },
    granted_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminAccess', AdminAccessSchema); 