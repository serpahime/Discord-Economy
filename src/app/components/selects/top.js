const ComponentState = require('../ComponentState');
const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

module.exports = [
    {
        customId: 'top_select',
        async execute(interaction, client) {    
            const state = ComponentState.getState(interaction.customId);
            const user = state.user;
            const embeds = state.embeds;
            const msg = state.msg;

            const value = interaction.values[0];

            if (value === 'online') {
                const onlineEmbed = embeds[0];
                await interaction.deferUpdate();
                const states = ComponentState.createMany(['top_select'], {
                    user: interaction.user,
                    embeds: embeds,
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
                await msg.edit({ embeds: [onlineEmbed], components: [row] });
            }

            if (value === 'balance') {
                const balanceEmbed = embeds[1];
                await interaction.deferUpdate();
                const states = ComponentState.createMany(['top_select'], {
                    user: interaction.user,
                    embeds: embeds,

                    msg: msg
    
                });
    
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(states.top_select)
                    .setPlaceholder('Выберите топ')
    
                    .addOptions([
                        {
                            label: 'Топ по времени в голосовых каналах',
                            description: 'Топ по времени в голосовых каналах',
                            value: 'online'
                        },
                        {
                            label: 'Топ по количеству монет',
                            description: 'Топ по количеству звёзд',
                            value: 'balance',
                            default: true
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
                await msg.edit({ embeds: [balanceEmbed], components: [row] });
            }



            if (value === 'loverooms') {
                const loveRoomsEmbed = embeds[2];
                await interaction.deferUpdate();
                const states = ComponentState.createMany(['top_select'], {
                    user: interaction.user,
                    embeds: embeds,
                    msg: msg
    
                });
    
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(states.top_select)
                    .setPlaceholder('Выберите топ')
    
                    .addOptions([
                        {
                            label: 'Топ по времени в голосовых каналах',
                            description: 'Топ по времени в голосовых каналах',
                            value: 'online'
                        },
                        {
                            label: 'Топ по количеству монет',
                            description: 'Топ по количеству звёзд',
                            value: 'balance'
                        },
                        {
                            label: 'Топ любовных комнат',
                            description: 'Топ по времени в любовных комнатах',
                            value: 'loverooms',
                            default: true
                        },
                        {
                            label: 'Топ по личным румам',
                            description: 'Топ по времени в личных румах',
                            value: 'personalrooms'
                        }
                    ]);
                const row = new ActionRowBuilder().addComponents(selectMenu);
                await msg.edit({ embeds: [loveRoomsEmbed], components: [row] });
            }

            if (value === 'personalrooms') {
                const personalRoomsEmbed = embeds[3];
                await interaction.deferUpdate();
                const states = ComponentState.createMany(['top_select'], {
                    user: interaction.user,
                    embeds: embeds,
                    msg: msg
    
                });
    
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(states.top_select)
                    .setPlaceholder('Выберите топ')

                    .addOptions([
                        {
                            label: 'Топ по времени в голосовых каналах',
                            description: 'Топ по времени в голосовых каналах',
                            value: 'online'
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
                            value: 'personalrooms',
                            default: true
                        }   
                    ]);
                const row = new ActionRowBuilder().addComponents(selectMenu);
                await msg.edit({ embeds: [personalRoomsEmbed], components: [row] });
            }
        }
    }
];
