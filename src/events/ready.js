const privates = require('../custom/app/privates');
const donat = require('../custom/app/donat');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            console.log(`Бот готов! Вошел как ${client.user.tag}`);
            
            // Подключаемся к MongoDB
            await client.connectMongoDB();

            // Выполняем все задачи немедленно, включая нашу новую задачу room-delete
            await client.taskManager.executeAllTasksImmediately();

            // Ждем немного перед отправкой эмбеда
            setTimeout(async () => {
                try {
                    await privates.execute(client);
                    await donat.execute(client);
                } catch (error) {
                    console.error('Ошибка при выполнении privates:', error);
                }
            }, 3000);

        } catch (error) {
            console.error('Ошибка в событии ready:', error);
        }
    }
};