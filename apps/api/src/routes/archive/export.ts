/**
 * GET /api/archive/export.csv
 *
 * Streams CSV rows from the Postgres `archive_export(filters jsonb)` RPC.
 *
 * Query string → jsonb filters mapping:
 *   q            → q                        (free text)
 *   range        → range_days   (int)       (days from now; 0/empty = all time)
 *   channel      → channel
 *   decision     → decision
 *   agent        → agent
 *   status       → status                   (OPEN | CLOSED | REOPENED)
 *   flag_sla     → flag_sla     (bool)
 *   flag_esc     → flag_esc     (bool)
 *   flag_unauth  → flag_unauth  (bool)
 *
 * Returns:
 *   200 text/csv   — rows streamed line-by-line
 *   416            — { error: 'EXPORT_TOO_LARGE', count } when RPC raises P0001
 *   500            — other errors
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const Query = z.object({
  q: z.string().optional(),
  range: z.coerce.number().int().min(0).optional(),
  channel: z.enum(['voice', 'email', 'web']).optional(),
  decision: z
    .enum([
      'PROCESSING',
      'ELIGIBLE_FOR_DAMAGE_REVIEW',
      'NOT_ELIGIBLE',
      'HUMAN_REVIEW_REQUIRED',
      'WARRANTY_EXPIRED',
    ])
    .optional(),
  agent: z.string().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'REOPENED']).optional(),
  flag_sla: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  flag_esc: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  flag_unauth: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

const route: FastifyPluginAsync = async (app) => {
  app.get('/api/archive/export.csv', async (req, reply) => {
    const parsed = Query.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_query',
        details: parsed.error.flatten(),
      });
    }
    const q = parsed.data;
    const log = req.log.child({ route: 'archive/export' });

    // Build filters object matching the RPC's expected shape.
    const filters: Record<string, unknown> = {};
    if (q.q) filters.q = q.q;
    if (q.range !== undefined) filters.range_days = q.range;
    if (q.channel) filters.channel = q.channel;
    if (q.decision) filters.decision = q.decision;
    if (q.agent) filters.agent = q.agent;
    if (q.status) filters.status = q.status;
    if (q.flag_sla) filters.flag_sla = true;
    if (q.flag_esc) filters.flag_esc = true;
    if (q.flag_unauth) filters.flag_unauth = true;

    const { data, error } = await app.supabase.rpc('archive_export', {
      p_filters: filters,
    });

    if (error) {
      // Postgres raises 'EXPORT_TOO_LARGE: N rows exceed the 10,000-row CSV cap'
      // with errcode P0001. Surface as 416 Range Not Satisfiable.
      const message = error.message || '';
      const tooLarge = /EXPORT_TOO_LARGE/.test(message);
      if (tooLarge) {
        const match = /(\d[\d,]*)\s*rows/.exec(message);
        const count = match ? Number(match[1]!.replace(/,/g, '')) : null;
        log.warn({ count, message }, 'archive export oversize');
        return reply.code(416).send({
          error: 'EXPORT_TOO_LARGE',
          count,
          message,
        });
      }
      log.error({ err: message }, 'archive_export rpc failed');
      return reply.code(500).send({ error: 'export_failed', message });
    }

    const rows = (data ?? []) as string[];
    const filename = `joola-archive-${new Date().toISOString().slice(0, 10)}.csv`;

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('X-Content-Type-Options', 'nosniff');

    // Each element of `rows` is already a fully-formed CSV line (header + data).
    const body = rows.join('\n') + (rows.length ? '\n' : '');
    log.info({ rowCount: rows.length, bytes: body.length }, 'archive export ok');
    return reply.send(body);
  });
};

export default route;
