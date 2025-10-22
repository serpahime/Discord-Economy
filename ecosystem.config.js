module.exports = {
    apps: [
      {
        name: "zxc-economy",
        script: "src/index.js",     // Путь к главному файлу бота
        watch: ["src"],             // Отслеживаем изменения в папке src
        exec_mode: "fork",
        
        // Настройки логирования
        error_file: "logs/err.log",
        out_file: "logs/out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss",
        merge_logs: true,
        
        // Управление ресурсами
        max_memory_restart: "1G",
        autorestart: true,
        max_restarts: 10,
        restart_delay: 4000,
        
        // Переменные окружения
        env: {
          NODE_ENV: "production",
        },
        
        // Настройки мониторинга
        min_uptime: "30s",
        listen_timeout: 8000,
        kill_timeout: 3000,
        
        // Игнорируемые файлы
        ignore_watch: [
          "logs",
          "node_modules",
          "*.log",
          ".git",
          "*.json"
        ],
      },
    ],
  };