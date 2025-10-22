const { REST, Routes } = require('discord.js');
const { readdirSync, statSync } = require('fs');
const { join } = require('path');

function loadCommandsRecursively(client, dir, parentFolder = '') {
    if (!statSync(dir).isDirectory()) {
        console.error(`[Command] Путь ${dir} не является директорией`);
        return;
    }

    const items = readdirSync(dir);
    console.log(`[Command] Сканирование директории ${dir}, найдено ${items.length} элементов`);

    for (const item of items) {
        const itemPath = join(dir, item);
        const isDirectory = statSync(itemPath).isDirectory();

        if (isDirectory) {
            // Рекурсивно загружаем команды из подпапки
            loadCommandsRecursively(client, itemPath, `${parentFolder}${item}/`);
        } else if (item.endsWith('.js')) {
            try {
                const commandModule = require(itemPath);
                let commandsToLoad = [];

                // Проверяем наличие свойства commands в модуле
                if (commandModule.commands && Array.isArray(commandModule.commands)) {
                    commandsToLoad = commandModule.commands;
                }
                // Проверяем, является ли сам модуль массивом команд
                else if (Array.isArray(commandModule)) {
                    commandsToLoad = commandModule;
                }
                // Если это одиночная команда
                else if (typeof commandModule === 'object') {
                    commandsToLoad = [commandModule];
                }

                for (const command of commandsToLoad) {
                    if ('data' in command && 'execute' in command) {
                        client.commands.set(command.data.name, command);
                        console.log(`[Command] Загружена команда ${command.data.name} из категории ${parentFolder || 'root'}`);
                    } else {
                        console.warn(`[Warning] Команда в файле ${item} не содержит необходимые свойства 'data' или 'execute'`);
                    }
                }
            } catch (error) {
                console.error(`[Error] Ошибка при загрузке команды ${item}:`, error);
            }
        }
    }
}

module.exports = {
    name: 'loadCommands',
    async execute(client) {
        try {
            const commandsPath = join(__dirname, '..', 'app', 'commands');
            console.log(`[Command] Начало загрузки команд из ${commandsPath}`);

            if (!statSync(commandsPath).isDirectory()) {
                await client.notifyDevelopers(`Директория команд ${commandsPath} не существует`);
                throw new Error(`Директория команд ${commandsPath} не существует`);
            }

            // Очищаем существующие команды
            client.commands.clear();

            // Рекурсивно загружаем все команды
            loadCommandsRecursively(client, commandsPath);

            const commandCount = client.commands.size;
            console.log(`[Command] Загружено ${commandCount} команд`);

            if (commandCount > 0) {
                // Регистрируем команды на сервере
                const rest = new REST().setToken(client.config.token);
                const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

                console.log(`[Command] Начало регистрации ${commands.length} команд на сервере ${client.config.guildId}`);

                await rest.put(
                    Routes.applicationGuildCommands(client.config.clientId, client.config.guildId),
                    { body: commands }
                );

                console.log('[Command] Команды успешно зарегистрированы');
            } else {
                console.warn('[Warning] Нет команд для регистрации');
            }
        } catch (error) {
            console.error('[Command] Ошибка при загрузке/регистрации команд:', error);
            await client.notifyDevelopers(error);
            throw error;
        }
    }
};