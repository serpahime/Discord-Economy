const { cfg } = require('../../cfg');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'privates',
    description: 'Приватные команды',
    async execute(client) {
        try {
            // Получаем гильдию используя ID из конфига клиента
            const guild = client.guilds.cache.get(client.config.guildId);
            if (!guild) {
                console.error('Гильдия не найдена');
                return;
            }

            // Получаем канал настроек
            const channel = guild.channels.cache.get(cfg.privates.settings_channel_id);
            if (!channel) {
                console.error('Канал настроек не найден');
                return;
            }

            // Очищаем старые сообщения
            try {
                const messages = await channel.messages.fetch({ limit: 100 });
                if (messages.size > 0) {
                    await channel.bulkDelete(messages).catch(() => null);
                }
            } catch (error) {
                console.error('Ошибка при очистке канала:', error);
            }

            const embed = new EmbedBuilder()
                .setTitle('Управление приватной комнатой')
                .setDescription(
                    '📝 — изменить название комнаты.\n' +
                    '✏️ — изменить лимит пользователей в комнате.\n' +
                    '🔒 — закрыть комнату для всех.\n' +
                    '🔓 — открыть комнату для всех.\n' +
                    '🚫 — забрать доступ к комнате у пользователя.\n' +
                    '🔑 — выдать доступ в комнату пользователю.\n' +
                    '❌ — выгнать пользователя из комнаты.\n' +
                    '🔇 — забрать право говорить.\n' +
                    '🔊 — выдать право говорить.'
                )
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setTimestamp();

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('privates_settings_name')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('privates_settings_limit')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✏️'),
                new ButtonBuilder()
                    .setCustomId('privates_settings_close')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('privates_settings_open')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔓'),
                new ButtonBuilder()
                    .setCustomId('privates_settings_block')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚫')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('privates_settings_unblock')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔑'),
                new ButtonBuilder()
                    .setCustomId('privates_settings_kick')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌'),
                new ButtonBuilder()
                    .setCustomId('privates_settings_mute')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔇'),
                new ButtonBuilder()
                    .setCustomId('privates_settings_unmute')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔊')
            );

            await channel.send({
                embeds: [embed],
                components: [row1, row2]
            });

            console.log('Эмбед управления приватными комнатами успешно отправлен');
        } catch (error) {
            console.error('Ошибка при отправке эмбеда управления приватными комнатами:', error);
        }
    },

    async handleButton(interaction, client) {
        try {
            const [action] = interaction.customId.split('_').slice(2);
            const member = interaction.member;

            // Проверяем, находится ли пользователь в голосовом канале
            if (!member.voice.channel) {
                return await interaction.reply({
                    content: '❌ Вы должны находиться в приватной комнате!',
                    flags: 64
                });
            }

            // Проверяем, является ли канал приватным
            const Private = client.schemas.get('Private');
            const privateRoom = await Private.findOne({ room_id: member.voice.channel.id });

            if (!privateRoom) {
                return await interaction.reply({
                    content: '❌ Это не приватная комната!',
                    flags: 64
                });
            }

            // Проверяем, является ли пользователь владельцем
            if (privateRoom.owner_id !== member.id) {
                return await interaction.reply({
                    content: '❌ Вы не являетесь владельцем этой комнаты!',
                    flags: 64
                });
            }

            const channel = member.voice.channel;

            switch (action) {
                case 'name': {
                    await interaction.reply({
                        content: '✏️ Введите новое название комнаты:',
                        ephemeral: true
                    });

                    const filter = m => m.author.id === member.id;
                    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                    collector.on('collect', async (message) => {
                        const newName = message.content.slice(0, 32);
                        await channel.setName(`🔑・${newName}`);
                        const reply = await message.reply(`✅ Название комнаты изменено на: ${newName}`);
                        
                        // Удаляем оба сообщения через 5 секунд
                        setTimeout(() => {
                            message.delete().catch(() => null);
                            reply.delete().catch(() => null);
                        }, 5000);
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp({
                                content: '❌ Время ожидания истекло',
                                ephemeral: true
                            });
                        }
                    });
                    break;
                }

                case 'limit': {
                    await interaction.reply({
                        content: '✏️ Введите новый лимит пользователей (от 1 до 99):',
                        ephemeral: true
                    });

                    const filter = m => m.author.id === member.id && !isNaN(m.content) && m.content >= 1 && m.content <= 99;
                    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                    collector.on('collect', async (message) => {
                        const limit = parseInt(message.content);
                        await channel.setUserLimit(limit);
                        await message.reply({ 
                            content: `✅ Лимит пользователей установлен: ${limit}`,
                            deleteAfter: 5000 
                        });
                        await message.delete().catch(() => null);
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp({
                                content: '❌ Время ожидания истекло или введено некорректное число',
                                ephemeral: true
                            });
                        }
                    });
                    break;
                }

                case 'close': {
                    await channel.permissionOverwrites.edit(interaction.guild.id, {
                        Connect: false
                    });
                    await interaction.reply({
                        content: '🔒 Комната закрыта для всех пользователей',
                        ephemeral: true
                    });
                    break;
                }

                case 'open': {
                    await channel.permissionOverwrites.edit(interaction.guild.id, {
                        Connect: null
                    });
                    await interaction.reply({
                        content: '🔓 Комната открыта для всех пользователей',
                        flags: 64
                    });
                    break;
                }

                case 'block': {
                    await interaction.reply({
                        content: '🚫 Упомяните пользователя, которого хотите заблокировать:',
                        ephemeral: true
                    });

                    const filter = m => m.author.id === member.id && m.mentions.members.size > 0;
                    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                    collector.on('collect', async (message) => {
                        const targetMember = message.mentions.members.first();
                        if (targetMember.id === member.id) {
                            const reply = await message.reply('❌ Вы не можете заблокировать себя!');
                            setTimeout(() => {
                                message.delete().catch(() => null);
                                reply.delete().catch(() => null);
                            }, 5000);
                            return;
                        }
                        await channel.permissionOverwrites.edit(targetMember.id, {
                            Connect: false,
                            Speak: false
                        });
                        if (targetMember.voice.channelId === channel.id) {
                            await targetMember.voice.disconnect();
                        }
                        const reply = await message.reply(`✅ Пользователь ${targetMember} заблокирован`);
                        setTimeout(() => {
                            message.delete().catch(() => null);
                            reply.delete().catch(() => null);
                        }, 5000);
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp({
                                content: '❌ Время ожидания истекло',
                                ephemeral: true
                            });
                        }
                    });
                    break;
                }

                case 'unblock': {
                    await interaction.reply({
                        content: '🔑 Упомяните пользователя, которого хотите разблокировать:',
                        ephemeral: true
                    });

                    const filter = m => m.author.id === member.id && m.mentions.members.size > 0;
                    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                    collector.on('collect', async (message) => {
                        const targetMember = message.mentions.members.first();
                        await channel.permissionOverwrites.delete(targetMember.id);
                        await message.reply({ 
                            content: `✅ Пользователь ${targetMember} разблокирован`,
                            deleteAfter: 5000 
                        });
                        await message.delete().catch(() => null);
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp({
                                content: '❌ Время ожидания истекло',
                                ephemeral: true
                            });
                        }
                    });
                    break;
                }

                case 'kick': {
                    await interaction.reply({
                        content: '❌ Упомяните пользователя, которого хотите выгнать:',
                        ephemeral: true
                    });

                    const filter = m => m.author.id === member.id && m.mentions.members.size > 0;
                    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                    collector.on('collect', async (message) => {
                        const targetMember = message.mentions.members.first();
                        if (targetMember.id === member.id) {
                            const reply = await message.reply('❌ Вы не можете выгнать себя!');
                            setTimeout(() => {
                                message.delete().catch(() => null);
                                reply.delete().catch(() => null);
                            }, 5000);
                            return;
                        }
                        if (targetMember.voice.channelId === channel.id) {
                            await targetMember.voice.disconnect();
                            const reply = await message.reply(`✅ Пользователь ${targetMember} выгнан из комнаты`);
                            setTimeout(() => {
                                message.delete().catch(() => null);
                                reply.delete().catch(() => null);
                            }, 5000);
                        } else {
                            const reply = await message.reply(`❌ Пользователь ${targetMember} не находится в вашей комнате`);
                            setTimeout(() => {
                                message.delete().catch(() => null);
                                reply.delete().catch(() => null);
                            }, 5000);
                        }
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp({
                                content: '❌ Время ожидания истекло',
                                ephemeral: true
                            });
                        }
                    });
                    break;
                }

                case 'mute': {
                    await interaction.reply({
                        content: '🔇 Упомяните пользователя, которому хотите запретить говорить:',
                        ephemeral: true
                    });

                    const filter = m => m.author.id === member.id && m.mentions.members.size > 0;
                    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                    collector.on('collect', async (message) => {
                        const targetMember = message.mentions.members.first();
                        if (targetMember.id === member.id) {
                            const reply = await message.reply('❌ Вы не можете замутить себя!');
                            setTimeout(() => {
                                message.delete().catch(() => null);
                                reply.delete().catch(() => null);
                            }, 5000);
                            return;
                        }
                        await channel.permissionOverwrites.edit(targetMember.id, {
                            Speak: false
                        });
                        const reply = await message.reply(`✅ Пользователь ${targetMember} больше не может говорить`);
                        setTimeout(() => {
                            message.delete().catch(() => null);
                            reply.delete().catch(() => null);
                        }, 5000);
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp({
                                content: '❌ Время ожидания истекло',
                                ephemeral: true
                            });
                        }
                    });
                    break;
                }

                case 'unmute': {
                    await interaction.reply({
                        content: '🔊 Упомяните пользователя, которому хотите разрешить говорить:',
                        ephemeral: true
                    });

                    const filter = m => m.author.id === member.id && m.mentions.members.size > 0;
                    const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

                    collector.on('collect', async (message) => {
                        const targetMember = message.mentions.members.first();
                        await channel.permissionOverwrites.edit(targetMember.id, {
                            Speak: null
                        });
                        const reply = await message.reply(`✅ Пользователь ${targetMember} снова может говорить`);
                        setTimeout(() => {
                            message.delete().catch(() => null);
                            reply.delete().catch(() => null);
                        }, 5000);
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp({
                                content: '❌ Время ожидания истекло',
                                ephemeral: true
                            });
                        }
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('Ошибка при обработке кнопки настроек:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при выполнении действия',
                flags: 64
            });
        }
    }
};