const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');
const { price, create, cfg } = require('../../cfg');

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('inventory')
            .setDescription('Показывает ваш инвентарь'),
        async execute(interaction, client, dbUser) {
            const Users = client.schemas.get('Users');
            const Donate = client.schemas.get('Donate');
            const author = interaction.user;
            const authorData = await Users.findOne({ user_id: author.id });
            const inventory = authorData.inventory || [];

            if (inventory.length === 0) {
                return interaction.reply({ 
                    content: 'У вас нет предметов в инвентаре', 
                    flags: 64 
                });
            }

            const embed = {
                title: 'Инвентарь',
                description: 'Ваши купленные услуги',
                fields: [
                    {
                        name: 'Услуга',
                        value: inventory.map(item => 
                            item.type === 'admin' ? 'Скрытая админка' : 'Скрытие гендера'
                        ).join('\n'),
                        inline: true
                    },
                    {
                        name: 'Срок',
                        value: inventory.map(item => 
                            `<t:${item.data_end}:R>`
                        ).join('\n'),
                        inline: true

                    },
                    {
                        name: 'Статус',
                        value: inventory.map(item => item.activate ? '✅ Активно' : '❌ Не активно').join('\n'),
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString()
            };

            const rows = [];
            let currentRow = new ActionRowBuilder();
            let buttonCount = 0;

            for (let i = 0; i < inventory.length; i++) {
                const item = inventory[i];
                const button = new ButtonBuilder()
                    .setCustomId(`inventory_${item.id}`)
                    .setLabel(item.activate ? 'Деактивировать' : 'Активировать')
                    .setStyle(item.activate ? ButtonStyle.Danger : ButtonStyle.Success);

                currentRow.addComponents(button);
                buttonCount++;

                if (buttonCount === 5 || i === inventory.length - 1) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                    buttonCount = 0;
                }
            }

            await interaction.reply({ 
                embeds: [embed], 
                components: rows,
                flags: 64 
            });

            // Сохраняем состояние для кнопок
            ComponentState.setState(`inventory_${author.id}`, {
                author: author,
                inventory: inventory
            });
        }
    }
];

module.exports = commands;