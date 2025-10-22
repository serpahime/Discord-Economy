const { readdirSync, statSync } = require('fs');
const { Collection } = require('discord.js');
const { join } = require('path');

function loadComponentsRecursively(client, dir, collection, type) {
    if (!statSync(dir).isDirectory()) {
        console.error(`[Components] Путь ${dir} не является директорией`);
        return;
    }

    const items = readdirSync(dir);
    console.log(`[Components] Сканирование директории ${dir}, найдено ${items.length} элементов`);

    for (const item of items) {
        const itemPath = join(dir, item);
        const isDirectory = statSync(itemPath).isDirectory();

        if (isDirectory) {
            loadComponentsRecursively(client, itemPath, collection, type);
        } else if (item.endsWith('.js')) {
            try {
                const components = require(itemPath);
                // Проверяем, является ли экспорт массивом компонентов или одним компонентом
                const componentArray = Array.isArray(components) ? components : [components];

                for (const component of componentArray) {
                    if ('customId' in component && 'execute' in component) {
                        collection.set(component.customId, component);
                        console.log(`[Components] Загружен ${type} ${component.customId}`);
                    } else {
                        console.warn(`[Warning] ${type} ${item} не содержит необходимые свойства 'customId' или 'execute'`);
                    }
                }
            } catch (error) {
                console.error(`[Error] Ошибка при загрузке ${type} ${item}:`, error);
            }
        }
    }
}

module.exports = {
    name: 'loadComponents',
    async execute(client) {
        try {
            // Инициализируем коллекции для разных типов компонентов
            client.buttons = new Collection();
            client.selects = new Collection();
            client.modals = new Collection();

            const componentsPath = join(__dirname, '..', 'app', 'components');
            
            // Загружаем кнопки
            const buttonsPath = join(componentsPath, 'buttons');
            if (statSync(buttonsPath).isDirectory()) {
                loadComponentsRecursively(client, buttonsPath, client.buttons, 'button');
            }

            // Загружаем селекты
            const selectsPath = join(componentsPath, 'selects');
            if (statSync(selectsPath).isDirectory()) {
                loadComponentsRecursively(client, selectsPath, client.selects, 'select');
            }

            // Загружаем модальные окна
            const modalsPath = join(componentsPath, 'modals');
            if (statSync(modalsPath).isDirectory()) {
                loadComponentsRecursively(client, modalsPath, client.modals, 'modal');
            }

            console.log(`[Components] Загружено: ${client.buttons.size} кнопок, ${client.selects.size} селектов, ${client.modals.size} модальных окон`);
        } catch (error) {
            console.error('[Components] Ошибка при загрузке компонентов:', error);
            await client.notifyDevelopers(error);
        }
    }
}; 