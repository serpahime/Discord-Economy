module.exports = {
    name: 'errorHandler',
    async execute(client) {
        // Обработка необработанных промисов
        process.on('unhandledRejection', async (error) => {
            console.error('Необработанная ошибка промиса:', error);
            await client.notifyDevelopers(error);
        });

        // Обработка необработанных исключений
        process.on('uncaughtException', async (error) => {
            console.error('Необработанное исключение:', error);
            await client.notifyDevelopers(error);
        });

        // Обработка предупреждений
        process.on('warning', async (warning) => {
            console.warn('Предупреждение:', warning);
            await client.notifyDevelopers(warning);
        });

        // Обработка ошибок Discord.js
        client.on('error', async (error) => {
            console.error('Ошибка Discord.js:', error);
            await client.notifyDevelopers(error);
        });

        // Обработка ошибок шардов (если используются)
        client.on('shardError', async (error, shardId) => {
            console.error(`Ошибка шарда ${shardId}:`, error);
            await client.notifyDevelopers(`Ошибка шарда ${shardId}: ${error}`);
        });

        // Обработка отключения от Discord
        client.on('disconnect', async () => {
            console.warn('Бот отключился от Discord');
            await client.notifyDevelopers('Бот отключился от Discord');
        });

        // Обработка ошибок WebSocket
        client.ws.on('error', async (error) => {
            console.error('Ошибка WebSocket:', error);
            await client.notifyDevelopers(error);
        });
    }
}; 