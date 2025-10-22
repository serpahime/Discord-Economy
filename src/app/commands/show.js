const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('roles')
            .setDescription('Управление вашими ролями'),
        
        async execute(interaction, client) {
            // Получаем данные пользователя из БД
            const user = await client.schemas.get('Users').findOne({ user_id: interaction.user.id });
            
            if (!user) {
                return interaction.reply({
                    content: 'Ваш профиль не найден в базе данных!',
                    ephemeral: true
                });
            }
            
            // Получаем видимые и скрытые роли
            const visibleRoles = user.roles.show || [];
            const hiddenRoles = user.roles.hide || [];
            
            // Если у пользователя нет ролей
            if (visibleRoles.length === 0 && hiddenRoles.length === 0) {
                return interaction.reply({
                    content: 'У вас нет ролей. Вы можете приобрести их в `/shop`!',
                    ephemeral: true
                });
            }
            
            // Создаем эмбед
            const embed = new EmbedBuilder()
                .setTitle('Управление ролями')
                .setDescription('Выберите роль в меню ниже, чтобы скрыть или показать её.')
                .setColor('Random')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'Выбор роли автоматически переключит её видимость' });
            
            // Добавляем поля для видимых и скрытых ролей
            if (visibleRoles.length > 0) {
                embed.addFields({
                    name: '✅ Активные роли',
                    value: visibleRoles.map(roleId => `<@&${roleId}>`).join('\n') || 'Нет активных ролей'
                });
            }
            
            if (hiddenRoles.length > 0) {
                embed.addFields({
                    name: '❌ Скрытые роли',
                    value: hiddenRoles.map(roleId => `<@&${roleId}>`).join('\n') || 'Нет скрытых ролей'
                });
            }
            
            // Создаем селект-меню со всеми ролями
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('toggle_role_visibility')
                .setPlaceholder('Выберите роль для переключения видимости')
                .setMinValues(1)
                .setMaxValues(1);
            
            // Добавляем видимые роли в меню
            for (const roleId of visibleRoles) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role) {
                    selectMenu.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(role.name)
                            .setDescription('Нажмите, чтобы скрыть')
                            .setValue(`hide:${roleId}`)
                            .setEmoji('✅')
                    );
                }
            }
            
            // Добавляем скрытые роли в меню
            for (const roleId of hiddenRoles) {
                const role = interaction.guild.roles.cache.get(roleId);
                if (role) {
                    selectMenu.addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(role.name)
                            .setDescription('Нажмите, чтобы показать')
                            .setValue(`show:${roleId}`)
                            .setEmoji('❌')
                    );
                }
            }
            
            // Создаем компонент с селект-меню
            const row = new ActionRowBuilder().addComponents(selectMenu);
            
            // Отправляем сообщение
            const response = await interaction.reply({
                embeds: [embed],
                components: [row]
            });
            
            // Создаем коллектор для обработки выбора
            const collector = response.createMessageComponentCollector({
                time: 180000 // 3 минуты
            });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: 'Это не ваше меню управления ролями!',
                        ephemeral: true
                    });
                }
                
                const [action, roleId] = i.values[0].split(':');
                
                // Получаем актуальные данные из БД
                const userData = await client.schemas.get('Users').findOne({ user_id: interaction.user.id });
                const visibleRoles = userData.roles.show || [];
                const hiddenRoles = userData.roles.hide || [];
                
                try {
                    if (action === 'hide') {
                        // Переносим роль из видимых в скрытые
                        await client.schemas.get('Users').updateOne(
                            { user_id: interaction.user.id },
                            { 
                                $pull: { 'roles.show': roleId },
                                $push: { 'roles.hide': roleId }
                            }
                        );
                        
                        // Удаляем роль у пользователя
                        await interaction.member.roles.remove(roleId);
                        
                        await i.reply({
                            content: `Роль <@&${roleId}> была скрыта!`,
                            ephemeral: true
                        });
                    } else if (action === 'show') {
                        // Переносим роль из скрытых в видимые
                        await client.schemas.get('Users').updateOne(
                            { user_id: interaction.user.id },
                            { 
                                $pull: { 'roles.hide': roleId },
                                $push: { 'roles.show': roleId }
                            }
                        );
                        
                        // Добавляем роль пользователю
                        await interaction.member.roles.add(roleId);
                        
                        await i.reply({
                            content: `Роль <@&${roleId}> была активирована!`,
                            ephemeral: true
                        });
                    }
                    
                    // Обновляем данные пользователя и эмбед
                    const updatedUser = await client.schemas.get('Users').findOne({ user_id: interaction.user.id });
                    const newVisibleRoles = updatedUser.roles.show || [];
                    const newHiddenRoles = updatedUser.roles.hide || [];
                    
                    // Обновляем эмбед
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle('Управление ролями')
                        .setDescription('Выберите роль в меню ниже, чтобы скрыть или показать её.')
                        .setColor('Random')
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: 'Выбор роли автоматически переключит её видимость' });
                    
                    if (newVisibleRoles.length > 0) {
                        updatedEmbed.addFields({
                            name: '✅ Активные роли',
                            value: newVisibleRoles.map(id => `<@&${id}>`).join('\n') || 'Нет активных ролей'
                        });
                    }
                    
                    if (newHiddenRoles.length > 0) {
                        updatedEmbed.addFields({
                            name: '❌ Скрытые роли',
                            value: newHiddenRoles.map(id => `<@&${id}>`).join('\n') || 'Нет скрытых ролей'
                        });
                    }
                    
                    // Обновляем селект-меню
                    const updatedSelectMenu = new StringSelectMenuBuilder()
                        .setCustomId('toggle_role_visibility')
                        .setPlaceholder('Выберите роль для переключения видимости')
                        .setMinValues(1)
                        .setMaxValues(1);
                    
                    // Добавляем видимые роли в меню
                    for (const roleId of newVisibleRoles) {
                        const role = interaction.guild.roles.cache.get(roleId);
                        if (role) {
                            updatedSelectMenu.addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(role.name)
                                    .setDescription('Нажмите, чтобы скрыть')
                                    .setValue(`hide:${roleId}`)
                                    .setEmoji('✅')
                            );
                        }
                    }
                    
                    // Добавляем скрытые роли в меню
                    for (const roleId of newHiddenRoles) {
                        const role = interaction.guild.roles.cache.get(roleId);
                        if (role) {
                            updatedSelectMenu.addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(role.name)
                                    .setDescription('Нажмите, чтобы показать')
                                    .setValue(`show:${roleId}`)
                                    .setEmoji('❌')
                            );
                        }
                    }
                    
                    // Создаем обновленный компонент
                    const updatedRow = new ActionRowBuilder().addComponents(updatedSelectMenu);
                    
                    // Обновляем сообщение
                    await interaction.editReply({
                        embeds: [updatedEmbed],
                        components: [updatedRow]
                    });
                    
                } catch (error) {
                    console.error('Ошибка при изменении видимости роли:', error);
                    await i.reply({
                        content: 'Произошла ошибка при изменении видимости роли. Попробуйте позже.',
                        ephemeral: true
                    });
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