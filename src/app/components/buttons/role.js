const ComponentState = require('../ComponentState');
const { price, create } = require('../../../cfg');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

// Общая функция для создания интерфейса управления ролью
function createRoleManagementInterface(user, shop, msg, role_id, description = null) {
    const states = ComponentState.createMany([
        'role_shop', 'role_reversal', 'role_icon', 'role_name', 'price_roless', 
        'give_role', 'take_role', 'delete_role', 'back_to_role_select'
    ], {
        user: user,
        shop: shop,
        msg: msg,
        role_id: role_id,
        show: shop.show_shop,
        roles: user.roles || []
    });

    const embed = {
        title: 'Управление ролями',
        description: description || `Выберите действие над <@&${role_id}>`,
        thumbnail: {
            url: user.displayAvatarURL({ size: 128 })
        },
        footer: {
            text: `Откройте обязательно личные сообщения`
        }
    };

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(states.role_shop)
            .setLabel(shop.show_shop ? 'Снять с продажи' : 'Выставить в магазин')
            .setStyle(shop.show_shop ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(states.role_reversal)
            .setLabel('Сменить цвет')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(states.role_icon)
            .setLabel('Сменить иконку')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(states.role_name)
            .setLabel('Изменить название')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(states.price_roless)
            .setLabel('Изменить цену')
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(states.give_role)
            .setLabel('Выдать роль')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(states.take_role)
            .setLabel('Забрать роль')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(states.delete_role)
            .setLabel('Удалить роль')
            .setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(states.back_to_role_select)
            .setLabel('← Назад к выбору ролей')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components: [row1, row2, row3] };
}

// Общая функция для обработки ошибок авторизации
function checkPermissions(interaction, state) {
    if (interaction.user.id !== state.user.id) {
        interaction.reply({ 
            content: '❌ Вы не можете изменить эту роль', 
            flags: ['Ephemeral'] 
        });
        return false;
    }

    if (!state) {
        interaction.reply({ 
            content: '❌ Срок действия истек', 
            flags: ['Ephemeral'] 
        });
        return false;
    }
    return true;
}

