const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { cfg } = require('../../cfg');

// Карта для отслеживания и предотвращения дублирующихся транзакций
const processedModals = new Map();

// Защищенные пользователи - только они могут взаимодействовать друг с другом
const protectedUsers = ['1370102381441978510', '1378425771709956146', '1235916722146508813'];

// Утилитарные функции
const isHighLevelAdmin = userId => cfg.apanel.allowed_users.includes(userId);

const isProtectedUser = userId => protectedUsers.includes(userId);

const canInteractWithUser = (executorId, targetId) => {
    // Если цель не защищена, можно взаимодействовать
    if (!isProtectedUser(targetId)) return true;
    
    // Если цель защищена, то исполнитель тоже должен быть защищенным
    return isProtectedUser(executorId);
};

const isTransactionProcessing = (userId, type, amount) => {
    const key = `${userId}-${type}-${amount}`;
    const now = Date.now();
    if (processedModals.get(key) && (now - processedModals.get(key)) < 5000) return true;
    processedModals.set(key, now);
    setTimeout(() => processedModals.delete(key), 5000);
    return false;
};

const sendActionLog = async (client, logData, userId) => {
    try {
        const logChannel = client.channels.cache.get('1397345875600212069');
        if (!logChannel) {
            console.error('Лог-канал не найден или бот не имеет доступа: 1397345875600212069');
            return;
        }
        await logChannel.send({ 
            embeds: [{
                title: '📝 Лог действия',
                description: logData.description,
                fields: logData.fields,
                color: logData.color || 0x3498db,
                timestamp: new Date().toISOString()
            }]
        });
    } catch (err) {
        console.error('Ошибка при отправке лога в канал:', err);
    }
};

// Шаблоны для интерфейса
const createErrorEmbed = (title, description) => ({
    embeds: [{
        title: `❌ ${title}`,
        description,
        color: 0xFF0000,
        timestamp: new Date().toISOString()
    }],
    flags: ['Ephemeral']
});

const createSuccessEmbed = (title, description) => ({
    embeds: [{
        title: `✅ ${title}`,
        description,
        color: 0x2ecc71,
        timestamp: new Date().toISOString()
    }],
    flags: ['Ephemeral']
});

const createWarningEmbed = (title, description) => ({
    embeds: [{
        title: `⚠️ ${title}`,
        description,
        color: 0xFFA500,
        timestamp: new Date().toISOString()
    }],
    flags: ['Ephemeral']
});

