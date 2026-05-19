#!/usr/bin/env node
"use strict";

/**
 * Production server entry-point wrapper.
 *
 * This file REPLACES the Next.js standalone `server.js` in the Docker image.
 * The real Next.js server is renamed to `_server.js` during build.
 *
 * Flow:
 *   1. Run Drizzle migrations (crash if any fail)
 *   2. Load the real Next.js server
 *
 * Why: Hamravesh/Darkube PaaS overrides Dockerfile ENTRYPOINT/CMD and runs
 * `node server.js` directly. This wrapper guarantees migrations execute
 * regardless of how the container is started.
 */

const { execSync } = require("node:child_process");
const path = require("node:path");

const cwd = path.resolve(__dirname);

// ---------- Step 1: Run migrations ----------
try {
  console.log("⏳ [server-wrapper] Running database migrations…");
  execSync("node --import tsx scripts/migrate.ts", {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  console.log("✅ [server-wrapper] Migrations applied successfully.");
} catch (err) {
  console.error("❌ [server-wrapper] Migration FAILED — aborting startup.");
  process.exit(1);
}

// ---------- Step 2: Start Next.js ----------
require("./_server.js");
