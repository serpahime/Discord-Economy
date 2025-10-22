const { User } = require('discord.js');
const { Schema, model } = require('mongoose');

// Helpers
function generateBankAccountNumber() {
	// Format: "dddd dddd dddd dddd"
	const digits = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
	return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`;
}

function getMonthKey(tsSec) {
	const date = new Date((tsSec || Math.floor(Date.now() / 1000)) * 1000);
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}

const UserSchema = new Schema({
    user_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    partner_id: {
        type: String,
        default: null
    },

	// Банковский счет пользователя
	bank_account: {
		type: String,
		unique: true,
		index: true,
	},
    balance: {
        type: Number,
        default: 0
    },
    experience: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    messages: {
        type: Number,
        default: 0
    },
    reputation: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        default: 'Не указан'
    },
    cooldowns: {
        reputation: {
            type: Number,
            default: null
        },
        timely: {
            type: Number,
            default: null
        }
    },
    online: {
        online: {
            type: Number,
            default: 0
        },
        online_day: {
            type: Number,
            default: 0
        },
        online_week: {
            type: Number,
            default: 0
        }
    },
    history_marry: [{
        partner_id: String,
        start_date: {
            type: Number,
            default: () => Math.floor(Date.now() / 1000)
        },
        end_date: {
            type: Number,
            default: null
        }
    }],
    // Расширенная система транзакций
    transactions: [{
        // от кого (user_id) – опционально
        from_user_id: { type: String, default: null },
        // кому (user_id) – опционально
        to_user_id: { type: String, default: null },
        // банковские счета для удобства трекинга
        from_account: { type: String, default: null },
        to_account: { type: String, default: null },
        // направление относительно ТЕКУЩЕГО пользователя
        type: { type: String, enum: ['give', 'take'], required: true },
        amount: { type: Number, required: true },
        // когда
        date: { type: Number, default: () => Math.floor(Date.now() / 1000) },
        // куда/за что
        description: { type: String, default: '' }
    }],

	// Ежемесячная аналитика
	monthly_analytics: {
		month_key: { type: String, default: () => getMonthKey() }, // YYYY-MM
		spent_month: { type: Number, default: 0 },
		earned_month: { type: Number, default: 0 },
		total_month: { type: Number, default: 0 } // earned - spent
	},
    roles: {
        show: {
            type: [String],
            default: []
        },
        hide: {
            type: [String],
            default: []
        }
    },
    inventory: {
        type: Array,
        default: [],
        validate: {
            validator: function(array) {
                return array.every(item => {
                    return (
                        item.id && // уникальный id предмета
                        item.type && // тип предмета (например: 'admin', 'gender')
                        item.time && // срок действия ('1d', '3d', '7d', '1w', '1m')
                        item.data_end && // время окончания в timestamp
                        item.activate !== undefined && // активирован ли предмет
                        (item.type === 'gender' ? item.gender !== undefined : true) // gender только для type === 'gender'
                    );
                });
            }
        }
    },
    created_at: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    },
    updated_at: {
        type: Number,
        default: () => Math.floor(Date.now() / 1000)
    }
}, {
    timestamps: false,
    versionKey: false
});

// Создаем/назначаем модель для внутренних проверок уникальности
const UsersModel = model('Users', UserSchema);

UserSchema.pre('save', function(next) {
    if (this.isModified()) {
        this.updated_at = Math.floor(Date.now() / 1000);
    }
	// Генерация банковского счёта при отсутствии
	if (!this.bank_account) {
		this.bank_account = generateBankAccountNumber();
	}

	// Сброс ключа месяца при смене месяца
	const currentKey = getMonthKey();
	if (!this.monthly_analytics || this.monthly_analytics.month_key !== currentKey) {
		this.monthly_analytics = {
			month_key: currentKey,
			spent_month: 0,
			earned_month: 0,
			total_month: 0
		};
	}
    next();
});

// Обеспечить реальную уникальность bank_account (на случай коллизии)
UserSchema.pre('validate', async function(next) {
	if (!this.bank_account) {
		let acc;
		for (let i = 0; i < 10; i++) {
			acc = generateBankAccountNumber();
			const exists = await UsersModel.exists({ bank_account: acc });
			if (!exists) break;
		}
		this.bank_account = acc;
	}
	return next();
});

// Виртуальное поле для проверки брака
UserSchema.virtual('isMarried').get(function() {
    return this.partner_id !== null;
});

// Добавление пользователя в базу данных

UserSchema.statics.addUser = async function(user) {
	let userData = await this.findOne({ user_id: user.id });
	if (!userData) {
		userData = await this.create({ user_id: user.id, balance: 0, status: 'Не установлен' });
	}
	return userData;
};

// Запись транзакции и обновление месячной аналитики
UserSchema.statics.recordTransaction = async function(userId, payload) {
	const {
		from_user_id = null,
		to_user_id = null,
		amount,
		type, // 'give' | 'take' относительно userId
		description = '',
		date = Math.floor(Date.now() / 1000)
	} = payload;

	if (!['give', 'take'].includes(type)) throw new Error('Invalid transaction type');
	if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) throw new Error('Invalid amount');

	const user = await this.findOne({ user_id: userId });
	if (!user) throw new Error('User not found');

	const monthKey = getMonthKey(date);
	if (!user.monthly_analytics || user.monthly_analytics.month_key !== monthKey) {
		user.monthly_analytics = {
			month_key: monthKey,
			spent_month: 0,
			earned_month: 0,
			total_month: 0
		};
	}

	const tx = {
		from_user_id,
		to_user_id,
		from_account: from_user_id === user.user_id ? user.bank_account : null,
		to_account: to_user_id === user.user_id ? user.bank_account : null,
		type,
		amount,
		date,
		description
	};

	user.transactions.push(tx);

	if (type === 'give') {
		user.monthly_analytics.spent_month += amount;
		user.balance = Math.max(0, (user.balance || 0) - amount);
	} else {
		user.monthly_analytics.earned_month += amount;
		user.balance = (user.balance || 0) + amount;
	}
	user.monthly_analytics.total_month = user.monthly_analytics.earned_month - user.monthly_analytics.spent_month;

	await user.save();
	return user;
};

UserSchema.virtual('canGetTimely').get(function() {
    const now = Math.floor(Date.now() / 1000);
    const cooldown = 12 * 60 * 60; // 12 часов в секундах
    return now >= (this.cooldowns.timely || 0) + cooldown;
});

UserSchema.virtual('nextTimely').get(function() {
    const cooldown = 12 * 60 * 60; // 12 часов в секундах
    return this.cooldowns.timely + cooldown;
});


module.exports = UserSchema;
