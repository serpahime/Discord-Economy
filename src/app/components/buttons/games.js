const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../ComponentState');
const { price, create } = require('../../../cfg');
const axios = require('axios');
const { activeDuels, duelCooldowns, COOLDOWN_TIME, activeDuelMessages } = require('../../commands/games');

// Массив поисковых запросов для разнообразия
const searchQueries = [
    'anime fight scene',
    'dragon ball z battle',
    'naruto vs sasuke',
    'one punch man fight',
    'jojo stand battle',
    'bleach ichigo fight',
    'one piece luffy battle',
    'attack on titan fight',
    'demon slayer battle',
    'my hero academia fight',
    'hunter x hunter fight',
    'sword art online fight',
    'fate series fight',
    'black clover fight',
    'tokyo ghoul fight'
];

// Функция получения случайного GIF
async function getRandomFightGif() {
    const randomQuery = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const response = await axios.get('https://api.giphy.com/v1/gifs/search', {
        params: {
            api_key: 'Hz6fM49NZMV535vubRR9iZr0wq185ErY', // Замените на ваш API ключ от GIPHY
            q: randomQuery,
            limit: 50,
            rating: 'pg-13'
        }
    });

    const gifs = response.data.data;
    const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
    return randomGif.images.original.url;
}

const buttons = [
    {
        customId: 'duel_accept',
        async execute(interaction, client) {
            try {
                const state = ComponentState.getState(interaction.customId);
                const Users = client.schemas.get('Users');
                const author = state.author;
                const msg = state.msg;
                const sum = state.sum;
                const authorData = state.authorData;

                // Проверяем, активна ли еще дуэль
                if (!activeDuels.has(author.id)) {
                    return interaction.reply({ 
                        content: '❌ Эта дуэль уже неактивна',
                        ephemeral: true 
                    });
                }

                // Проверяем, не в дуэли ли уже принимающий
                if (activeDuels.has(interaction.user.id)) {
                    return interaction.reply({ 
                        content: '❌ У вас уже есть активная дуэль! Дождитесь её завершения.',
                        ephemeral: true 
                    });
                }

                if (interaction.user.id === author.id) {
                    return interaction.reply({ 
                        content: '❌ Вы не можете принять свою собственную дуэль', 
                        ephemeral: true 
                    });
                }

                await interaction.reply({
                    content: `⚔️ Дуэль между <@${author.id}> и <@${interaction.user.id}> началась!`,
                    flags: 64
                });

                const user = interaction.user;
                const userData = await Users.findOne({ user_id: user.id });

                if (userData.balance < sum) {
                    return interaction.followUp({
                        content: `❌ У вас недостаточно средств! Не хватает ${sum - userData.balance} ${client.emojis.zvezda}`,
                        flags: 64
                    });
                }

                if (authorData.balance < sum) {
                    return interaction.followUp({
                        content: `❌ У автора недостаточно средств! Не хватает ${sum - authorData.balance} ${client.emojis.zvezda}`,
                        flags: 64
                    });
                }

                // Показываем анимацию боя
                const fightEmbed = {
                    title: '⚔️ Идёт бой!',
                    description: `${author.username} **VS** ${user.username}\n\n*Определяем победителя...*`,
                    image: {
                        url: await getRandomFightGif()
                    },
                    color: 0x2f3136,
                    timestamp: new Date().toISOString()
                };

                await msg.edit({ embeds: [fightEmbed], components: [] });

                // Ждем 5 секунд для эффекта
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Определяем победителя
                const winner = Math.random() < 0.5 ? author : user;
                const loser = winner === author ? user : author;

                // Обновляем балансы
                await Users.updateOne(
                    { user_id: winner.id },
                    { $inc: { balance: sum } }
                );
                await Users.updateOne(
                    { user_id: loser.id },
                    { $inc: { balance: -sum } }
                );

                const resultEmbed = {
                    title: '🏆 Результат дуэли',
                    description: `**Победитель:** <@${winner.id}>\n**Проигравший:** <@${loser.id}>\n**Награда:** ${sum} ${client.emojis.zvezda}`,
                    image: {
                        url: await getRandomFightGif()
                    },

                    fields: [
                        {
                            name: '💫 Статус',
                            value: `<@${winner.id}> забирает **${sum}** ${client.emojis.zvezda} у <@${loser.id}>`
                        }
                    ],
                    color: 0x2f3136,
                    timestamp: new Date().toISOString()
                };

                await msg.edit({ 
                    embeds: [resultEmbed],
                    components: [] 
                });

                await interaction.channel.send({
                    content: `⚔️ Дуэль завершена! <@${winner.id}> победил и получает **${sum}** ${client.emojis.zvezda}`
                });

                // После завершения дуэли:
                activeDuels.delete(author.id);
                activeDuels.delete(interaction.user.id);
                activeDuelMessages.delete(author.id);

                // Устанавливаем кулдаун для обоих участников
                duelCooldowns.set(author.id, Date.now() + COOLDOWN_TIME);
                duelCooldowns.set(interaction.user.id, Date.now() + COOLDOWN_TIME);

            } catch (error) {
                // В случае ошибки очищаем активные дуэли
                activeDuels.delete(author?.id);
                activeDuels.delete(interaction.user.id);
                console.error('Ошибка в дуэли:', error);
                await interaction.followUp({
                    content: '❌ Произошла ошибка при проведении дуэли',
                    ephemeral: true
                });
            }
        }
    }
];

module.exports = buttons;