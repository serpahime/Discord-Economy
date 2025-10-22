const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');
const { price, create, cfg } = require('../../cfg');

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('marry')
            .setDescription('Создать брак')
            .addUserOption(option => option.setName('пользователь').setDescription('Пользователь').setRequired(true)),
        async execute(interaction, client) {
            const author = interaction.user;
            const user = interaction.options.getUser('пользователь');

            const User = client.schemas.get('Users');
            const authorData = await User.findOne({ user_id: author.id });
            const userData = await User.findOne({ user_id: user.id });

            const male_role = interaction.guild.roles.cache.get(cfg.marry.male_role_id);
            const female_role = interaction.guild.roles.cache.get(cfg.marry.female_role_id);
            
            const authorMember = interaction.guild.members.cache.get(author.id);
            const userMember = interaction.guild.members.cache.get(user.id);
            
            const authorHasMaleRole = authorMember.roles.cache.has(male_role.id);
            const authorHasFemaleRole = authorMember.roles.cache.has(female_role.id);
            const userHasMaleRole = userMember.roles.cache.has(male_role.id);
            const userHasFemaleRole = userMember.roles.cache.has(female_role.id);
            
            // Проверка на одинаковые роли
            if ((authorHasMaleRole && userHasMaleRole) || (authorHasFemaleRole && userHasFemaleRole)) {
                return interaction.reply({
                    content: 'Вы не можете пожениться с пользователем того же пола!',
                    ephemeral: true
                });
            }
            

            if (authorData.balance < price.marry) {
                return interaction.reply({ content: `У вас недостаточно средств для создания брака\nНе хватает **${price.marry - authorData.balance}** ${client.emojis.zvezda}`, flags: 64 });
            }

            const marry = client.schemas.get('Marry');
            const marryData = await marry.findOne({ users: { $in: author.id } });
            const marryDataUser = await marry.findOne({ users: { $in: user.id } });

            if (marryData) {
                return interaction.reply({ content: 'Вы уже состоите в браке', flags: 64 });
            }
            if (marryDataUser) {
                return interaction.reply({ content: 'Этот пользователь уже состоит в браке', flags: 64 });
            }

            try {
                const dmChannel = await user.createDM();
                const testMessage = await dmChannel.send({
                    embeds: [{
                        title: '✅ Проверка личных сообщений',
                        description: 'Это тестовое сообщение будет удалено автоматически.',
                        timestamp: new Date().toISOString()
                    }]
                });
                
                if (testMessage) {
                    await testMessage.delete().catch(() => {});
                }
            } catch (error) {
                console.error('Ошибка при проверке ЛС:', error);
                return interaction.reply({
                    embeds: [{
                        title: '❌ Проблема у пользователя закрытые личные сообщения',
                        description: 'Для создания роли необходимо:\n\n1. Откройте настройки конфиденциальности сервера\n2. Включите "Личные сообщения от участников сервера"\n3. Попробуйте создать роль снова\n\nЭто необходимо для отправки важных уведомлений о вашей роли.',
                        color: 0xFF0000,
                        thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
                    }],
                    flags: ['Ephemeral']
                });
            }

            const authorEmbed = {
                title: 'Заключение брака',
                description: `Вы отправили запрос на заключение брака пользователю <@${user.id}>`,
                thumbnail: { url: user.displayAvatarURL({ size: 128 }) },
                author: {
                    name: author.username,
                    iconURL: author.displayAvatarURL({ size: 128 })
                },
                timestamp: new Date().toISOString()
            }

            const amsg = await interaction.reply({ embeds: [authorEmbed] });

            const userEmbed = {
                title: 'Заключение брака',
                description: `Вы получили запрос на заключение брака от пользователя <@${author.id}>`,
                thumbnail: { url: author.displayAvatarURL({ size: 128 }) },
                author: {
                    name: author.username,
                    iconURL: author.displayAvatarURL({ size: 128 })
                },
                timestamp: new Date().toISOString()
            }

            const umsg = await user.send({ embeds: [userEmbed] });

            const states = ComponentState.createMany(['marry_accept', 'marry_reject'], {
                author: author,
                user: user,
                amsg: amsg,
                umsg: umsg
            });
                
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(states.marry_accept)
                    .setLabel('Принять')
                    .setStyle(ButtonStyle.Success),
                    
                new ButtonBuilder()
                    .setCustomId(states.marry_reject)
                    .setLabel('Отклонить')
                    .setStyle(ButtonStyle.Danger)
            );
            
            // Получаем роль по ID
            const marriageRole = interaction.guild.roles.cache.get('1340657424637628448');
            if (marriageRole) {
                // Выдаем роль обоим пользователям
                await interaction.member.roles.add(marriageRole);
                const targetMember = await interaction.guild.members.fetch(user.id);
                await targetMember.roles.add(marriageRole);
            }
            
            await umsg.edit({ components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('lprofile')
            .setDescription('Любовный профиль'),

        async execute(interaction, client) {
            const author = interaction.user;
            const marry = client.schemas.get('Marry');
            const marryData = await marry.findOne({ users: { $in: author.id } });

            if (!marryData) {
                return interaction.reply({ content: 'Вы не состоите в браке', flags: 64 });
            }


            const Users = client.schemas.get('Users');
            const userData = await Users.findOne({ user_id: author.id });
            const partner = userData.partner_id;
            
            const embed = {
                title: 'Любовный профиль',
                fields: [

                    {
                        name: 'Партнер',
                        value: `<@${partner}>`,
                        inline: true
                    },
                    {
                        name: 'Баланс',
                        value: `${marryData.balance} ${client.emojis.zvezda}`,
                        inline: true
                    },
                    {
                        name: 'Списание за лавруму',
                        value: `<t:${marryData.date_end}:R>`,
                        inline: true
                    },
                    {
                        name: 'Название лаврумы',
                        value: `${marryData.name_love_room}`,
                        inline: true
                    }
                ],
                thumbnail: { url: author.displayAvatarURL({ size: 128 }) },
                timestamp: new Date().toISOString()
            }
            const msg = await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });

            const states = ComponentState.createMany(['marry_balance', 'marry_nameroom', 'marry_divorce'], {
                author: author,
                marry: marryData
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(states.marry_balance)
                    .setLabel('Пополнить баланс')
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId(states.marry_nameroom)
                    .setLabel('Изменить название лаврумы')
                    .setStyle(ButtonStyle.Primary)
            );
            
            // Добавляем кнопку развода только если партнер НЕ имеет ID 1378425771709956146
            if (partner !== '1378425771709956146') {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(states.marry_divorce)
                        .setLabel('Разорвать брак')
                        .setStyle(ButtonStyle.Danger)
                );
            }

            await msg.edit({ embeds: [embed], components: [row], flags: ['Ephemeral'] });
        }
    }
]

module.exports = commands;