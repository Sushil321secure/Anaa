import http from 'node:http';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { attachSignaling } from './signaling/index.js';
import { startRewardScheduler } from './modules/rewards/service.js';
import { startYogaScheduler } from './modules/yoga/yoga.service.js';

await connectDb();
const server = http.createServer(createApp());
attachSignaling(server);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`
Port ${env.PORT} is already in use: another copy of the API is probably still running (another terminal?).
Stop it, or set a different PORT in server/.env.
`);
    process.exit(1);
  }
  throw err;
});

server.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
  startYogaScheduler(); // group yoga reminders and expired seat holds
  startRewardScheduler(); // monthly point expiry, expiry reminders and housekeeping (idempotent)
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
