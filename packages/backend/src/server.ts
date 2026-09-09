import dotenv from 'dotenv';
import { buildApp } from './app.js';

// Load .env
dotenv.config({ path: '../../.env' });
dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const app = await buildApp();
    console.log(`\n🚀 Academy Management System Backend running on http://${HOST}:${PORT}`);
    console.log(`📊 Health Endpoint: http://${HOST}:${PORT}/api/v1/health`);
    console.log(`🔐 Brevo OTP Auth: http://${HOST}:${PORT}/api/v1/auth/request-otp\n`);
  } catch (err) {
    console.error('Fatal server boot error:', err);
    process.exit(1);
  }
}

start();
