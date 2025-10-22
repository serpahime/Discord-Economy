const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { cfg } = require('../../cfg');
const { donate } = require('../../emoji');

const price = {
    donate_nitro: 4000,
    donate_telegram: 4000,
    cs2_skin_box: 15000,
    dota2_skin_box: 15000,
    donate_decor: 3500,
    donate_coowner: 30000
}

const uvedaUsers = {
    "users": [
        "653645423482765312",
        "995032922207821884"
    ]
}

const createEmbed = (user, image) => new EmbedBuilder()
    .setTitle('💰 Донат')
    .setDescription(`Здравствуйте, ${user.username}! Вы открыли донат-магазин. Здесь вы можете приобрести различные плюшки(Discord Nitro, Telegram Premium, и т.д.)`)
    .setImage(image)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setTimestamp();

const createNavigationButtons = (backDisabled = true, forwardDisabled = false) => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('back_donate')
        .setLabel('Назад')
        .setStyle(ButtonStyle.Secondary)
        //.setEmoji('🔙')
        .setDisabled(backDisabled),
    new ButtonBuilder()
        .setCustomId('vpered_donate')
        .setLabel('Вперед')
        .setStyle(ButtonStyle.Secondary)
        //.setEmoji('➡️')
        .setDisabled(forwardDisabled)
);

const createProductButtons = (products, userDonate) => {
    const row = new ActionRowBuilder();
    products.forEach(product => {
        const productPrice = price[product.id];
        const canAfford = userDonate >= productPrice;
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(product.id)
                .setLabel(`${product.label} (${productPrice})`)
                .setStyle(canAfford ? ButtonStyle.Secondary : ButtonStyle.Secondary)
                //.setEmoji('🔑')
                .setDisabled(!canAfford)
        );
    });
    return row;
};

const createPurchaseEmbed = (user, product) => new EmbedBuilder()
    .setTitle('✅ Покупка успешна')
    .setDescription(`Вы приобрели донат услугу: ${product.label}\nОжидайте в течение 12 часов ее обработают.`)
    .setColor('#00ff00')
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setTimestamp();

const createAdminNotificationEmbed = (user, product) => new EmbedBuilder()
    .setTitle('🛒 Новая покупка')
    .setDescription(`Пользователь ${user} (${user.id}) приобрел: ${product.label}`)
    .setColor('#ff9900')
    .setTimestamp();    

module.exports = {
    data: new SlashCommandBuilder()
        .setName('donate')
        .setDescription('Открыть донат-магазин'),
    async execute(interaction, client, dbUser) {
        const user = interaction.user;
        const Donate = client.schemas.get('Donate');
        const donate = await Donate.findOne({ user_id: user.id }) || await Donate.create({ user_id: user.id, donate: 0 });

        const images = {
            first: 'https://media.discordapp.net/attachments/1344939098468777995/1359565368934400272/gCjMPiY.png?ex=67f7f16b&is=67f69feb&hm=b335d56dc72b4a22a093d18feaa3cd10f8bdc66bb8bf592b2d1161491b6d590a&=&format=webp&quality=lossless&width=1253&height=705',
            second: 'https://media.discordapp.net/attachments/1344939098468777995/1359565337615663395/AlaPCsX.png?ex=67f7f163&is=67f69fe3&hm=fe9d15aef1114c6fed13ca8b594b8441605f79be34e08b416fb1fa0ca3ee5cde&=&format=webp&quality=lossless&width=1253&height=705'
        };

        const products = {
            first: [
                { id: 'donate_nitro', label: 'Discord Nitro' },
                { id: 'donate_telegram', label: 'Telegram Premium' },
                { id: 'cs2_skin_box', label: 'CS 2 SKIN BOX' },
                { id: 'dota2_skin_box', label: 'Dota 2 SKIN BOX' }
            ],
            second: [
                { id: 'donate_decor', label: 'Украшение в дискорде' },
                { id: 'donate_coowner', label: 'CO-OWNER 7 дней' }
            ]
        };

        await interaction.reply({
            embeds: [createEmbed(user, images.first)],
            components: [createNavigationButtons(true, false), createProductButtons(products.first, donate.donate)]
        });

        const collector = interaction.channel.createMessageComponentCollector({ 
            time: 150000,
            filter: i => i.user.id === user.id
        });

        collector.on('collect', async (i) => {
            const isBack = i.customId === 'back_donate';
            const isForward = i.customId === 'vpered_donate';
            const isProduct = !isBack && !isForward;

            if (isProduct) {
                const product = [...products.first, ...products.second].find(p => p.id === i.customId);
                if (!product) return;

                const productPrice = price[product.id];
                if (donate.donate < productPrice) {
                    return i.reply({ content: '❌ У вас недостаточно донат-валюты для покупки.', ephemeral: true });
                }

                donate.donate -= productPrice;
                await donate.save();
                await Donate.addHistoryBuy(user.id, product.label, productPrice);

                // Отправляем сообщение в чат
                await i.channel.send({ 
                    content: `<@${user.id}>`,
                    embeds: [createPurchaseEmbed(user, product)],
                    allowedMentions: { users: [user.id] }
                });

                // Пытаемся отправить в ЛС (тихо пропускаем ошибки)
                try {
                    await user.send({ embeds: [createPurchaseEmbed(user, product)] });
                } catch {
                    // Игнорируем ошибку
                }

                // Отправляем уведомления админам (тихо пропускаем ошибки)
                for (const adminId of uvedaUsers.users) {
                    const admin = await client.users.fetch(adminId);
                    if (admin) {
                        try {
                            await admin.send({ embeds: [createAdminNotificationEmbed(user, product)] });
                        } catch {
                            // Игнорируем ошибку
                        }
                    }
                }

                await i.update({
                    embeds: [createEmbed(user, images[isBack ? 'first' : 'second'])],
                    components: [
                        createNavigationButtons(isBack, isForward),
                        createProductButtons(isBack ? products.first : products.second, donate.donate)
                    ]
                });
            } else {
                const page = isBack ? 'first' : 'second';
                await i.update({
                    embeds: [createEmbed(user, images[page])],
                    components: [
                        createNavigationButtons(isBack, isForward),
                        createProductButtons(products[page], donate.donate)
                    ]
                });
            }
        });
    }
};