const buttons = [
    {
        customId: 'role_shop',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            const Shops = client.schemas.get('Shops');
            
            try {
                await Shops.updateOne(
                    { role_id: state.role_id },
                    { $set: { show_shop: !state.shop.show_shop } }
                );

                const updatedShop = { ...state.shop, show_shop: !state.shop.show_shop };
                const description = `${!state.shop.show_shop ? '✅ Роль выставлена в магазин' : '❌ Роль снята с продажи'}\n\nВыберите действие над <@&${state.role_id}>`;
                
                const { embed, components } = createRoleManagementInterface(
                    state.user, updatedShop, state.msg, state.role_id, description
                );

                await state.msg.edit({ embeds: [embed], components });
                await interaction.reply({ 
                    content: !state.shop.show_shop ? 
                        '✅ Роль успешно выставлена в магазин' : 
                        '✅ Роль успешно снята с продажи', 
                    flags: ['Ephemeral'] 
                });
            } catch (error) {
                console.error('Ошибка при обновлении статуса роли:', error);
                await interaction.reply({ 
                    content: '❌ Произошла ошибка при обновлении статуса роли', 
                    flags: ['Ephemeral'] 
                });
            }
        }
    },
    {
        customId: 'role_reversal',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            const userData = await client.schemas.get('Users').findOne({ user_id: state.user.id });
            if (userData.balance < price.role_color) {
                return interaction.reply({
                    content: `❌ Недостаточно средств! Необходимо: **${price.role_color}** ${client.emojis.zvezda}`,
                    flags: ['Ephemeral']
                });
            }

            await interaction.reply({
                content: `Отправьте новый цвет роли в HEX формате (например: #FF0000 или FF0000)\nСтоимость: **${price.role_color}** ${client.emojis.zvezda}`,
                flags: ['Ephemeral']
            });

            const filter = m => m.author.id === interaction.user.id && m.content.match(/^#?[0-9A-Fa-f]{6}$/);
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                try {
                    const userData = await client.schemas.get('Users').findOne({ user_id: state.user.id });
                    if (userData.balance < price.role_color) {
                        const reply = await message.reply({
                            content: `❌ Недостаточно средств! Необходимо: **${price.role_color}** ${client.emojis.zvezda}`,
                        });
                        setTimeout(() => {
                            message.delete().catch(() => {});
                            reply.delete().catch(() => {});
                        }, 5000);
                        return;
                    }

                    const color = message.content.replace('#', '');
                    const role = await interaction.guild.roles.fetch(state.role_id);
                    
                    await Promise.all([
                        role.setColor(`#${color}`),
                        client.schemas.get('Shops').updateOne(
                            { role_id: state.role_id },
                            { $set: { color: color } }
                        ),
                        client.schemas.get('Users').updateOne(
                            { user_id: state.user.id },
                            { $inc: { balance: -price.role_color } }
                        )
                    ]);

                    const description = `Цвет роли успешно изменен на #${color}, с вашего баланса списана сумма: **${price.role_color}** ${client.emojis.zvezda}\n\nВыберите действие над <@&${state.role_id}>`;
                    const { embed, components } = createRoleManagementInterface(
                        state.user, state.shop, state.msg, state.role_id, description
                    );

                    await state.msg.edit({ embeds: [embed], components });

                    const reply = await interaction.followUp({ 
                        content: `✅ Цвет роли успешно изменен на #${color}`,
                        flags: ['Ephemeral']
                    });

                    setTimeout(() => {
                        message.delete().catch(() => {});
                        reply.delete().catch(() => {});
                    }, 5000);
                } catch (error) {
                    console.error('Ошибка при смене цвета:', error);
                    const errorMsg = await message.reply('❌ Произошла ошибка при смене цвета роли');
                    setTimeout(() => {
                        message.delete().catch(() => {});
                        errorMsg.delete().catch(() => {});
                    }, 5000);
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.followUp({
                        content: '❌ Время ожидания истекло',
                        flags: ['Ephemeral']
                    });
                }
            });
        }
    },
    {
        customId: 'role_icon',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            await interaction.reply({
                content: `Отправьте изображение для иконки роли\nСтоимость: **${price.role_icon}** ${client.emojis.zvezda}`,
                flags: ['Ephemeral']
            });

            const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                try {
                    const userData = await client.schemas.get('Users').findOne({ user_id: state.user.id });
                    if (userData.balance < price.role_icon) {
                        const reply = await message.reply({
                            content: `❌ Недостаточно средств! Необходимо: **${price.role_icon}** ${client.emojis.zvezda}`,
                        });
                        setTimeout(() => {
                            message.delete().catch(() => {});
                            reply.delete().catch(() => {});
                        }, 5000);
                        return;
                    }

                    const attachment = message.attachments.first();
                    const role = await interaction.guild.roles.fetch(state.role_id);
                    
                    await Promise.all([
                        role.setIcon(attachment.url),
                        client.schemas.get('Users').updateOne(
                            { user_id: state.user.id },
                            { $inc: { balance: -price.role_icon } }
                        )
                    ]);

                    const description = `Иконка роли успешно изменена, с вашего баланса списана сумма: **${price.role_icon}** ${client.emojis.zvezda}\n\nВыберите действие над <@&${state.role_id}>`;
                    const { embed, components } = createRoleManagementInterface(
                        state.user, state.shop, state.msg, state.role_id, description
                    );

                    await state.msg.edit({ embeds: [embed], components });
                    const reply = await message.reply(`✅ Иконка роли успешно изменена`);

                    setTimeout(() => {
                        message.delete().catch(() => {});
                        reply.delete().catch(() => {});
                    }, 5000);
                } catch (error) {
                    console.error('Ошибка при смене иконки:', error);
                    const errorMsg = await message.reply('❌ Произошла ошибка при смене иконки роли');
                    setTimeout(() => {
                        message.delete().catch(() => {});
                        errorMsg.delete().catch(() => {});
                    }, 5000);
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.followUp({
                        content: '❌ Время ожидания истекло',
                        flags: ['Ephemeral']
                    });
                }
            });
        }
    },
    {
        customId: 'role_name',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            const userData = await client.schemas.get('Users').findOne({ user_id: state.user.id });
            if (userData.balance < price.role_name) {
                return interaction.reply({
                    content: `❌ Недостаточно средств! Необходимо: **${price.role_name}** ${client.emojis.zvezda}`,
                    flags: ['Ephemeral']
                });
            }

            await interaction.reply({
                content: `Отправьте новое название роли\nСтоимость: **${price.role_name}** ${client.emojis.zvezda}`,
                flags: ['Ephemeral']
            });

            const filter = m => m.author.id === interaction.user.id && m.content.length > 0 && m.content.length <= 100;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                try {
                    const userData = await client.schemas.get('Users').findOne({ user_id: state.user.id });
                    if (userData.balance < price.role_name) {
                        const reply = await message.reply({
                            content: `❌ Недостаточно средств! Необходимо: **${price.role_name}** ${client.emojis.zvezda}`,
                        });
                        setTimeout(() => {
                            message.delete().catch(() => {});
                            reply.delete().catch(() => {});
                        }, 5000);
                        return;
                    }

                    const newName = message.content.trim();
                    const role = await interaction.guild.roles.fetch(state.role_id);
                    
                    await Promise.all([
                        role.setName(newName),
                        client.schemas.get('Shops').updateOne(
                            { role_id: state.role_id },
                            { $set: { name_role: newName } }
                        ),
                        client.schemas.get('Users').updateOne(
                            { user_id: state.user.id },
                            { $inc: { balance: -price.role_name } }
                        )
                    ]);

                    const updatedShop = { ...state.shop, name_role: newName };
                    const description = `Название роли успешно изменено на "${newName}", с вашего баланса списана сумма: **${price.role_name}** ${client.emojis.zvezda}\n\nВыберите действие над <@&${state.role_id}>`;
                    const { embed, components } = createRoleManagementInterface(
                        state.user, updatedShop, state.msg, state.role_id, description
                    );

                    await state.msg.edit({ embeds: [embed], components });

                    const reply = await interaction.followUp({ 
                        content: `✅ Название роли успешно изменено на "${newName}"`,
                        flags: ['Ephemeral']
                    });

                    setTimeout(() => {
                        message.delete().catch(() => {});
                        reply.delete().catch(() => {});
                    }, 5000);
                } catch (error) {
                    console.error('Ошибка при смене названия:', error);
                    const errorMsg = await message.reply('❌ Произошла ошибка при смене названия роли');
                    setTimeout(() => {
                        message.delete().catch(() => {});
                        errorMsg.delete().catch(() => {});
                    }, 5000);
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.followUp({
                        content: '❌ Время ожидания истекло',
                        flags: ['Ephemeral']
                    });
                }
            });
        }
    },
    {
        customId: 'price_roless',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            await interaction.reply({
                content: `Отправьте новую цену для роли <@&${state.role_id}>`,
                flags: ['Ephemeral']
            });

            const filter = m => m.author.id === interaction.user.id && m.content.match(/^[0-9]+$/);
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
            
            collector.on('collect', async (message) => {
                const newPrice = parseInt(message.content);
                if (isNaN(newPrice) || newPrice < 0) {
                    const reply = await message.reply('❌ Некорректная цена');
                    setTimeout(() => {
                        message.delete().catch(() => {});
                        reply.delete().catch(() => {});
                    }, 5000);
                    return;
                }

                await client.schemas.get('Shops').updateOne(
                    { role_id: state.role_id },
                    { $set: { price: newPrice } }
                );

                const updatedShop = { ...state.shop, price: newPrice };
                const description = `Цена роли успешно изменена на **${newPrice}** ${client.emojis.zvezda}\n\nВыберите действие над <@&${state.role_id}>`;
                const { embed, components } = createRoleManagementInterface(
                    state.user, updatedShop, state.msg, state.role_id, description
                );

                await state.msg.edit({ embeds: [embed], components });

                const reply = await message.reply(`✅ Цена роли успешно изменена на **${newPrice}** ${client.emojis.zvezda}`);
                
                setTimeout(() => {
                    message.delete().catch(() => {});
                    reply.delete().catch(() => {});
                }, 5000);
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.followUp({
                        content: '❌ Время ожидания истекло',
                        flags: ['Ephemeral']
                    });
                }
            });
        }
    },
    {
        customId: 'give_role',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            const giveRoleCost = Math.floor(state.shop.price * 0.75);
            const userData = await client.schemas.get('Users').findOne({ user_id: state.user.id });
            if (userData.balance < giveRoleCost) {
                return interaction.reply({
                    content: `❌ Недостаточно средств! Необходимо: **${giveRoleCost}** ${client.emojis.zvezda}`,
                    flags: ['Ephemeral']
                });
            }

            await interaction.reply({
                content: `Тегните пользователя, которому хотите выдать роль <@&${state.role_id}>\nСтоимость: **${giveRoleCost}** ${client.emojis.zvezda}`,
                flags: ['Ephemeral']
            });

            const filter = m => m.author.id === interaction.user.id && m.mentions.users.size > 0;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                try {
                    const userData = await client.schemas.get('Users').findOne({ user_id: state.user.id });
                    if (userData.balance < giveRoleCost) {
                        const reply = await message.reply({
                            content: `❌ Недостаточно средств! Необходимо: **${giveRoleCost}** ${client.emojis.zvezda}`,
                        });
                        setTimeout(() => {
                            message.delete().catch(() => {});
                            reply.delete().catch(() => {});
                        }, 5000);
                        return;
                    }

                    const targetUser = message.mentions.users.first();
                    const targetMember = await interaction.guild.members.fetch(targetUser.id);

                    if (targetMember.roles.cache.has(state.role_id)) {
                        const reply = await message.reply('❌ У этого пользователя уже есть данная роль');
                        setTimeout(() => {
                            message.delete().catch(() => {});
                            reply.delete().catch(() => {});
                        }, 5000);
                        return;
                    }

                    let targetUserData = await client.schemas.get('Users').findOne({ user_id: targetUser.id });
                    if (!targetUserData) {
                        targetUserData = new (client.schemas.get('Users'))({ 
                            user_id: targetUser.id,
                            balance: 0,
                            roles: { show: [], hide: [] }
                        });
                        await targetUserData.save();
                    }

                    await Promise.all([
                        targetMember.roles.add(state.role_id),
                        client.schemas.get('Users').updateOne(
                            { user_id: state.user.id },
                            { $inc: { balance: -giveRoleCost } }
                        ),
                        client.schemas.get('Users').updateOne(
                            { user_id: targetUser.id },
                            { $addToSet: { 'roles.show': state.role_id } }
                        )
                    ]);

                    const description = `Роль успешно выдана пользователю <@${targetUser.id}>, с вашего баланса списана сумма: **${giveRoleCost}** ${client.emojis.zvezda}\n\nВыберите действие над <@&${state.role_id}>`;
                    const { embed, components } = createRoleManagementInterface(
                        state.user, state.shop, state.msg, state.role_id, description
                    );

                    await state.msg.edit({ embeds: [embed], components });

                    const reply = await interaction.followUp({ 
                        content: `✅ Роль успешно выдана пользователю <@${targetUser.id}>`,
                        flags: ['Ephemeral']
                    });

                    setTimeout(() => {
                        message.delete().catch(() => {});
                        reply.delete().catch(() => {});
                    }, 5000);
                } catch (error) {
                    console.error('Ошибка при выдаче роли:', error);
                    const errorMsg = await message.reply('❌ Произошла ошибка при выдаче роли');
                    setTimeout(() => {
                        message.delete().catch(() => {});
                        errorMsg.delete().catch(() => {});
                    }, 5000);
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.followUp({
                        content: '❌ Время ожидания истекло',
                        flags: ['Ephemeral']
                    });
                }
            });
        }
    },
    {
        customId: 'take_role',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            await interaction.reply({
                content: `Тегните пользователя, у которого хотите забрать роль <@&${state.role_id}>`,
                flags: ['Ephemeral']
            });

            const filter = m => m.author.id === interaction.user.id && m.mentions.users.size > 0;
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async (message) => {
                try {
                    const targetUser = message.mentions.users.first();
                    const targetMember = await interaction.guild.members.fetch(targetUser.id);

                    if (!targetMember.roles.cache.has(state.role_id)) {
                        const reply = await message.reply('❌ У этого пользователя нет данной роли');
                        setTimeout(() => {
                            message.delete().catch(() => {});
                            reply.delete().catch(() => {});
                        }, 5000);
                        return;
                    }

                    await Promise.all([
                        targetMember.roles.remove(state.role_id),
                        client.schemas.get('Users').updateOne(
                            { user_id: targetUser.id },
                            { 
                                $pull: { 
                                    'roles.show': state.role_id,
                                    'roles.hide': state.role_id 
                                } 
                            }
                        )
                    ]);

                    const description = `Роль успешно забрана у пользователя <@${targetUser.id}>\n\nВыберите действие над <@&${state.role_id}>`;
                    const { embed, components } = createRoleManagementInterface(
                        state.user, state.shop, state.msg, state.role_id, description
                    );

                    await state.msg.edit({ embeds: [embed], components });

                    const reply = await interaction.followUp({ 
                        content: `✅ Роль успешно забрана у пользователя <@${targetUser.id}>`,
                        flags: ['Ephemeral']
                    });

                    setTimeout(() => {
                        message.delete().catch(() => {});
                        reply.delete().catch(() => {});
                    }, 5000);
                } catch (error) {
                    console.error('Ошибка при забирании роли:', error);
                    const errorMsg = await message.reply('❌ Произошла ошибка при забирании роли');
                    setTimeout(() => {
                        message.delete().catch(() => {});
                        errorMsg.delete().catch(() => {});
                    }, 5000);
                }
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    interaction.followUp({
                        content: '❌ Время ожидания истекло',
                        flags: ['Ephemeral']
                    });
                }
            });
        }
    },
    {
        customId: 'delete_role',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            const embed = {
                title: 'Управление ролями',
                description: `Вы уверены, что хотите удалить роль <@&${state.role_id}>?`,
                thumbnail: {
                    url: interaction.user.displayAvatarURL({ size: 128 })
                },
                footer: {
                    text: `Откройте обязательно личные сообщения`
                }
            };

            const states = ComponentState.createMany(['delete_role_yes', 'delete_role_no'], {
                user: state.user,
                shop: state.shop,
                msg: state.msg,
                role_id: state.role_id
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(states.delete_role_yes)
                    .setLabel('Да')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(states.delete_role_no)
                    .setLabel('Нет')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.deferUpdate();
            await state.msg.edit({ embeds: [embed], components: [row] });
        }   
    },
    {
        customId: 'delete_role_yes',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            const role = await interaction.guild.roles.fetch(state.role_id);
            await role.delete();
            await client.schemas.get('Shops').deleteOne({ role_id: state.role_id });

            await state.msg.edit({
                embeds: [{
                    title: 'Управление ролями',
                    description: '✅ Роль успешно удалена',
                    thumbnail: {
                        url: interaction.user.displayAvatarURL({ size: 128 })
                    },
                    footer: {
                        text: `Откройте обязательно личные сообщения`
                    }
                }],
                components: []
            });
        }
    },
    {
        customId: 'delete_role_no',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            const { embed, components } = createRoleManagementInterface(
                state.user, state.shop, state.msg, state.role_id, '❌ Удаление роли отменено\n\nВыберите действие над <@&' + state.role_id + '>'
            );

            await interaction.deferUpdate();
            await state.msg.edit({ embeds: [embed], components });
        }
    },
    {
        customId: 'back_to_role_select',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!checkPermissions(interaction, state)) return;

            await interaction.deferUpdate();

            // Получаем обновленный список ролей пользователя
            const userRoles = await client.schemas.get('Shops').find({ owner_id: state.user.id });

            const embed = {
                title: 'Управление ролями',
                description: 'Выберите роль для управления:',
                thumbnail: {
                    url: state.user.displayAvatarURL({ size: 128 })
                }
            };

            const states = ComponentState.createMany(['role_select'], {
                user: state.user,
                roles: userRoles,
                msg: state.msg
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
            await state.msg.edit({ embeds: [embed], components: [row] });
        }
    }
];

module.exports = buttons;