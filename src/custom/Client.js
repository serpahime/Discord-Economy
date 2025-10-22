const { Client, Collection } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
const mongoose = require('mongoose');

class CustomClient extends Client {
    constructor(options) {
        super(options);
        this.handlers = new Collection();
        this.events = new Collection();
        this.commands = new Collection();
        this.schemas = new Collection();
        this._config = require('../config.json');
        this._emojis = require('../emoji.js');
    }

    get emojis() {
        return this._emojis;
    }

    get config() {
        return this._config;
    }

    async connectMongoDB() {
        try {
            const { url, database } = this.config.db;
            await mongoose.connect(url, {
                dbName: database
            });
            console.log('[Database] Успешное подключение к MongoDB');

            // Загружаем схемы после подключения
            await this.loadSchemas();
        } catch (error) {
            console.error('[Database] Ошибка подключения к MongoDB:', error);
            await this.notifyDevelopers(error);
        }

        // Обработчики событий MongoDB
        mongoose.connection.on('error', async error => {
            console.error('[Database] Ошибка MongoDB:', error);
            await this.notifyDevelopers(error);
        });

        mongoose.connection.on('disconnected', async () => {
            console.warn('[Database] Отключение от MongoDB');
            await this.notifyDevelopers('Отключение от MongoDB');
        });
    }

    async loadSchemas() {
        try {
            const schemasPath = join(__dirname, 'schemas');
            const schemaFiles = readdirSync(schemasPath).filter(file => file.endsWith('.js'));

            for (const file of schemaFiles) {
                const schema = require(join(schemasPath, file));
                const schemaName = file.split('.')[0];
                
                // Регистрируем схему в mongoose
                if (!mongoose.models[schemaName]) {
                    mongoose.model(schemaName, schema);
                }
                
                // Сохраняем схему в коллекции для удобного доступа
                this.schemas.set(schemaName, mongoose.model(schemaName));
                console.log(`[Database] Загружена схема ${schemaName}`);
            }
        } catch (error) {
            console.error('[Database] Ошибка при загрузке схем:', error);
            await this.notifyDevelopers(error);
        }
    }

    async loadHandlers() {
        try {
            // Сначала подключаемся к базе данных
            await this.connectMongoDB();

            const handlersPath = join(__dirname, '..', 'handlers');
            const handlerFiles = readdirSync(handlersPath).filter(file => file.endsWith('.js'));

            // Сортируем обработчики так, чтобы loadTasks загружался последним
            const sortedHandlers = handlerFiles.sort((a, b) => {
                if (a === 'loadTasks.js') return 1;
                if (b === 'loadTasks.js') return -1;
                return 0;
            });

            for (const file of sortedHandlers) {
                const handler = require(join(handlersPath, file));
                const handlerName = file.split('.')[0];
                
                this.handlers.set(handlerName, handler);
                
                if (typeof handler.execute === 'function') {
                    await handler.execute(this);
                    console.log(`[Handler] Загружен обработчик ${handlerName}`);
                }
            }
        } catch (error) {
            console.error('[Handler] Ошибка при загрузке обработчиков:', error);
            await this.notifyDevelopers(error);
        }
    }

    async notifyDevelopers(error) {
        const { developersId } = this.config;
        
        for (const devId of developersId) {
            try {
                const dev = await this.users.fetch(devId);
                await dev.send({
                    content: `**🔴 Ошибка:**\n\`\`\`js\n${error.stack || error}\n\`\`\``,
                });
            } catch (err) {
                console.error(`Не удалось отправить уведомление разработчику ${devId}:`, err);
            }
        }
    }
}

module.exports = CustomClient; 