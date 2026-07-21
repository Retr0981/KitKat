/**
 * KitKat local analytics server.
 *
 * Lightweight Express + SQLite ingest for WebMCP tool events emitted by the
 * extension's service worker. Runs entirely locally — no external API calls.
 * Start with `npm run server`. The extension batches events to :7421.
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { router } from './routes.js';
import { db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, '..', '..', 'demo');

const PORT = Number(process.env.KITKAT_PORT ?? 7421);
const HOST = process.env.KITKAT_HOST ?? '127.0.0.1';

const app = express();
app.use(cors({ origin: ['chrome-extension://*'] })); // allow the extension
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'kitkat-analytics' }));

// Demo pages — served so you can point the extension at real WebMCP pages.
app.use(express.static(DEMO_DIR));
app.get('/', (_req, res) => res.redirect('/index.html'));

app.use(router);

// Warm the DB + prepared statements at boot so the first request is fast.
db();

const server = app.listen(PORT, HOST, () => {
  console.log(`\n  KitKat analytics server → http://${HOST}:${PORT}\n  Events: POST /events · Dashboard data: GET /stats\n  Press Ctrl+C to stop.\n`);
});

const shutdown = (sig: string) => {
  console.log(`\n${sig} received, shutting down…`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
