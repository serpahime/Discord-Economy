const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');
const { price, create } = require('../../cfg');


const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('room-create')
            .setDescription('Создать комнату')
            .addStringOption(option => option.setName('name').setDescription('Название комнаты').setRequired(true)),

        async execute(interaction, client) {
            const name = interaction.options.getString('name');
            const role = interaction.options.getRole('role');
            const guild = interaction.guild;

            const Users = client.schemas.get('Users');
            const userdb = await Users.findOne({ user_id: interaction.user.id });
            const balance = userdb.balance;
            const Room = client.schemas.get('Room');

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

            if (balance < price.room) {
                const nexvatka = {
                    title: 'Недостаточно средств',
                    description: `У вас недостаточно средств для создания комнаты. Необходимо ещё ${price.room - balance} ${client.emojis.zvezda}`,
                    thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
                }
                return interaction.reply({
                    embeds: [nexvatka],
                    flags: ['Ephemeral']
                });
            }
            const namescan = await Room.findOne({ name_room: name });
            const roomscan = await Room.findOne({ owner_id: interaction.user.id });
            if (namescan) {
                const nexvatka = {
                    title: 'Комната уже существует',
                    description: 'Комната с таким названием уже существует',
                    thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
                }
                return interaction.reply({
                    embeds: [nexvatka],
                    flags: ['Ephemeral']
                });
            }
            if (roomscan) {
                const nexvatka = {
                    title: 'Вы уже создали комнату',
                    description: 'Вы уже создали комнату',
                    thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
                }
                return interaction.reply({
                    embeds: [nexvatka],
                    flags: ['Ephemeral']
                });
            }
            const embed = {
                title: 'Создание комнаты',
                description: `Вы уверены что хотите создать комнату **${name}** за **${price.room}** ${client.emojis.zvezda}?`,
                thumbnail: {
                    url: interaction.user.displayAvatarURL({ size: 128 })
                },

                footer: {
                    text: `Откройте обязательно личные сообщения`
                },
            }
            const msg = await interaction.reply({ embeds: [embed] });

            const states = ComponentState.createMany(['confirm_create_room', 'cancel_create_room'], {
                user: interaction.user,
                price: price.room,
                name: name,
                msg: msg,
                guild: guild
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(states.confirm_create_room).setLabel('Да').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(states.cancel_create_room).setLabel('Нет').setStyle(ButtonStyle.Danger)
            );

            await msg.edit({
                components: [row]
            });
            
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('room-manage')
            .setDescription('Управление своей личной комнотой'),

        async execute(interaction, client) {
            const user = interaction.user;
            const guild = interaction.guild;
            const Room = client.schemas.get('Room');
            const room = await Room.findOne({ owner_id: user.id });

            if (!room) {
                return interaction.reply({
                    embeds: [{
                        title: 'У вас нет комнаты',
                        description: 'Вы не можете управлять своей личной комнатой',
                        thumbnail: { url: user.displayAvatarURL({ size: 128 }) }
                    }],
                    flags: ['Ephemeral']
                });
            }

            const embed = {
                title: 'Управление комнатой',
                description: `**Текущий уровень комнаты:** ${room.level}\n\n` +
                           `**Требования для функций:**\n` +
                           `• Переименование комнаты - 1 уровень\n` +
                           `• Чат комнаты - 2 уровень\n` +
                           `• Изменение цвета роли - 3 уровень\n\n` +
                           `**Стоимость услуг:**\n` +
                           `• Переименование: ${price.room_name} ${client.emojis.zvezda}\n` +
                           `• Изменение цвета: ${price.room_color} ${client.emojis.zvezda}`,
                thumbnail: { url: user.displayAvatarURL({ size: 128 }) },
                color: 0x3498DB
            };

            const msg = await interaction.reply({ embeds: [embed] });

            const states = ComponentState.createMany(
                ['room_rename', 'room_give_dostup', 'room_ungive_dostup', 'vklchat', 'otklchat', 'color_role_set', 'delete_room'], 
                {
                    user: user,
                    room: room,
                    msg: msg,
                    guild: guild
                }
            );

            // Создаем первый ряд кнопок (основные функции)
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(states.room_rename)
                        .setLabel('Переименовать комнату')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(room.level < 1),
                    new ButtonBuilder()
                        .setCustomId(states.room_give_dostup)
                        .setLabel('Выдать доступ')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(states.room_ungive_dostup)
                        .setLabel('Забрать доступ')
                        .setStyle(ButtonStyle.Danger),
                );

            // Создаем второй ряд кнопок (дополнительные функции)
            const row2 = new ActionRowBuilder();

            // Добавляем кнопки чата в зависимости от уровня и статуса
            if (room.chat) {
                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId(states.otklchat)
                        .setLabel('Выключить чат')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(room.level < 2)
                );
            } else {
                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId(states.vklchat)
                        .setLabel('Включить чат')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(room.level < 2)
                );
            }

            // Добавляем кнопку изменения цвета
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(states.color_role_set)
                    .setLabel('Изменить цвет')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(room.level < 3),
                new ButtonBuilder()
                    .setCustomId(states.delete_room)
                    .setLabel('Удалить комнату')
                    .setStyle(ButtonStyle.Danger)
            );

            // Отправляем сообщение с кнопками
            await msg.edit({
                components: [row1, row2]
            });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('room-leave')
            .setDescription('Покинуть комнату'),
    
        async execute(interaction, client) {
            const user = interaction.user;
            const guild = interaction.guild;
            const Room = client.schemas.get('Room');
    
            // Ищем комнату, в которой находится пользователь
            const room = await Room.findOne({ users: user.id });
    
            if (!room) {
                return interaction.reply({
                    embeds: [{
                        title: 'Вы не находитесь в комнате',
                        description: 'Вы не состоите ни в одной комнате',
                        thumbnail: { url: user.displayAvatarURL({ size: 128 }) },
                        color: 0xE74C3C
                    }],
                    flags: ['Ephemeral']
                });
            }
    
            // Проверяем, не является ли пользователь владельцем комнаты
            if (room.owner_id === user.id) {
                return interaction.reply({
                    embeds: [{
                        title: 'Невозможно покинуть комнату',
                        description: 'Вы являетесь владельцем комнаты. Для удаления комнаты используйте команду управления комнатой.',
                        thumbnail: { url: user.displayAvatarURL({ size: 128 }) },
                        color: 0xE74C3C
                    }],
                    flags: ['Ephemeral']
                });
            }
    
            try {
                // Убираем роль у пользователя
                const member = await guild.members.fetch(user.id);
                const role = await guild.roles.fetch(room.role_id);
                
                if (member && role) {
                    await member.roles.remove(role);
                }
    
                // Убираем пользователя из массива users в базе данных
                await Room.updateOne(
                    { _id: room._id },
                    { $pull: { users: user.id } }
                );
    
                // Отправляем подтверждение
                const successEmbed = {
                    title: '✅ Вы покинули комнату',
                    description: `Вы успешно покинули комнату **${room.name_room}**\n\nРоль была снята с вашего аккаунта.`,
                    thumbnail: { url: user.displayAvatarURL({ size: 128 }) },
                    color: 0x2ECC71,
                    timestamp: new Date().toISOString()
                };
    
                await interaction.reply({
                    embeds: [successEmbed],
                    flags: ['Ephemeral']
                });
    
                // Уведомляем владельца комнаты
                try {
                    const owner = await client.users.fetch(room.owner_id);
                    if (owner) {
                        const dmChannel = await owner.createDM();
                        const notifyEmbed = {
                            title: '👋 Пользователь покинул вашу комнату',
                            description: `**${user.tag}** покинул комнату **${room.name_room}**`,
                            thumbnail: { url: user.displayAvatarURL({ size: 128 }) },
                            color: 0xF39C12,
                            timestamp: new Date().toISOString()
                        };
                        
                        await dmChannel.send({ embeds: [notifyEmbed] });
                    }
                } catch (error) {
                    console.log('Не удалось отправить уведомление владельцу комнаты:', error);
                }
    
            } catch (error) {
                console.error('Ошибка при покидании комнаты:', error);
                
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'Произошла ошибка при попытке покинуть комнату. Обратитесь к администрации.',
                        thumbnail: { url: user.displayAvatarURL({ size: 128 }) },
                        color: 0xE74C3C
                    }],
                    flags: ['Ephemeral']
                });
            }
        }
    }
]

module.exports = commands