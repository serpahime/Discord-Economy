const ComponentState = require('../ComponentState');
const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = [
    {
        customId: 'role_select',
        async execute(interaction, client) {    
            const state = ComponentState.getState(interaction.customId);
            const user = state.user;
            const roles = state.roles;
            const msg = state.msg;

            const selectedRoleId = interaction.values[0];
            const selectedRole = roles.find(role => role.role_id === selectedRoleId);

            if (!selectedRole) {
                return interaction.reply({
                    content: '❌ Роль не найдена',
                    flags: ['Ephemeral']
                });
            }

            await interaction.deferUpdate();

            const embed = {
                title: 'Управление ролями',
                description: `Выберите действие над <@&${selectedRole.role_id}>`,
                thumbnail: {
                    url: interaction.user.displayAvatarURL({ size: 128 })
                },
                footer: {
                    text: `Откройте обязательно личные сообщения`
                },
            }

            const states = ComponentState.createMany(['role_shop', 'role_reversal', 'role_icon', 'role_name', 'price_roless', 'give_role', 'take_role', 'delete_role', 'back_to_role_select'], {
                user: interaction.user,
                shop: selectedRole,
                msg: msg,
                role_id: selectedRole.role_id,
                show: selectedRole.show_shop,
                roles: roles
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(states.role_shop)
                    .setLabel(selectedRole.show_shop ? 'Снять с продажи' : 'Выставить в магазин')
                    .setStyle(selectedRole.show_shop ? ButtonStyle.Danger : ButtonStyle.Secondary),
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

            await msg.edit({ embeds: [embed], components: [row, row2, row3] });
        }
    }
];