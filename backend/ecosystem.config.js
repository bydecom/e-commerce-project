module.exports = {
  apps: [
    {
      name: 'bandai-api',
      script: 'npm',
      args: 'run start:prod', // Gọi lệnh đã cấu hình sẵn trong package.json
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M', // Khởi động lại nếu ngốn quá nhiều RAM của EC2 Free Tier
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        // Tận dụng biến môi trường lấy từ file .env.production thông qua dotenv-cli 
        // ở câu lệnh start:prod của bạn
      }
    }
  ]
};
