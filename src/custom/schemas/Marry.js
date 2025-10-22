const { Schema } = require('mongoose');


const MarrySchema = new Schema({
    users: {
        type: Array,
        required: true
    },
    online: {
        type: Number,
        default: 0
    },
    date: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    love_room_id: {
        type: String,
        default: null
    },
    name_love_room: {
        type: String,
        required: true
    },
    balance: {

        type: Number,
        default: 0
    },
    date: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    date_end: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 10 дней
    },
    notify: {   
        type: Boolean,
        default: false
    }
}, {
    timestamps: false,
    versionKey: false
});





module.exports = MarrySchema;