// Создание модальных окон
const createModal = (id, title, fields) => {
    const modal = new ModalBuilder().setCustomId(id).setTitle(title);
    fields.forEach(field => {
        const textInput = new TextInputBuilder()
            .setCustomId(field.id)
            .setLabel(field.label)
            .setStyle(field.style || TextInputStyle.Short)
            .setPlaceholder(field.placeholder || '')
            .setRequired(field.required !== false);
            
        if (field.maxLength) {
            textInput.setMaxLength(field.maxLength);
        }
        if (field.minLength) {
            textInput.setMinLength(field.minLength);
        }
        
        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    });
    return modal;
};

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('apanel')
            .setDescription('Панель управления экономикой и браками'),

        async execute(interaction, client) {
            try {
                const AdminAccess = client.schemas?.get('AdminAccess');
                if (!AdminAccess) {
                    return interaction.reply(createErrorEmbed(
                        'Ошибка системы', 
                        'Произошла ошибка при проверке доступа. Пожалуйста, сообщите администратору.'
                    ));
                }

                const hasAccess = await AdminAccess.findOne({ user_id: interaction.user.id }).catch(() => null);
                if (!hasAccess && !isHighLevelAdmin(interaction.user.id)) {
                    return interaction.reply(createErrorEmbed(
                        'Отказано в доступе', 
                        'У вас нет прав для использования этой команды!\n\nДоступ можно получить через команду `/giveaccess`'
                    ));
                }

                let accessInfo = '';
                if (hasAccess) {
                    try {
                        const grantedBy = await client.users.fetch(hasAccess.granted_by).catch(() => null);
                        accessInfo = `\n\n👤 Доступ выдан: ${grantedBy ? grantedBy.tag : 'Неизвестно'}\n📅 Дата выдачи: <t:${Math.floor(hasAccess.granted_at.getTime() / 1000)}:F>`;
                    } catch (error) {
                        accessInfo = '\n\n❗ Информация о доступе недоступна';
                    }
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('give_money').setLabel('💰 Выдать монеты').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('take_money').setLabel('🔴 Забрать монеты').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('create_marriage').setLabel('💍 Создать брак').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('divorce').setLabel('💔 Расторгнуть брак').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('create_private_room').setLabel('🏠 Создать личную руму').setStyle(ButtonStyle.Primary)
                );

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('delete_private_room').setLabel('🗑️ Удалить личную руму').setStyle(ButtonStyle.Danger)
                );

                const components = [row, row2];
                
                if (isHighLevelAdmin(interaction.user.id)) {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('give_online').setLabel('⏱️ Выдать онлайн').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('take_online').setLabel('🕒 Снять онлайн').setStyle(ButtonStyle.Danger)
                    ));
                }

                const response = await interaction.reply({
                    embeds: [{
                        title: '👑 Панель управления',
                        description: `Выберите действие, которое хотите выполнить:${accessInfo}`,
                        fields: [
                            { name: '💰 Экономика', value: '`Выдать монеты` - Начисление монет пользователю\n`Забрать монеты` - Изъятие монет у пользователя', inline: false },
                            { name: '💕 Браки', value: '`Создать брак` - Принудительное создание брака\n`Расторгнуть брак` - Принудительное расторжение брака', inline: false },
                            { name: '🏠 Румы', value: '`Создать личную руму` - Создание личной румы для пользователя\n`Удалить личную руму` - Удаление личной румы у пользователя', inline: false },
                            { name: '⏱️ Онлайн', value: '`Выдать онлайн` - Добавление времени онлайна пользователю\n`Снять онлайн` - Удаление времени онлайна у пользователя', inline: false }
                        ],
                        color: 0x2b2d31,
                        thumbnail: { url: interaction.user.displayAvatarURL({ dynamic: true }) },
                        timestamp: new Date().toISOString()
                    }],
                    components,
                    flags: ['Ephemeral']
                });

                const collector = response.createMessageComponentCollector({ time: 3_600_000 });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        return i.reply(createErrorEmbed('Ошибка доступа', 'Вы не можете использовать эти кнопки!'));
                    }

                    try {
                        switch (i.customId) {
                            case 'give_money':
                                return i.showModal(createModal('give_money_modal', '💰 Выдача монет', [
                                    { id: 'userId', label: 'ID пользователя', maxLength: 20 },
                                    { id: 'amount', label: 'Количество монет', maxLength: 10 }
                                ]));
                            
                            case 'take_money':
                                return i.showModal(createModal('take_money_modal', '🔴 Изъятие монет', [
                                    { id: 'userId', label: 'ID пользователя', maxLength: 20 },
                                    { id: 'amount', label: 'Количество монет', maxLength: 10 }
                                ]));
                            
                            case 'divorce':
                                return i.showModal(createModal('divorce_modal', '💔 Расторжение брака', [
                                    { id: 'userId', label: 'ID пользователя', maxLength: 20 }
                                ]));
                            
                            case 'give_online':
                                return i.showModal(createModal('give_online_modal', '⏱️ Выдача онлайна', [
                                    { id: 'userId', label: 'ID пользователя', maxLength: 20 },
                                    { id: 'amount', label: 'Количество секунд', maxLength: 10 },
                                    { id: 'type', label: 'Тип онлайна', placeholder: 'online', maxLength: 15 }
                                ]));
                            
                            case 'take_online':
                                return i.showModal(createModal('take_online_modal', '🕒 Снятие онлайна', [
                                    { id: 'userId', label: 'ID пользователя', maxLength: 20 },
                                    { id: 'amount', label: 'Количество секунд', maxLength: 10 },
                                    { id: 'type', label: 'Тип онлайна', placeholder: 'online', maxLength: 15 }
                                ]));

                            case 'create_private_room':
                                return i.showModal(createModal('create_private_room_modal', '🏠 Создание личной румы', [
                                    { id: 'userId', label: 'ID пользователя', maxLength: 20 },
                                    { id: 'roomName', label: 'Название румы', maxLength: 32, minLength: 1 },
                                    { id: 'roleColor', label: 'Цвет роли (HEX)', placeholder: '#FFFFFF', maxLength: 7 }
                                ]));
                            
                            case 'delete_private_room':
                                return i.showModal(createModal('delete_private_room_modal', '🗑️ Удаление личной румы', [
                                    { id: 'userId', label: 'ID пользователя', maxLength: 20 }
                                ]));
                            
                            case 'create_marriage':
                                await handleMarriageCreation(i, interaction, client);
                                break;
                                
                            default:
                                console.log(`Неизвестная кнопка: ${i.customId}`);
                                return i.reply(createErrorEmbed('Ошибка', 'Неизвестная кнопка!'));
                        }
                    } catch (error) {
                        console.error('Ошибка в обработчике кнопки:', error);
                        try {
                            await i.reply(createErrorEmbed(
                                'Ошибка', 
                                'Произошла ошибка при обработке кнопки. Пожалуйста, попробуйте позже.'
                            ));
                        } catch (replyError) {
                            console.error('Не удалось ответить на ошибку кнопки:', replyError);
                        }
                    }
                });

                // Обработчик модальных окон
                const modalHandler = async modalInteraction => {
                    if (!modalInteraction.isModalSubmit()) return;
                    
                    const interactionKey = `${modalInteraction.customId}-${modalInteraction.user.id}-${Date.now()}`;
                    if (processedModals.has(interactionKey)) return;
                    processedModals.set(interactionKey, true);
                    setTimeout(() => processedModals.delete(interactionKey), 10000);

                    const { customId, fields } = modalInteraction;
                    
                    try {
                        switch (customId) {
                            case 'give_money_modal': {
                                const userId = fields.getTextInputValue('userId');
                                await handleMoneyTransaction(modalInteraction, client, userId, true);
                                break;
                            }
                            
                            case 'take_money_modal': {
                                const userId = fields.getTextInputValue('userId');
                                await handleMoneyTransaction(modalInteraction, client, userId, false);
                                break;
                            }
                            
                            case 'divorce_modal': {
                                const userId = fields.getTextInputValue('userId');
                                await handleDivorce(modalInteraction, client, userId, interaction);
                                break;
                            }
                            
                            case 'give_online_modal': {
                                const userId = fields.getTextInputValue('userId');
                                await handleOnlineTransaction(modalInteraction, client, userId, true);
                                break;
                            }
                            
                            case 'take_online_modal': {
                                const userId = fields.getTextInputValue('userId');
                                await handleOnlineTransaction(modalInteraction, client, userId, false);
                                break;
                            }

                            case 'create_private_room_modal':
                                await handlePrivateRoomCreation(modalInteraction, client, interaction);
                                break;
                                
                            case 'delete_private_room_modal':
                                const userId = modalInteraction.fields.getTextInputValue('userId');
                                await handlePrivateRoomDeletion(modalInteraction, client, userId, interaction);
                                break;
                                
                            default:
                                console.log(`Неизвестное модальное окно: ${customId}`);
                                break;
                        }
                    } catch (error) {
                        console.error('Ошибка в обработчике модального окна:', error);
                        try {
                            await modalInteraction.reply(createErrorEmbed(
                                'Ошибка', 
                                'Произошла ошибка при обработке модального окна. Пожалуйста, попробуйте позже.'
                            ));
                        } catch (replyError) {
                            console.error('Не удалось ответить на ошибку модального окна:', replyError);
                        }
                    }
                };

                const modalListener = interaction => modalHandler(interaction);
                client.on('interactionCreate', modalListener);
                collector.on('end', () => client.removeListener('interactionCreate', modalListener));

            } catch (error) {
                console.error('Ошибка при выполнении команды:', error);
                return interaction.reply(createErrorEmbed(
                    'Ошибка', 
                    'Произошла ошибка при выполнении команды. Пожалуйста, попробуйте позже.'
                ));
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('giveaccess')
            .setDescription('Выдать доступ к команде award')
            .addUserOption(option => 
                option.setName('пользователь')
                    .setDescription('Пользователь, которому нужно выдать доступ')
                    .setRequired(true)),

        async execute(interaction, client) {
            if (!isHighLevelAdmin(interaction.user.id)) {
                return interaction.reply(createErrorEmbed('Отказано в доступе', 'У вас нет прав для выдачи доступа!'));
            }

            const targetUser = interaction.options.getUser('пользователь');
            const AdminAccess = client.schemas.get('AdminAccess');

            const existingAccess = await AdminAccess.findOne({ user_id: targetUser.id });
            if (existingAccess) {
                return interaction.reply(createErrorEmbed('Ошибка', 'У этого пользователя уже есть доступ!'));
            }

            await AdminAccess.create({
                user_id: targetUser.id,
                granted_by: interaction.user.id,
                granted_at: new Date()
            });

            await sendActionLog(client, {
                description: `**Администратор ${interaction.user} выдал доступ к панели**`,
                fields: [
                    { name: '👤 Получатель', value: `${targetUser}`, inline: true },
                    { name: '⏰ Время', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                ],
                color: 0x2ecc71
            }, interaction.user.id);

            return interaction.reply(createSuccessEmbed('Успешно', `Доступ к команде award выдан пользователю <@${targetUser.id}>`));
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('removeaccess')
            .setDescription('Удалить доступ к команде award')
            .addUserOption(option => 
                option.setName('пользователь')
                    .setDescription('Пользователь, у которого нужно удалить доступ')
                    .setRequired(true)),

        async execute(interaction, client) {
            if (!isHighLevelAdmin(interaction.user.id)) {
                return interaction.reply(createErrorEmbed('Отказано в доступе', 'У вас нет прав для удаления доступа!'));
            }

            const targetUser = interaction.options.getUser('пользователь');
            const AdminAccess = client.schemas.get('AdminAccess');

            const result = await AdminAccess.deleteOne({ user_id: targetUser.id });
            if (result.deletedCount === 0) {
                return interaction.reply(createErrorEmbed('Ошибка', 'У этого пользователя не было доступа!'));
            }

            await sendActionLog(client, {
                description: `**Администратор ${interaction.user} удалил доступ к панели**`,
                fields: [
                    { name: '👤 У пользователя', value: `${targetUser}`, inline: true },
                    { name: '⏰ Время', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                ],
                color: 0xe74c3c
            }, interaction.user.id);

            return interaction.reply(createSuccessEmbed('Успешно', `Доступ к команде award удален у пользователя <@${targetUser.id}>`));
        }
    }
];

// Универсальная функция для безопасного ответа на интеракцию
async function safeReply(interaction, options) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply(options);
        } else {
            await interaction.editReply(options);
        }
    } catch (e) {
        try {
            await interaction.followUp(options);
        } catch (e2) {
            console.error('safeReply failed', { user: interaction.user?.id, customId: interaction.customId, error: e2 });
        }
    }
}

