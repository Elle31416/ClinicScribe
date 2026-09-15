#!/usr/bin/env node
/**
 * Rewires the AssemblyAI Voice Agent ID used by the frontend.
 *
 * Usage:
 *   npm run import agent_b0aca15004de4ab2b39bbfc1ce360956
 *   AGENT_ID=agent_b0aca15004de4ab2b39bbfc1ce360956 npm run import
 *
 * The ID lives in exactly one place: the `AGENT_ID` constant at the top of
 * `public/app.js`, which is sent in the Voice Agent WebSocket handshake
 * (`session: { agent_id: AGENT_ID }`). This script rewrites that line so the
 * client binds to a different stored agent — its voice, greeting, system
 * prompt, and tools all come from the agent, not from this repo.
 *
 * The command is idempotent: importing an already-active agent is a no-op.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const AGENT_ID_PATTERN = /^agent_[a-f0-9]{32}$/;
const AGENT_ID_LINE = /const AGENT_ID = "agent_[a-f0-9]{32}";/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const agentId = process.argv[2] ?? process.env.AGENT_ID ?? "";

if (!agentId) {
  fail(
    "Usage: npm run import <agent_id>\n" +
      "Example: npm run import agent_b0aca15004de4ab2b39bbfc1ce360956",
  );
}

if (!AGENT_ID_PATTERN.test(agentId)) {
  fail(
    `Invalid agent ID: ${agentId}\n` +
      "Expected format: agent_ followed by 32 lowercase hex characters.",
  );
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "public", "app.js");

const source = readFileSync(appPath, "utf8");

if (!AGENT_ID_LINE.test(source)) {
  fail(
    "Could not find the AGENT_ID constant in public/app.js.\n" +
      'Expected a line like:  const AGENT_ID = "agent_...";',
  );
}

if (source.includes(`const AGENT_ID = "${agentId}";`)) {
  console.log(`public/app.js already points at ${agentId} — nothing to do.`);
  process.exit(0);
}

writeFileSync(
  appPath,
  source.replace(AGENT_ID_LINE, `const AGENT_ID = "${agentId}";`),
  "utf8",
);

console.log(`Imported agent ${agentId} into public/app.js.`);
console.log("Commit public/app.js (and redeploy if running) to activate the new agent.");
