const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');
const { price } = require('../../cfg');

async function handleInventoryButton(interaction, client) {
    const state = ComponentState.getState(`inventory_${interaction.user.id}`);
    if (!state || state.author.id !== interaction.user.id) return;

    const itemId = interaction.customId.replace('inventory_', '');
    const Users = client.schemas.get('Users');
    const guild = await client.guilds.fetch(client.config.guildId);
    const member = await guild.members.fetch(interaction.user.id);

    const userData = await Users.findOne({ user_id: interaction.user.id });
    const itemIndex = userData.inventory.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    const item = userData.inventory[itemIndex];
    const inventory = [...userData.inventory];
    
    if (!item.activate) {
        // Активация
        if (item.type === 'gender') {
            // Удаляем существующие роли гендера
            if (member.roles.cache.has(price.hide_gender.male_id_role)) {
                await member.roles.remove(price.hide_gender.male_id_role);
            }
            if (member.roles.cache.has(price.hide_gender.female_id_role)) {
                await member.roles.remove(price.hide_gender.female_id_role);
            }
        } else if (item.type === 'admin') {
            const adminRole = await guild.roles.fetch(price.admin.role_id);
            if(adminRole) {
                await member.roles.add(adminRole.id);
            }
        }

        // Обновляем статус в инвентаре
        inventory[itemIndex].activate = true;

    } else {
        // Деактивация
        if (item.type === 'gender') {
            const roleId = item.gender === 'male' ? 
                price.hide_gender.male_id_role : 
                price.hide_gender.female_id_role;
            await member.roles.add(roleId);
        } else if (item.type === 'admin') {
            const adminRole = await guild.roles.fetch(price.admin.role_id);
            if (adminRole && member.roles.cache.has(adminRole.id)) {
                await member.roles.remove(adminRole.id);
            }
        }

        // Обновляем статус в инвентаре
        inventory[itemIndex].activate = false;
    }

    // Обновляем инвентарь пользователя
    await Users.updateOne(
        { user_id: interaction.user.id },
        { $set: { inventory: inventory } }
    );

    // Обновляем сообщение
    const embed = interaction.message.embeds[0];
    embed.fields[2].value = inventory.map(item => 
        item.activate ? '✅ Активно' : '❌ Не активно'
    ).join('\n');

    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    for (let i = 0; i < inventory.length; i++) {
        const invItem = inventory[i];
        const button = new ButtonBuilder()
            .setCustomId(`inventory_${invItem.id}`)
            .setLabel(invItem.activate ? 'Деактивировать' : 'Активировать')
            .setStyle(invItem.activate ? ButtonStyle.Danger : ButtonStyle.Success);

        currentRow.addComponents(button);
        buttonCount++;

        if (buttonCount === 5 || i === inventory.length - 1) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }
    }

    await interaction.update({ 
        embeds: [embed], 
        components: rows 
    });

    // Отправляем сообщение об успешной активации/деактивации
    const actionText = item.activate ? 'активирована' : 'деактивирована';
    const itemText = item.type === 'admin' ? 'Скрытая админка' : 'Скрытие гендера';
    await interaction.followUp({
        content: `✅ Услуга "${itemText}" успешно ${actionText}!`,
        flags: 64
    });
}

module.exports = {
    handleInventoryButton
};