const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../ComponentState');
const { price, create, cfg } = require('../../../cfg');

const buttons = [
    {
        customId: 'marry_accept',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const author = state.author;
            const user = state.user;
            const amsg = state.amsg;
            const umsg = state.umsg;

            const marrys = client.schemas.get('Marry');
            const User = client.schemas.get('Users');
            const marryData = await marrys.findOne({ users: { $in: author.id } });
            const marryDataUser = await marrys.findOne({ users: { $in: user.id } });
            const authorData = await User.findOne({ user_id: author.id });
            const userData = await User.findOne({ user_id: user.id });

            if (marryData) {
                return interaction.reply({ content: 'Пользователь уже состоит в браке', flags: 64 });
            }

            if (marryDataUser) {
                return interaction.reply({ content: 'Вы уже состоите в браке', flags: 64 });
            }

            // Создаем новую запись о браке
            const newMarry = await marrys.create({
                users: [author.id, user.id],
                balance: 0,
                date: Math.floor(Date.now() / 1000),
                date_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 дней
                name_love_room: `💕・${author.username} & ${user.username}`

            });

            // Добавляем запись в историю браков для обоих пользователей
            await User.updateOne(
                { user_id: author.id },
                { 
                    $set: { partner_id: user.id },
                    $inc: { balance: -price.marry },
                    $push: { 
                        history_marry: {
                            partner_id: user.id,
                            marry_id: newMarry._id,
                            date: Math.floor(Date.now() / 1000),
                            status: 'active'
                        }
                    }
                }
            );

            await User.updateOne(
                { user_id: user.id },
                { 
                    $set: { partner_id: author.id },
                    $push: { 
                        history_marry: {
                            partner_id: author.id,
                            marry_id: newMarry._id,
                            date: Math.floor(Date.now() / 1000),
                            status: 'active'
                        }
                    }
                }
            );

            const marryEmbed = {
                title: 'Заключен брак',
                description: `Пользователь <@${author.id}> и <@${user.id}> заключили брак.`,
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: user.displayAvatarURL({ size: 128 })
                },
                author: {
                    name: author.username,
                    iconURL: author.displayAvatarURL({ size: 128 })
                }
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('marry_balance')
                        .setLabel('Пополнить баланс')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('marry_nameroom')
                        .setLabel('Изменить название лаврумы')
                        .setStyle(ButtonStyle.Primary),
                );

            await amsg.edit({ embeds: [marryEmbed], components: [row] });
            await umsg.edit({ embeds: [marryEmbed], components: [] });

            // Отправляем подтверждение
            await interaction.reply({
                content: `✅ Брак успешно заключен! Поздравляем <@${author.id}> и <@${user.id}>`,
                flags: 64
            });
        }
    },
    {
        customId: 'marry_balance',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const author = state.author;
            const marry = state.marry;

            const User = client.schemas.get('Users');
            const Marry = client.schemas.get('Marry');
            const userData = await User.findOne({ user_id: author.id });

            await interaction.reply({
                content: `Введите сумму для пополнения баланса брака (от 1 до ${userData.balance} ${client.emojis.zvezda})`,
                flags: 64
            });

            const filter = m => m.author.id === author.id && !isNaN(m.content) && parseInt(m.content) > 0 && parseInt(m.content) <= userData.balance;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                const amount = parseInt(message.content);
                
                // Обновляем балансы
                await Promise.all([
                    User.updateOne(
                        { user_id: author.id },
                        { $inc: { balance: -amount } }
                    ),
                    Marry.updateOne(
                        { _id: marry._id },
                        { $inc: { balance: amount } }
                    )
                ]);

                // Удаляем сообщение пользователя
                await message.delete().catch(() => {});
                const partner = userData.partner_id;


                // Обновляем эмбед профиля
                const updatedMarry = await Marry.findById(marry._id);
                const embed = {
                    title: 'Любовный профиль',
                    fields: [
                        {
                            name: 'Партнер',
                            value: `<@${partner}>`,
                            inline: true
                        },

                        {
                            name: 'Баланс',
                            value: `${updatedMarry.balance} ${client.emojis.zvezda}`,
                            inline: true
                        },
                        {
                            name: 'Списание за лавруму',
                            value: `<t:${updatedMarry.date_end}:R>`,
                            inline: true
                        },
                        {
                            name: 'Название лаврумы',
                            value: updatedMarry.name_love_room,
                            inline: true
                        }
                    ],
                    thumbnail: { url: author.displayAvatarURL({ size: 128 }) },
                    timestamp: new Date().toISOString()
                };

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('marry_balance')
                            .setLabel('Пополнить баланс')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('marry_nameroom')
                            .setLabel('Изменить название лаврумы')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('marry_divorce')
                            .setLabel('Развестись')
                            .setStyle(ButtonStyle.Danger)
                    );

                await interaction.editReply({
                    content: `✅ Баланс брака пополнен на ${amount} ${client.emojis.zvezda}`,
                    flags: 64
                });

                // Обновляем оригинальное сообщение
                await interaction.message.edit({ 
                    embeds: [embed], 
                    components: [row] 
                });
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({
                        content: '❌ Время ожидания истекло',
                        flags: 64
                    });
                }
            });
        }
    },
    {
        customId: 'marry_nameroom',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const author = state.author;
            const marry = state.marry;

            const Marry = client.schemas.get('Marry');
            
            // Проверяем баланс брака вместо баланса пользователя
            if (marry.balance < price.marry_nameroom) {
                return interaction.reply({
                    content: `На балансе брака недостаточно средств для изменения названия (${price.marry_nameroom} ${client.emojis.zvezda})`,
                    flags: 64
                });
            }

            await interaction.reply({
                content: 'Введите новое название для лаврумы:',
                flags: 64
            });

            const filter = m => m.author.id === author.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                const newName = message.content;
                
                // Обновляем название в БД и списываем с баланса брака
                await Marry.updateOne(
                    { _id: marry._id },
                    { 
                        $set: { name_love_room: newName },
                        $inc: { balance: -price.marry_nameroom } // Списываем с баланса брака
                    }
                );

                // Если есть активная комната, меняем её название
                if (marry.love_room_id) {
                    const guild = await client.guilds.fetch(client.config.guildId);
                    const channel = await guild.channels.fetch(marry.love_room_id).catch(() => null);
                    if (channel) {
                        await channel.setName(newName).catch(console.error);
                    }
                }

                // Удаляем сообщение пользователя
                await message.delete().catch(() => {});
                const partner = userData.partner_id;

                // Обновляем эмбед профиля
                const updatedMarry = await Marry.findById(marry._id);
                const embed = {
                    title: 'Любовный профиль',
                    fields: [
                        {
                            name: 'Партнер',
                            value: `<@${partner}>`,
                            inline: true
                        },

                        {
                            name: 'Баланс',
                            value: `${updatedMarry.balance} ${client.emojis.zvezda}`,
                            inline: true
                        },
                        {
                            name: 'Списание за лавруму',
                            value: `<t:${updatedMarry.date_end}:R>`,
                            inline: true
                        },
                        {
                            name: 'Название лаврумы',
                            value: newName,
                            inline: true
                        }
                    ],
                    thumbnail: { url: author.displayAvatarURL({ size: 128 }) },
                    timestamp: new Date().toISOString()
                };

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('marry_balance')
                            .setLabel('Пополнить баланс')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('marry_nameroom')
                            .setLabel('Изменить название лаврумы')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('marry_divorce')
                            .setLabel('Развестись')
                            .setStyle(ButtonStyle.Danger)
                    );

                await interaction.editReply({
                    content: `✅ Название лаврумы изменено на "${newName}"\nСписано с баланса брака: ${price.marry_nameroom} ${client.emojis.zvezda}`,
                    flags: 64
                });

                // Обновляем оригинальное сообщение
                await interaction.message.edit({ 
                    embeds: [embed], 
                    components: [row] 
                });
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({
                        content: '❌ Время ожидания истекло',
                        flags: 64
                    });
                }
            });
        }
    },
    {
        customId: 'marry_divorce',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            const author = state.author;

            const Marry = client.schemas.get('Marry');
            const User = client.schemas.get('Users');

            // Находим запись о браке
            const marryData = await Marry.findOne({ users: { $in: author.id } });

            if (!marryData) {
                return interaction.reply({ content: 'Вы не состоите в браке', flags: 64 });
            }

            // Находим ID партнера (тот, который не author.id)
            const partnerId = marryData.users.find(id => id !== author.id);

            // Удаляем запись о браке
            await Marry.deleteOne({ _id: marryData._id });

            // Убираем роль у обоих пользователей
            const guild = await client.guilds.fetch(client.config.guildId);
            const authorMember = await guild.members.fetch(author.id);
            const partnerMember = await guild.members.fetch(partnerId);
            const role = guild.roles.cache.get('1340657424637628448');

            if (role) {
                await authorMember.roles.remove(role).catch(console.error);
                await partnerMember.roles.remove(role).catch(console.error);
            }

            // Обновляем данные пользователей
            await Promise.all([
                User.updateOne({ user_id: author.id }, { $set: { partner_id: null } }),
                User.updateOne({ user_id: partnerId }, { $set: { partner_id: null } })
            ]);

            await interaction.reply({
                content: `✅ Вы успешно развелись с <@${partnerId}>!`,
                flags: 64
            });
        }
    },
];

module.exports = buttons;