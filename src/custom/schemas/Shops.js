const { Schema } = require('mongoose');

const ShopSchema = new Schema({
    owner_id: {
        type: String,
        required: true,
        index: true
    },
    role_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name_role: {
        type: String,
        required: true,
        index: true
    },
    price: {
        type: Number,
        required: true,
        index: true
    },
    color: {
        type: String, // hex
        required: true,
        index: true
        // убран флаг unique
    },
    buy_count: {
        type: Number,
        default: 0
    },
    show_shop: {
        type: Boolean,
        default: false
    },
    created_at: {
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
    }
}, {
    timestamps: false,
    versionKey: false
});


module.exports = ShopSchema;