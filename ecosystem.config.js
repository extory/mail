module.exports = {
  apps: [
    {
      name: "mail",
      script: "node_modules/.bin/next",
      args: "start -p 3100",
      cwd: "/Users/nick/mail",
      env: {
        NODE_ENV: "production",
        PORT: 3100,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/Users/nick/mail/logs/error.log",
      out_file: "/Users/nick/mail/logs/out.log",
      merge_logs: true,
    },
  ],
};