// Вспомогательные функции обработчиков
async function handleMoneyTransaction(modalInteraction, client, userId, isGiving) {
    // Проверка защиты пользователя
    if (!canInteractWithUser(modalInteraction.user.id, userId)) {
        return safeReply(modalInteraction, createErrorEmbed(
            'Отказано в доступе', 
            'Вы не можете выполнять действия с этим пользователем! Доступ ограничен.'
        ));
    }

    const amount = parseInt(modalInteraction.fields.getTextInputValue('amount'));
    const action = isGiving ? 'give' : 'take';
    
    if (isTransactionProcessing(userId, action, amount)) {
        return safeReply(modalInteraction, createWarningEmbed('Предупреждение', 'Транзакция уже обрабатывается. Пожалуйста, подождите.'));
    }

    if (isNaN(amount) || amount <= 0) {
        return safeReply(modalInteraction, createErrorEmbed('Ошибка', 'Количество монет должно быть положительным числом!'));
    }

    const Users = client.schemas.get('Users');
    
    try {
        if (!isGiving) {
            const user = await Users.findOne({ user_id: userId });
            if (!user || user.balance < amount) {
                return safeReply(modalInteraction, createErrorEmbed('Ошибка', 'У пользователя недостаточно монет!'));
            }
        }

        await Users.updateOne(
            { user_id: userId },
            { $inc: { balance: isGiving ? amount : -amount } },
            { upsert: isGiving }
        );

        await sendActionLog(client, {
            description: `**Администратор ${modalInteraction.user} ${isGiving ? 'выдал' : 'изъял'} монеты**`,
            fields: [
                { name: `👤 ${isGiving ? 'Получатель' : 'У пользователя'}`, value: `<@${userId}>`, inline: true },
                { name: '💰 Сумма', value: `${amount}`, inline: true },
                { name: '⏰ Время', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            ],
            color: isGiving ? 0x2ecc71 : 0xe74c3c
        }, modalInteraction.user.id);

        return safeReply(modalInteraction, createSuccessEmbed('Успешно', 
            `Успешно ${isGiving ? 'выдано' : 'забрано'} ${amount} монет ${isGiving ? 'пользователю' : 'у пользователя'} <@${userId}>`
        ));
    } catch (error) {
        console.error('handleMoneyTransaction', { user: modalInteraction.user.id, customId: modalInteraction.customId, error });
        return safeReply(modalInteraction, createErrorEmbed('Ошибка', `Произошла ошибка при ${isGiving ? 'выдаче' : 'изъятии'} монет!`));
    }
}

async function handleOnlineTransaction(modalInteraction, client, userId, isGiving) {
    // Проверка защиты пользователя
    if (!canInteractWithUser(modalInteraction.user.id, userId)) {
        return safeReply(modalInteraction, createErrorEmbed(
            'Отказано в доступе', 
            'Вы не можете выполнять действия с этим пользователем! Доступ ограничен.'
        ));
    }

    const amount = parseInt(modalInteraction.fields.getTextInputValue('amount'));
    const type = modalInteraction.fields.getTextInputValue('type');
    const action = isGiving ? 'give_online' : 'take_online';
    
    if (isTransactionProcessing(userId, action, amount)) {
        return safeReply(modalInteraction, createWarningEmbed('Предупреждение', 'Операция уже обрабатывается. Пожалуйста, подождите.'));
    }

    if (isNaN(amount) || amount <= 0) {
        return safeReply(modalInteraction, createErrorEmbed('Ошибка', 'Количество секунд должно быть положительным числом!'));
    }

    if (!['online', 'online_day', 'online_week'].includes(type)) {
        return safeReply(modalInteraction, createErrorEmbed('Ошибка', 
            'Неверный тип онлайна! Допустимые значения: online, online_day, online_week'
        ));
    }

    const Users = client.schemas.get('Users');
    
    try {
        if (!isGiving) {
            const user = await Users.findOne({ user_id: userId });
            if (!user || !user.online || user.online[type] < amount) {
                return safeReply(modalInteraction, createErrorEmbed('Ошибка', `У пользователя недостаточно минут онлайна (${type})!`));
            }
        }

        const updateQuery = {};
        updateQuery[`online.${type}`] = isGiving ? amount : -amount;
        
        await Users.updateOne(
            { user_id: userId },
            { $inc: updateQuery },
            { upsert: isGiving }
        );

        await sendActionLog(client, {
            description: `**Администратор ${modalInteraction.user} ${isGiving ? 'выдал' : 'снял'} онлайн**`,
            fields: [
                { name: `👤 ${isGiving ? 'Получатель' : 'У пользователя'}`, value: `<@${userId}>`, inline: true },
                { name: '⏱️ Количество', value: `${amount} минут`, inline: true },
                { name: '📊 Тип', value: type, inline: true },
                { name: '⏰ Время', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            ],
            color: isGiving ? 0x2ecc71 : 0xe74c3c
        }, modalInteraction.user.id);

        return safeReply(modalInteraction, createSuccessEmbed('Успешно', 
            `Успешно ${isGiving ? 'выдано' : 'снято'} ${amount} минут онлайна (${type}) ${isGiving ? 'пользователю' : 'у пользователя'} <@${userId}>`
        ));
    } catch (error) {
        console.error('handleOnlineTransaction', { user: modalInteraction.user.id, customId: modalInteraction.customId, error });
        return safeReply(modalInteraction, createErrorEmbed('Ошибка', `Произошла ошибка при ${isGiving ? 'выдаче' : 'снятии'} онлайна!`));
    }
}

async function handleDivorce(modalInteraction, client, userId, originalInteraction) {
    // Проверка защиты пользователя
    if (!canInteractWithUser(modalInteraction.user.id, userId)) {
        return safeReply(modalInteraction, createErrorEmbed(
            'Отказано в доступе', 
            'Вы не можете выполнять действия с этим пользователем! Доступ ограничен.'
        ));
    }

    const Marry = client.schemas.get('Marry');
    const Users = client.schemas.get('Users');

    try {
        const marriage = await Marry.findOne({ users: { $in: [userId] } });
        if (!marriage) {
            return safeReply(modalInteraction, createErrorEmbed('Ошибка', 'Этот пользователь не состоит в браке!'));
        }

        const partnerId = marriage.users.find(id => id !== userId);
        
        // Дополнительная проверка для партнера
        if (!canInteractWithUser(modalInteraction.user.id, partnerId)) {
            return safeReply(modalInteraction, createErrorEmbed(
                'Отказано в доступе', 
                'Вы не можете расторгнуть брак с участием защищенных пользователей!'
            ));
        }

        await Marry.deleteOne({ _id: marriage._id });
        await Users.updateMany({ user_id: { $in: [userId, partnerId] } }, { $unset: { partner_id: "" } });

        const marriageRole = originalInteraction.guild.roles.cache.get('1340657424637628448');
        if (marriageRole) {
            try {
                const member1 = await originalInteraction.guild.members.fetch(userId).catch(() => null);
                const member2 = await originalInteraction.guild.members.fetch(partnerId).catch(() => null);
                
                if (member1) await member1.roles.remove(marriageRole);
                if (member2) await member2.roles.remove(marriageRole);
                
                if (!member1 || !member2) {
                    await modalInteraction.followUp(createWarningEmbed('Предупреждение', 
                        'Брак расторгнут, но не удалось удалить роль у одного или обоих пользователей.'
                    ));
                }
            } catch (error) {
                console.error('Ошибка при удалении роли брака:', error);
                await modalInteraction.followUp(createWarningEmbed('Предупреждение', 
                    'Брак расторгнут, но не удалось удалить роль у одного или обоих пользователей.'
                ));
            }
        }

        await sendActionLog(client, {
            description: `**Администратор ${modalInteraction.user} расторг брак**`,
            fields: [
                { name: '👥 Участники', value: `<@${userId}> и <@${partnerId}>`, inline: true },
                { name: '⏰ Время', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            ],
            color: 0xe74c3c
        }, modalInteraction.user.id);

        return safeReply(modalInteraction, {
            embeds: [{
                title: '�� Брак расторгнут',
                description: `Брак <@${userId}> расторгнут`,
                color: 0xe74c3c,
                timestamp: new Date().toISOString()
            }],
            flags: ['Ephemeral']
        });
    } catch (error) {
        console.error('handleDivorce', { user: modalInteraction.user.id, customId: modalInteraction.customId, error });
        return safeReply(modalInteraction, createErrorEmbed('Ошибка', 'Произошла ошибка при расторжении брака!'));
    }
}

async function handleMarriageCreation(i, interaction, client) {
    await i.reply({
        embeds: [{
            title: '💍 Создание брака',
            description: '**Отметьте первого пользователя для брака**\n\nОжидание ввода...',
            color: 0x3498db,
            timestamp: new Date().toISOString()
        }],
        flags: ['Ephemeral']
    });

    const filter = m => m.author.id === interaction.user.id && m.mentions.users.size > 0;
    
    try {
        const firstUserCollector = i.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        firstUserCollector.on('collect', async firstMsg => {
            const user1 = firstMsg.mentions.users.first();
            
            // Проверка защиты первого пользователя
            if (!canInteractWithUser(interaction.user.id, user1.id)) {
                return i.followUp(createErrorEmbed(
                    'Отказано в доступе', 
                    'Вы не можете создавать браки с этим пользователем! Доступ ограничен.'
                ));
            }
            
            await i.followUp({
                embeds: [{
                    title: '💍 Создание брака',
                    description: `**Первый пользователь:** ${user1}\n\n**Отметьте второго пользователя для брака**\nОжидание ввода...`,
                    color: 0x3498db,
                    timestamp: new Date().toISOString()
                }],
                flags: ['Ephemeral']
            });

            const secondUserCollector = i.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            secondUserCollector.on('collect', async secondMsg => {
                const user2 = secondMsg.mentions.users.first();
                
                // Проверка защиты второго пользователя
                if (!canInteractWithUser(interaction.user.id, user2.id)) {
                    return i.followUp(createErrorEmbed(
                        'Отказано в доступе', 
                        'Вы не можете создавать браки с этим пользователем! Доступ ограничен.'
                    ));
                }
                
                if (user2.id === user1.id) {
                    return i.followUp(createErrorEmbed('Ошибка', 'Нельзя создать брак с самим собой!'));
                }

                const Marry = client.schemas.get('Marry');
                const Users = client.schemas.get('Users');

                try {
                    const [existingMarriage1, existingMarriage2] = await Promise.all([
                        Marry.findOne({ users: { $in: [user1.id] } }),
                        Marry.findOne({ users: { $in: [user2.id] } })
                    ]);

                    if (existingMarriage1 || existingMarriage2) {
                        return i.followUp(createErrorEmbed('Ошибка', 'Один из пользователей уже состоит в браке!'));
                    }

                    const currentTime = Math.floor(Date.now() / 1000);
                    const dateEnd = currentTime + (30 * 24 * 60 * 60);

                    const newMarriage = await Marry.create({
                        users: [user1.id, user2.id],
                        date: currentTime,
                        balance: 0,
                        name_love_room: `${user1.username} 💕 ${user2.username}`,
                        date_end: dateEnd
                    });

                    await Promise.all([
                        Users.updateOne({ user_id: user1.id }, { $set: { partner_id: user2.id } }, { upsert: true }),
                        Users.updateOne({ user_id: user2.id }, { $set: { partner_id: user1.id } }, { upsert: true })
                    ]);

                    const marriageRole = interaction.guild.roles.cache.get('1340657424637628448');
                    if (marriageRole) {
                        try {
                            const [member1, member2] = await Promise.all([
                                interaction.guild.members.fetch(user1.id),
                                interaction.guild.members.fetch(user2.id)
                            ]);
                            
                            await Promise.all([
                                member1.roles.add(marriageRole),
                                member2.roles.add(marriageRole)
                            ]);
                        } catch (error) {
                            console.error('Ошибка при выдаче роли брака:', error);
                            await i.followUp(createWarningEmbed('Предупреждение', 
                                'Брак создан, но не удалось выдать роль одному или обоим пользователям.'
                            ));
                        }
                    }

                    const marriageEmbed = {
                        title: '💍 Принудительный брак создан',
                        description: `${user1} и ${user2} теперь в браке!`,
                        fields: [
                            { name: '🏠 Название лаврумы', value: newMarriage.name_love_room, inline: true },
                            { name: '📅 Дата заключения', value: `<t:${newMarriage.date}:F>`, inline: true },
                            { name: '⏰ Списание за лавруму', value: `<t:${newMarriage.date_end}:R>`, inline: true }
                        ],
                        color: 0x2ecc71,
                        thumbnail: { url: user1.displayAvatarURL({ dynamic: true }) },
                        timestamp: new Date().toISOString()
                    };

                    await i.followUp({ embeds: [marriageEmbed], flags: ['Ephemeral'] });
                    
                    try {
                        await Promise.all([
                            user1.send({ embeds: [marriageEmbed] }),
                            user2.send({ embeds: [marriageEmbed] })
                        ]);
                    } catch (error) {
                        await i.followUp(createWarningEmbed('Предупреждение', 
                            'Брак создан, но не удалось отправить уведомление в ЛС одному или обоим пользователям.'
                        ));
                    }

                    await sendActionLog(client, {
                        description: `**Администратор ${interaction.user} создал брак**`,
                        fields: [
                            { name: '👥 Участники', value: `${user1} и ${user2}`, inline: true },
                            { name: '⏰ Время', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                        ],
                        color: 0x3498db
                    }, interaction.user.id);

                } catch (error) {
                    console.error(error);
                    await i.followUp(createErrorEmbed('Ошибка', 'Произошла ошибка при создании брака!'));
                }
            });

            secondUserCollector.on('end', collected => {
                if (collected.size === 0) {
                    i.followUp(createErrorEmbed('Время истекло', 'Время выбора второго пользователя истекло!'));
                }
            });
        });

        firstUserCollector.on('end', collected => {
            if (collected.size === 0) {
                i.followUp(createErrorEmbed('Время истекло', 'Время выбора первого пользователя истекло!'));
            }
        });
    } catch (error) {
        console.error(error);
        await i.followUp(createErrorEmbed('Ошибка', 'Произошла ошибка при создании брака!'));
    }
}

async function handlePrivateRoomCreation(modalInteraction, client, originalInteraction) {
    const userId = modalInteraction.fields.getTextInputValue('userId');
    const roomName = modalInteraction.fields.getTextInputValue('roomName');
    const roleColor = modalInteraction.fields.getTextInputValue('roleColor');

    // deferReply для модальных интеракций
    if (!modalInteraction.deferred && !modalInteraction.replied) {
        await modalInteraction.deferReply({ ephemeral: true });
    }

    // Проверка защиты пользователя
    if (!canInteractWithUser(modalInteraction.user.id, userId)) {
        return safeReply(modalInteraction, createErrorEmbed(
            'Отказано в доступе', 
            'Вы не можете создавать румы для этого пользователя! Доступ ограничен.'
        ));
    }

    // Проверка валидности цвета
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(roleColor)) {
        return safeReply(modalInteraction, createErrorEmbed(
            'Ошибка', 
            'Неверный формат цвета! Используйте HEX формат, например: #FF0000'
        ));
    }

    // Проверка длины названия
    if (roomName.length < 1 || roomName.length > 32) {
        return safeReply(modalInteraction, createErrorEmbed(
            'Ошибка', 
            'Название румы должно быть от 1 до 32 символов!'
        ));
    }

    // СНАЧАЛА отвечаем на интеракцию
    await safeReply(modalInteraction, {
        embeds: [{
            title: '⏳ Создание румы...',
            description: 'Пожалуйста, подождите. Создаю личную руму...',
            color: 0x3498db,
            timestamp: new Date().toISOString()
        }],
        flags: ['Ephemeral']
    });

    const Room = client.schemas.get('Room');
    const guild = originalInteraction.guild;

    try {
        // Проверяем, есть ли уже рума у пользователя
        const existingRoom = await Room.findOne({ owner_id: userId });
        if (existingRoom) {
            return safeReply(modalInteraction, createErrorEmbed(
                'Ошибка', 
                'У этого пользователя уже есть активная рума!'
            ));
        }

        // Проверяем, существует ли рума с таким названием
        const nameExists = await Room.findOne({ name_room: roomName });
        if (nameExists) {
            return safeReply(modalInteraction, createErrorEmbed(
                'Ошибка', 
                'Рума с таким названием уже существует!'
            ));
        }

        // Проверяем, существует ли пользователь на сервере
        const targetMember = await guild.members.fetch(userId).catch(() => null);
        if (!targetMember) {
            return safeReply(modalInteraction, createErrorEmbed(
                'Ошибка', 
                'Пользователь не найден на сервере!'
            ));
        }

        // Проверяем DM пользователя (упрощенная проверка)
        let canSendDM = true;
        try {
            const dmChannel = await targetMember.user.createDM();
            // Просто проверяем, что канал создался, без отправки тестового сообщения
        } catch (error) {
            canSendDM = false;
        }

        // Создание роли и канала с таймаутом
        const createTimeout = setTimeout(() => {
            console.error('Таймаут при создании румы');
        }, 25000); // 25 секунд таймаут

        try {
            // Создание роли
            const role = await guild.roles.create({
                name: roomName,
                color: roleColor,
                position: guild.roles.cache.get(cfg.room_create.role_pos_create)?.position || 1,
                permissions: []
            });

            // Создание голосового канала
            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.Connect],
                    allow: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: role.id,
                    allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel]
                },
                {
                    id: targetMember.user.id,
                    allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ViewChannel]
                }
            ];

            // Добавляем ограничения для каждой заблокированной роли
            for (const roleId of cfg.room_create.block_roles) {
                const blockedRole = guild.roles.cache.get(roleId);
                if (blockedRole) {
                    permissionOverwrites.push({
                        id: blockedRole.id,
                        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
                    });
                }
            }

            const voiceChannel = await guild.channels.create({
                name: roomName,
                type: 2, // Голосовой канал
                parent: cfg.room_create.room_category_id,
                reason: 'Создание личной комнаты администратором',
                permissionOverwrites: permissionOverwrites
            });

            clearTimeout(createTimeout);

            // Сохранение в базу данных
            const room = new Room({
                owner_id: userId,
                role_id: role.id,
                room_id: voiceChannel.id,
                name_role: roomName,
                name_room: roomName,
                users: [userId]
            });
            await room.save();

            // Выдача роли пользователю
            await targetMember.roles.add(role.id);

            // Отправка уведомления пользователю в ЛС
            if (canSendDM) {
                try {
                    await targetMember.user.send({
                        embeds: [{
                            title: '🏠 Вам создана личная рума!',
                            description: `Администратор создал для вас личную руму!\n\n**Название:** ${roomName}\n**Роль:** <@&${role.id}>\n**Канал:** <#${voiceChannel.id}>`,
                            color: parseInt(roleColor.replace('#', ''), 16),
                            thumbnail: { url: targetMember.user.displayAvatarURL({ size: 128 }) },
                            timestamp: new Date().toISOString()
                        }]
                    });
                } catch (error) {
                    console.error('Не удалось отправить ЛС:', error);
                }
            }

            // Логирование действия
            await sendActionLog(client, {
                description: `**Администратор ${modalInteraction.user} создал личную руму**`,
                fields: [
                    { name: '👤 Владелец', value: `<@${userId}>`, inline: true },
                    { name: '🏠 Название', value: roomName, inline: true },
                    { name: '🎨 Цвет роли', value: roleColor, inline: true },
                    { name: '📢 Канал', value: `<#${voiceChannel.id}>`, inline: true },
                    { name: '⏰ Время', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                ],
                color: parseInt(roleColor.replace('#', ''), 16)
            }, modalInteraction.user.id);

            return safeReply(modalInteraction, createSuccessEmbed(
                'Рума создана!', 
                `Успешно создана личная рума для <@${userId}>\n\n**Название:** ${roomName}\n**Роль:** <@&${role.id}>\n**Канал:** <#${voiceChannel.id}>\n**Цвет:** ${roleColor}`
            ));
        } catch (createError) {
            clearTimeout(createTimeout);
            console.error('Ошибка при создании роли/канала:', createError);
            throw createError;
        }

    } catch (error) {
        console.error('handlePrivateRoomCreation', { user: modalInteraction.user.id, customId: modalInteraction.customId, error });
        // Проверяем, не истекла ли интеракция
        try {
            return safeReply(modalInteraction, createErrorEmbed(
                'Ошибка', 
                'Произошла ошибка при создании личной румы. Пожалуйста, попробуйте позже.'
            ));
        } catch (editError) {
            console.error('Не удалось отправить ошибку:', editError);
        }
    }
}

