const ComponentState = require('../ComponentState');
const { price, create, cfg } = require('../../../cfg');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const buttons = [
    {
        customId: 'room_rename',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const user = state.user;
            const roombd = state.room;
            const msg = state.msg;
            const guild = state.guild;
            const priceRename = price.room_name;

            if (interaction.user.id !== user.id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            const Users = client.schemas.get('Users');
            const userdb = await Users.findOne({ user_id: user.id });
            const balance = Number(userdb.balance) || 0;

            if (balance < priceRename) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Недостаточно средств',
                        description: `Для переименования комнаты необходимо ${priceRename} ${client.emojis.zvezda}\nУ вас на балансе: ${balance} ${client.emojis.zvezda}`,
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            await interaction.reply({
                embeds: [{
                    title: '✏️ Переименование комнаты',
                    description: 'Введите новое название комнаты в чат',
                    color: 0x3498DB
                }]
            });

            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                const newName = message.content;
                
                // Удаляем сообщение с названием
                try {
                    await message.delete();
                } catch (err) {
                    console.error('Не удалось удалить сообщение:', err);
                }

                // Проверяем существование комнаты с таким названием
                const Room = client.schemas.get('Room');
                const existingRoom = await Room.findOne({ name_room: newName });
                if (existingRoom) {
                    return interaction.editReply({
                        embeds: [{
                            title: '❌ Ошибка',
                            description: 'Комната с таким названием уже существует',
                            color: 0xFF0000
                        }],
                        flags: ['Ephemeral']
                    });
                }

                try {
                    // Получаем роль и канал через guild
                    const role = await guild.roles.fetch(roombd.role_id);
                    const channel = await guild.channels.fetch(roombd.room_id);

                    // Обновляем название роли и канала
                    await role.setName(newName);
                    await channel.setName(newName);

                    // Обновляем в базе данных
                    await Room.updateOne(
                        { _id: roombd._id },
                        { $set: { name_room: newName, name_role: newName } }
                    );

                    // Списываем средства
                    await Users.updateOne(
                        { user_id: user.id },
                        { $inc: { balance: -priceRename } }
                    );

                    await msg.edit({
                        content: 'Комната успешно переименована',
                        embeds: [{
                            title: '✅ Комната переименована',
                            description: `Новое название: **${newName}**\nСписано: ${priceRename} ${client.emojis.zvezda}`,
                            color: 0x2ECC71
                        }],
                        components: []
                    });
                } catch (err) {
                    console.error('Ошибка при переименовании:', err);
                    await interaction.editReply({
                        embeds: [{
                            title: '❌ Ошибка',
                            description: 'Произошла ошибка при переименовании комнаты',
                            color: 0xFF0000
                        }]
                    });
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({
                        embeds: [{
                            title: '❌ Время истекло',
                            description: 'Вы не указали новое название в течение 30 секунд',
                            color: 0xFF0000
                        }]
                    });
                }
            });
        }
    },
    {
        customId: 'room_give_dostup',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const roombd = state.room;
            const msg = state.msg;
            const guild = state.guild;

            if (interaction.user.id !== roombd.owner_id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            await interaction.reply({
                embeds: [{
                    title: '👥 Выдача доступа',
                    description: 'Укажите пользователя через @упоминание в чате',
                    color: 0x3498DB
                }]
            });

            const filter = m => m.author.id === interaction.user.id && m.mentions.users.size > 0;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                try {
                    // Проверяем наличие упоминания
                    const targetUser = message.mentions.users.first();
                    if (!targetUser) {
                        await message.delete().catch(() => {});
                        return interaction.editReply({
                            embeds: [{
                                title: '❌ Ошибка',
                                description: 'Пользователь не указан',
                                color: 0xFF0000
                            }]
                        });
                    }

                    // Удаляем сообщение с упоминанием
                    await message.delete().catch(() => {});

                    // Проверяем, не владелец ли это
                    if (targetUser.id === roombd.owner_id) {
                        return interaction.editReply({
                            embeds: [{
                                title: '❌ Ошибка',
                                description: 'Вы не можете выдать доступ владельцу комнаты',
                                color: 0xFF0000
                            }]
                        });
                    }

                    // Проверяем наличие роли
                    const role = await guild.roles.fetch(roombd.role_id);
                    if (!role) {
                        return interaction.editReply({
                            embeds: [{
                                title: '❌ Ошибка',
                                description: 'Роль комнаты не найдена',
                                color: 0xFF0000
                            }]  
                        });
                    }

                    // Проверяем, есть ли уже доступ
                    const Room = client.schemas.get('Room');
                    const roomData = await Room.findOne({ _id: roombd._id });
                    if (roomData.users.includes(targetUser.id)) {
                        return interaction.editReply({
                            embeds: [{
                                title: '❌ Ошибка',
                                description: 'У пользователя уже есть доступ к комнате',
                                color: 0xFF0000
                            }]
                        });
                    }

                    // Получаем участника сервера
                    const member = await guild.members.fetch(targetUser.id).catch(() => null);
                    if (!member) {
                        return interaction.editReply({
                            embeds: [{
                                title: '❌ Ошибка',
                                description: 'Пользователь не найден на сервере',
                                color: 0xFF0000
                            }]
                        });
                    }

                    // Выдаем роль
                    await member.roles.add(role.id);

                    // Обновляем БД
                    await Room.updateOne(
                        { _id: roombd._id },
                        { $push: { users: targetUser.id } }
                    );

                    // Отправляем сообщение об успехе
                    await interaction.editReply({
                        embeds: [{
                            title: '✅ Доступ выдан',
                            description: `Пользователь ${targetUser} получил доступ к комнате`,
                            color: 0x2ECC71
                        }]
                    });

                    // Обновляем основное сообщение
                    await msg.edit({ components: [] });

                } catch (err) {
                    console.error('Ошибка при выдаче доступа:', err);
                    await interaction.editReply({
                        embeds: [{
                            title: '❌ Ошибка',
                            description: 'Произошла ошибка при выдаче доступа',
                            color: 0xFF0000
                        }]
                    });
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({
                        embeds: [{
                            title: '❌ Время истекло',
                            description: 'Вы не указали пользователя в течение 30 секунд',
                            color: 0xFF0000
                        }]
                    });
                }
            });
        }
    },

    {
        customId: 'room_ungive_dostup',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const roombd = state.room;
            const msg = state.msg;
            const guild = state.guild;

            if (interaction.user.id !== roombd.owner_id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            await interaction.reply({
                embeds: [{
                    title: '🚫 Снятие доступа',
                    description: 'Укажите пользователя через @упоминание в чате',
                    color: 0x3498DB
                }]
            });

            const filter = m => m.author.id === interaction.user.id && m.mentions.users.size > 0;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                const targetUser = message.mentions.users.first();
                await message.delete();

                const Room = client.schemas.get('Room');

                if (!roombd.users.includes(targetUser.id)) {
                    return interaction.editReply({
                        embeds: [{
                            title: '❌ Ошибка',
                            description: 'У пользователя нет доступа к комнате',
                            color: 0xFF0000
                        }]
                    });
                }

                try {
                    // Получаем роль через guild
                    const role = await guild.roles.fetch(roombd.role_id);
                    // Получаем участника через guild
                    const member = await guild.members.fetch(targetUser.id);

                    await member.roles.remove(role.id);
                    await Room.updateOne(
                        { _id: roombd._id },
                        { $pull: { users: targetUser.id } }
                    );

                    await msg.edit({
                        embeds: [{
                            title: '✅ Доступ снят',
                            description: `У пользователя ${targetUser} был снят доступ к комнате`,
                            color: 0x2ECC71
                        }],
                        components: []
                    });
                } catch (err) {
                    console.error('Ошибка при снятии доступа:', err);
                    await interaction.editReply({
                        embeds: [{
                            title: '❌ Ошибка',
                            description: 'Произошла ошибка при снятии доступа',
                            color: 0xFF0000
                        }]
                    });
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({
                        embeds: [{
                            title: '❌ Время истекло',
                            description: 'Вы не указали пользователя в течение 30 секунд',
                            color: 0xFF0000
                        }]
                    });
                }
            });
        }
    },

    {
        customId: 'color_role_set',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const roombd = state.room;
            const priceColor = price.room_color;

            if (interaction.user.id !== roombd.owner_id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            const Users = client.schemas.get('Users');
            const userdb = await Users.findOne({ user_id: interaction.user.id });
            const balance = Number(userdb?.balance) || 0;

            if (balance < priceColor) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Недостаточно средств',
                        description: `Для изменения цвета необходимо ${priceColor} ${client.emojis.zvezda}\nУ вас на балансе: ${balance} ${client.emojis.zvezda}`,
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            await interaction.reply({
                embeds: [{
                    title: '🎨 Изменение цвета роли',
                    description: 'Введите HEX-код цвета (например: #FF0000)',
                    color: 0x3498DB
                }]
            });

            const filter = m => m.author.id === interaction.user.id && m.content.startsWith('#');
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                try {
                    const colorCode = message.content.trim();
                    await message.delete().catch(() => {});

                    // Проверяем формат цвета
                    if (!/^#[0-9A-F]{6}$/i.test(colorCode)) {
                        return interaction.editReply({
                            embeds: [{
                                title: '❌ Ошибка',
                                description: 'Неверный формат цвета. Используйте HEX-код (например: #FF0000)',
                                color: 0xFF0000
                            }]
                        });
                    }

                    // Получаем роль
                    const role = await guild.roles.fetch(roombd.role_id);
                    if (!role) {
                        return interaction.editReply({
                            embeds: [{
                                title: '❌ Ошибка',
                                description: 'Роль комнаты не найдена',
                                color: 0xFF0000
                            }]
                        });
                    }

                    // Меняем цвет роли
                    await role.setColor(colorCode);

                    // Списываем средства
                    await Users.updateOne(
                        { user_id: interaction.user.id },
                        { $inc: { balance: -priceColor } }
                    );

                    // Обновляем сообщение
                    await msg.edit({
                        embeds: [{
                            title: '✅ Цвет изменен',
                            description: `Новый цвет: ${colorCode}\nСписано: ${priceColor} ${client.emojis.zvezda}`,
                            color: parseInt(colorCode.replace('#', ''), 16)
                        }],
                        components: []
                    });

                } catch (err) {
                    console.error('Ошибка при изменении цвета:', err);
                    await interaction.editReply({
                        embeds: [{
                            title: '❌ Ошибка',
                            description: 'Произошла ошибка при изменении цвета роли',
                            color: 0xFF0000
                        }]
                    });
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({
                        embeds: [{
                            title: '❌ Время истекло',
                            description: 'Вы не указали цвет в течение 30 секунд',
                            color: 0xFF0000
                        }]
                    });
                }
            });
        }
    },

    {
        customId: 'vklchat',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const roombd = state.room;
            const msg = state.msg;
            const guild = state.guild;

            if (interaction.user.id !== roombd.owner_id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            try {
                // Получаем категорию через guild
                const category = await guild.channels.fetch(cfg.room_create.room_category_id);

                // Создаем текстовый канал
                const permissionOverwrites = [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: roombd.role_id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles]
                    }
                ];

                // Добавляем ограничения для каждой заблокированной роли
                for (const roleId of cfg.room_create.block_roles) {
                    const blockedRole = guild.roles.cache.get(roleId);
                    if (blockedRole) {
                        permissionOverwrites.push({
                            id: blockedRole.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        });
                    }
                }

                const chatChannel = await guild.channels.create({
                    name: roombd.name_room,
                    type: 0,
                    parent: category,
                    reason: 'Создание текстового чата личной комнаты',
                    permissionOverwrites: permissionOverwrites
                });

                // Обновляем информацию в БД
                const Room = client.schemas.get('Room');
                await Room.updateOne(
                    { _id: roombd._id },
                    { 
                        $set: { 
                            chat: true,
                            chat_id: chatChannel.id
                        }
                    }
                );

                await msg.edit({
                    embeds: [{
                        title: '✅ Чат создан',
                        description: `Текстовый канал ${chatChannel} успешно создан`,
                        color: 0x2ECC71
                    }],
                    components: []
                });
            } catch (err) {
                console.error('Ошибка при создании чата:', err);
                await interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'Произошла ошибка при создании чата',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }
        }
    },

    {
        customId: 'otklchat',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const roombd = state.room;
            const msg = state.msg;
            const guild = state.guild;

            if (interaction.user.id !== roombd.owner_id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }

            try {
                // Получаем и удаляем канал через guild
                if (roombd.chat_id) {
                    const chatChannel = await guild.channels.fetch(roombd.chat_id);
                    if (chatChannel) {
                        await chatChannel.delete('Отключение чата личной комнаты по запросу владельца');
                    }
                }

                // Обновляем информацию в БД
                const Room = client.schemas.get('Room');
                await Room.updateOne(
                    { _id: roombd._id },
                    { 
                        $set: { 
                            chat: false,
                            chat_id: null
                        }
                    }
                );

                await msg.edit({
                    embeds: [{
                        title: '✅ Чат отключен',
                        description: 'Текстовый канал успешно удален',
                        color: 0x2ECC71
                    }],
                    components: []
                });
            } catch (err) {
                console.error('Ошибка при удалении чата:', err);
                await interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'Произошла ошибка при удалении чата',
                        color: 0xFF0000
                    }],
                    flags: ['Ephemeral']
                });
            }
        }
    },
    {
        customId: 'delete_room',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const roombd = state.room;
            const msg = state.msg;
            const guild = state.guild;

            if (interaction.user.id !== roombd.owner_id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                    }],
                });
            }
            
            const embed = {
                title: 'Удаление комнаты',
                description: 'Вы уверены, что хотите удалить комнату?',
                color: 0x2b2d31,
                thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) }
            }

            const states = ComponentState.createMany(
                ['delete_room_yes', 'delete_room_no'],
                {
                    user: interaction.user,
                    room: roombd,
                    msg: msg,
                    guild: guild
                }
            )

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(states.delete_room_yes)
                    .setLabel('Да')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(states.delete_room_no)
                    .setLabel('Нет')
                    .setStyle(ButtonStyle.Danger)
            )

            await interaction.deferUpdate();
            await msg.edit({
                embeds: [embed],
                components: [row]
            })
        }
    },
    {
        customId: 'delete_room_yes',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const user = state.user;
            const roombd = state.room;
            const msg = state.msg;
            const guild = state.guild;

            if(interaction.user.id !== user.id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                    }],
                })
            }

            const Room = client.schemas.get('Room');
            const role = await guild.roles.fetch(roombd.role_id);
            const channel = await guild.channels.fetch(roombd.room_id);
            await Room.deleteOne({ _id: roombd._id });
            await role.delete();
            await channel.delete('Удаление личной комнаты по запросу владельца');


            await msg.edit({
                embeds: [{
                    title: '✅ Комната удалена',
                    description: 'Комната успешно удалена',
                    color: 0x2ECC71,
                    thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) }
                }],
                components: []
            })
        }
    },
    {
        customId: 'delete_room_no',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const user = state.user;
            const roombd = state.room;
            const msg = state.msg;
            const guild = state.guild;

            if(interaction.user.id !== user.id) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'У вас нет доступа к этой комнате',
                    }],
                })
            }
            await interaction.deferUpdate();
            await msg.edit({
                embeds: [{
                    title: '✅ Комната не удалена',
                    description: 'Комната не удалена',
                }],
                components: []
            })
        }
    }
]

module.exports = buttons;