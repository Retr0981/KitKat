/**
 * Seed the analytics DB with 10,000 realistic WebMCP events so the dashboard
 * has something to render and the benchmark has data to measure against.
 *
 *   npm run seed
 */

import { db, closeDb } from './db.js';
import type { IngestEvent } from './routes.js';

const TOOL_NAMES = [
  'shop.search',
  'shop.addToCart',
  'shop.checkout',
  'travel.searchFlights',
  'travel.bookTrip',
  'support.getOrder',
  'support.refund',
];

const ORIGINS = [
  'https://shop.example.com',
  'https://travel.example.com',
  'https://support.example.com',
];

function main() {
  const count = Number(process.argv[2] ?? 10000);
  const now = Date.now();
  const insert = db().prepare(
    `INSERT INTO events (type, origin, tool_name, status, duration_ms, tab_id, at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db().transaction((events: IngestEvent[]) => {
    for (const e of events) {
      insert.run(e.type, e.origin, e.toolName ?? null, e.status ?? null, e.durationMs ?? null, e.tabId ?? null, e.at);
    }
  });

  const events: IngestEvent[] = [];
  for (let i = 0; i < count; i++) {
    const tool = TOOL_NAMES[i % TOOL_NAMES.length]!;
    const origin = ORIGINS[i % ORIGINS.length]!;
    // 1 registration per ~10 invocations, mostly successful.
    const isReg = i % 10 === 0;
    const isError = !isReg && i % 13 === 0;
    events.push({
      type: isReg ? 'tool:registered' : 'tool:result',
      origin,
      toolName: tool,
      status: isReg ? null : isError ? 'error' : 'success',
      durationMs: isReg ? null : Math.round(20 + Math.random() * 480),
      tabId: 1,
      at: now - (count - i) * 1000 * 60,
    });
  }
  tx(events);
  console.log(`Seeded ${count} events.`);
  closeDb();
}

main();
