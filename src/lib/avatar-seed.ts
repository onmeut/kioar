import "server-only";
import { randomBytes } from "node:crypto";

/** Generate a stable, opaque seed string for the boring-avatar fallback. */
export function generateAvatarSeed(): string {
  return randomBytes(8).toString("hex");
}
