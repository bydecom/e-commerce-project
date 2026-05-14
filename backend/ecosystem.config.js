module.exports = {
  apps: [
    {
      name: 'bandai-api',
      script: './dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'email-worker',
      script: './dist/src/workers/email.worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};