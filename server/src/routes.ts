/**
 * HTTP routes for the KitKat analytics server.
 *
 *   POST /events          batch ingest (body: { events: IngestEvent[] })
 *   GET  /events          paginated, filterable event log (?type&tool&status&limit&offset)
 *   GET  /stats           aggregate KPIs + series + breakdowns (dashboard payload)
 *   GET  /tools           ranked tool usage
 *   GET  /export          CSV or JSON dump
 *   GET  /stream          server-sent events (live tail)
 *
 * All prepared once at module load — the 10k/<1s target rests on this.
 */

import { Router } from 'express';
import { db } from './db.js';

export interface IngestEvent {
  type: string;
  origin: string;
  toolName?: string | null;
  status?: string | null;
  durationMs?: number | null;
  at: number;
  tabId?: number | null;
}

export const router = Router();

// --- Prepared statements (compiled once) ------------------------------------
const stmts = () => {
  const d = db();
  return {
    insert: d.prepare(
      `INSERT INTO events (type, origin, tool_name, status, duration_ms, tab_id, at)
       VALUES (@type, @origin, @toolName, @status, @durationMs, @tabId, @at)`,
    ),
    count: d.prepare('SELECT COUNT(*) AS n FROM events'),
    range: d.prepare('SELECT * FROM events ORDER BY at DESC LIMIT ? OFFSET ?'),
    byType: d.prepare('SELECT * FROM events WHERE type = ? ORDER BY at DESC LIMIT ? OFFSET ?'),
    byTool: d.prepare('SELECT * FROM events WHERE tool_name = ? ORDER BY at DESC LIMIT ? OFFSET ?'),
  };
};

// --- POST /events -----------------------------------------------------------
const ingestMany = (events: IngestEvent[]) => {
  const s = stmts();
  const tx = db().transaction((rows: IngestEvent[]) => {
    for (const r of rows) {
      s.insert.run({
        type: r.type,
        origin: r.origin,
        toolName: r.toolName ?? null,
        status: r.status ?? null,
        durationMs: r.durationMs ?? null,
        tabId: r.tabId ?? null,
        at: r.at,
      });
    }
  });
  tx(events);
};

router.post('/events', (req, res) => {
  const events = req.body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: 'body.events must be a non-empty array' });
    return;
  }
  try {
    ingestMany(events as IngestEvent[]);
    res.json({ ingested: events.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- GET /events ------------------------------------------------------------
router.get('/events', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 1000);
  const offset = Number(req.query.offset ?? 0);
  const s = stmts();
  let rows;
  if (req.query.type) rows = s.byType.all(String(req.query.type), limit, offset);
  else if (req.query.tool) rows = s.byTool.all(String(req.query.tool), limit, offset);
  else rows = s.range.all(limit, offset);
  res.json({ events: rows });
});

// --- GET /stats -------------------------------------------------------------
router.get('/stats', (_req, res) => {
  const d = db();
  const totalEvents = (stmts().count.get() as { n: number }).n;
  const totalRegistrations = (
    d.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'tool:registered'`).get() as { n: number }
  ).n;
  const invocations = (
    d.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'tool:result'`).get() as { n: number }
  ).n;
  const success = (
    d.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'tool:result' AND status = 'success'`).get() as {
      n: number;
    }
  ).n;
  const errors = invocations - success;
  const avgDuration = (
    d.prepare(`SELECT AVG(duration_ms) AS a FROM events WHERE type = 'tool:result'`).get() as { a: number | null }
  ).a;

  const topTools = d
    .prepare(
      `SELECT tool_name AS name, COUNT(*) AS count
       FROM events WHERE tool_name IS NOT NULL
       GROUP BY tool_name ORDER BY count DESC LIMIT 8`,
    )
    .all() as { name: string; count: number }[];

  const errorBreakdown = d
    .prepare(
      `SELECT
         CASE
           WHEN type = 'tool:result' AND status != 'success' THEN 'execution'
           WHEN type = 'consent:resolved' THEN 'permission'
           WHEN type = 'error' THEN COALESCE(NULL, 'execution')
           ELSE 'unknown' END AS category,
         COUNT(*) AS count
       FROM events
       WHERE type IN ('tool:result','consent:resolved','error')
         AND NOT (type = 'tool:result' AND status = 'success')
       GROUP BY category`,
    )
    .all() as { category: string; count: number }[];

  // 24-bucket series over the last 24h.
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const rawSeries = d
    .prepare(
      `SELECT (at / 3600000) * 3600000 AS bucket,
              SUM(CASE WHEN type = 'tool:result' THEN 1 ELSE 0 END) AS invocations,
              SUM(CASE WHEN type = 'tool:result' AND status != 'success' THEN 1 ELSE 0 END) AS errors
       FROM events WHERE at >= ?
       GROUP BY bucket ORDER BY bucket`,
    )
    .all(dayAgo) as { bucket: number; invocations: number; errors: number }[];
  const series = rawSeries.map((r) => ({
    bucket: new Date(r.bucket).toISOString().slice(0, 16),
    invocations: r.invocations ?? 0,
    errors: r.errors ?? 0,
  }));

  res.json({
    totalEvents,
    totalRegistrations,
    invocations,
    successRate: invocations ? (success / invocations) * 100 : 100,
    errorRate: invocations ? (errors / invocations) * 100 : 0,
    avgDurationMs: avgDuration ?? 0,
    topTools,
    errorBreakdown,
    series,
  });
});

// --- GET /tools -------------------------------------------------------------
router.get('/tools', (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT tool_name AS name,
              COUNT(*) AS count,
              SUM(CASE WHEN type='tool:result' AND status='success' THEN 1 ELSE 0 END) AS successes,
              AVG(CASE WHEN type='tool:result' THEN duration_ms END) AS avgMs
       FROM events WHERE tool_name IS NOT NULL
       GROUP BY tool_name ORDER BY count DESC`,
    )
    .all();
  res.json({ tools: rows });
});

// --- GET /export ------------------------------------------------------------
router.get('/export', (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const rows = stmts().range.all(10000, 0) as Record<string, unknown>[];
  if (format === 'json') {
    res.setHeader('Content-Disposition', 'attachment; filename="kitkat-events.json"');
    res.json(rows);
    return;
  }
  const headers = ['id', 'type', 'origin', 'tool_name', 'status', 'duration_ms', 'tab_id', 'at'];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kitkat-events.csv"');
  res.send(csv);
});

// --- GET /stream (SSE) ------------------------------------------------------
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = () => res.write(`data: ${JSON.stringify({ at: Date.now() })}\n\n`);
  const interval = setInterval(send, 15000);
  req.on('close', () => clearInterval(interval));
});
