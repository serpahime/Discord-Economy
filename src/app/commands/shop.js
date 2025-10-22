const { price, create } = require('../../cfg');
const ComponentState = require('../components/ComponentState');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('shop')
            .setDescription('Магазин'),
        async execute(interaction, client) {
            const roles = await client.schemas.get('Shops').find({ show_shop: true });
            const user = await client.schemas.get('Users').findOne({ user_id: interaction.user.id });
            
            if (!roles.length) {
                return interaction.reply({
                    content: 'В магазине пока нет доступных ролей',
                    flags: ['Ephemeral']
                });
            }

            let currentPage = 0;
            const rolesPerPage = 5;
            const maxPages = Math.ceil(roles.length / rolesPerPage);

            function generateEmbed(page) {
                const embed = new EmbedBuilder()
                    .setTitle('Магазин')
                    .setColor('Random')
                    .setFooter({ text: `Страница ${page + 1}/${maxPages}` })
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

                let description = '';
                const startIndex = page * rolesPerPage;
                const pageRoles = roles.slice(startIndex, startIndex + rolesPerPage);

                pageRoles.forEach((role, index) => {
                    description += `**${startIndex + index + 1})** Роль: <@&${role.role_id}>\n`;
                    description += `Продавец: <@${role.owner_id}>\n`;
                    description += `Цена: ${role.price} 💰\n`;
                    description += `Куплено: ${role.buy_count} раз\n\n`;
                });

                embed.setDescription(description);
                return embed;
            }

            function generateButtons(page) {
                const startIndex = page * rolesPerPage;
                const pageRoles = roles.slice(startIndex, startIndex + rolesPerPage);

                const navigationRow = new ActionRowBuilder();
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_prev_${page}`)
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId(`shop_next_${page}`)
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === maxPages - 1)
                );

                const buttonRow = new ActionRowBuilder();
                pageRoles.forEach((_, index) => {
                    buttonRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`shop_buy_${startIndex + index}`)
                            .setLabel(`${startIndex + index + 1}`)
                            .setEmoji('🛒')
                            .setStyle(ButtonStyle.Primary)
                    );
                });

                return [buttonRow, navigationRow];
            }

            const response = await interaction.reply({
                embeds: [generateEmbed(currentPage)],
                components: generateButtons(currentPage)
            });

            const message = await response.fetch();
            const collector = message.createMessageComponentCollector({
                time: 120000 // 2 минуты
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({
                        content: 'Эта кнопка не для вас!',
                        flags: ['Ephemeral']
                    });
                    return;
                }

                const [action, type, index] = i.customId.split('_');

                if (type === 'prev') {
                    currentPage--;
                    await i.update({
                        embeds: [generateEmbed(currentPage)],
                        components: generateButtons(currentPage)
                    });
                    return;
                }

                if (type === 'next') {
                    currentPage++;
                    await i.update({
                        embeds: [generateEmbed(currentPage)],
                        components: generateButtons(currentPage)
                    });
                    return;
                }

                if (type === 'buy') {
                    const currentUser = await client.schemas.get('Users').findOne({ user_id: interaction.user.id });
                    const roleIndex = parseInt(index);
                    const selectedRole = roles[roleIndex];

                    if (!selectedRole) {
                        await i.reply({
                            content: 'Эта роль больше недоступна!',
                            flags: ['Ephemeral']
                        });
                        return;
                    }

                    if (currentUser.roles.show.includes(selectedRole.role_id) || 
                        currentUser.roles.hide.includes(selectedRole.role_id)) {
                        await i.reply({
                            content: 'У вас уже есть эта роль!',
                            flags: ['Ephemeral']
                        });
                        return;
                    }

                    if (currentUser.balance < selectedRole.price) {
                        await i.reply({
                            content: `Недостаточно средств! Необходимо: ${selectedRole.price} 💰`,
                            flags: ['Ephemeral']
                        });
                        return;
                    }

                    try {
                        const updateResult = await client.schemas.get('Users').updateOne(
                            { 
                                user_id: interaction.user.id,
                                balance: { $gte: selectedRole.price }
                            },
                            {
                                $inc: { balance: -selectedRole.price },
                                $push: { 'roles.show': selectedRole.role_id }
                            }
                        );

                        if (updateResult.modifiedCount === 0) {
                            await i.reply({
                                content: 'Недостаточно средств или роль уже куплена!',
                                flags: ['Ephemeral']
                            });
                            return;
                        }

                        await client.schemas.get('Shops').updateOne(
                            { role_id: selectedRole.role_id },
                            { $inc: { buy_count: 1 } }
                        );

                        // Начисление 90% от стоимости роли владельцу
                        const ownerReward = Math.floor(selectedRole.price * 0.9);
                        await client.schemas.get('Users').updateOne(
                            { user_id: selectedRole.owner_id },
                            { $inc: { balance: ownerReward } }
                        );

                        try {
                            await interaction.member.roles.add(selectedRole.role_id);
                            await i.reply({
                                content: `Вы успешно приобрели роль <@&${selectedRole.role_id}>!`,
                                flags: ['Ephemeral']
                            });
                        } catch (error) {
                            await client.schemas.get('Users').updateOne(
                                { user_id: interaction.user.id },
                                {
                                    $inc: { balance: selectedRole.price },
                                    $pull: { 'roles.show': selectedRole.role_id }
                                }
                            );
                            
                            await i.reply({
                                content: 'Произошла ошибка при выдаче роли. Средства возвращены.',
                                flags: ['Ephemeral']
                            });
                        }
                    } catch (error) {
                        console.error('Ошибка при покупке роли:', error);
                        await i.reply({
                            content: 'Произошла ошибка при покупке роли!',
                            flags: ['Ephemeral']
                        });
                    }
                }
            });

            collector.on('end', () => {
                interaction.editReply({
                    components: []
                }).catch(() => {});
            });
        }
    }
];