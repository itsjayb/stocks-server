/**
 * PM2 ecosystem config for the tweet scheduler.
 * Start: pm2 start ecosystem.config.cjs
 * Logs: pm2 logs tweet-scheduler
 */

module.exports = {
  apps: [
    {
      name: 'tweet-scheduler',
      script: 'src/scheduler.js',
      cwd: __dirname,
      interpreter: 'node',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      env: {},
      env_file: '.env',
    },
  ],
};
