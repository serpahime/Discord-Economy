const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../ComponentState');

const buttons = [
    {
        customId: 'refresh_ping',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!state) {
                return interaction.reply({
                    content: '❌ Срок действия кнопки истек. Используйте команду `/ping` снова.',
                    flags: ['Ephemeral']
                });
            }

            if (interaction.user.id !== state.user.id) {
                return interaction.reply({
                    content: '❌ Только пользователь, вызвавший команду, может обновить информацию!',
                    flags: ['Ephemeral']
                });
            }

            if (interaction.channelId !== state.channel.id) {
                return interaction.reply({
                    content: '❌ Эта кнопка может быть использована только в канале, где была вызвана команда!',
                    flags: ['Ephemeral']
                });
            }

            await interaction.update({
                content: 'Обновляю данные...',
                components: []
            });

            const latency = Date.now() - interaction.createdTimestamp;
            const apiLatency = Math.round(client.ws.ping);

            // Создаем новые состояния для обеих кнопок
            const states = ComponentState.createMany(['refresh_ping', 'clear_ping'], {
                user: state.user,
                guild: state.guild,
                channel: state.channel,
                member: state.member
            });

            const refreshButton = new ButtonBuilder()
                .setCustomId(states.refresh_ping)
                .setLabel('Обновить')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄');

            const clearButton = new ButtonBuilder()
                .setCustomId(states.clear_ping)
                .setLabel('Очистить')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️');

            const row = new ActionRowBuilder()
                .addComponents(refreshButton, clearButton);

            ComponentState.delete(interaction.customId);

            await interaction.editReply({
                content: `🏓 Понг!\n⏱️ Задержка: \`${latency}ms\`\n📡 API: \`${apiLatency}ms\``,
                components: [row]
            });
        }
    },
    {
        customId: 'clear_ping',
        async execute(interaction, client) {
            const state = ComponentState.getState(interaction.customId);
            if (!state) {
                return interaction.reply({
                    content: '❌ Срок действия кнопки истек.',
                    ephemeral: true
                });
            }

            if (interaction.user.id !== state.user.id) {
                return interaction.reply({
                    content: '❌ Только пользователь, вызвавший команду, может очистить сообщение!',
                    ephemeral: true
                });
            }

            ComponentState.delete(interaction.customId);
            await interaction.update({
                content: '✅ Сообщение очищено',
                components: []
            });
        }
    }
];

module.exports = buttons; 