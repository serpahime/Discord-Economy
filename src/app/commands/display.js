const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ComponentState = require('../components/ComponentState');

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('avatar')
            .setDescription('Просмотр аватара пользователя')
            .addUserOption(option => option.setName('пользователь').setDescription('Пользователь').setRequired(false)),

        async execute(interaction, client) {
            const user = interaction.options.getUser('пользователь') || interaction.user;
            const embed = {
                title: `Аватар — ${user.tag}`,
                image: { url: user.displayAvatarURL({ size: 1024 }) }
            }
            await interaction.reply({ embeds: [embed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('banner')
            .setDescription('Просмотр баннера пользователя')
            .addUserOption(option => option.setName('пользователь').setDescription('Пользователь').setRequired(false)),

        async execute(interaction, client) {
            const user = interaction.options.getUser('пользователь') || interaction.user;
            
            if (!user.bannerURL()) {
                return interaction.reply({ 
                    content: '❌ У пользователя нет баннера!', 
                    flags: ['Ephemeral'] 
                });
            }
            
            const embed = {
                title: `Баннер — ${user.tag}`,
                image: { url: user.bannerURL({ size: 1024 }) }
            }
            await interaction.reply({ embeds: [embed] });
        }
    }
];

module.exports = commands;