class ComponentUtil {
    static parseCustomId(customId) {
        const [baseId, ...params] = customId.split(':');
        return {
            baseId,
            params
        };
    }

    static createCustomId(baseId, ...params) {
        return [baseId, ...params].join(':');
    }

    static matchBaseId(customId, targetBaseId) {
        return this.parseCustomId(customId).baseId === targetBaseId;
    }

    static getParams(customId) {
        return this.parseCustomId(customId).params;
    }
}

module.exports = ComponentUtil; 