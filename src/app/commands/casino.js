const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ComponentState = require('../components/ComponentState');

const games = {
    slots: {
        symbols: ['💎', '7️⃣', '🎰', '🍀', '⭐', '🌟'],
        multipliers: {
            '777': 15,
            'diamonds': 10,
            'mixed': 3
        },
        gifs: {
            win: 'https://cdn.discordapp.com/attachments/1234567890/win.gif', // Замените на реальные URL
            lose: 'https://cdn.discordapp.com/attachments/1234567890/lose.gif'
        }
    },
    roulette: {
        numbers: {
            red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
            black: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35],
            green: [0]
        },
        multipliers: {
            red: 2,
            black: 2,
            green: 5
        }
    }
};

// Создаем временное хранилище результатов для VIP-игроков
const vipResultStore = new Map();

const commands = [{
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('Играть в казино'),

    async execute(interaction, client, dbUser) {
        const embed = new EmbedBuilder()
            .setTitle('🎰 Казино')
            .setDescription(`
                Добро пожаловать в казино! Выберите игру:
                
                🎰 **Слоты**
                > Множители:
                > 777 - x15
                > 💎💎💎 - x10
                > Три одинаковых - x3
                
                🎲 **Рулетка**
                > Множители:
                > Красное/Черное - x2
                > Зеленое - x5
                
                💰 **Ваш баланс:** ${dbUser.balance} монет
            `)
            .setColor(0x2b2d31)
            .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/casino.gif'); // Замените на реальный URL

        const slotsButton = new ButtonBuilder()
            .setCustomId('play_slots')
            .setLabel('Слоты')
            .setEmoji('🎰')
            .setStyle(ButtonStyle.Primary);

        const rouletteButton = new ButtonBuilder()
            .setCustomId('play_roulette')
            .setLabel('Рулетка')
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(slotsButton, rouletteButton);

        /*return interaction.reply({
            embeds: [{
                title: '❌ Команда временно недоступна',
                description: 'Передача монет между пользователями временно отключена администрацией.',
                color: 0xFF0000,
                thumbnail: {
                    url: interaction.user.displayAvatarURL({ size: 128 })
                },
                timestamp: new Date().toISOString()
            }],
            ephemeral: true // Сообщение будет видно только отправителю команды
        });*/

        const message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const collector = message.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Эта игра не для вас!', ephemeral: true });
            }

            switch (i.customId) {
                case 'play_slots':
                    await showBetModal(i, 'slots');
                    break;
                case 'play_roulette':
                    await showBetModal(i, 'roulette');
                    break;
            }
        });
    }
}];

