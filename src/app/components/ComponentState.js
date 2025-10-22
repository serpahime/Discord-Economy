const { Collection } = require('discord.js');

class ComponentState {
    constructor() {
        this.states = new Collection();
        this.components = new Collection();
        this._cleanupInterval = setInterval(() => this.cleanup(), 1000 * 60 * 5); // Очистка каждые 5 минут
    }

    // Регистрация компонента
    registerComponent(baseId, component) {
        this.components.set(baseId, component);
    }

    // Получение компонента
    getComponent(baseId) {
        return this.components.get(baseId);
    }

    // Сохранение состояния
    setState(stateId, data) {
        this.states.set(stateId, {
            data,
            timestamp: Date.now()
        });
        return stateId;
    }

    // Получение состояния
    getState(stateId) {
        const state = this.states.get(stateId);
        return state ? state.data : null;
    }

    // Создание нового состояния для компонента
    create(baseId, data = {}) {
        const stateId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        this.setState(stateId, {
            component: baseId,
            ...data
        });
        return stateId;
    }

    // Создание состояний для нескольких компонентов с общими данными
    createMany(componentIds, data = {}) {
        const timestamp = Date.now().toString(36);
        const states = {};

        for (const baseId of componentIds) {
            const stateId = timestamp + '_' + Math.random().toString(36).substring(2);
            this.setState(stateId, {
                component: baseId,
                ...data
            });
            states[baseId] = stateId;
        }

        return states;
    }

    // Очистка старых состояний (старше 1 часа)
    cleanup() {
        const hour = 1000 * 60 * 60;
        const now = Date.now();
        
        this.states.sweep(state => (now - state.timestamp) > hour);
    }

    // Удаление состояния
    delete(stateId) {
        return this.states.delete(stateId);
    }

    // Удаление нескольких состояний
    deleteMany(stateIds) {
        for (const stateId of stateIds) {
            this.delete(stateId);
        }
    }

    // Получение базового ID компонента из состояния
    getBaseId(stateId) {
        const state = this.getState(stateId);
        return state ? state.component : null;
    }
}

module.exports = new ComponentState(); 