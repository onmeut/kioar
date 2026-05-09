import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Request-scoped logging context.
 *
 * AsyncLocalStorage propagates a `requestId` (and optionally other
 * structured fields) through every `await` chain rooted in a wrapped
 * callback. The request-id correlates log lines emitted across:
 *
 *   - the route handler body
 *   - service files it calls (`billing-apply`, `sms-queue`, `profile-cache`)
 *   - DB transactions and Redis ops, transitively
 *
 * Why ALS and not `headers()` from `next/headers`?
 *   `headers()` only works in Server Components and route handlers; it
 *   cannot be called from a service file. ALS works uniformly everywhere
 *   in Node (Next 16's App Router on the Node runtime), including deep
 *   inside library code that has no idea it's serving a request.
 *
 * Why not seed in middleware?
 *   The proxy (`src/proxy.ts`) is intentionally scoped to `/auth`.
 *   Broadening its matcher to set `x-request-id` on every request adds
 *   middleware overhead to static assets. Cron routes are external
 *   entry points anyway — no upstream client emits an `x-request-id`,
 *   so generation lives at the route handler regardless. Each route
 *   handler that wants correlation explicitly wraps its body in
 *   `withRequestContext`.
 */

export type RequestContext = {
  /** Stable identifier for the request — UUIDv4. */
  requestId: string;
  /** Optional route label for filterability, e.g. "cron.billing". */
  route?: string;
  /** Free-form fields. Merged into every log line emitted within scope. */
  fields?: Record<string, unknown>;
};

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Run `fn` with `ctx` as the active request context. Any `log.*` call
 * emitted inside the callback (or inside any awaited descendant) will
 * automatically include `ctx.requestId` and `ctx.route` in its payload.
 *
 * If `ctx.requestId` is omitted a fresh UUID is generated. Callers that
 * already have an upstream id (e.g. forwarded via `x-request-id`)
 * SHOULD pass it through so log lines stitch end-to-end.
 */
export function withRequestContext<T>(
  ctx: Partial<RequestContext>,
  fn: () => Promise<T>,
): Promise<T> {
  const resolved: RequestContext = {
    requestId: ctx.requestId ?? randomUUID(),
    route: ctx.route,
    fields: ctx.fields,
  };
  return storage.run(resolved, fn);
}

/**
 * Returns the current ALS-bound context, or `undefined` if the caller
 * is running outside a `withRequestContext` scope (legacy code, tests,
 * scripts). `log.*` falls back to emitting without correlation in
 * that case — never throws.
 */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
