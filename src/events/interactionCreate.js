const ComponentState = require('../app/components/ComponentState');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(client, interaction) {
        try {
            let dbUser = null;

            // Проверяем и создаем пользователя в БД перед выполнением команд
            if (interaction.guild) {
                const Users = client.schemas.get('Users');
                const Donate = client.schemas.get('Donate');
                dbUser = await Users.findOne({ user_id: interaction.user.id });
                const donate = await Donate.findOne({ user_id: interaction.user.id });

                if (!donate) {
                    await Donate.create({ user_id: interaction.user.id, donate: 0 });
                }

                if (!dbUser) {
                    dbUser = await Users.create({
                        user_id: interaction.user.id,
                        status: 'Не установлен'
                    });
                    console.log(`[Database] Создан новый пользователь: ${interaction.user.tag}`);
                }
            }

            // Обработка слеш-команд
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    console.error(`[Command] Команда ${interaction.commandName} не найдена.`);
                    return;
                }
                // Передаем пользователя из БД в команду
                await command.execute(interaction, client, dbUser);
            }
            
            // Обработка кнопок
            else if (interaction.isButton()) {
                // Проверяем, является ли это кнопкой коллектора
                if (interaction.customId.includes('shop_')) {
                    // Пропускаем обработку, так как это кнопка коллектора
                    return;
                }

                    
                if (interaction.customId.startsWith('privates_settings_')) {
                    const privates = require('../custom/app/privates');
                    await privates.handleButton(interaction, client);
                    return;
                }

                if (interaction.customId.startsWith('donatbuy_')) {
                    const donat = require('../custom/app/donat');
                    await donat.handleButton(interaction, client);
                    return;
                }

                if (interaction.customId.startsWith('inventory_')) {
                    const { handleInventoryButton } = require('../app/components/zalupa');
                    await handleInventoryButton(interaction, client);
                    return;
                }
                
                // Обработка обычных кнопок
                const baseId = ComponentState.getBaseId(interaction.customId);
                const buttons = client.buttons.get(baseId);



                if (!buttons) {
                    console.error(`[Button] Кнопка ${baseId} не найдена.`);
                    return;
                }

                if (Array.isArray(buttons)) {
                    const button = buttons.find(b => b.customId === baseId);
                    if (!button) {
                        console.error(`[Button] Кнопка ${baseId} не найдена в массиве.`);
                        return;
                    }
                    await button.execute(interaction, client);
                } else {
                    await buttons.execute(interaction, client);
                }
            }
            
            // Обработка селект-меню
            else if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || 
                     interaction.isRoleSelectMenu() || interaction.isUserSelectMenu() || 
                     interaction.isMentionableSelectMenu()) {

                if (interaction.customId.startsWith('donatbuy_')) {
                    const donat = require('../custom/app/donat');
                    await donat.handleSelect(interaction, client);
                    return;
                }

                const baseId = ComponentState.getBaseId(interaction.customId);
                const selects = client.selects.get(baseId);

                if (!selects) {
                    console.error(`[Select] Селект ${baseId} не найден.`);
                    return;
                }
                // Если это массив селектов, ищем нужный по customId
                if (Array.isArray(selects)) {
                    const select = selects.find(s => s.customId === baseId);
                    if (!select) {
                        console.error(`[Select] Селект ${baseId} не найден в массиве.`);
                        return;
                    }
                    // Передаем пользователя из БД в обработчик селекта
                    await select.execute(interaction, client, dbUser);
                } else {
                    // Передаем пользователя из БД в обработчик селекта
                    await selects.execute(interaction, client, dbUser);
                }
            }
            
            // Обработка модальных окон
            else if (interaction.isModalSubmit()) {
                const baseId = ComponentState.getBaseId(interaction.customId);
                const modals = client.modals.get(baseId);
                if (!modals) {
                    console.error(`[Modal] Модальное окно ${baseId} не найдено.`);
                    return;
                }
                // Если это массив модальных окон, ищем нужное по customId
                if (Array.isArray(modals)) {
                    const modal = modals.find(m => m.customId === baseId);
                    if (!modal) {
                        console.error(`[Modal] Модальное окно ${baseId} не найдено в массиве.`);
                        return;
                    }
                    // Передаем пользователя из БД в обработчик модального окна
                    await modal.execute(interaction, client, dbUser);
                } else {
                    // Передаем пользователя из БД в обработчик модального окна
                    await modals.execute(interaction, client, dbUser);
                }
            }
        } catch (error) {
            console.error(`[Interaction] Ошибка при обработке взаимодействия:`, error);
            client.notifyDevelopers(error);

            const errorMessage = {
                content: 'При обработке взаимодействия произошла ошибка!',
                flags: ['Ephemeral']
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
}; 