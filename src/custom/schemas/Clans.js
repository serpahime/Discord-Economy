const { Schema } = require('mongoose');

const ClanPrivateVoiceSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Number,
        default: () => Date.now()
    }
});

const ClanMemberSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['owner', 'assistant', 'helper', 'member'],
        default: 'member'
    },
    online: {
        type: Number,
        default: 0
    },
    onlineWeek: {
        type: Number,
        default: 0
    },
    onlineMonth: {
        type: Number,
        default: 0
    },
    joinedAt: {
        type: Number,
        default: () => Date.now()
    }
});

const ClanChannelsSchema = new Schema({
    categoryId: {
        type: String,
        default: ''
    },
    chatId: {
        type: String,
        default: ''
    },
    infoId: {
        type: String,
        default: ''
    },
    createVoiceId: {
        type: String,
        default: ''
    },
    requestsId: {
        type: String,
        default: ''
    }
});

const ClanProfileSchema = new Schema({
    description: {
        type: String,
        default: 'Описание клана не указано'
    },
    level: {
        type: Number,
        default: 1
    },
    exp: {
        type: Number,
        default: 0
    },
    balance: {
        type: Number,
        default: 0
    },
    clanPoints: {
        type: Number,
        default: 0
    },
    online: {
        type: Number,
        default: 0
    },
    onlineWeek: {
        type: Number,
        default: 0
    },
    onlineMonth: {
        type: Number,
        default: 0
    },
    slots: {
        type: Number,
        default: 10
    },
    slotsHelper: {
        type: Number,
        default: 2
    },
    slotsAssistant: {
        type: Number,
        default: 1
    },
    premium: {
        type: Boolean,
        default: false
    },
    premiumStartDate: {
        type: Number,
        default: null
    },
    premiumEndDate: {
        type: Number,
        default: null
    },
    premiumLevel: {
        type: Number,
        default: 0
    }
});

const ClanSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    clanId: {
        type: String,
        required: true,
    },
    roleId: {
        type: String,
        default: ''
    },
    ownerId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    profile: {
        type: ClanProfileSchema,
        default: () => ({})
    },
    channels: {
        type: ClanChannelsSchema,
        default: () => ({})
    },
    members: [ClanMemberSchema],
    privateVoices: [ClanPrivateVoiceSchema]
}, {
    versionKey: false
});

// Индексы
ClanSchema.index({ clanId: 1 }, { unique: true });
ClanSchema.index({ ownerId: 1 });
ClanSchema.index({ 'members.userId': 1 });
ClanSchema.index({ 'privateVoices.userId': 1 });
ClanSchema.index({ 'privateVoices.channelId': 1 });

module.exports = ClanSchema;