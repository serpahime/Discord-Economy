const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apanel-list')
        .setDescription('Показать список пользователей с доступом к админ-панели'),

    async execute(interaction, client) {
        try {
            // Проверка на право просмотра списка
            const allowedUsers = ['1370102381441978510'];
            if (!allowedUsers.includes(interaction.user.id)) {
                return interaction.reply({ 
                    embeds: [{
                        title: '❌ Отказано в доступе',
                        description: 'У вас нет прав для просмотра списка!',
                        color: 0xFF0000,
                        timestamp: new Date().toISOString()
                    }],
                    flags: ['Ephemeral'] 
                });
            }

            const AdminAccess = client.schemas.get('AdminAccess');
            const accessList = await AdminAccess.find({}).sort({ granted_at: -1 });

            if (accessList.length === 0) {
                return interaction.reply({
                    embeds: [{
                        title: '📋 Список пользователей с доступом',
                        description: 'В данный момент нет пользователей с доступом к админ-панели',
                        color: 0x2b2d31,
                        timestamp: new Date().toISOString()
                    }],
                    flags: ['Ephemeral']
                });
            }

            let userListString = '';
            for (const access of accessList) {
                const user = await client.users.fetch(access.user_id).catch(() => null);
                const grantedBy = await client.users.fetch(access.granted_by).catch(() => null);
                
                if (user) {
                    userListString += `👤 **${user.tag}** (${user.id})\n`;
                    userListString += `├ Выдал: ${grantedBy ? grantedBy.tag : 'Неизвестно'}\n`;
                    userListString += `└ Дата: <t:${Math.floor(access.granted_at.getTime() / 1000)}:F>\n\n`;
                }
            }

            const embed = {
                title: '📋 Список пользователей с доступом',
                description: userListString || 'Не удалось загрузить информацию о пользователях',
                color: 0x2b2d31,
                footer: {
                    text: `Всего пользователей: ${accessList.length}`
                },
                timestamp: new Date().toISOString()
            };

            // Отправляем лог в канал
            const logEmbed = {
                title: '📝 Лог действия',
                description: `**Администратор ${interaction.user} просмотрел список доступа**`,
                fields: [
                    {
                        name: '⏰ Время',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: true
                    }
                ],
                color: 0x3498db,
                timestamp: new Date().toISOString()
            };

            await client.channels.cache.get('1340472040787808388').send({ embeds: [logEmbed] });

            return interaction.reply({
                embeds: [embed],
                flags: ['Ephemeral']
            });

        } catch (error) {
            console.error('Ошибка при выполнении команды apanel-list:', error);
            return interaction.reply({
                embeds: [{
                    title: '❌ Ошибка',
                    description: 'Произошла ошибка при получении списка. Пожалуйста, попробуйте позже.',
                    color: 0xFF0000,
                    timestamp: new Date().toISOString()
                }],
                flags: ['Ephemeral']
            });
        }
    }
}; 