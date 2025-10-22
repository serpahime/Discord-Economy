const { cfg } = require('../cfg'); // Импортируем конфиг напрямую
const { PermissionFlagsBits } = require('discord.js');

// Добавляем список разрешенных пользователей
const allowedUsers = [
    '1235916722146508813',
    '919218631810904104',
    "653645423482765312",
    '995032922207821884',
    "1251116136486142035",
    '1262212668727496797',
    '1146406135738400928',
    '1337712870359699520',
    '319455741096493056',
    '287230007443456011',
    '722433348009590835',
    '1154849113901383692'
];

// Функция для очистки зависших комнат
async function cleanupStuckRooms(guild, Marry) {
    try {
        // Получаем все браки с любовными комнатами
        const marriages = await Marry.find({ love_room_id: { $exists: true } });
        
        for (const marriage of marriages) {
            const channel = guild.channels.cache.get(marriage.love_room_id);
            
            // Если канал не существует или пустой
            if (!channel || channel.members.size === 0) {
                // Удаляем запись о комнате из БД
                await Marry.updateOne(
                    { _id: marriage._id },
                    { $unset: { love_room_id: "" } }
                );
                
                // Если канал существует, удаляем его
                if (channel) {
                    try {
                        await channel.delete('Очистка зависшей любовной комнаты');
                    } catch (error) {
                        console.error(`Ошибка при удалении зависшей комнаты ${channel.id}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка при очистке зависших комнат:', error);
    }
}

// Функция для удаления всех пустых управляемых ботом голосовых комнат в категории, кроме одной
async function cleanupEmptyRoomsInCategory(guild, categoryId, exceptChannelId, client) {
	const Private = client.schemas.get('Private');
	const Marry = client.schemas.get('Marry');
	const channels = guild.channels.cache.filter(
		c => c.parentId === categoryId && c.type === 2 // 2 = GUILD_VOICE
	);
	for (const channel of channels.values()) {
		if (channel.id === exceptChannelId) continue;
		try {
			// Удаляем только те каналы, которые реально ведутся ботом (есть в БД Private/Marry)
			const [isPrivate, isLove] = await Promise.all([
				Private.findOne({ room_id: channel.id }),
				Marry.findOne({ love_room_id: channel.id })
			]);
			if (!isPrivate && !isLove) continue;
			if (channel.members.size === 0) {
				await channel.delete('Автоочистка пустого канала, управляемого ботом');
			}
		} catch (error) {
			console.error(`Ошибка при удалении пустой комнаты ${channel.id}:`, error);
		}
	}
}

module.exports = {
    name: 'voiceStateUpdate',
    once: false,
    async execute(client, oldState, newState) {
        try {
            // Проверяем, что пользователь присоединился к каналу создания приватной комнаты
            if (newState.channelId === cfg.privates.join_voice_id) {
                const Private = client.schemas.get('Private');
                const guild = newState.guild;
                const member = newState.member;

                // Проверяем, есть ли у пользователя уже приватная комната
                const existingPrivate = await Private.findOne({ owner_id: member.id });

                if (existingPrivate) {
                    // Если комната существует, проверяем её наличие на сервере
                    const existingChannel = guild.channels.cache.get(existingPrivate.room_id);
                    
                    if (existingChannel) {
                        // Если канал существует, перемещаем пользователя в него
                        await member.voice.setChannel(existingChannel.id).catch(console.error);
                    } else {
                        // Если канал не существует, удаляем запись из БД и создаем новый канал
                        await Private.deleteOne({ owner_id: member.id });
                        await createNewPrivateChannel();
                    }
                } else {
                    // Создаем новую приватную комнату
                    await createNewPrivateChannel();
                }

                async function createNewPrivateChannel() {
                    // Повторно проверяем, не был ли уже создан канал другим пользователем
                    const updatedPrivate = await Private.findOne({ owner_id: member.id });
                    if (updatedPrivate && updatedPrivate.room_id) {
                        const existingChannel = guild.channels.cache.get(updatedPrivate.room_id);
                        if (existingChannel) {
                            await member.voice.setChannel(existingChannel.id);
                            return;
                        }
                    }
                    try {
                        // Создаем новый голосовой канал
                        const channel = await guild.channels.create({
                            name: `🔑・${member.user.username}`,
                            type: 2, // 2 = GUILD_VOICE
                            parent: newState.channel.parent, // Создаем в той же категории
                            reason: 'Создание приватной комнаты',
                            permissionOverwrites: [
                                {
                                    id: guild.id, // @everyone
                                    deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                                },
                                {
                                    id: member.id, // Владелец комнаты
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.Connect,
                                        PermissionFlagsBits.Speak,
                                        PermissionFlagsBits.Stream,
                                        PermissionFlagsBits.UseVAD,
                                        PermissionFlagsBits.PrioritySpeaker
                                    ]
                                },
                                {
                                    id: client.user.id, // Бот
                                    allow: [
                                        PermissionFlagsBits.Connect,
                                        PermissionFlagsBits.Speak,
                                        PermissionFlagsBits.ManageChannels,
                                        PermissionFlagsBits.ManageRoles
                                    ]
                                }
                            ]
                        });

                        // Сохраняем информацию о комнате в БД
                        await Private.create({
                            owner_id: member.id,
                            room_id: channel.id
                        });

                        // Перемещаем пользователя в созданную комнату
                        await member.voice.setChannel(channel.id);

                        // Очищаем пустые приватные комнаты в категории (только управляемые ботом)
                        await cleanupEmptyRoomsInCategory(guild, channel.parentId, channel.id, client);

                        console.log(`Создана приватная комната для ${member.user.tag}`);
                    } catch (error) {
                        console.error('Ошибка при создании приватной комнаты:', error);
                    }
                }
            }

            // Обработка любовных комнат
            if (newState.channelId) {  // Проверяем любой вход в голосовой канал
                const Marry = client.schemas.get('Marry');
                
                // Проверяем, является ли канал любовной комнатой
                const marriage = await Marry.findOne({
                    love_room_id: newState.channelId
                });

                if (marriage && 
                    !marriage.users.includes(newState.member.id) && 
                    !allowedUsers.includes(newState.member.id)) {
                    // Если это любовная комната и пользователь не является одним из супругов
                    // и не находится в списке разрешенных пользователей,
                    // отключаем его от канала
                    await newState.member.voice.disconnect();
                    return;
                }
            }

            if (newState.channelId === cfg.marry.join_voice_id) {
                const Marry = client.schemas.get('Marry');
                const guild = newState.guild;
                const member = newState.member;

                // Запускаем очистку зависших комнат
                await cleanupStuckRooms(guild, Marry);

                // Проверяем, находится ли пользователь в браке
                const marriage = await Marry.findOne({
                    users: member.id
                });

                if (!marriage) {
                    // Если пользователь не в браке, отключаем его от голосового канала
                    await member.voice.disconnect();
                    return;
                }

                // Проверяем существующую любовную комнату
                if (marriage.love_room_id) {
                    const existingChannel = guild.channels.cache.get(marriage.love_room_id);
                    
                    if (existingChannel) {
                        // Проверяем, не пустая ли комната
                        if (existingChannel.members.size === 0) {
                            // Если комната пустая, удаляем её и создаем новую
                            try {
                                await existingChannel.delete('Удаление пустой любовной комнаты перед пересозданием');
                                await Marry.updateOne(
                                    { _id: marriage._id },
                                    { $unset: { love_room_id: "" } }
                                );
                                await createNewLoveRoom();
                            } catch (error) {
                                console.error('Ошибка при удалении пустой комнаты:', error);
                            }
                        } else {
                            // Если канал существует и не пустой, перемещаем пользователя в него
                            await member.voice.setChannel(existingChannel.id).catch(console.error);
                        }
                    } else {
                        // Если канал не существует, создаем новый
                        await createNewLoveRoom();
                    }
                } else {
                    // Создаем новую любовную комнату
                    await createNewLoveRoom();
                }

                async function createNewLoveRoom() {
                    // Повторно проверяем, не был ли уже создан канал другим пользователем
                    const updatedMarriage = await Marry.findOne({ users: member.id });
                    if (updatedMarriage.love_room_id) {
                        // Если канал уже создан, просто перемещаем пользователя
                        const existingChannel = guild.channels.cache.get(updatedMarriage.love_room_id);
                        if (existingChannel) {
                            await member.voice.setChannel(existingChannel.id);
                            return;
                        }
                    }
                    try {
                        // Получаем партнера
                        const partner = marriage.users.find(id => id !== member.id);
                        const loveroomname = marriage.name_love_room;

                        // Создаем новый голосовой канал
                        const channel = await guild.channels.create({
                            name: `${loveroomname}`,
                            type: 2,
                            parent: newState.channel.parent,
                            reason: 'Создание любовной комнаты',
                            permissionOverwrites: [
                                {
                                    id: guild.id,
                                    deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                                },
                                {
                                    id: member.id,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.Connect,
                                        PermissionFlagsBits.Speak,
                                        PermissionFlagsBits.Stream,
                                        PermissionFlagsBits.UseVAD,
                                        PermissionFlagsBits.PrioritySpeaker
                                    ]
                                },
                                {
                                    id: partner,
                                    allow: [
                                        PermissionFlagsBits.ViewChannel,
                                        PermissionFlagsBits.Connect,
                                        PermissionFlagsBits.Speak,
                                        PermissionFlagsBits.Stream,
                                        PermissionFlagsBits.UseVAD,
                                        PermissionFlagsBits.PrioritySpeaker
                                    ]
                                },
                                {
                                    id: client.user.id,
                                    allow: [
                                        PermissionFlagsBits.Connect,
                                        PermissionFlagsBits.Speak,
                                        PermissionFlagsBits.ManageChannels,
                                        PermissionFlagsBits.ManageRoles
                                    ]
                                }
                            ]
                        });

                        // Обновляем ID комнаты в БД
                        await Marry.updateOne(
                            { users: member.id },
                            { $set: { love_room_id: channel.id } }
                        );

                        // Перемещаем пользователя в созданную комнату
                        await member.voice.setChannel(channel.id);

                        // Очищаем пустые комнаты в категории, кроме одной (только управляемые ботом)
                        await cleanupEmptyRoomsInCategory(guild, channel.parentId, '1213918576646295612', client);

                        console.log(`Создана любовная комната для ${member.user.tag}`);
                    } catch (error) {
                        console.error('Ошибка при создании любовной комнаты:', error);
                        // В случае ошибки очищаем запись о комнате из БД
                        await Marry.updateOne(
                            { users: member.id },
                            { $unset: { love_room_id: "" } }
                        );
                    }
                }
            }

        } catch (error) {
            console.error('Ошибка в обработчике voiceStateUpdate:', error);
        }
    }
};