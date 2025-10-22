const ComponentState = require('../ComponentState');

module.exports = [{
    customId: 'confirm_give',
    async execute(interaction, client) {
        const state = ComponentState.getState(interaction.customId);
        if (!state) return interaction.reply({ 
            content: '❌ Срок действия кнопки истек. Используйте команду `/balance` снова.', 
            flags: ['Ephemeral'] 
        });

        if (interaction.user.id !== state.author.id) return interaction.reply({ 
            content: '❌ Только автор команды может подтвердить передачу!', 
            flags: ['Ephemeral'] 
        });

        const Users = client.schemas.get('Users');
        const [userData, authorData] = await Promise.all([
            Users.findOne({ user_id: state.user.id }),
            Users.findOne({ user_id: state.author.id })
        ]);

        if (authorData.balance < state.sAmount) return interaction.reply({ 
            content: '❌ Недостаточно средств!', 
            flags: ['Ephemeral'] 
        });

        const date = Math.floor(Date.now() / 1000);
        const transaction = {
            date,
            authorUpdate: {
                member: state.user.id,
                type: 'give',
                amount: state.sAmount,
                description: `Передача монет ${state.user.tag}`
            },
            userUpdate: {
                member: state.author.id,
                type: 'take',
                amount: state.amount,
                description: `Получение от ${state.author.tag}`
            }
        };

        await Promise.all([
            Users.updateOne(
                { user_id: state.author.id },
                {
                    $inc: { balance: -state.sAmount },
                    $push: { transactions: transaction.authorUpdate }
                }
            ),
            Users.updateOne(
                { user_id: state.user.id },
                {
                    $inc: { balance: state.amount },
                    $push: { transactions: transaction.userUpdate }
                }
            )
        ]);

        await state.msg.edit({
            embeds: [{
                title: 'Передать монеты',
                description: `<@${state.author.id}>, Вы **передали** **${state.amount}** ${client.emojis.zvezda} пользователю <@${state.user.id}>`,
                thumbnail: { url: state.author.displayAvatarURL({ size: 128 }) },
                timestamp: new Date().toISOString()
            }],
            components: []
        });
    }
}, {
    customId: 'cancel_give',
    async execute(interaction, client) {
        const state = ComponentState.getState(interaction.customId);
        if (interaction.user.id !== state.author.id) return interaction.reply({ 
            content: '❌ Только автор команды может подтвердить передачу!', 
            flags: ['Ephemeral'] 
        });

        await state.msg.edit({
            embeds: [{
                title: 'Передать монеты',
                description: `<@${state.author.id}>, Вы **отказались** передавать **${state.sAmount}** ${client.emojis.zvezda} пользователю <@${state.user.id}>`,
                thumbnail: { url: state.author.displayAvatarURL({ size: 128 }) },
                timestamp: new Date().toISOString()
            }],
            components: []
        });
    }
}];