module.exports = {
    apps: [
        {
            name: 'Backend',
            script: './dist/server.js',
            cwd: '/var/www/backend',
            instances: 1,
            exec_mode: 'fork',

            env: {
                NODE_ENV: 'production',
                PORT: 5001
            },

            // Logging - Using local logs folder
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_file: './logs/combined.log',

            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            // Auto restart configuration
            watch: false,
            ignore_watch: ['node_modules', 'logs', '.git'],

            // Memory and CPU limits
            max_memory_restart: '1G',

            // Restart policy
            restart_delay: 10000,
            max_restarts: 10,
            min_uptime: '30s',

            // Health monitoring
            kill_timeout: 5000,
            wait_ready: false,  // Changed to false to avoid waiting issues
            listen_timeout: 3000,

            // Source control
            merge_logs: true,

            // Advanced PM2 features
            instance_var: 'INSTANCE_ID',

            // Graceful start/shutdown
            shutdown_with_message: true
        }
    ],
};