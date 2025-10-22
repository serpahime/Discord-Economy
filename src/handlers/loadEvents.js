const { readdirSync } = require('fs');
const { join } = require('path');

module.exports = {
    name: 'loadEvents',
    async execute(client) {
        try {
            const eventsPath = join(__dirname, '..', 'events');
            const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

            for (const file of eventFiles) {
                const event = require(join(eventsPath, file));
                const eventName = file.split('.')[0];
                
                client.events.set(eventName, event);
                
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(client, ...args));
                } else {
                    client.on(event.name, (...args) => event.execute(client, ...args));
                }
                
                console.log(`[Event] Загружено событие ${eventName}`);
            }
        } catch (error) {
            console.error('[Event] Ошибка при загрузке событий:', error);
            throw error;
        }
    }
}; 