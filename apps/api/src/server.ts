import { app } from './app.ts';
import { config } from './config.ts';
import { prisma } from './db.ts';

const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`API Skena Sonik jalan di http://${config.HOST}:${config.PORT} (${config.NODE_ENV})`);
});

// Docker mengirim SIGTERM saat container dihentikan: selesaikan request yang berjalan, tutup koneksi DB
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} diterima, mematikan server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
