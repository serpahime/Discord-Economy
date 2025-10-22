const { Schema } = require('mongoose');

const RoomSchema = new Schema({
    owner_id: {
        type: String,
        required: true,
        index: true
    },
    role_id: {
        type: String,
        required: true,
        index: true
    },
    room_id: {
        type: String,
        default: null
    },
    name_role: {
        type: String,
        required: true,
        index: true
    },
    name_room: {
        type: String,
        required: true,
        index: true
    },
    users: {
        type: Array,
        default: []
    },
    date_create: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    date_end: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 дней в секундах
    },
    notify: {
        type: Boolean,
        default: false
    },
    online: {
        type: Number,
        default: 0
    },
    exp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 0
    },
    chat: {
        type: Boolean,
        default: false
    },
    chat_id: {
        type: String,
        default: null
    }
}, {
    timestamps: false,
    versionKey: false
});

module.exports = RoomSchema