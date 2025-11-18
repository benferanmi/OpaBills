module.exports = {
    apps: [
        {
            name: 'Backend',
            script: './dist/server.js',
            cwd: '/var/www/backend',
            instances: 1,
            exec_mode: 'fork',

            // Default environment
            env: {
                NODE_ENV: 'development',
                PORT: 5001
            },

            // Production environment (explicitly defined)
            env_production: {
                NODE_ENV: 'production',
                PORT: 5001
            },

            // Logging
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_file: './logs/combined.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,

            // Watch configuration
            watch: false,
            ignore_watch: ['node_modules', 'logs', '.git'],

            // Memory limits
            max_memory_restart: '1G',

            // Restart policy
            autorestart: true,
            restart_delay: 4000,
            max_restarts: 10,
            min_uptime: '10s',

            kill_timeout: 10000,         // Give 10 seconds for graceful shutdown
            wait_ready: false,           // Don't wait for ready signal
            listen_timeout: 5000,        // Timeout for listening
            shutdown_with_message: true, // Enable shutdown messages

            // Restart backoff
            exp_backoff_restart_delay: 100,

            // Instance variable
            instance_var: 'INSTANCE_ID',
        }
    ],
};