/**
 * PM2 ecosystem config.
 * - pattern-scheduler: runs pattern scan daily at 2am; runs tweet job only if RUN_TWEET_JOB=true (e.g. on Pi).
 * - dashboard: serves Vue app + pattern results API on port 3000.
 * Start: pm2 start ecosystem.config.cjs
 * Logs: pm2 logs
 */

module.exports = {
  apps: [
    {
      name: 'pattern-scheduler',
      script: 'src/scheduler.ts',
      cwd: __dirname,
      interpreter: 'npx',
      interpreter_args: ['tsx'],
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      env: {},
      env_file: '.env',
    },
    {
      name: 'dashboard',
      script: 'src/dashboard-server.ts',
      cwd: __dirname,
      interpreter: 'npx',
      interpreter_args: ['tsx'],
      autorestart: true,
      watch: false,
      env: { PORT: '3000' },
      env_file: '.env',
    },
  ],
};
