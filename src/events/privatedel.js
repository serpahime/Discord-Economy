const { Events } = require('discord.js');

// Категория и исключаемые каналы
const CATEGORY_ID = '1198892644265361498';
const MANAGEMENT_CHANNEL_ID = '1198892653765464114';
const CREATE_CHANNEL_ID = '1239689229617991710';

module.exports = {
    name: Events.VoiceStateUpdate,
    once: false,
    /**
     * @param {import('discord.js').Client} client
     * @param {import('discord.js').VoiceState} oldState
     * @param {import('discord.js').VoiceState} newState
     */
    async execute(client, oldState, newState) {
        // Проверяем, что пользователь ВЫШЕЛ из голосового канала
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            const channel = oldState.guild.channels.cache.get(oldState.channelId);
            if (!channel) return;
            // Проверяем, что это нужная категория и не исключённые каналы
            if (
                channel.parentId === CATEGORY_ID &&
                channel.id !== MANAGEMENT_CHANNEL_ID &&
                channel.id !== CREATE_CHANNEL_ID &&
                channel.type === 2 // GUILD_VOICE
            ) {
                // Если канал стал пустым
                if (channel.members.size === 0) {
                    setTimeout(async () => {
                        // Проверяем ещё раз, что канал пустой и существует
                        const fresh = oldState.guild.channels.cache.get(channel.id);
                        if (!fresh || fresh.members.size > 0) return;
                        try {
                            // Удаляем только если канал ведётся ботом (есть в БД Private/Marry)
                            const Private = client.schemas.get('Private');
                            const Marry = client.schemas.get('Marry');
                            const [isPrivate, isLove] = await Promise.all([
                                Private.findOne({ room_id: fresh.id }),
                                Marry.findOne({ love_room_id: fresh.id })
                            ]);
                            if (!isPrivate && !isLove) return;
                            await fresh.delete('Автоочистка пустого канала, управляемого ботом');
                            console.log(`Удалён пустой канал: ${fresh.name} (${fresh.id})`);
                        } catch (err) {
                            console.error('Ошибка при удалении канала:', err);
                        }
                    }, 1000); // 1 секунда
                }
            }
        }
    }
};
