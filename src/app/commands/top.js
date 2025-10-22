const { price, create } = require('../../cfg');
const ComponentState = require('../components/ComponentState');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('top')
            .setDescription('Топ пользователей'),
        async execute(interaction, client) {

            const Users = client.schemas.get('Users');
            const Marry = client.schemas.get('Marry');
            const Room = client.schemas.get('Room');

            // Получаем данные для всех топов
            const [users, onlineUsers, loveRooms, personalRooms] = await Promise.all([
                Users.find({}).sort({ balance: -1 }).limit(10),
                Users.find({ 'online.online': { $exists: true } })
                    .sort({ 'online.online': -1 })
                    .limit(10),
                Marry.find({ online: { $exists: true } })
                    .sort({ online: -1 })
                    .limit(10),
                Room.find({ online: { $exists: true } })
                    .sort({ online: -1 })
                    .limit(10)
            ]);
            
            const formatTime = (seconds) => {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                return `${hours}ч ${minutes}м`;
            };

            const getPosition = (index) => {
                switch(index) {
                    case 0: return ':first_place:';
                    case 1: return ':second_place:';
                    case 2: return ':third_place:';
                    default: return `${index + 1}.`;
                }
            };

            // Создаем эмбеды для каждого типа топа
            const onlineEmbed = {
                title: 'ТОП-10 пользователей по голосовому онлайну',
                description: onlineUsers.map((user, index) => 
                    `${getPosition(index)} <@${user.user_id}> - ${formatTime(user.online?.online || 0)}`
                ).join('\n'),
                color: 0x2F3136,
                timestamp: new Date().toISOString()
            };

            const balanceEmbed = {
                title: 'ТОП-10 пользователей по балансу',
                description: users.map((user, index) => 
                    `${getPosition(index)} <@${user.user_id}> - ${user.balance} ${client.emojis.zvezda}`
                ).join('\n'),
                color: 0x2F3136,
                timestamp: new Date().toISOString()
            };

            const loveRoomsEmbed = {
                title: 'ТОП-10 любовных комнат по онлайну',
                description: loveRooms.length > 0 ? loveRooms.map((marry, index) => 
                    `${getPosition(index)} <@${marry.users[0]}> & <@${marry.users[1]}> - ${formatTime(marry.online || 0)}`
                ).join('\n') : 'Нет активных любовных комнат',
                color: 0x2F3136,
                timestamp: new Date().toISOString()
            };

            const personalRoomsEmbed = {
                title: 'ТОП-10 личных рум по онлайну',
                description: personalRooms.length > 0 ? personalRooms.map((room, index) => 
                    `${getPosition(index)} ${room.name_room} & Owner: <@${room.owner_id}> - ${formatTime(room.online || 0)}`
                ).join('\n') : 'Нет активных личных румов',
                color: 0x2F3136,
                timestamp: new Date().toISOString()
            };

            const msg = await interaction.reply({ embeds: [onlineEmbed] });


            const states = ComponentState.createMany(['top_select'], {
                user: interaction.user,
                embeds: [onlineEmbed, balanceEmbed, loveRoomsEmbed, personalRoomsEmbed],
                msg: msg

            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(states.top_select)
                .setPlaceholder('Выберите топ')

                .addOptions([
                    {
                        label: 'Топ по времени в голосовых каналах',
                        description: 'Топ по времени в голосовых каналах',
                        value: 'online',
                        default: true
                    },
                    {
                        label: 'Топ по количеству монет',
                        description: 'Топ по количеству звёзд',
                        value: 'balance'
                    },
                    {
                        label: 'Топ любовных комнат',
                        description: 'Топ по времени в любовных комнатах',
                        value: 'loverooms'
                    },
                    {
                        label: 'Топ по личным румам',
                        description: 'Топ по времени в личных румах',
                        value: 'personalrooms'
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await msg.edit({
                embeds: [onlineEmbed],
                components: [row]
            });
        }
    }
];