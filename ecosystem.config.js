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
            autorestart: true,
            restart_delay: 4000,        // Wait 4s before restart
            max_restarts: 15,            // Allow more restarts
            min_uptime: '10s',           // Lower uptime requirement

            // Health monitoring
            kill_timeout: 5000,      
            wait_ready: false,
            listen_timeout: 10000,

            // Graceful start/shutdown
            shutdown_with_message: true,

            // Source control
            merge_logs: true,
            instance_var: 'INSTANCE_ID',

            // Error handling - important!
            exp_backoff_restart_delay: 100,
        }
    ],
};