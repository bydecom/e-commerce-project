import { app } from './src/app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`Backend: http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/api/health`);
  console.log('========================================');
});
