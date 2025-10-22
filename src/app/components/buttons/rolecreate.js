const ComponentState = require('../ComponentState');
const { price, create } = require('../../../cfg');

module.exports = [{
    customId: 'confirm_create_role',
    async execute(interaction, client) {
        const state = ComponentState.getState(interaction.customId);
        const priceRole = state.price;
        if (!state) return interaction.reply({ 
            content: '❌ Срок действия истек', 
            flags: ['Ephemeral'] 
        });

        if (interaction.user.id !== state.user.id) return interaction.reply({ 
            content: '❌ Вы не можете создать эту роль', 
            flags: ['Ephemeral'] 
        });

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
            await state.msg.delete();
        }


        const [Users, Shops] = [
            client.schemas.get('Users'),
            client.schemas.get('Shops')
        ];

        const userData = await Users.findOne({ user_id: interaction.user.id });

        if (userData.balance < priceRole) {
            return interaction.reply({ 
                content: '❌ Недостаточно средств!', 
                flags: ['Ephemeral'] 
            });
        }

        try {
            // Создаем роль под указанной ролью
            const referenceRole = await interaction.guild.roles.fetch(create.role);
            const newRole = await interaction.guild.roles.create({
                name: state.name,
                color: state.color,
                position: referenceRole.position,
                reason: `Создано пользователем ${interaction.user.tag}`
            });

            // Выдаем роль создателю
            await interaction.member.roles.add(newRole.id);

            // Создаем запись в магазине
            await Shops.create({
                owner_id: interaction.user.id,
                role_id: newRole.id,
                name_role: state.name,
                price: priceRole,
                color: state.color
            });

            // Обновляем баланс и добавляем роль в показанные
            await Users.updateOne(
                { user_id: interaction.user.id },
                {
                    $inc: { balance: -priceRole },
                    $push: { 'roles.show': newRole.id }
                }
            );

            await state.msg.edit({
                embeds: [{
                    title: 'Создание роли',
                    description: `✅ Роль ${newRole} успешно создана!\nСписано: **${priceRole}** ${client.emojis.zvezda}`,
                    thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
                    timestamp: new Date().toISOString()
                }],
                components: []
            });
        } catch (error) {
            console.error('Ошибка при создании роли:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при создании роли!',
                flags: ['Ephemeral']
            });
        }
    }
}, {
    customId: 'cancel_create_role',
    async execute(interaction, client) {
        const state = ComponentState.getState(interaction.customId);

        if (interaction.user.id !== state.user.id) return interaction.reply({ 
            content: '❌ Вы не можете отменить создание этой роли', 
            flags: ['Ephemeral'] 
        });

        if (!state) return interaction.reply({ 
            content: '❌ Срок действия истек', 
            flags: ['Ephemeral'] 
        });


        await state.msg.edit({
            embeds: [{
                title: 'Создание роли',
                description: '❌ Создание роли отменено',
                thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
                timestamp: new Date().toISOString()
            }],
            components: []
        });
    }
}];