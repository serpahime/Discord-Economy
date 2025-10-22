const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// Вам нужно получить API ключ с https://tenor.com/developer/dashboard
const TENOR_API_KEY = 'AIzaSyABHGhJWuTabwxw0FfM2BgK2Kl9ejiu0IE';
const TENOR_API_URL = 'https://tenor.googleapis.com/v2';

// Поисковые термины для каждого типа действия
const searchTerms = {
    hug: ['anime hug', 'manga hug', 'cute anime hug', 'kawaii hug'],
    kiss: ['anime kiss', 'manga kiss', 'romantic anime kiss', 'kawaii kiss'],
    hit: ['anime hit', 'manga hit', 'anime punch', 'anime slap'],
    bite: ['anime bite', 'manga bite', 'kawaii bite', 'playful bite anime'],
    pat: ['anime pat head', 'manga pat', 'headpat anime', 'kawaii pat'],
    slap: ['anime slap', 'manga slap', 'anime hit face', 'funny anime slap'],
    cuddle: ['anime cuddle', 'manga cuddle', 'kawaii cuddle', 'anime hug cute']
};

// Функция для получения гифки с Tenor
async function getGif(action) {
    try {
        // Выбираем случайный поисковый запрос для разнообразия
        const searchQuery = searchTerms[action][Math.floor(Math.random() * searchTerms[action].length)];
        
        const response = await axios.get(`${TENOR_API_URL}/search`, {
            params: {
                q: searchQuery,
                key: TENOR_API_KEY,
                client_key: 'discord_bot',
                limit: 20, // Увеличиваем лимит до 20 гифок
                media_filter: 'gif',
                random: true // Добавляем параметр random для большего разнообразия
            }
        });

        const results = response.data.results;
        if (results && results.length > 0) {
            const randomIndex = Math.floor(Math.random() * results.length);
            return results[randomIndex].media_formats.gif.url;
        }
        return null;
    } catch (error) {
        console.error('Error fetching GIF from Tenor:', error);
        return null;
    }
}

// Функция для создания команды
function createCommand(name, description, action, color) {
    return {
        data: new SlashCommandBuilder()
            .setName(name)
            .setDescription(description)
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Пользователь для взаимодействия')
                    .setRequired(true)),
        async execute(interaction) {
            await interaction.deferReply(); // Добавляем отложенный ответ
            const user = interaction.options.getUser('user');
            const gifUrl = await getGif(action);
            
            if (!gifUrl) {
                return await interaction.editReply({ 
                    content: 'Извините, не удалось загрузить гифку. Попробуйте еще раз.',
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(`${interaction.user} ${description.toLowerCase()} ${user}`)
                .setImage(gifUrl);
            
            await interaction.editReply({ embeds: [embed] });
        },
    };
}

// Создаем команды
const commands = [
    // Английские команды


    // Русские команды
    createCommand('обнять', 'Обнять пользователя', 'hug', '#FF69B4'),
    createCommand('поцеловать', 'Поцеловать пользователя', 'kiss', '#FF69B4'),
    createCommand('ударить', 'Ударить пользователя', 'hit', '#FF0000'),
    createCommand('укусить', 'Укусить пользователя', 'bite', '#FF0000'),
    createCommand('погладить', 'Погладить пользователя', 'pat', '#FF69B4'),
    createCommand('шлепнуть', 'Шлепнуть пользователя', 'slap', '#FF0000'),
    createCommand('обнимашки', 'Обнимашки с пользователем', 'cuddle', '#FF69B4')
];

module.exports = commands;
