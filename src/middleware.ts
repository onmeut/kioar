/**
 * Next.js edge middleware — thin re-export of `src/proxy.ts`.
 *
 * Handles:
 *   - Root "/" redirect: logged-in users (session cookie present) are sent
 *     to /me before any page HTML is generated. This runs at the edge so
 *     browser caches can never serve a stale 200 landing-page response to
 *     an authenticated user.
 *   - "/auth?handle=…" slug pre-fill: captures the handle into a short-lived
 *     cookie before the redirect cleans the URL.
 *
 * The matcher is defined in proxy.ts so it stays co-located with the logic.
 */
export { proxy as middleware, config } from "./proxy";