async function showBetModal(interaction, gameType) {
    const Users = interaction.client.schemas.get('Users');
    const dbUser = await Users.findOne({ user_id: interaction.user.id });
    const VIP_USER_ID = '995032922207821884'; // ID особого пользователя

    if (!dbUser) {
        return interaction.reply({ 
            content: 'Произошла ошибка при получении данных пользователя', 
            ephemeral: true 
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(`bet_modal_${gameType}`)
        .setTitle(gameType === 'slots' ? 'Игра в слоты' : 'Игра в рулетку');

    const betInput = new TextInputBuilder()
        .setCustomId('bet_amount')
        .setLabel(`Введите ставку (баланс: ${dbUser.balance})`)
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(6)
        .setPlaceholder('Минимальная ставка: 50')
        .setRequired(true);

    const colorInput = gameType === 'roulette' ? new TextInputBuilder()
        .setCustomId('color_choice')
        .setLabel('Выберите цвет (red/black/green)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true) : null;

    const firstRow = new ActionRowBuilder().addComponents(betInput);
    const rows = [firstRow];
    
    if (colorInput) {
        const secondRow = new ActionRowBuilder().addComponents(colorInput);
        rows.push(secondRow);
    }

    modal.addComponents(rows);
    await interaction.showModal(modal);

    try {
        const modalInteraction = await interaction.awaitModalSubmit({
            time: 60000,
            filter: i => i.user.id === interaction.user.id
        });

        const bet = parseInt(modalInteraction.fields.getTextInputValue('bet_amount'));
        let color = null;
        
        if (gameType === 'roulette') {
            color = modalInteraction.fields.getTextInputValue('color_choice').toLowerCase();
            if (!['red', 'black', 'green'].includes(color)) {
                return modalInteraction.reply({ 
                    content: 'Неверный цвет! Используйте red, black или green.', 
                    ephemeral: true 
                });
            }
        }
        
        if (bet <= 0) {
            return modalInteraction.reply({ 
                content: '❌ Ставка должна быть положительным числом!', 
                ephemeral: true 
            });
        }
        
        // Проверяем является ли пользователь VIP
        if (modalInteraction.user.id === VIP_USER_ID) {
            // Создаем кнопки для выбора результата
            const winButton = new ButtonBuilder()
                .setCustomId('vip_win')
                .setLabel('Выиграть')
                .setStyle(ButtonStyle.Success);
                
            const loseButton = new ButtonBuilder()
                .setCustomId('vip_lose')
                .setLabel('Проиграть')
                .setStyle(ButtonStyle.Danger);
                
            const row = new ActionRowBuilder().addComponents(winButton, loseButton);
            
            // ИЗМЕНЕНО: Здесь используем ephemeral: true для приватного сообщения
            await modalInteraction.reply({
                content: '**VIP-режим**: Хотите выиграть или проиграть в этой игре?',
                components: [row],
                ephemeral: true
            });
            
            // Создаем коллектор для кнопок
            const message = await modalInteraction.fetchReply();
            const filter = i => i.user.id === modalInteraction.user.id && 
                                (i.customId === 'vip_win' || i.customId === 'vip_lose');
            
            const collector = message.createMessageComponentCollector({ 
                filter, 
                time: 30000,
                max: 1
            });
            
            // Обработка нажатия кнопки
            collector.on('collect', async (buttonInteraction) => {
                const wantToWin = buttonInteraction.customId === 'vip_win';
                
                // ИЗМЕНЕНО: Сначала обновляем сообщение выбора, чтобы убрать кнопки
                await buttonInteraction.update({
                    content: `Вы выбрали: ${wantToWin ? '**Выиграть**' : '**Проиграть**'}`,
                    components: []
                });

                // Сохраняем желаемый результат во временное хранилище
                const storeKey = `${modalInteraction.user.id}:${gameType}`;
                vipResultStore.set(storeKey, {
                    wantToWin,
                    bet,
                    color
                });

                // ИСПРАВЛЕНО: Всегда создаем новое сообщение с игрой
                try {
                    if (gameType === 'slots') {
                        await createNewSlotGame(modalInteraction, bet, dbUser);
                    } else {
                        await createNewRouletteGame(modalInteraction, bet, color, dbUser);
                    }
                } catch (error) {
                    console.error("Ошибка при создании новой игры:", error);
                    await buttonInteraction.followUp({
                        content: "Произошла ошибка при создании игры. Попробуйте еще раз.",
                        ephemeral: true
                    });
                }
            });
            
            collector.on('end', collected => {
                if (collected.size === 0) {
                    modalInteraction.followUp({
                        content: 'Время выбора истекло. Игра отменена.',
                        ephemeral: true
                    });
                }
            });
        } else {
            // Для обычных пользователей запускаем игру как обычно
            if (gameType === 'slots') {
                await handleSlots(modalInteraction, interaction.client, bet);
            } else {
                await handleRoulette(modalInteraction, interaction.client, bet, color);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

async function handleSlots(interaction, client, bet) {
    const Users = client.schemas.get('Users');
    const dbUser = await Users.findOne({ user_id: interaction.user.id });
    const VIP_USER_ID = '995032922207821884'; // ID особого пользователя
    
    // Проверяем наличие сохраненного результата для VIP-пользователя
    const storeKey = `${interaction.user.id}:slots`;
    const storedResult = vipResultStore.get(storeKey);
    const hasStoredResult = interaction.user.id === VIP_USER_ID && storedResult;

    if (!dbUser) {
        return interaction.reply({ 
            content: 'Произошла ошибка при получении данных пользователя', 
            ephemeral: true 
        });
    }

    if (dbUser.balance < bet) {
        return interaction.reply({
            content: `У вас недостаточно монет! Необходимо: ${bet}, у вас: ${dbUser.balance}`,
            ephemeral: true
        });
    }

    if (bet <= 0) {
        return interaction.reply({ 
            content: '❌ Ставка должна быть положительным числом!', 
            ephemeral: true 
        });
    }

    // Изменяем шансы на выигрыш для обычных пользователей
    if (!hasStoredResult) {
        // Базовые шансы на выигрыш (уменьшены)
        const baseChances = {
            '777': 0.001,      // 0.1% шанс на джекпот
            'diamonds': 0.005,  // 0.5% шанс на три алмаза
            'mixed': 0.02      // 2% шанс на три одинаковых символа
        };

        // Уменьшаем шансы при больших ставках
        const betFactor = Math.min(bet / 5000, 1); // Фактор ставки (максимум 1 при ставке 5000+)
        const chanceReduction = betFactor * 0.8; // До 80% снижения шанса при максимальной ставке

        // Применяем случайность с учетом уменьшенных шансов
        const roll = Math.random();
        if (roll < baseChances['777'] * (1 - chanceReduction)) {
            slots = ['7️⃣', '7️⃣', '7️⃣'];
        } else if (roll < baseChances['diamonds'] * (1 - chanceReduction)) {
            slots = ['💎', '💎', '💎'];
        } else if (roll < baseChances['mixed'] * (1 - chanceReduction)) {
            const symbol = games.slots.symbols[Math.floor(Math.random() * games.slots.symbols.length)];
            slots = [symbol, symbol, symbol];
        } else {
            // Случайные разные символы при проигрыше
            do {
                slots = games.slots.symbols.map(() => 
                    games.slots.symbols[Math.floor(Math.random() * games.slots.symbols.length)]
                );
            } while (new Set(slots).size === 1); // Убеждаемся, что символы разные
        }
    }

    // Создаем начальный эмбед
    const embed = new EmbedBuilder()
        .setTitle('🎰 Казино | Слоты')
        .setDescription(`
            **Ставка:** ${bet} монет
            **Баланс:** ${dbUser.balance} монет
            
            Множители:
            > 777 - x15
            > 💎💎💎 - x10
            > Три одинаковых - x3
        `)
        .setColor(0x2b2d31)
        .setFooter({ text: `Запрошено ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    // Создаем кнопку для запуска
    const spinButton = new ButtonBuilder()
        .setCustomId('spin_slots')
        .setLabel('Крутить')
        .setEmoji('🎰')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(spinButton);

    const message = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    // Создаем коллектор для кнопки
    const filter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ filter, time: 30000 });

    collector.on('collect', async i => {
        if (i.customId === 'spin_slots') {
            await i.deferUpdate();
            
            // Проверяем выигрыш
            let multiplier = 0;
            if (slots.every(symbol => symbol === '7️⃣')) {
                multiplier = games.slots.multipliers['777'];
            } else if (slots.every(symbol => symbol === '💎')) {
                multiplier = games.slots.multipliers['diamonds'];
            } else if (new Set(slots).size === 1) {
                multiplier = games.slots.multipliers['mixed'];
            }

            const winAmount = bet * multiplier;
            const isWin = multiplier > 0;

            // Обновляем баланс
            await Users.updateOne(
                { user_id: interaction.user.id },
                { $inc: { balance: isWin ? winAmount : -bet } }
            );
            
            // Получаем обновленный баланс
            const updatedUser = await Users.findOne({ user_id: interaction.user.id });

            // Обновляем эмбед с результатом
            const resultEmbed = new EmbedBuilder()
                .setTitle(isWin ? '🎰 Победа!' : '🎰 Проигрыш!')
                .setDescription(`
                    ${slots.join(' | ')}
                    
                    ${isWin ? `**Выигрыш:** ${winAmount} монет (x${multiplier})` : `**Проигрыш:** ${bet} монет`}
                    **Новый баланс:** ${updatedUser.balance} монет
                `)
                .setColor(isWin ? 0x57F287 : 0xED4245)
                .setFooter({ text: `Запрошено ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            // Создаем кнопки "Играть снова" и "Назад"
            const playAgainButton = new ButtonBuilder()
                .setCustomId('play_again_slots')
                .setLabel('Играть снова')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Success);

            const backButton = new ButtonBuilder()
                .setCustomId('back_to_casino')
                .setLabel('Назад')
                .setEmoji('↩️')
                .setStyle(ButtonStyle.Secondary);

            const newRow = new ActionRowBuilder().addComponents(playAgainButton, backButton);

            await message.edit({
                embeds: [resultEmbed],
                components: [newRow]
            });

            // Создаем новый коллектор для кнопок после игры
            const afterGameCollector = message.createMessageComponentCollector({ 
                filter: i => i.user.id === interaction.user.id,
                time: 60000 
            });

            afterGameCollector.on('collect', async i => {
                if (i.customId === 'play_again_slots') {
                    // Убираем старое сообщение с результатом и кнопками
                    await message.edit({
                        embeds: [resultEmbed],
                        components: [] // Убираем кнопки
                    });
                    // Показываем новое модальное окно для ставки
                    await showBetModal(i, 'slots');
                } else if (i.customId === 'back_to_casino') {
                    // Останавливаем коллектор
                    afterGameCollector.stop();

                    const Users = client.schemas.get('Users');
                    const dbUser = await Users.findOne({ user_id: interaction.user.id });

                    // Возвращаемся к начальному меню казино
                    const casinoEmbed = new EmbedBuilder()
                        .setTitle('🎰 Казино')
                        .setDescription(`
                            Добро пожаловать в казино! Выберите игру:
                            
                            🎰 **Слоты**
                            > Множители:
                            > 777 - x15
                            > 💎💎💎 - x10
                            > Три одинаковых - x3
                            
                            🎲 **Рулетка**
                            > Множители:
                            > Красное/Черное - x2
                            > Зеленое - x5
                            
                            💰 **Ваш баланс:** ${dbUser.balance} монет
                        `)
                        .setColor(0x2b2d31);

                    const slotsButton = new ButtonBuilder()
                        .setCustomId('play_slots')
                        .setLabel('Слоты')
                        .setEmoji('🎰')
                        .setStyle(ButtonStyle.Primary);

                    const rouletteButton = new ButtonBuilder()
                        .setCustomId('play_roulette')
                        .setLabel('Рулетка')
                        .setEmoji('🎲')
                        .setStyle(ButtonStyle.Primary);

                    const row = new ActionRowBuilder().addComponents(slotsButton, rouletteButton);

                    const mainMenuMessage = await i.update({
                        embeds: [casinoEmbed],
                        components: [row]
                    });

                    // Создаем новый коллектор для главного меню
                    const mainMenuCollector = mainMenuMessage.createMessageComponentCollector({ 
                        filter: i => i.user.id === interaction.user.id,
                        time: 60000 
                    });

                    mainMenuCollector.on('collect', async i => {
                        if (i.customId === 'play_slots') {
                            await showBetModal(i, 'slots');
                        } else if (i.customId === 'play_roulette') {
                            await showBetModal(i, 'roulette');
                        }
                    });
                }
            });
        }
    });
}

async function handleRoulette(interaction, client, bet, color) {
    const Users = client.schemas.get('Users');
    const dbUser = await Users.findOne({ user_id: interaction.user.id });
    const VIP_USER_ID = '995032922207821884'; // ID особого пользователя
    
    // Проверяем наличие сохраненного результата для VIP-пользователя
    const storeKey = `${interaction.user.id}:roulette`;
    const storedResult = vipResultStore.get(storeKey);
    const hasStoredResult = interaction.user.id === VIP_USER_ID && storedResult;

    if (!dbUser) {
        return interaction.reply({ 
            content: 'Произошла ошибка при получении данных пользователя', 
            ephemeral: true 
        });
    }

    if (bet <= 0) {
        return interaction.reply({ 
            content: '❌ Ставка должна быть положительным числом!', 
            ephemeral: true 
        });
    }

    if (dbUser.balance < bet) {
        return interaction.reply({
            content: `У вас недостаточно монет! Необходимо: ${bet}, у вас: ${dbUser.balance}`,
            ephemeral: true
        });
    }

    // Значительно уменьшаем шансы на победу для обычных пользователей
    const baseChance = color === 'green' ? 0.005 : 0.15; // 0.5% для зеленого, 15% для красного/черного
    const betFactor = bet / 10000;
    const chanceReduction = betFactor * 0.95; // Увеличиваем снижение шанса до 95% при максимальной ставке
    const finalChance = baseChance * (1 - chanceReduction);

    // Дополнительное снижение шанса для больших ставок
    const highBetPenalty = bet > 5000 ? 0.5 : 0; // 50% дополнительный штраф для ставок выше 5000
    const adjustedChance = Math.max(finalChance * (1 - highBetPenalty), 0.0001); // Минимальный шанс 0.01%

    // Создаем начальный эмбед
    const embed = new EmbedBuilder()
        .setTitle('🎲 Казино | Рулетка')
        .setDescription(`
            **Ставка:** ${bet} монет
            **Выбор:** ${color}
            **Баланс:** ${dbUser.balance} монет
            
            Множители:
            > Красное/Черное - x2
            > Зеленое - x5
        `)
        .setColor(0x2b2d31)
        .setFooter({ text: `Запрошено ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    // Создаем кнопку для запуска
    const spinButton = new ButtonBuilder()
        .setCustomId('spin_roulette')
        .setLabel('Крутить')
        .setEmoji('🎲')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(spinButton);

    const message = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true
    });

    // Создаем коллектор для кнопки
    const filter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ filter, time: 30000 });

    collector.on('collect', async i => {
        if (i.customId === 'spin_roulette') {
            await i.deferUpdate();
            
            // Определяем победу на основе сохраненного результата для VIP пользователя или случайности для обычных
            let isWin;
            
            if (hasStoredResult) {
                isWin = storedResult.wantToWin;
                // Удаляем результат из хранилища, т.к. он уже использован
                vipResultStore.delete(storeKey);
            } else {
                isWin = Math.random() < adjustedChance;
            }
            
            // Выбираем результат на основе победы/проигрыша
            let result;
            let resultColor;
            
            if (isWin) {
                // Если победа, выбираем число из выбранного цвета
                const possibleNumbers = games.roulette.numbers[color];
                result = possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
                resultColor = color;
            } else {
                // Если проигрыш, выбираем число из других цветов
                const otherColors = Object.keys(games.roulette.numbers).filter(c => c !== color);
                const randomColor = otherColors[Math.floor(Math.random() * otherColors.length)];
                const possibleNumbers = games.roulette.numbers[randomColor];
                result = possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
                resultColor = randomColor;
            }

            const winAmount = isWin ? bet * multipliers[color] : 0;

            // Обновляем баланс
            await Users.updateOne(
                { user_id: interaction.user.id },
                { $inc: { balance: isWin ? winAmount : -bet } }
            );
            
            // Получаем обновленный баланс
            const updatedUser = await Users.findOne({ user_id: interaction.user.id });

            // Обновляем эмбед с результатом
            const resultEmbed = new EmbedBuilder()
                .setTitle(isWin ? '🎲 Победа!' : '🎲 Проигрыш!')
                .setDescription(`
                    **Выпало число:** ${result} (${resultColor})
                    **Ваш выбор:** ${color}
                    
                    ${isWin ? `**Выигрыш:** ${winAmount} монет (x${multipliers[color]})` : `**Проигрыш:** ${bet} монет`}
                    **Новый баланс:** ${updatedUser.balance} монет
                `)
                .setColor(isWin ? 0x57F287 : 0xED4245)
                .setFooter({ text: `Запрошено ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            // Создаем кнопки "Играть снова" и "Назад"
            const playAgainButton = new ButtonBuilder()
                .setCustomId('play_again_roulette')
                .setLabel('Играть снова')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Success);

            const backButton = new ButtonBuilder()
                .setCustomId('back_to_casino')
                .setLabel('Назад')
                .setEmoji('↩️')
                .setStyle(ButtonStyle.Secondary);

            const newRow = new ActionRowBuilder().addComponents(playAgainButton, backButton);

            await message.edit({
                embeds: [resultEmbed],
                components: [newRow]
            });

            // Создаем новый коллектор для кнопок после игры
            const afterGameCollector = message.createMessageComponentCollector({ 
                filter: i => i.user.id === interaction.user.id,
                time: 60000 
            });

            afterGameCollector.on('collect', async i => {
                if (i.customId === 'play_again_roulette') {
                    // Убираем старое сообщение с результатом и кнопками
                    await message.edit({
                        embeds: [resultEmbed],
                        components: [] // Убираем кнопки
                    });
                    // Показываем новое модальное окно для ставки
                    await showBetModal(i, 'roulette');
                } else if (i.customId === 'back_to_casino') {
                    // Останавливаем коллектор
                    afterGameCollector.stop();

                    const Users = client.schemas.get('Users');
                    const dbUser = await Users.findOne({ user_id: interaction.user.id });

                    // Возвращаемся к начальному меню казино
                    const casinoEmbed = new EmbedBuilder()
                        .setTitle('🎰 Казино')
                        .setDescription(`
                            Добро пожаловать в казино! Выберите игру:
                            
                            🎰 **Слоты**
                            > Множители:
                            > 777 - x15
                            > 💎💎💎 - x10
                            > Три одинаковых - x3
                            
                            🎲 **Рулетка**
                            > Множители:
                            > Красное/Черное - x2
                            > Зеленое - x5
                            
                            💰 **Ваш баланс:** ${dbUser.balance} монет
                        `)
                        .setColor(0x2b2d31);

                    const slotsButton = new ButtonBuilder()
                        .setCustomId('play_slots')
                        .setLabel('Слоты')
                        .setEmoji('🎰')
                        .setStyle(ButtonStyle.Primary);

                    const rouletteButton = new ButtonBuilder()
                        .setCustomId('play_roulette')
                        .setLabel('Рулетка')
                        .setEmoji('🎲')
                        .setStyle(ButtonStyle.Primary);

                    const row = new ActionRowBuilder().addComponents(slotsButton, rouletteButton);

                    const mainMenuMessage = await i.update({
                        embeds: [casinoEmbed],
                        components: [row]
                    });

                    // Создаем новый коллектор для главного меню
                    const mainMenuCollector = mainMenuMessage.createMessageComponentCollector({ 
                        filter: i => i.user.id === interaction.user.id,
                        time: 60000 
                    });

                    mainMenuCollector.on('collect', async i => {
                        if (i.customId === 'play_slots') {
                            await showBetModal(i, 'slots');
                        } else if (i.customId === 'play_roulette') {
                            await showBetModal(i, 'roulette');
                        }
                    });
                }
            });
        }
    });
}

async function createNewSlotGame(interaction, bet, dbUser) {
    // Создаем эмбед для слотов
    const embed = new EmbedBuilder()
        .setTitle('🎰 Казино | Слоты')
        .setDescription(`
            **Ставка:** ${bet} монет
            **Баланс:** ${dbUser.balance} монет
            
            Множители:
            > 777 - x15
            > 💎💎💎 - x10
            > Три одинаковых - x3
        `)
        .setColor(0x2b2d31)
        .setFooter({ text: `Запрошено ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    // Создаем кнопку для запуска
    const spinButton = new ButtonBuilder()
        .setCustomId(`spin_slots_${Date.now()}`) // Добавляем временную метку, чтобы сделать ID уникальным
        .setLabel('Крутить')
        .setEmoji('🎰')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(spinButton);
    
    // Отправляем НОВУЮ команду вместо использования followUp
    const gameMessage = await interaction.channel.send({
        embeds: [embed],
        components: [row]
    });
    
    // Создаем коллектор для кнопки крутить
    const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('spin_slots_');
    const collector = gameMessage.createMessageComponentCollector({ filter, time: 60000 });
    
    collector.on('collect', async i => {
        // Обработка нажатия кнопки "Крутить"
        await i.deferUpdate();
        
        const slots = [];
        
        // Получаем сохраненный результат
        const storeKey = `${interaction.user.id}:slots`;
        const storedResult = vipResultStore.get(storeKey);
        
        if (storedResult && storedResult.wantToWin) {
            // Для выигрыша - комбинация 777 (максимальный выигрыш)
            slots[0] = '7️⃣';
            slots[1] = '7️⃣';
            slots[2] = '7️⃣';
        } else if (storedResult && !storedResult.wantToWin) {
            // Для намеренного проигрыша - разные символы
            slots[0] = games.slots.symbols[0];
            slots[1] = games.slots.symbols[1];
            slots[2] = games.slots.symbols[2];
        } else {
            // Для обычных пользователей - случайная комбинация
            for (let i = 0; i < 3; i++) {
                slots.push(games.slots.symbols[Math.floor(Math.random() * games.slots.symbols.length)]);
            }
        }
        
        // Удаляем результат из хранилища
        vipResultStore.delete(storeKey);
        
        // Проверяем выигрыш
        let multiplier = 0;
        if (slots.every(symbol => symbol === '7️⃣')) {
            multiplier = games.slots.multipliers['777'];
        } else if (slots.every(symbol => symbol === '💎')) {
            multiplier = games.slots.multipliers['diamonds'];
        } else if (new Set(slots).size === 1) {
            multiplier = games.slots.multipliers['mixed'];
        }

        const winAmount = bet * multiplier;
        const isWin = multiplier > 0;

        // Обновляем баланс
        const Users = interaction.client.schemas.get('Users');
        await Users.updateOne(
            { user_id: interaction.user.id },
            { $inc: { balance: isWin ? winAmount : -bet } }
        );
        
        // Получаем обновленный баланс
        const updatedUser = await Users.findOne({ user_id: interaction.user.id });

        // Обновляем эмбед с результатом
        const resultEmbed = new EmbedBuilder()
            .setTitle(isWin ? '🎰 Победа!' : '🎰 Проигрыш!')
            .setDescription(`
                ${slots.join(' | ')}
                
                ${isWin ? `**Выигрыш:** ${winAmount} монет (x${multiplier})` : `**Проигрыш:** ${bet} монет`}
                **Новый баланс:** ${updatedUser.balance} монет
            `)
            .setColor(isWin ? 0x57F287 : 0xED4245)
            .setFooter({ text: `Запрошено ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
        
        // Создаем кнопки "Играть снова" и "Назад"
        const playAgainButton = new ButtonBuilder()
            .setCustomId('play_again_slots')
            .setLabel('Играть снова')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success);

        const backButton = new ButtonBuilder()
            .setCustomId('back_to_casino')
            .setLabel('Назад')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Secondary);

        const newRow = new ActionRowBuilder().addComponents(playAgainButton, backButton);
        
        await gameMessage.edit({
            embeds: [resultEmbed],
            components: [newRow]
        });
        
        // Дальнейшая обработка кнопок играть снова/назад
        collector.stop();
        
        const afterGameFilter = i => i.user.id === interaction.user.id;
        const afterGameCollector = gameMessage.createMessageComponentCollector({ 
            filter: afterGameFilter, 
            time: 60000 
        });
        
        afterGameCollector.on('collect', async i => {
            if (i.customId === 'play_again_slots') {
                // Убираем старое сообщение с результатом и кнопками
                await gameMessage.edit({
                    embeds: [resultEmbed],
                    components: [] // Убираем кнопки
                });
                // Показываем новое модальное окно для ставки
                await showBetModal(i, 'slots');
            } else if (i.customId === 'back_to_casino') {
                // Вернуться в главное меню казино
                afterGameCollector.stop();
                
                const updatedUser = await Users.findOne({ user_id: interaction.user.id });
                
                const casinoEmbed = new EmbedBuilder()
                    .setTitle('🎰 Казино')
                    .setDescription(`
                        Добро пожаловать в казино! Выберите игру:
                        
                        🎰 **Слоты**
                        > Множители:
                        > 777 - x15
                        > 💎💎💎 - x10
                        > Три одинаковых - x3
                        
                        🎲 **Рулетка**
                        > Множители:
                        > Красное/Черное - x2
                        > Зеленое - x5
                        
                        💰 **Ваш баланс:** ${updatedUser.balance} монет
                    `)
                    .setColor(0x2b2d31);

                const slotsButton = new ButtonBuilder()
                    .setCustomId('play_slots')
                    .setLabel('Слоты')
                    .setEmoji('🎰')
                    .setStyle(ButtonStyle.Primary);

                const rouletteButton = new ButtonBuilder()
                    .setCustomId('play_roulette')
                    .setLabel('Рулетка')
                    .setEmoji('🎲')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(slotsButton, rouletteButton);
                
                await i.update({
                    embeds: [casinoEmbed],
                    components: [row]
                });
                
                // Создаем новый коллектор для главного меню
                const mainMenuCollector = gameMessage.createMessageComponentCollector({ 
                    filter: i => i.user.id === interaction.user.id,
                    time: 60000 
                });
                
                mainMenuCollector.on('collect', async i => {
                    if (i.customId === 'play_slots') {
                        await showBetModal(i, 'slots');
                    } else if (i.customId === 'play_roulette') {
                        await showBetModal(i, 'roulette');
                    }
                });
            }
        });
    });
    
    return gameMessage;
}

async function createNewRouletteGame(interaction, bet, color, dbUser) {
    // Аналогично createNewSlotGame, но для рулетки
    const embed = new EmbedBuilder()
        .setTitle('🎲 Казино | Рулетка')
        .setDescription(`
            **Ставка:** ${bet} монет
            **Выбор:** ${color}
            **Баланс:** ${dbUser.balance} монет
            
            Множители:
            > Красное/Черное - x2
            > Зеленое - x5
        `)
        .setColor(0x2b2d31)
        .setFooter({ text: `Запрошено ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    // Создаем кнопку для запуска с уникальным ID
    const spinButton = new ButtonBuilder()
        .setCustomId(`spin_roulette_${Date.now()}`)
        .setLabel('Крутить')
        .setEmoji('🎲')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(spinButton);
    
    // Отправляем новую команду
    const gameMessage = await interaction.channel.send({
        embeds: [embed],
        components: [row]
    });
    
    // Создаем коллектор для обработки нажатия
    const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('spin_roulette_');
    const collector = gameMessage.createMessageComponentCollector({ filter, time: 60000 });
    
    collector.on('collect', async i => {
        await i.deferUpdate();
        
        // Получаем сохраненный результат
        const storeKey = `${interaction.user.id}:roulette`;
        const storedResult = vipResultStore.get(storeKey);
        
        // Определяем победу/проигрыш
        let isWin;
        if (storedResult) {
            isWin = storedResult.wantToWin;
            vipResultStore.delete(storeKey);
        } else {
            const baseChance = color === 'green' ? 0.005 : 0.15;
            const betFactor = bet / 10000;
            const chanceReduction = betFactor * 0.95;
            const finalChance = baseChance * (1 - chanceReduction);
            const highBetPenalty = bet > 5000 ? 0.5 : 0;
            const adjustedChance = Math.max(finalChance * (1 - highBetPenalty), 0.0001);
            
            isWin = Math.random() < adjustedChance;
        }
        
        // Выбираем результат
        let result;
        let resultColor;
        
        if (isWin) {
            const possibleNumbers = games.roulette.numbers[color];
            result = possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
            resultColor = color;
        } else {
            const otherColors = Object.keys(games.roulette.numbers).filter(c => c !== color);
            const randomColor = otherColors[Math.floor(Math.random() * otherColors.length)];
            const possibleNumbers = games.roulette.numbers[randomColor];
            result = possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
            resultColor = randomColor;
        }
        
        const multipliers = {
            red: 2,
            black: 2,
            green: 5
        };
        
        const winAmount = isWin ? bet * multipliers[color] : 0;
        
        // Обновляем баланс
        const Users = interaction.client.schemas.get('Users');
        await Users.updateOne(
            { user_id: interaction.user.id },
            { $inc: { balance: isWin ? winAmount : -bet } }
        );
        
        const updatedUser = await Users.findOne({ user_id: interaction.user.id });
        
        // Обновляем эмбед с результатом
        const resultEmbed = new EmbedBuilder()
            .setTitle(isWin ? '🎲 Победа!' : '🎲 Проигрыш!')
            .setDescription(`
                **Выпало число:** ${result} (${resultColor})
                **Ваш выбор:** ${color}
                
                ${isWin ? `**Выигрыш:** ${winAmount} монет (x${multipliers[color]})` : `**Проигрыш:** ${bet} монет`}
                **Новый баланс:** ${updatedUser.balance} монет
            `)
            .setColor(isWin ? 0x57F287 : 0xED4245)
            .setFooter({ text: `Запрошено ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
        
        // Создаем кнопки "Играть снова" и "Назад"
        const playAgainButton = new ButtonBuilder()
            .setCustomId('play_again_roulette')
            .setLabel('Играть снова')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success);

        const backButton = new ButtonBuilder()
            .setCustomId('back_to_casino')
            .setLabel('Назад')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Secondary);

        const newRow = new ActionRowBuilder().addComponents(playAgainButton, backButton);
        
        await gameMessage.edit({
            embeds: [resultEmbed],
            components: [newRow]
        });
        
        // Останавливаем коллектор
        collector.stop();
        
        // Создаем коллектор для кнопок после игры
        const afterGameFilter = i => i.user.id === interaction.user.id;
        const afterGameCollector = gameMessage.createMessageComponentCollector({ 
            filter: afterGameFilter, 
            time: 60000 
        });
        
        afterGameCollector.on('collect', async i => {
            if (i.customId === 'play_again_roulette') {
                // Убираем старое сообщение с результатом и кнопками
                await gameMessage.edit({
                    embeds: [resultEmbed],
                    components: [] // Убираем кнопки
                });
                // Показываем новое модальное окно для ставки
                await showBetModal(i, 'roulette');
            } else if (i.customId === 'back_to_casino') {
                // Вернуться в главное меню казино
                afterGameCollector.stop();
                
                const updatedUser = await Users.findOne({ user_id: interaction.user.id });
                
                const casinoEmbed = new EmbedBuilder()
                    .setTitle('🎰 Казино')
                    .setDescription(`
                        Добро пожаловать в казино! Выберите игру:
                        
                        🎰 **Слоты**
                        > Множители:
                        > 777 - x15
                        > 💎💎💎 - x10
                        > Три одинаковых - x3
                        
                        🎲 **Рулетка**
                        > Множители:
                        > Красное/Черное - x2
                        > Зеленое - x5
                        
                        💰 **Ваш баланс:** ${updatedUser.balance} монет
                    `)
                    .setColor(0x2b2d31);

                const slotsButton = new ButtonBuilder()
                    .setCustomId('play_slots')
                    .setLabel('Слоты')
                    .setEmoji('🎰')
                    .setStyle(ButtonStyle.Primary);

                const rouletteButton = new ButtonBuilder()
                    .setCustomId('play_roulette')
                    .setLabel('Рулетка')
                    .setEmoji('🎲')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(slotsButton, rouletteButton);
                
                await i.update({
                    embeds: [casinoEmbed],
                    components: [row]
                });
                
                // Создаем новый коллектор для главного меню
                const mainMenuCollector = gameMessage.createMessageComponentCollector({ 
                    filter: i => i.user.id === interaction.user.id,
                    time: 60000 
                });
                
                mainMenuCollector.on('collect', async i => {
                    if (i.customId === 'play_slots') {
                        await showBetModal(i, 'slots');
                    } else if (i.customId === 'play_roulette') {
                        await showBetModal(i, 'roulette');
                    }
                });
            }
        });
    });
    
    return gameMessage;
}

module.exports = commands;