async function handlePrivateRoomDeletion(modalInteraction, client, userId, originalInteraction) {
    // deferReply для модальных интеракций
    if (!modalInteraction.deferred && !modalInteraction.replied) {
        await modalInteraction.deferReply({ ephemeral: true });
    }

    // Проверка защиты пользователя
    if (!canInteractWithUser(modalInteraction.user.id, userId)) {
        return safeReply(modalInteraction, createErrorEmbed(
            'Отказано в доступе', 
            'Вы не можете удалять румы у этого пользователя! Доступ ограничен.'
        ));
    }

    // СНАЧАЛА отвечаем на интеракцию
    await safeReply(modalInteraction, {
        embeds: [{
            title: '⏳ Удаление румы...',
            description: 'Пожалуйста, подождите. Удаляю личную руму...',
            color: 0x3498db,
            timestamp: new Date().toISOString()
        }],
        flags: ['Ephemeral']
    });

    const Room = client.schemas.get('Room');
    const guild = originalInteraction.guild;

    try {
        // Проверяем, есть ли рума у пользователя
        const existingRoom = await Room.findOne({ owner_id: userId });
        if (!existingRoom) {
            return safeReply(modalInteraction, createErrorEmbed(
                'Ошибка', 
                'У этого пользователя нет активной румы!'
            ));
        }

        // Проверяем, существует ли пользователь на сервере
        const targetMember = await guild.members.fetch(userId).catch(() => null);
        if (!targetMember) {
            return safeReply(modalInteraction, createErrorEmbed(
                'Ошибка', 
                'Пользователь не найден на сервере!'
            ));
        }

        // Проверяем DM пользователя (упрощенная проверка)
        let canSendDM = true;
        try {
            const dmChannel = await targetMember.user.createDM();
            // Просто проверяем, что канал создался, без отправки тестового сообщения
        } catch (error) {
            canSendDM = false;
        }

        // Удаление с таймаутом
        const deleteTimeout = setTimeout(() => {
            console.error('Таймаут при удалении румы');
        }, 25000); // 25 секунд таймаут

        try {
            // Удаляем роль у всех пользователей в руме
            const role = await guild.roles.fetch(existingRoom.role_id).catch(() => null);
            if (role) {
                // Удаляем роль у всех пользователей в руме
                for (const memberId of existingRoom.users) {
                    try {
                        const member = await guild.members.fetch(memberId).catch(() => null);
                        if (member) {
                            await member.roles.remove(role);
                        }
                    } catch (error) {
                        console.error(`Ошибка при удалении роли у пользователя ${memberId}:`, error);
                    }
                }
                
                // Удаляем саму роль
                await role.delete();
            }

            // Удаляем голосовой канал
            const voiceChannel = await guild.channels.fetch(existingRoom.room_id).catch(() => null);
            if (voiceChannel) {
                await voiceChannel.delete('Удаление личной комнаты администратором');
            }

            clearTimeout(deleteTimeout);

            // Удаляем запись из базы данных
            await Room.deleteOne({ _id: existingRoom._id });

            // Отправка уведомления пользователю в ЛС
            if (canSendDM) {
                try {
                    await targetMember.user.send({
                        embeds: [{
                            title: '🗑️ Ваша личная рума удалена!',
                            description: `Администратор удалил вашу личную руму!\n\n**Название:** ${existingRoom.name_room}\n\nВсе участники румы были уведомлены об удалении.`,
                            color: 0xe74c3c,
                            thumbnail: { url: targetMember.user.displayAvatarURL({ size: 128 }) },
                            timestamp: new Date().toISOString()
                        }]
                    });
                } catch (error) {
                    console.error('Не удалось отправить ЛС:', error);
                }
            }

            // Уведомляем всех участников румы
            for (const memberId of existingRoom.users) {
                if (memberId !== userId) { // Не уведомляем владельца, так как уже уведомили
                    try {
                        const member = await client.users.fetch(memberId);
                        const dmChannel = await member.createDM();
                        await dmChannel.send({
                            embeds: [{
                                title: '🗑️ Рума удалена!',
                                description: `Личная рума **${existingRoom.name_room}** была удалена администратором.\n\nВы больше не являетесь участником этой румы.`,
                                color: 0xe74c3c,
                                timestamp: new Date().toISOString()
                            }]
                        });
                    } catch (error) {
                        console.error(`Не удалось уведомить участника ${memberId}:`, error);
                    }
                }
            }

            // Логирование действия
            await sendActionLog(client, {
                description: `**Администратор ${modalInteraction.user} удалил личную руму**`,
                fields: [
                    { name: '👤 Владелец', value: `<@${userId}>`, inline: true },
                    { name: '🏠 Название', value: existingRoom.name_room, inline: true },
                    { name: '👥 Участников', value: existingRoom.users.length.toString(), inline: true },
                    { name: '⏰ Время', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                ],
                color: 0xe74c3c
            }, modalInteraction.user.id);

            return safeReply(modalInteraction, createSuccessEmbed(
                'Рума удалена!', 
                `Успешно удалена личная рума у <@${userId}>\n\n**Название:** ${existingRoom.name_room}\n**Участников:** ${existingRoom.users.length}\n\nВсе участники румы были уведомлены об удалении.`
            ));
        } catch (deleteError) {
            clearTimeout(deleteTimeout);
            console.error('Ошибка при удалении роли/канала:', deleteError);
            throw deleteError;
        }

    } catch (error) {
        console.error('handlePrivateRoomDeletion', { user: modalInteraction.user.id, customId: modalInteraction.customId, error });
        // Проверяем, не истекла ли интеракция
        try {
            return safeReply(modalInteraction, createErrorEmbed(
                'Ошибка', 
                'Произошла ошибка при удалении личной румы. Пожалуйста, попробуйте позже.'
            ));
        } catch (editError) {
            console.error('Не удалось отправить ошибку:', editError);
        }
    }
}

module.exports = commands;