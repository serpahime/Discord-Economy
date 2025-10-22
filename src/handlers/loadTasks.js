const { readdirSync } = require('fs');
const { join } = require('path');
const cron = require('node-cron');

// Парсер времени (5s, 5min, 5h, 5d или cron выражение)
function parseTime(timeString) {
    // Проверка на cron-выражение
    if (timeString.includes('*') || timeString.split(' ').length === 5) {
        return cron.validate(timeString) ? 'cron' : null;
    }

    const units = { 's': 1000, 'min': 60000, 'h': 3600000, 'd': 86400000 };
    const match = timeString.match(/^(\d+)(s|min|h|d)$/);
    return match ? parseInt(match[1]) * units[match[2]] : null;
}

class TaskManager {
    constructor(client) {
        this.client = client;
        this.tasks = new Map();
        this.cronJobs = new Map();
        this.taskDefinitions = new Map();
        this.failCounts = new Map();
        this.maxRetries = 3; // Максимальное кол-во последовательных ошибок
        this.retryDelay = 60000; // 1 минута между перезапусками
    }

    // Безопасное выполнение с обработкой ошибок и перезапуском
    async safeExecute(task, name) {
        try {
            await task.execute(this.client);
            // Сбрасываем счетчик ошибок при успешном выполнении
            this.failCounts.set(name, 0);
        } catch (error) {
            const failCount = (this.failCounts.get(name) || 0) + 1;
            this.failCounts.set(name, failCount);
            
            const timestamp = new Date().toISOString();
            console.error(`[${timestamp}] [Task] Ошибка в задаче ${name} (попытка ${failCount}/${this.maxRetries}):`, error);
            
            // Оповещение разработчиков только для важных ошибок
            if (failCount >= this.maxRetries) {
                console.error(`[${timestamp}] [Task] Критическая ошибка в задаче ${name}! Требуется вмешательство.`);
                this.client.notifyDevelopers(`Критическая ошибка в задаче ${name}:\n${error.stack || error}`);
            }
            
            // Планируем перезапуск задачи
            if (failCount < this.maxRetries * 2) { 
                setTimeout(() => {
                    console.log(`[${timestamp}] [Task] Перезапуск задачи ${name} после ошибки...`);
                    this.safeExecute(task, name);
                }, this.retryDelay);
            }
        }
    }

    registerTask(task) {
        this.taskDefinitions.set(task.name, task);
        this.failCounts.set(task.name, 0);
        console.log(`[Task] Зарегистрирована задача ${task.name} (${task.time})`);
    }

    async executeAllTasksImmediately() {
        console.log(`[Task] Запуск всех задач...`);
        
        const promises = [...this.taskDefinitions.entries()].map(
            ([name, task]) => this.safeExecute(task, name)
        );
        
        await Promise.allSettled(promises);
        console.log(`[Task] Начальное выполнение завершено, запуск планировщика`);
        this.startAllTasks();
    }
    
    startAllTasks() {
        this.taskDefinitions.forEach((task, name) => this.startTask(task));
    }

    startTask(task) {
        const timeFormat = parseTime(task.time);
        if (!timeFormat) {
            console.error(`[Task] Неверный формат времени для задачи ${task.name}: ${task.time}`);
            return;
        }

        const taskFunction = () => this.safeExecute(task, task.name);

        if (timeFormat === 'cron') {
            const cronJob = cron.schedule(task.time, taskFunction, {
                timezone: "Europe/Moscow"
            });
            this.cronJobs.set(task.name, cronJob);
        } else {
            const taskInterval = setInterval(taskFunction, timeFormat);
            this.tasks.set(task.name, taskInterval);
        }
        
        console.log(`[Task] Запущена задача ${task.name}`);
    }

    stopTask(taskName) {
        if (this.tasks.has(taskName)) {
            clearInterval(this.tasks.get(taskName));
            this.tasks.delete(taskName);
            console.log(`[Task] Остановлена задача ${taskName}`);
        }

        if (this.cronJobs.has(taskName)) {
            this.cronJobs.get(taskName).stop();
            this.cronJobs.delete(taskName);
            console.log(`[Task] Остановлена cron-задача ${taskName}`);
        }
    }

    stopAllTasks() {
        this.tasks.forEach((interval, taskName) => {
            clearInterval(interval);
            console.log(`[Task] Остановлена задача ${taskName}`);
        });
        this.tasks.clear();

        this.cronJobs.forEach((job, taskName) => {
            job.stop();
            console.log(`[Task] Остановлена cron-задача ${taskName}`);
        });
        this.cronJobs.clear();
    }
}

module.exports = {
    name: 'loadTasks',
    async execute(client) {
        try {
            client.taskManager = new TaskManager(client);
            const tasksPath = join(__dirname, '..', 'app', 'tasks');
            
            readdirSync(tasksPath)
                .filter(file => file.endsWith('.js'))
                .forEach(file => {
                    try {
                        const tasks = require(join(tasksPath, file));
                        const taskArray = Array.isArray(tasks) ? tasks : [tasks];
                        
                        taskArray.forEach(task => {
                            if (task.name && task.time && typeof task.execute === 'function') {
                                client.taskManager.registerTask(task);
                            } else {
                                console.warn(`[Task] Неверный формат задачи в файле ${file}`);
                            }
                        });
                    } catch (fileError) {
                        console.error(`[Task] Ошибка загрузки файла ${file}:`, fileError);
                    }
                });

            // Обработка завершения
            process.on('SIGINT', () => {
                console.log('[Task] Остановка всех задач...');
                client.taskManager.stopAllTasks();
                process.exit(0);
            });

        } catch (error) {
            console.error('[Task] Критическая ошибка загрузчика задач:', error);
            client.notifyDevelopers(error);
        }
    }
};