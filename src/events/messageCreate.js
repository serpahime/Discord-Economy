const { cfg } = require('../cfg');
const { config } = require('../config.json');

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        try {
            // Проверяем, что сообщение отправлено в нужный канал
            if (message.channelId !== "1369002974835249324") return;
            
            // Проверяем, что отправитель не бот
            if (message.author.bot) return;

            // Проверяем наличие заблокированных ролей
            if (message.member.roles.cache.some(role => 
                cfg.chat.block_roles.includes(role.id)
            )) return;

            // Получаем схему пользователей
            const Users = client.schemas.get('Users');
            
            // Ищем или создаем пользователя
            let user = await Users.findOne({ user_id: message.author.id });

            if (!user) {
                user = await Users.create({
                    user_id: message.author.id,
                    balance: 0,
                    messages: 1,
                    status: 'Не указан',
                    experience: 0,
                    level: 1
                });
            } else {
                // Увеличиваем счетчик сообщений
                const newMessages = user.messages + 1;
                
                // Проверяем, делится ли количество сообщений на 10 без остатка
                const isMultipleOfTen = newMessages % 10 === 0;
                
                // Обновляем данные пользователя
                await Users.updateOne(
                    { user_id: message.author.id },
                    { 
                        $inc: { 
                            messages: 1,
                            experience: isMultipleOfTen ? 1 : 0
                        } 
                    }
                );

                if (isMultipleOfTen) {
                    console.log(`${message.author.tag} достиг ${newMessages} сообщений и получил +1 опыт`);
                }
            }

        } catch (error) {
            console.error('Ошибка в обработчике messageCreate:', error);
        }
    }
};