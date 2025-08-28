import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  currency: process.env.STRIPE_CURRENCY || 'usd',
  apiVersion: process.env.STRIPE_API_VERSION || '2024-12-18.acacia',
}));