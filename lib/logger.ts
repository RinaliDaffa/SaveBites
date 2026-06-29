/**
 * SaveBites v3 — structured logger.
 *
 * Replacement for console.error in API routes. Writes:
 *   1. A console line in dev (and a structured one in prod via Vercel).
 *   2. A row in public.error_logs via the admin client.
 *
 * The error_logs insert is fire-and-forget -- it never throws or
 * blocks the response. All writes happen on the server only; this
 * module imports the admin client and must not be used from RSC or
 * client components.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type ErrorLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  route: string;
  method?: string;
  requestId?: string;
  userId?: string;
  statusCode?: number;
}

const isDev = process.env.NODE_ENV !== 'production';

const LEVEL_TO_INT: Record<ErrorLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

function isoTimestamp(): string {
  return new Date().toISOString();
}

function emit(level: ErrorLevel, ctx: LogContext, message: string, details?: unknown) {
  const line = {
    level,
    ts: isoTimestamp(),
    route: ctx.route,
    method: ctx.method,
    requestId: ctx.requestId,
    userId: ctx.userId,
    statusCode: ctx.statusCode,
    msg: message,
    details: details ?? null,
  };

  // Always emit to stderr in production so Vercel picks it up as
  // a structured log line. In dev, also emit for human readability.
  const stream = level === 'debug' || level === 'info' ? 'log' : 'error';
  // eslint-disable-next-line no-console
  console[stream](JSON.stringify(line));

  // Persist warn+ to error_logs. info and debug are too noisy for the DB.
  if (LEVEL_TO_INT[level] < LEVEL_TO_INT.warn) return;
  if (isDev) return; // Don't pollute error_logs in dev -- it makes local debugging painful.

  // Fire-and-forget. Never block on the DB write.
  void persistToDb(level, ctx, message, details).catch(() => {
    // Silent: if the DB is down, we already have the console line.
  });
}

async function persistToDb(
  level: ErrorLevel,
  ctx: LogContext,
  message: string,
  details: unknown,
) {
  try {
    const supabase = createAdminClient();
    await supabase.from('error_logs').insert({
      level,
      route: ctx.route,
      method: ctx.method ?? null,
      request_id: ctx.requestId ?? null,
      user_id: ctx.userId ?? null,
      status_code: ctx.statusCode ?? null,
      message,
      details: details === undefined ? null : (details as object),
    });
  } catch {
    // Logger must never throw.
  }
}

export const logger = {
  debug: (ctx: LogContext, msg: string, details?: unknown) => emit('debug', ctx, msg, details),
  info: (ctx: LogContext, msg: string, details?: unknown) => emit('info', ctx, msg, details),
  warn: (ctx: LogContext, msg: string, details?: unknown) => emit('warn', ctx, msg, details),
  error: (ctx: LogContext, msg: string, details?: unknown) => emit('error', ctx, msg, details),
  fatal: (ctx: LogContext, msg: string, details?: unknown) => emit('fatal', ctx, msg, details),
};

/**
 * Helper for API routes: derive a LogContext from a NextRequest.
 * Use once at the top of the route and pass to subsequent log calls.
 */
export function ctxFromRequest(
  route: string,
  req: Request,
  extras: Pick<LogContext, 'requestId' | 'userId' | 'statusCode'> = {},
): LogContext {
  return {
    route,
    method: req.method,
    ...extras,
  };
}