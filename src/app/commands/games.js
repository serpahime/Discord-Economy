const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');
const { price, create, cfg } = require('../../cfg');

// Создаем Map для отслеживания кулдаунов и активных дуэлей
const duelCooldowns = new Map();
const activeDuels = new Map();
const activeDuelMessages = new Map(); // Добавляем Map для отслеживания активных сообщений

const COOLDOWN_TIME = 30 * 1000; // 30 секунд кулдауна

// Изменяем экспорт, делая команды отдельным модулем
module.exports = {
    // Экспортируем команды как свойство module.exports
    commands: [
        {
            data: new SlashCommandBuilder()
                .setName('duel')
                .setDescription('Создает дуэль')
                .addIntegerOption(option => option.setName('сумма').setDescription('Сумма дуэли').setRequired(true)),
            async execute(interaction, client, dbUser) {
                const User = client.schemas.get('Users');
                const author = interaction.user;
                const authorData = await User.findOne({ user_id: author.id });
                const sum = interaction.options.getInteger('сумма');

                // Проверка на активную дуэль
                if (activeDuels.has(author.id)) {
                    return interaction.reply({ 
                        content: '❌ У вас уже есть активная дуэль! Дождитесь её завершения.',
                        ephemeral: true 
                    });
                }
                
                if (sum <= 0) {
                    return interaction.reply({ 
                        content: '❌ Сумма дуэли должна быть положительным числом!', 
                        ephemeral: true 
                    });
                }

                // Проверка кулдауна
                const cooldownEnd = duelCooldowns.get(author.id);
                if (cooldownEnd && Date.now() < cooldownEnd) {
                    const remainingTime = Math.ceil((cooldownEnd - Date.now()) / 1000);
                    return interaction.reply({ 
                        content: `⏳ Подождите ${remainingTime} секунд перед следующей дуэлью!`,
                        ephemeral: true 
                    });
                }

                // Деактивируем предыдущие сообщения с дуэлями этого пользователя
                const previousMessage = activeDuelMessages.get(author.id);
                if (previousMessage) {
                    try {
                        await previousMessage.edit({
                            embeds: [{
                                title: 'Дуэль отменена',
                                description: 'Создана новая дуэль',
                                color: 0xFF0000,
                                timestamp: new Date().toISOString()
                            }],
                            components: []
                        });
                    } catch (error) {
                        console.error('Ошибка при деактивации предыдущей дуэли:', error);
                    }
                    activeDuelMessages.delete(author.id);
                }

                if (sum < 100) {
                    return interaction.reply({ content: 'Сумма дуэли должна быть больше 100', ephemeral: true });
                }

                if (authorData.balance < sum) {
                    const huy = {
                        title: 'Недостаточно средств!',
                        description: `У вас **недостаточно средств**\nНе хватает **${sum - authorData.balance}** ${client.emojis.zvezda}`,
                        thumbnail: {
                            url: author.displayAvatarURL({ dynamic: true })
                        },
                        timestamp: new Date().toISOString()
                    }

                    return interaction.reply({ embeds: [huy] });
                }

                // Устанавливаем активную дуэль
                activeDuels.set(author.id, true);

                const embed = {
                    title: 'Дуэль',
                    description: `<@${author.id}> создал дуэль на **${sum}** ${client.emojis.zvezda}`,
                    thumbnail: {
                        url: author.displayAvatarURL({ dynamic: true })
                    },
                    timestamp: new Date().toISOString()
                }

                const msg = await interaction.reply({ embeds: [embed] });

                // Сохраняем сообщение в Map активных дуэлей
                activeDuelMessages.set(author.id, msg);

                const states = ComponentState.createMany(['duel_accept'], {
                    author: author,
                    msg: msg,
                    sum: sum,
                    authorData: authorData,
                });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(states.duel_accept)
                        .setLabel('Принять')
                        .setEmoji('⚔️')
                        .setStyle(ButtonStyle.Success),
                );

                // Устанавливаем таймер на автоматическое удаление дуэли
                setTimeout(async () => {
                    if (activeDuels.has(author.id)) {
                        activeDuels.delete(author.id);
                        activeDuelMessages.delete(author.id);
                        try {
                            await msg.edit({ 
                                embeds: [{
                                    title: 'Дуэль отменена',
                                    description: 'Никто не принял вызов в течение 30 секунд',
                                    color: 0xFF0000,
                                    timestamp: new Date().toISOString()
                                }], 
                                components: [] 
                            });
                        } catch (error) {
                            console.error('Ошибка при отмене дуэли:', error);
                        }
                    }
                }, 30000); // 30 секунд на принятие дуэли

                await msg.edit({ components: [row] });
            }
        }
    ],
    // Экспортируем остальные утилиты
    activeDuels,
    duelCooldowns,
    COOLDOWN_TIME,
    activeDuelMessages
};