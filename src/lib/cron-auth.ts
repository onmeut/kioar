/**
 * Shared cron authentication helper.
 *
 * Uses the native `crypto.timingSafeEqual` (C++ implementation) rather than a
 * hand-rolled JS loop to ensure the comparison is genuinely constant-time and
 * not susceptible to V8 JIT optimisations that could leak timing information.
 */
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

/**
 * Compare two strings in constant time.
 *
 * Strings of different lengths return `false` immediately (length is not a
 * secret), and the native `timingSafeEqual` is only called when lengths match.
 * Both branches pad via `Buffer.from` so allocation time is uniform.
 */
export function safeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
