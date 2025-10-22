const ComponentState = require('../ComponentState');
const { price, create, cfg } = require('../../../cfg');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const buttons = [
    {
        customId: 'confirm_create_room',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const user = state.user;
            const name = state.name;
            const msg = state.msg;
            const guild = state.guild;

            const Users = client.schemas.get('Users');
            const Room = client.schemas.get('Room');
            const userdb = await Users.findOne({ user_id: user.id });
            const balance = Number(userdb.balance) || 0;
            const roomPrice = Number(price.room) || 0;

            if (isNaN(balance) || isNaN(roomPrice)) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка при создании комнаты',
                        description: 'Произошла ошибка при проверке баланса. Пожалуйста, обратитесь к администратору.',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            if (interaction.user.id !== user.id) return interaction.reply({ content: '❌ Вы не можете создать комнату', flags: ['Ephemeral'] });
        
            try {
                const dmChannel = await interaction.user.createDM();
                const testMessage = await dmChannel.send({
                    embeds: [{
                        title: '✅ Проверка личных сообщений',
                        description: 'Это тестовое сообщение будет удалено автоматически.',
                        timestamp: new Date().toISOString()
                    }]
                });

                if (testMessage) {
                    await testMessage.delete().catch(() => { });
                }
            } catch (error) {
                console.error('Ошибка при проверке ЛС:', error);
                return interaction.reply({
                    embeds: [{
                        title: '❌ Проблема с личными сообщениями',
                        description: 'Для создания роли необходимо:\n\n1. Откройте настройки конфиденциальности сервера\n2. Включите "Личные сообщения от участников сервера"\n3. Попробуйте создать роль снова\n\nЭто необходимо для отправки важных уведомлений о вашей роли.',
                        color: 0xFF0000,
                        thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
                    }],
                    flags: ['Ephemeral']
                });
            }
            try{

                if (balance < roomPrice) {
                    const nexvatka = {
                        title: 'Недостаточно средств',
                        description: `У вас недостаточно средств для создания комнаты. Необходимо ещё ${roomPrice - balance} ${client.emojis.zvezda}`,
                        thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) }
                    }
                    return interaction.reply({
                        embeds: [nexvatka],
                        flags: ['Ephemeral']
                    });
                }

                const [namescan, roomscan] = await Promise.all([
                    Room.findOne({ name_room: name }),
                    Room.findOne({ owner_id: interaction.user.id })
                ]);

                if (namescan || roomscan) {
                    return interaction.reply({
                        embeds: [{
                            title: namescan ? 'Комната уже существует' : 'Вы уже создали комнату',
                            description: namescan ? 'Комната с таким названием уже существует' : 'У вас уже есть активная комната',
                            thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) }
                        }],
                        flags: ['Ephemeral']
                    });
                }

                // Создание роли
                const role = await guild.roles.create({
                    name: name,
                    position: guild.roles.cache.get(cfg.room_create.role_pos_create).position,
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
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers]
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
                    name: name,
                    type: 2, // Голосовой канал
                    parent: cfg.room_create.room_category_id,
                    reason: 'Создание личной комнаты пользователем',
                    permissionOverwrites: permissionOverwrites
                });

                // Списание средств
                await Users.updateOne(
                    { user_id: interaction.user.id },
                    { $inc: { balance: -roomPrice } }
                );

                // Сохранение в базу данных
                const room = new Room({
                    owner_id: interaction.user.id,
                    role_id: role.id,
                    room_id: voiceChannel.id,
                    name_role: name,
                    name_room: name,
                    users: [interaction.user.id]
                });
                await room.save();

                // Выдача роли создателю
                await interaction.member.roles.add(role.id);

                // Отправка подтверждения
                await msg.edit({
                    embeds: [{
                        title: '✅ Комната успешно создана',
                        description: `Создана комната "${name}"\n\nРоль: <@&${role.id}>\nКанал: <#${voiceChannel.id}>\nСписано: ${roomPrice} ${client.emojis.zvezda}`,
                        color: 0x00FF00,
                        thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) }
                    }],
                    components: []
                });

            } catch (error) {
                console.error('Ошибка при создании комнаты:', error);
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка при создании комнаты',
                        description: 'Произошла ошибка при создании комнаты. Пожалуйста, попробуйте позже.',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }
        }
    },
    {
        customId: 'cancel_create_room',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const user = state.user;
            const msg = state.msg;
            if (interaction.user.id !== user.id) return interaction.reply({ content: '❌ Вы не можете отменить создание комнаты', flags: ['Ephemeral'] });
            const membed = {
                title: 'Создание комнаты отменено',
                description: 'Создание комнаты отменено',
                color: 0xFF0000
            }
            await msg.edit({ embeds: [membed], components: [] });
            
        }
    }
];


module.exports = buttons;