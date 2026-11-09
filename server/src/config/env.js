import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load server/.env no matter which folder the server is started from (npm start, npm run dev, node src/server.js,
// the seed script). Variables that are already set in the environment (Docker, CI, tests) are never overridden.
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envFile, quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_MOCK: z.enum(['true', 'false']).default('false'),
  MAIL_FROM: z.string().default('Anaa Nutricare <no-reply@localhost>'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const missing = Object.keys(parsed.error.flatten().fieldErrors);
  console.error('\nInvalid environment configuration:', parsed.error.flatten().fieldErrors);
  console.error(
    fs.existsSync(envFile)
      ? `\nThe file ${envFile} exists but these settings are missing or invalid: ${missing.join(', ')}. Compare it with .env.example.\n`
      : `\nThere is no .env file at ${envFile}.\nCreate one by copying .env.example to .env in the server folder, then set MONGO_URI and JWT_SECRET.\n`,
  );
  process.exit(1);
}

export const env = parsed.data;
