const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');
const { price, create } = require('../../cfg');


const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('role-create')
            .setDescription('Создать роль')
            .addStringOption(option => option.setName('name').setDescription('Название роли').setRequired(true))
            .addStringOption(option => option.setName('color').setDescription('Цвет роли').setRequired(true)),

        async execute(interaction, client) {
            const name = interaction.options.getString('name');
            let color = interaction.options.getString('color').replace('#', '');
            const priceRole = price.role;
    
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
                    await testMessage.delete().catch(() => {});
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
    
            // Проверка формата HEX
            if (!/^[0-9A-Fa-f]{6}$/.test(color)) {
                return interaction.reply({ 
                    content: '❌ Неверный формат цвета! Используйте HEX формат (например: #ff0000 или ff0000)', 
                    flags: ['Ephemeral'] 
                });
            }
    
            const [Users, Shops] = [
                client.schemas.get('Users'),
                client.schemas.get('Shops')
            ];
    
            const [userData, existingRole] = await Promise.all([
                Users.findOne({ user_id: interaction.user.id }),
                Shops.findOne({ name_role: name })
            ]);
    
            if (userData.balance < priceRole) {
                return interaction.reply({ 
                    content: `❌ У вас недостаточно средств необходимо ещё ${priceRole - userData.balance} ${client.emojis.zvezda}`, 
                    flags: ['Ephemeral'] 
                });
            }
    
            if (existingRole) {
                return interaction.reply({ 
                    content: '❌ Название роли уже занято', 
                    flags: ['Ephemeral'] 
                });
            }

            const embed = {
                title: 'Создание роли',
                description: `Вы уверены что хотите создать роль **${name}** за **${priceRole}** ${client.emojis.zvezda}?`,
                thumbnail: {
                    url: interaction.user.displayAvatarURL({ size: 128 })
                },
                footer: {
                    text: `Откройте обязательно личные сообщения`
                },
            }

            const msg = await interaction.reply({ embeds: [embed] });

            const states = ComponentState.createMany(['confirm_create_role', 'cancel_create_role'], {
                user: interaction.user,
                price: priceRole,
                name: name,
                color: color,
                msg: msg
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(states.confirm_create_role).setLabel('Да').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(states.cancel_create_role).setLabel('Нет').setStyle(ButtonStyle.Danger)
            );

            await msg.edit({ embeds: [embed], components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('role-manage')
            .setDescription('Управление ролями'),

        async execute(interaction, client) {
            const [Users, Shops] = [
                client.schemas.get('Users'),
                client.schemas.get('Shops')
            ];

            const userData = await Users.findOne({ user_id: interaction.user.id });
            
            if (!userData) {
                return interaction.reply({ 
                    content: '❌ Вы не зарегистрированы', 
                    flags: ['Ephemeral'] 
                });
            }

            const userRoles = await Shops.find({ owner_id: interaction.user.id });

            if (!userRoles || userRoles.length === 0) {
                return interaction.reply({ 
                    content: '❌ Вы не создали ни одной роли', 
                    flags: ['Ephemeral'] 
                });
            }

            // Всегда показываем селект для выбора роли
            const embed = {
                title: 'Управление ролями',
                description: 'Выберите роль для управления:',
                thumbnail: {
                    url: interaction.user.displayAvatarURL({ size: 128 })
                }
            }

            const msg = await interaction.reply({ embeds: [embed] });

            const states = ComponentState.createMany(['role_select'], {
                user: interaction.user,
                roles: userRoles,
                msg: msg
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(states.role_select)
                .setPlaceholder('Выберите роль')
                .addOptions(
                    userRoles.map(role => ({
                        label: role.name_role,
                        description: `Цена: ${role.price} | Покупок: ${role.buy_count}`,
                        value: role.role_id
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await msg.edit({ embeds: [embed], components: [row] });
        }
    }
]

module.exports = commands;