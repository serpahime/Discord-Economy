const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Проверка задержки бота'),
        
        async execute(interaction, client) {
            // Создаем состояния для всех кнопок сразу
            const states = ComponentState.createMany(['refresh_ping', 'clear_ping'], {
                user: interaction.user,
                guild: interaction.guild,
                channel: interaction.channel,
                member: interaction.member
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

            // Отправляем начальное сообщение
            await interaction.reply({ 
                content: 'Измеряю задержку...'
            });

            // Получаем сообщение после отправки
            const reply = await interaction.fetchReply();
            const latency = reply.createdTimestamp - interaction.createdTimestamp;
            const apiLatency = Math.round(client.ws.ping);

            await interaction.editReply({
                content: `🏓 Понг!\n⏱️ Задержка: \`${latency}ms\`\n📡 API: \`${apiLatency}ms\``,
                components: [row]
            });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('latency')
            .setDescription('Подробная информация о задержках'),
        
        async execute(interaction, client) {
            await interaction.reply({ 
                content: 'Собираю информацию...',
                ephemeral: true
            });

            const reply = await interaction.fetchReply();
            const latency = reply.createdTimestamp - interaction.createdTimestamp;
            const apiLatency = Math.round(client.ws.ping);
            const uptime = Math.round(client.uptime / 1000); // в секундах

            await interaction.editReply({
                content: `📊 **Подробная информация:**\n` +
                        `⏱️ Задержка бота: \`${latency}ms\`\n` +
                        `📡 Задержка API: \`${apiLatency}ms\`\n` +
                        `⌚ Аптайм: \`${uptime}s\`\n` +
                        `🖥️ Шард: \`${interaction.guild.shardId}\``,
                ephemeral: true
            });
        }
    }
];

module.exports = commands; 