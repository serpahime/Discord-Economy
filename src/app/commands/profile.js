const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { spawn } = require('child_process');
const path = require('path');
const { title } = require('process');
const fs = require('fs').promises;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Профиль пользователя')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Пользователь')
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply();

        try {
            const embedload = {
                title: 'Загрузка...',
                description: 'Пожалуйста, подождите, пока профиль будет загружен...',
                color: 0x0099ff,
                thumbnail: {
                    url: interaction.user.displayAvatarURL({ extension: 'png', size: 256 })
                }
            }
            const msg = await interaction.editReply({ embeds: [embedload] });
            const user = interaction.options.getUser('user') || interaction.user;
            const member = await interaction.guild.members.fetch(user.id);
            const Users = client.schemas.get('Users');
            const Marry = client.schemas.get('Marry');
            const Clans = client.schemas.get('Clans');
            const userData = await Users.findOne({ user_id: user.id });
            
            // Получаем информацию о клане
            const clanData = await Clans.findOne({ 
                "members.userId": user.id  // Изменено с user_id на userId
            });

            let clanInfo = null;
            if (clanData) {
                const memberData = clanData.members.find(m => m.userId === user.id);  // Изменено с user_id на userId
                const roleTranslations = {
                    'member': 'Участник',
                    'helper': 'Помощник',
                    'assistant': 'Со-овнер',
                    'owner': 'Владелец'
                };
                
                clanInfo = {
                    name: clanData.name,  // Изменено с profile.name на name
                    role: roleTranslations[memberData.role] || 'Участник'
                };
            }

            // Получаем информацию о браке
            const marryData = await Marry.findOne({ users: user.id });
            let partnerData = null;
            
            if (marryData) {
                const partnerId = marryData.users.find(id => id !== user.id);
                const partner = await interaction.guild.members.fetch(partnerId).catch(() => null);
                if (partner) {
                    partnerData = {
                        name: partner.displayName,
                        avatar_url: partner.user.displayAvatarURL({ extension: 'png', size: 256 }),
                        days_together: Math.floor((Date.now() / 1000 - marryData.date) / (60 * 60 * 24))
                    };
                }
            }

            const currentExp = userData.experience || 0;
            const currentLevel = userData.level || 1;
            const requiredExp = 1000 * Math.pow(2, currentLevel - 1);
            const expToNextLevel = requiredExp - currentExp;

            const allUsers = await Users.find({}).sort({ 'online.online': -1 }).lean();
            const userIndex = allUsers.findIndex(u => u.user_id === user.id) + 1;

            // Подготавливаем данные для Python-скрипта
            const profileData = {
                user_id: user.id,
                avatar_url: user.displayAvatarURL({ extension: 'png', size: 256 }),
                display_name: member.displayName,
                status: member.presence?.status || 'offline',
                balance: userData.balance,
                online: userData.online.online,
                messages: userData.messages || 0,
                reputation: userData.reputation || 0,
                level: userData.level || 1,
                exp: userData.experience || 0,
                exp_to_next_level: requiredExp,
                partner: partnerData,
                clan: clanInfo,
                position: userIndex
            };

            // Запускаем Python-скрипт
            const pythonProcess = spawn('python', [
                path.join(__dirname, '../utils/profile_generator.py')
            ]);

            let result = '';
            let error = '';

            pythonProcess.stdout.on('data', (data) => {
                result += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                error += data.toString();
                console.error('Python error:', data.toString());
            });

            pythonProcess.stdin.write(JSON.stringify(profileData));
            pythonProcess.stdin.end();

            await new Promise((resolve, reject) => {
                pythonProcess.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Python process exited with code ${code}: ${error}`));
                });
            });

            const base64Image = result.trim();
            
            if (!base64Image || base64Image === 'None') {
                throw new Error('Failed to generate profile image');
            }

            // Декодируем base64 в буфер
            const imageBuffer = Buffer.from(base64Image, 'base64');

            // Отправляем изображение
            const components = [];
            const row = new ActionRowBuilder();

            if (clanInfo) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`clan_profile`)
                        .setLabel('Профиль клана')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            if (partnerData) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`love_profile`)
                        .setLabel('Любовный профиль')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            if (row.components.length > 0) {
                components.push(row);
            }

            await msg.edit({
                embeds: [],
                files: [{
                    attachment: imageBuffer,
                    name: 'profile.png'
                }],
                components: components
            });

            const collector = interaction.channel.createMessageComponentCollector({
                time: 25000
            });

            collector.on('collect', async (i) => {
                const customId = i.customId;

                if (customId === 'clan_profile') {
                    try {
                        // Используем ID пользователя, чей профиль просматриваем
                        const targetUser = interaction.options.getUser('user') || interaction.user;
                        const targetMember = await interaction.guild.members.fetch(targetUser.id);
                        
                        const clanData = await Clans.findOne({
                            "members.userId": targetUser.id  // Изменено с user_id на userId
                        });
                
                        if (!clanData) {
                            return i.reply({
                                content: 'Клан не найден',
                                ephemeral: true
                            });
                        }
                
                        // Получаем владельца и ассистентов
                        const owner = await interaction.guild.members.fetch(clanData.ownerId).catch(() => null);  // Изменено с owner_id на ownerId
                        
                        // Получаем всех ассистентов и сортируем по дате присоединения (берем первых 2)
                        const assistants = clanData.members
                            .filter(m => m.role === 'assistant')
                            .sort((a, b) => a.joinedAt - b.joinedAt)  // Сортировка по дате присоединения
                            .slice(0, 2); // Берем только первых двух по дате
                
                        // Получаем данные ассистентов
                        const assistantMembers = await Promise.all(
                            assistants.map(a => interaction.guild.members.fetch(a.userId).catch(() => null))  // Изменено с user_id на userId
                        );
                
                        // Считаем позицию клана по clanPoints (изменено с ok на clanPoints)
                        const allClans = await Clans.find({}).sort({ 'profile.clanPoints': -1 }).lean();
                        const clanPosition = allClans.findIndex(c => c._id.toString() === clanData._id.toString()) + 1;
                
                        // Подсчитываем количество участников
                        const membersCount = clanData.members.length;
                
                        // Подготавливаем данные для Python-скрипта
                        const clanProfileData = {
                            // Данные пользователя, чей профиль просматриваем
                            caller: {
                                id: targetUser.id,
                                name: targetMember.displayName,
                                avatar_url: targetUser.displayAvatarURL({ extension: 'png', size: 256 })
                            },
                            // Данные владельца
                            owner: owner ? {
                                id: owner.id,
                                name: owner.displayName,
                                avatar_url: owner.user.displayAvatarURL({ extension: 'png', size: 256 })
                            } : null,
                            // Данные ассистентов
                            assistants: assistantMembers.filter(Boolean).map(member => ({
                                id: member.id,
                                name: member.displayName,
                                avatar_url: member.user.displayAvatarURL({ extension: 'png', size: 256 })
                            })),
                            // Данные клана
                            clan: {
                                name: clanData.name,
                                description: clanData.profile.description,
                                members_count: membersCount,
                                online: clanData.profile.online,
                                balance: clanData.profile.balance,
                                ok: clanData.profile.clanPoints,  // Изменено с ok на clanPoints
                                level: clanData.profile.level,
                                position: clanPosition
                            }
                        };

                        // Запускаем Python-скрипт
                        const pythonProcess = spawn('python', [
                            path.join(__dirname, '../utils/clan_Profile.py')
                        ]);

                        let result = '';
                        let error = '';

                        pythonProcess.stdout.on('data', (data) => {
                            result += data.toString();
                        });

                        pythonProcess.stderr.on('data', (data) => {
                            error += data.toString();
                            console.error('Python error:', data.toString());
                        });

                        pythonProcess.stdin.write(JSON.stringify(clanProfileData));
                        pythonProcess.stdin.end();

                        await new Promise((resolve, reject) => {
                            pythonProcess.on('close', (code) => {
                                if (code === 0) resolve();
                                else reject(new Error(`Python process exited with code ${code}: ${error}`));
                            });
                        });

                        const base64Image = result.trim();
                        
                        if (!base64Image || base64Image === 'None') {
                            throw new Error('Failed to generate clan profile image');
                        }

                        // Декодируем base64 в буфер
                        const imageBuffer = Buffer.from(base64Image, 'base64');

                        const returnButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`return_profile:${targetUser.id}`)  // Добавляем ID целевого пользователя
                                .setLabel('Вернуться')
                                .setStyle(ButtonStyle.Secondary)
                        );

                        await i.deferUpdate();
                        // Отправляем изображение
                        await msg.edit({
                            files: [{
                                attachment: imageBuffer,
                                name: 'clan_profile.png'
                            }],
                            components: [returnButton]
                        });

                        const newcollector = interaction.channel.createMessageComponentCollector({
                            time: 25000
                        });

                        newcollector.on('collect', async (i) => {
                            const customId = i.customId;
                            if (interaction.user.id !== user.id) {
                                await i.reply({
                                    content: 'Вы не можете просматривать этот профиль',
                                    flags: ['Ephemeral']
                                })
                            }

                            if (customId === 'return_profile') {
                                if (interaction.user.id !== user.id) {
                                    return await i.reply({
                                        content: 'Вы не можете использовать эту кнопку',
                                        ephemeral: true
                                    });
                                }
            
                                // Получаем данные пользователя заново
                                const user = await interaction.guild.members.fetch(user.id);
                                const Users = client.schemas.get('Users');
                                const userData = await Users.findOne({ user_id: user.id });
                                
                                // Генерируем обычный профиль
                                const profileData = {
                                    user_id: user.id,
                                    avatar_url: user.user.displayAvatarURL({ extension: 'png', size: 256 }),
                                    display_name: user.displayName,
                                    status: user.presence?.status || 'offline',
                                    balance: userData.balance,
                                    online: userData.online.online,
                                    messages: userData.messages || 0,
                                    reputation: userData.reputation || 0,
                                    level: userData.level || 1,
                                    exp: userData.experience || 0,
                                    exp_to_next_level: requiredExp,
                                    partner: partnerData,
                                    clan: clanInfo,
                                    position: userIndex
                                };
            
                                // Запускаем Python-скрипт для генерации обычного профиля
                                const pythonProcess = spawn('python', [
                                    path.join(__dirname, '../utils/profile_generator.py')
                                ]);
            
                                let result = '';
                                let error = '';
            
                                pythonProcess.stdout.on('data', (data) => {
                                    result += data.toString();
                                });
            
                                pythonProcess.stderr.on('data', (data) => {
                                    error += data.toString();
                                });
            
                                pythonProcess.stdin.write(JSON.stringify(profileData));
                                pythonProcess.stdin.end();
            
                                await new Promise((resolve, reject) => {
                                    pythonProcess.on('close', (code) => {
                                        if (code === 0) resolve();
                                        else reject(new Error(`Python process exited with code ${code}: ${error}`));
                                    });
                                });
            
                                const base64Image = result.trim();
                                
                                if (!base64Image || base64Image === 'None') {
                                    throw new Error('Failed to generate profile image');
                                }
            
                                // Декодируем base64 в буфер
                                const imageBuffer = Buffer.from(base64Image, 'base64');
            
                                // Создаем кнопки для обычного профиля
                                const components = [];
                                const row = new ActionRowBuilder();
            
                                if (clanInfo) {
                                    row.addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`clan_profile`)
                                            .setLabel('Профиль клана')
                                            .setStyle(ButtonStyle.Secondary)
                                    );
                                }
            
                                if (partnerData) {
                                    row.addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`love_profile`)
                                            .setLabel('Любовный профиль')
                                            .setStyle(ButtonStyle.Secondary)
                                    );
                                }
            
                                if (row.components.length > 0) {
                                    components.push(row);
                                }
            
                                // Отправляем обычный профиль
                                await msg.edit({
                                    files: [{
                                        attachment: imageBuffer,
                                        name: 'profile.png'
                                    }],
                                    components: components
                                });
                            }
                        });

                    } catch (error) {
                        console.error('Error in clan profile generation:', error);
                        await i.editReply({
                            content: 'Произошла ошибка при создании профиля клана',
                            ephemeral: true
                        });
                    }
                }

                if (customId === 'love_profile') {
                    try {
                        // Используем ID пользователя, чей профиль просматриваем
                        const targetUser = interaction.options.getUser('user') || interaction.user;
                        const marryData = await Marry.findOne({
                            users: targetUser.id
                        });

                        if (!marryData) {
                            return i.reply({
                                content: 'Брак не найден',
                                ephemeral: true
                            });
                        }

                        // Получаем данные партнера относительно целевого пользователя
                        const partnerId = marryData.users.find(id => id !== targetUser.id);
                        const partner = await interaction.guild.members.fetch(partnerId).catch(() => null);
                        const targetMember = await interaction.guild.members.fetch(targetUser.id);

                        if (!partner) {
                            return i.reply({
                                content: 'Партнер не найден',
                                ephemeral: true
                            });
                        }

                        // Форматируем дату
                        const date = new Date(marryData.date * 1000);
                        const formattedDate = date.toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit'
                        });

                        // Подготавливаем данные для Python-скрипта с правильными пользователями
                        const loveProfileData = {
                            // Данные целевого пользователя
                            caller: {
                                id: targetUser.id,
                                name: targetMember.displayName,
                                avatar_url: targetUser.displayAvatarURL({ extension: 'png', size: 256 })
                            },
                            // Данные партнера
                            partner: {
                                id: partner.id,
                                name: partner.displayName,
                                avatar_url: partner.user.displayAvatarURL({ extension: 'png', size: 256 })
                            },
                            // Данные брака
                            marriage: {
                                balance: marryData.balance,
                                online: marryData.online,
                                date: formattedDate,
                                room_name: marryData.name_love_room
                            }
                        };

                        // Запускаем Python-скрипт
                        const pythonProcess = spawn('python', [
                            path.join(__dirname, '../utils/love_profile.py')
                        ]);

                        let result = '';
                        let error = '';

                        pythonProcess.stdout.on('data', (data) => {
                            result += data.toString();
                        });

                        pythonProcess.stderr.on('data', (data) => {
                            error += data.toString();
                            console.error('Python error:', data.toString());
                        });

                        pythonProcess.stdin.write(JSON.stringify(loveProfileData));
                        pythonProcess.stdin.end();

                        await new Promise((resolve, reject) => {
                            pythonProcess.on('close', (code) => {
                                if (code === 0) resolve();
                                else reject(new Error(`Python process exited with code ${code}: ${error}`));
                            });
                        });

                        const base64Image = result.trim();
                        
                        if (!base64Image || base64Image === 'None') {
                            throw new Error('Failed to generate love profile image');
                        }

                        // Декодируем base64 в буфер
                        const imageBuffer = Buffer.from(base64Image, 'base64');

                        const returnButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`return_profile:${targetUser.id}`)  // Добавляем ID целевого пользователя
                                .setLabel('Вернуться')
                                .setStyle(ButtonStyle.Secondary)
                        );

                        await i.deferUpdate();
                        await msg.edit({
                            files: [{
                                attachment: imageBuffer,
                                name: 'love_profile.png'
                            }],
                            components: [returnButton]
                        });

                        const newcollector = interaction.channel.createMessageComponentCollector({
                            time: 25000
                        });

                        newcollector.on('collect', async (i) => {
                            const [action, userId] = i.customId.split(':');
                            if (action === 'return_profile') {
                                await i.deferUpdate();

                                // Получаем данные целевого пользователя
                                const targetUser = await interaction.guild.members.fetch(userId);
                                const Users = client.schemas.get('Users');
                                const userData = await Users.findOne({ user_id: userId });

                                // Генерируем обычный профиль для целевого пользователя
                                const profileData = {
                                    user_id: targetUser.id,
                                    avatar_url: targetUser.user.displayAvatarURL({ extension: 'png', size: 256 }),
                                    display_name: targetUser.displayName,
                                    status: targetUser.presence?.status || 'offline',
                                    balance: userData.balance,
                                    online: userData.online.online,
                                    messages: userData.messages || 0,
                                    reputation: userData.reputation || 0,
                                    level: userData.level || 1,
                                    exp: userData.experience || 0,
                                    exp_to_next_level: requiredExp,
                                    partner: partnerData,
                                    clan: clanInfo,
                                    position: userIndex
                                };

                                // Запускаем Python-скрипт для генерации обычного профиля
                                const pythonProcess = spawn('python', [
                                    path.join(__dirname, '../utils/profile_generator.py')
                                ]);

                                let result = '';
                                let error = '';

                                pythonProcess.stdout.on('data', (data) => {
                                    result += data.toString();
                                });

                                pythonProcess.stderr.on('data', (data) => {
                                    error += data.toString();
                                });

                                pythonProcess.stdin.write(JSON.stringify(profileData));
                                pythonProcess.stdin.end();

                                await new Promise((resolve, reject) => {
                                    pythonProcess.on('close', (code) => {
                                        if (code === 0) resolve();
                                        else reject(new Error(`Python process exited with code ${code}: ${error}`));
                                    });
                                });

                                const base64Image = result.trim();
                                
                                if (!base64Image || base64Image === 'None') {
                                    throw new Error('Failed to generate profile image');
                                }

                                // Декодируем base64 в буфер
                                const imageBuffer = Buffer.from(base64Image, 'base64');

                                // Создаем кнопки для обычного профиля
                                const components = [];
                                const row = new ActionRowBuilder();

                                if (clanInfo) {
                                    row.addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`clan_profile`)
                                            .setLabel('Профиль клана')
                                            .setStyle(ButtonStyle.Secondary)
                                    );
                                }

                                if (partnerData) {
                                    row.addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`love_profile`)
                                            .setLabel('Любовный профиль')
                                            .setStyle(ButtonStyle.Secondary)
                                    );
                                }

                                if (row.components.length > 0) {
                                    components.push(row);
                                }

                                // Отправляем обычный профиль
                                await msg.edit({
                                    files: [{
                                        attachment: imageBuffer,
                                        name: 'profile.png'
                                    }],
                                    components: components
                                });
                            }
                        });

                    } catch (error) {
                        console.error('Error in love profile generation:', error);
                        await i.reply({
                            content: 'Произошла ошибка при создании любовного профиля',
                            ephemeral: true
                        });
                    }
                }
            });

        } catch (error) {
            console.error('Error in profile command:', error);
            await interaction.editReply({
                content: 'Произошла ошибка при создании профиля',
                ephemeral: true
            });
        }
    }
};