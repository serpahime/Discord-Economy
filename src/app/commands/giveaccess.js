const { SlashCommandBuilder } = require('discord.js');

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('giveaccess')
            .setDescription('Управление доступом к админ-командам')
            .addUserOption(option => 
                option
                    .setName('пользователь')
                    .setDescription('Выберите пользователя')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('действие')
                    .setDescription('Выдать или забрать доступ')
                    .setRequired(true)
                    .addChoices(
                        { name: '✅ Выдать доступ', value: 'give' },
                        { name: '❌ Забрать доступ', value: 'remove' }
                    )
            )
            .addStringOption(option =>
                option
                    .setName('причина')
                    .setDescription('Укажите причину')
                    .setRequired(false)
            ),

        async execute(interaction, client) {
            // Проверяем, является ли пользователь владельцем
            const allowedUsers = ['1370102381441978510', '1235916722146508813s'];
            if (!allowedUsers.includes(interaction.user.id)) {
                return interaction.reply({
                    embeds: [{
                        title: '❌ Отказано в доступе',
                        description: 'Только владельцы бота могут управлять доступом!',
                        color: 0xFF0000,
                        timestamp: new Date().toISOString()
                    }],
                    flags: ['Ephemeral']
                });
            }

            const targetUser = interaction.options.getUser('пользователь');
            const action = interaction.options.getString('действие');
            const reason = interaction.options.getString('причина') || 'Не указана';
            const AdminAccess = client.schemas.get('AdminAccess');

            try {
                if (action === 'give') {
                    // Проверяем, есть ли уже доступ
                    const existingAccess = await AdminAccess.findOne({ user_id: targetUser.id });
                    if (existingAccess) {
                        return interaction.reply({
                            embeds: [{
                                title: '⚠️ Внимание',
                                description: `${targetUser} уже имеет доступ к админ-командам!\n\nВыдан: <@${existingAccess.granted_by}>\nДата: <t:${Math.floor(existingAccess.granted_at.getTime() / 1000)}:F>`,
                                color: 0xFFA500,
                                timestamp: new Date().toISOString()
                            }],
                            flags: ['Ephemeral']
                        });
                    }

                    // Выдаем доступ
                    await AdminAccess.create({
                        user_id: targetUser.id,
                        granted_by: interaction.user.id,
                        reason: reason
                    });

                    const successEmbed = {
                        title: '✅ Доступ выдан',
                        description: `${targetUser} получил доступ к админ-командам`,
                        fields: [
                            {
                                name: '👤 Выдал',
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: '📝 Причина',
                                value: reason,
                                inline: true
                            }
                        ],
                        color: 0x2ecc71,
                        timestamp: new Date().toISOString()
                    };

                    // Отправляем уведомление
                    await interaction.reply({ embeds: [successEmbed] });
                    try {
                        await targetUser.send({ embeds: [successEmbed] });
                    } catch (error) {
                        console.error('Не удалось отправить ЛС пользователю:', error);
                    }

                    // Отправляем лог в канал
                    const logEmbed = {
                        title: '📝 Лог действия',
                        description: `**Администратор ${interaction.user} выдал доступ к админ-командам**`,
                        fields: [
                            {
                                name: '👤 Получатель',
                                value: `${targetUser}`,
                                inline: true
                            },
                            {
                                name: '📝 Причина',
                                value: reason,
                                inline: true
                            },
                            {
                                name: '⏰ Время',
                                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                                inline: true
                            }
                        ],
                        color: 0x2ecc71,
                        timestamp: new Date().toISOString()
                    };

                    await client.channels.cache.get('1340472040787808388').send({ embeds: [logEmbed] });

                } else if (action === 'remove') {
                    // Проверяем, есть ли доступ
                    const existingAccess = await AdminAccess.findOne({ user_id: targetUser.id });
                    if (!existingAccess) {
                        return interaction.reply({
                            embeds: [{
                                title: '⚠️ Внимание',
                                description: `${targetUser} не имеет доступа к админ-командам!`,
                                color: 0xFFA500,
                                timestamp: new Date().toISOString()
                            }],
                            flags: ['Ephemeral']
                        });
                    }

                    // Забираем доступ
                    await AdminAccess.deleteOne({ user_id: targetUser.id });

                    const removeEmbed = {
                        title: '❌ Доступ удален',
                        description: `${targetUser} больше не имеет доступа к админ-командам`,
                        fields: [
                            {
                                name: '👤 Удалил',
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: '📝 Причина',
                                value: reason,
                                inline: true
                            }
                        ],
                        color: 0xe74c3c,
                        timestamp: new Date().toISOString()
                    };

                    // Отправляем уведомление
                    await interaction.reply({ embeds: [removeEmbed] });
                    try {
                        await targetUser.send({ embeds: [removeEmbed] });
                    } catch (error) {
                        console.error('Не удалось отправить ЛС пользователю:', error);
                    }

                    // Отправляем лог в канал
                    const logEmbed = {
                        title: '📝 Лог действия',
                        description: `**Администратор ${interaction.user} удалил доступ к админ-командам**`,
                        fields: [
                            {
                                name: '👤 У пользователя',
                                value: `${targetUser}`,
                                inline: true
                            },
                            {
                                name: '📝 Причина',
                                value: reason,
                                inline: true
                            },
                            {
                                name: '⏰ Время',
                                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                                inline: true
                            }
                        ],
                        color: 0xe74c3c,
                        timestamp: new Date().toISOString()
                    };

                    await client.channels.cache.get('1340472040787808388').send({ embeds: [logEmbed] });
                }

            } catch (error) {
                console.error('Ошибка при управлении доступом:', error);
                await interaction.reply({
                    embeds: [{
                        title: '❌ Ошибка',
                        description: 'Произошла ошибка при выполнении команды',
                        color: 0xFF0000,
                        timestamp: new Date().toISOString()
                    }],
                    flags: ['Ephemeral']
                });
            }
        }
    }
];

module.exports = commands; 