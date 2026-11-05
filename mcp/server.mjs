#!/usr/bin/env node
// Optional MCP server exposing the same operations as the skill script.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { listAll, create, sync } from "../skills/roblox-monetize/scripts/monetize.mjs";

const server = new McpServer({ name: "roblox-monetize", version: "1.1.0" });
const wrap = (fn) => async (args) => {
  try { return { content: [{ type: "text", text: JSON.stringify(await fn(args), null, 2) }] }; }
  catch (e) { return { isError: true, content: [{ type: "text", text: String(e.message ?? e) }] }; }
};
const item = z.object({
  key: z.string(), kind: z.enum(["pass", "product"]), name: z.string(), price: z.number().int().min(1),
  description: z.string().optional(), imagePath: z.string().optional(),
});

server.tool("list_monetization", "List all game passes and developer products in a universe.",
  { universeId: z.number().int() },
  wrap(async ({ universeId }) => ({ passes: await listAll("pass", universeId), products: await listAll("product", universeId) })));
server.tool("create_game_pass", "Create one game pass (for sale).",
  { universeId: z.number().int(), name: z.string(), price: z.number().int().min(1), description: z.string().optional(), imagePath: z.string().optional() },
  wrap(async ({ universeId, ...rest }) => ({ gamePassId: await create("pass", universeId, rest) })));
server.tool("create_developer_product", "Create one developer product (for sale).",
  { universeId: z.number().int(), name: z.string(), price: z.number().int().min(1), description: z.string().optional(), imagePath: z.string().optional() },
  wrap(async ({ universeId, ...rest }) => ({ productId: await create("product", universeId, rest) })));
server.tool("sync_config",
  "Create any missing passes/products and write their IDs into the game's Luau config. Idempotent. Pass specPath (monetization.json) or the fields inline. Use dryRun first.",
  { specPath: z.string().optional(), universeId: z.number().int().optional(), configPath: z.string().optional(), items: z.array(item).optional(),
    passTable: z.string().optional(), productTable: z.string().optional(), dryRun: z.boolean().optional() },
  wrap(async ({ specPath, dryRun, ...inline }) => specPath
    ? sync({ ...JSON.parse(readFileSync(specPath, "utf8")), dryRun }, dirname(resolve(specPath)))
    : sync({ ...inline, dryRun })));

await server.connect(new StdioServerTransport());
