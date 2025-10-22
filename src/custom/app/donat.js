const { cfg, price } = require('../../cfg');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'donate',
    description: 'Донат',

    async execute(client) {
        try {
            // Получаем актуальные данные гильдии
            const guild = await client.guilds.fetch(client.config.guildId);
            if (!guild) {
                console.error('Гильдия не найдена');
                return;
            }

            // Получаем актуальные данные канала
            const channel = await guild.channels.fetch(cfg.donat_channel);
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
                .setTitle('Покупка дополнительных услуг')
                .setDescription(
                    'Скрытая админка 1 день, 3 дня, 7 дней.\n' +
                    'Скрытие гендера 1 день, 7 дней, 30 дней.'
                )
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('donatbuy_admin')
                    .setLabel('Скрытая админка')
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('donatbuy_gender')
                    .setLabel('Скрытие гендера')
                    .setStyle(ButtonStyle.Success)
            );

            await channel.send({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
        }
    },

    async handleButton(interaction, client) {
        const customId = interaction.customId;
        const userId = interaction.user.id;
        const guild = await client.guilds.fetch(client.config.guildId);
        const Users = client.schemas.get('Users');
        const userData = await Users.findOne({ user_id: userId });

        if (customId === 'donatbuy_admin') {
            const hasActiveService = userData.inventory?.some(item => 
                item.type === 'admin' && item.data_end > Math.floor(Date.now() / 1000)
            );

            if (hasActiveService) {
                return interaction.reply({
                    content: 'У вас уже есть действующая услуга скрытой админки. Дождитесь окончания срока действия.',
                    flags: 64
                });
            }


            const embed = {
                title: 'Скрытая админка',   
                description: 'Выберите срок действия:',
                fields: [
                    {
                        name: '1 день',
                        value: `${price.admin["1d"]} ${client.emojis.zvezda}`,
                        inline: true
                    },
                    {
                        name: '3 дня',
                        value: `${price.admin["3d"]} ${client.emojis.zvezda}`,
                        inline: true
                    },
                    {
                        name: '7 дней',
                        value: `${price.admin["7d"]} ${client.emojis.zvezda}`,
                        inline: true
                    }
                ],
                thumbnail: { url: guild.iconURL({ dynamic: true }) },
                timestamp: new Date().toISOString()
            };

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('donatbuy_admin_select')
                    .setPlaceholder('Выберите срок действия')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setOptions([
                        {
                            label: '1 день',
                            value: '1d',
                            description: `${price.admin["1d"]} ${client.emojis.zvezda}`
                        },
                        {
                            label: '3 дня',
                            value: '3d',
                            description: `${price.admin["3d"]} ${client.emojis.zvezda}`
                        },
                        {
                            label: '7 дней',
                            value: '7d',
                            description: `${price.admin["7d"]} ${client.emojis.zvezda}`
                        }
                    ])
            );

            await interaction.reply({ embeds: [embed], components: [selectMenu], flags: 64 });
        } else if (customId === 'donatbuy_gender') {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                return interaction.reply({
                    content: 'Не удалось получить данные пользователя',
                    flags: 64
                });
            }

            const hasActiveService = userData.inventory?.some(item => 
                item.type === 'gender' && item.data_end > Math.floor(Date.now() / 1000)
            );

            if (hasActiveService) {
                return interaction.reply({
                    content: 'У вас уже есть действующая услуга скрытия гендера. Дождитесь окончания срока действия.',
                    flags: 64
                });
            }


            // Проверяем роли напрямую из кэша после получения актуальных данных члена гильдии
            const hasMaleRole = member.roles.cache.has(price.hide_gender.male_id_role);
            const hasFemaleRole = member.roles.cache.has(price.hide_gender.female_id_role);
            console.log(hasMaleRole, hasFemaleRole);

            if (!hasMaleRole && !hasFemaleRole) {
                return interaction.reply({
                    content: 'У вас нет роли гендера для скрытия',
                    flags: 64
                });
            }

            const embed = {
                title: 'Скрытие гендера',
                description: 'Выберите срок действия:',
                fields: [
                    {
                        name: '1 день',
                        value: `${price.hide_gender["1d"]} ${client.emojis.zvezda}`,
                        inline: true
                    },
                    {
                        name: '7 дней',
                        value: `${price.hide_gender["1w"]} ${client.emojis.zvezda}`,
                        inline: true
                    },
                    {
                        name: '30 дней',
                        value: `${price.hide_gender["1m"]} ${client.emojis.zvezda}`,
                        inline: true
                    }
                ],
                thumbnail: { url: guild.iconURL({ dynamic: true }) },
                timestamp: new Date().toISOString()
            };

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('donatbuy_gender_select')
                    .setPlaceholder('Выберите срок действия')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setOptions([
                        {
                            label: '1 день',
                            value: '1d',
                            description: `${price.hide_gender["1d"]} ${client.emojis.zvezda}`
                        },
                        {
                            label: '7 дней',
                            value: '1w',
                            description: `${price.hide_gender["1w"]} ${client.emojis.zvezda}`
                        },
                        {
                            label: '30 дней',
                            value: '1m',
                            description: `${price.hide_gender["1m"]} ${client.emojis.zvezda}`
                        }
                    ])
            );

            await interaction.reply({ embeds: [embed], components: [selectMenu], flags: 64 });
        }
    },

    async handleSelect(interaction, client) {
        const customId = interaction.customId;
        const userId = interaction.user.id;
        const value = interaction.values[0];
        const Users = client.schemas.get('Users');
        const userData = await Users.findOne({ user_id: userId });
        const guild = await client.guilds.fetch(client.config.guildId);
        const member = await guild.members.fetch(userId).catch(() => null);

        if (!member) {
            return interaction.reply({
                content: 'Не удалось получить данные пользователя',
                flags: 64
            });
        }

        if (customId === 'donatbuy_admin_select') {
            const cost = price.admin[value];
            if (userData.balance < cost) {
                return interaction.reply({
                    content: `У вас недостаточно средств. Необходимо: ${cost} ${client.emojis.zvezda}`,
                    flags: 64
                });
            }

            // Проверяем наличие активной услуги в инвентаре
            const hasActiveService = userData.inventory?.some(item => 
                item.type === 'admin' && item.data_end > Math.floor(Date.now() / 1000)
            );

            if (hasActiveService) {
                return interaction.reply({
                    content: 'У вас уже есть действующая услуга скрытой админки. Дождитесь окончания срока действия.',
                    flags: 64
                });
            }

            const timeInSeconds = {
                '1d': 86400,
                '3d': 259200,
                '7d': 604800
            };

            const data_end = Math.floor(Date.now() / 1000) + timeInSeconds[value];
            const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Добавляем только в инвентарь
            await Users.updateOne(
                { user_id: userId },
                {
                    $push: {
                        inventory: {
                            id: itemId,
                            type: 'admin',
                            time: value,
                            data_end: data_end,
                            activate: false
                        }
                    },
                    $inc: { balance: -cost }
                }
            );

            await interaction.reply({
                content: `✅ Вы успешно приобрели скрытую админку на ${value.replace('d', ' дней')}\nСписано: ${cost} ${client.emojis.zvezda}\n\nЧтобы активировать купленные услуги, используйте команду \`/inventory\``,
                flags: 64
            });

        } else if (customId === 'donatbuy_gender_select') {
            const cost = price.hide_gender[value];
            if (userData.balance < cost) {
                return interaction.reply({
                    content: `У вас недостаточно средств. Необходимо: ${cost} ${client.emojis.zvezda}`,
                    flags: 64
                });
            }

            // Проверяем наличие активной услуги в инвентаре
            const hasActiveService = userData.inventory?.some(item => 
                item.type === 'gender' && item.data_end > Math.floor(Date.now() / 1000)
            );

            if (hasActiveService) {
                return interaction.reply({
                    content: 'У вас уже есть действующая услуга скрытия гендера. Дождитесь окончания срока действия.',
                    flags: 64
                });
            }

            const timeInSeconds = {
                '1d': 86400,
                '3d': 259200,
                '7d': 604800
            };

            // Проверяем роли после получения актуальных данных члена гильдии
            const gender = member.roles.cache.has(price.hide_gender.male_id_role) ? 'male' : 'female';

            const data_end = Math.floor(Date.now() / 1000) + timeInSeconds[value];
            const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Добавляем только в инвентарь
            await Users.updateOne(
                { user_id: userId },
                {
                    $push: {
                        inventory: {
                            id: itemId,
                            type: 'gender',
                            time: value,
                            data_end: data_end,
                            activate: false,
                            gender: gender
                        }
                    },
                    $inc: { balance: -cost }
                }
            );

            await interaction.reply({
                content: `✅ Вы успешно приобрели скрытие гендера на ${value.replace('d', ' день').replace('w', ' дней').replace('m', ' дней')}\nСписано: ${cost} ${client.emojis.zvezda}\n\nЧтобы активировать купленные услуги, используйте команду \`/inventory\``,
                flags: 64
            });
        }
    }
};