#!/usr/bin/env node
// Cross-platform installer (Windows, macOS, Linux):
//   node install.mjs          skill only
//   node install.mjs --mcp    skill + MCP server
import { rmSync, mkdirSync, symlinkSync, cpSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (Number(process.versions.node.split(".")[0]) < 18) {
  console.error(`Node 18+ is required (found ${process.version}): https://nodejs.org`);
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "skills", "roblox-monetize");
const dest = join(process.env.CLAUDE_SKILLS_DIR || join(homedir(), ".claude", "skills"), "roblox-monetize");
const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });

mkdirSync(dirname(dest), { recursive: true });
rmSync(dest, { recursive: true, force: true });
try {
  symlinkSync(src, dest, "junction"); // "junction" needs no admin rights on Windows; ignored elsewhere
} catch {
  cpSync(src, dest, { recursive: true }); // shortcut: a copy does not follow `git pull`, re-run the installer after updating
}
run(`node "${join(dest, "scripts", "monetize.mjs")}" selftest`);
console.log(`Skill installed: ${dest}`);

if (process.argv.includes("--mcp")) {
  run("npm install --silent", { cwd: join(here, "mcp") });
  try { execSync("claude mcp remove roblox-monetize --scope user", { stdio: "ignore" }); } catch {}
  run(`claude mcp add roblox-monetize --scope user -- node "${join(here, "mcp", "server.mjs")}"`);
  console.log("MCP server registered as roblox-monetize");
}
console.log(`\nNext: create an Open Cloud API key, copy it, then run:\n  node "${join(dest, "scripts", "monetize.mjs")}" set-key\nRestart Claude Code so it picks up the skill.`);
