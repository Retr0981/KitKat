/**
 * Benchmark: prove the dashboard query (GET /stats equivalent) returns within
 * the success criterion of <1 second on a 10,000-event dataset.
 *
 *   npm run benchmark   (seed first, then run this)
 */

import { db, closeDb } from './db.js';

function time<T>(label: string, fn: () => T): T {
  const start = performance.now();
  const out = fn();
  const ms = performance.now() - start;
  console.log(`${label.padEnd(40)} ${ms.toFixed(1)}ms`);
  return out;
}

function main() {
  const d = db();
  const count = (d.prepare('SELECT COUNT(*) AS n FROM events').get() as { n: number }).n;
  console.log(`\nBenchmarking against ${count.toLocaleString()} events.\n`);

  const under = (ms: number) => (ms < 1000 ? '✓ under 1s' : '✗ OVER 1s');

  // 1. The dashboard stats query (the headline number).
  const statsMs = time('GET /stats (full dashboard payload)', () => {
    d.prepare(`SELECT COUNT(*) AS n FROM events`).get();
    d.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'tool:registered'`).get();
    d.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'tool:result'`).get();
    d.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'tool:result' AND status = 'success'`).get();
    d.prepare(`SELECT AVG(duration_ms) AS a FROM events WHERE type = 'tool:result'`).get();
    d.prepare(
      `SELECT tool_name AS name, COUNT(*) AS count FROM events WHERE tool_name IS NOT NULL
       GROUP BY tool_name ORDER BY count DESC LIMIT 8`,
    ).all();
    return 0;
  });
  console.log(`   → ${under(statsMs)}\n`);

  // 2. A paginated event log read (virtualized list fetch).
  time('GET /events?limit=100 (paginated log)', () =>
    d.prepare('SELECT * FROM events ORDER BY at DESC LIMIT 100 OFFSET 0').all(),
  );

  // 3. A bulk ingest of 1,000 events (extension batch).
  time('POST /events (1,000 event batch insert)', () => {
    const ins = d.prepare(
      `INSERT INTO events (type, origin, tool_name, status, duration_ms, tab_id, at) VALUES (?,?,?,?,?,?,?)`,
    );
    const tx = d.transaction((n: number) => {
      const now = Date.now();
      for (let i = 0; i < n; i++) {
        ins.run('tool:result', 'https://bench.example.com', 'bench.run', 'success', 50, 1, now + i);
      }
    });
    tx(1000);
  });

  closeDb();
}

main();
