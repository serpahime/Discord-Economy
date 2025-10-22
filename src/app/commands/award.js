const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { donate } = require('../../emoji');

const uvedaUsers = {
    "users": [
        "653645423482765312",
        "995032922207821884"
    ]
};

const createAwardEmbed = (user, amount) => new EmbedBuilder()
    .setTitle('💰 Пополнение доната')
    .setDescription(`Пользователю ${user} было начислено ${amount} ${donate} донат-валюты`)
    .setColor('#00ff00')
    .setTimestamp();

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('award')
            .setDescription('Выдать донат-валюту пользователю')
            .addUserOption(option => 
                option
                    .setName('user')
                    .setDescription('Пользователь, которому нужно выдать донат-валюту')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option
                    .setName('amount')
                    .setDescription('Количество донат-валюты')
                    .setRequired(true)
                    .setMinValue(1)
            ),
        async execute(interaction, client, dbUser) {
            if (!uvedaUsers.users.includes(interaction.user.id)) {
                return interaction.reply({ 
                    content: '❌ У вас нет доступа к этой команде.',
                    ephemeral: true 
                });
            }

            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');

            const Donate = client.schemas.get('Donate');
            const donate = await Donate.findOne({ user_id: targetUser.id }) || await Donate.create({ user_id: targetUser.id, donate: 0 });

            donate.donate += amount;
            await donate.save();

            // Отправляем сообщение о начислении
            const awardMessage = await interaction.reply({
                embeds: [createAwardEmbed(targetUser, amount)],
                flags: 64
            });

            // Удаляем сообщение через 5 секунд
            setTimeout(() => {
                awardMessage.delete().catch(() => {});
            }, 5000);
        }
    }
];

module.exports = commands; 