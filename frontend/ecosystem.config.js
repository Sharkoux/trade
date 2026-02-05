// PM2 Configuration for Raspberry Pi deployment
// Usage: pm2 start ecosystem.config.js

const path = require('path');
const baseDir = __dirname;

module.exports = {
  apps: [
    {
      name: 'spreadlab-web',
      script: 'npm',
      args: 'start',
      cwd: baseDir,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      // Auto-restart on crash
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // Logs
      error_file: path.join(baseDir, 'logs', 'web-error.log'),
      out_file: path.join(baseDir, 'logs', 'web-out.log'),
      merge_logs: true,
      time: true,
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 1000
    },
    {
      name: 'spreadlab-bot',
      script: 'bot-worker.js',
      cwd: baseDir,
      // Auto-restart on crash
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      // Logs
      error_file: path.join(baseDir, 'logs', 'bot-error.log'),
      out_file: path.join(baseDir, 'logs', 'bot-out.log'),
      merge_logs: true,
      time: true,
      // Wait 10s before restart on crash
      restart_delay: 10000,
      // Exponential backoff
      exp_backoff_restart_delay: 1000
    }
  ]
};
