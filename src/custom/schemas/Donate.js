const { Schema } = require('mongoose');

const DonateSchema = new Schema({
    user_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    donate: {
        type: Number,
        default: 0
    },
    history_buy: [{
        buy: String,
        donate: Number,
        date: Number
    }]
}, {
    timestamps: false,
    versionKey: false
});

DonateSchema.statics.addDonate = async function(user_id, buy, donate) {
    const donateData = await this.findOne({ user_id });
    if (!donateData) {
        await this.create({ user_id, donate: 0 });
    }
};

DonateSchema.statics.getDonate = async function(user_id) {
    const donateData = await this.findOne({ user_id });
    return donateData ? donateData.donate : 0;
};

DonateSchema.statics.getHistoryBuy = async function(user_id) {
    const donateData = await this.findOne({ user_id });
    return donateData ? donateData.history_buy : [];
};

DonateSchema.statics.addHistoryBuy = async function(user_id, buy, donate) {
    const donateData = await this.findOne({ user_id });
    if (!donateData) {
        await this.create({ user_id, history_buy: [] });
    }
    donateData.history_buy.push({ buy, donate, date: Math.floor(Date.now() / 1000) });
    await donateData.save();
};


module.exports = DonateSchema;
