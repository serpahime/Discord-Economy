const { Schema } = require('mongoose');

const PrivateSchema = new Schema({
    owner_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    room_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    }
}, {
    timestamps: false,
    versionKey: false
});

module.exports = PrivateSchema;