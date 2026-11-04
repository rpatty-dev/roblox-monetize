#!/usr/bin/env node
// roblox-monetize: create Roblox game passes and developer products through Open Cloud,
// then write their IDs into your game's Luau config (`Key = 0` -> `Key = <id>`).
// Zero dependencies. Node 18+.
//
//   node monetize.mjs set-key                       (reads the key from stdin)
//   node monetize.mjs check <universeId>
//   node monetize.mjs list <universeId>
//   node monetize.mjs sync <spec.json> [--dry]
//   node monetize.mjs create-pass <universeId> <name> <price> [description] [imagePath]
//   node monetize.mjs create-product <universeId> <name> <price> [description] [imagePath]
//   node monetize.mjs selftest
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://apis.roblox.com";
export const KEY_FILE = join(homedir(), ".config", "roblox-monetize", "api-key");

export function apiKey() {
  if (process.env.ROBLOX_API_KEY) return process.env.ROBLOX_API_KEY.trim();
  if (existsSync(KEY_FILE)) return readFileSync(KEY_FILE, "utf8").trim();
  throw new Error(`No API key. Run: pbpaste | node monetize.mjs set-key   (or set ROBLOX_API_KEY)`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HINTS = {
  401: "API key rejected. Check it was copied fully, or regenerate it.",
  403: "Key is missing permissions. In Creator Hub > Open Cloud > API Keys, give it game-passes and developer-products read + write for this experience, and add 0.0.0.0/0 (or your IP) to Accepted IP Addresses.",
};

async function call(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, { method, headers: { "x-api-key": apiKey() }, body });
    if (res.status === 429 && attempt < 5) { await sleep(1000 * 2 ** attempt); continue; }
    const txt = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${txt.slice(0, 300)}${HINTS[res.status] ? "\n" + HINTS[res.status] : ""}`);
    return txt ? JSON.parse(txt) : {};
  }
}

const KINDS = {
  pass: { base: (u) => `/game-passes/v1/universes/${u}/game-passes`, listKey: "gamePasses", idKey: "gamePassId" },
  product: { base: (u) => `/developer-products/v2/universes/${u}/developer-products`, listKey: "developerProducts", idKey: "productId" },
};

export async function listAll(kind, universeId) {
  const k = KINDS[kind];
  const out = [];
  let token = "";
  do {
    const q = new URLSearchParams({ pageSize: "50" });
    if (token) q.set("pageToken", token);
    const page = await call("GET", `${k.base(universeId)}/creator?${q}`);
    for (const it of page[k.listKey] ?? []) {
      out.push({ id: it[k.idKey], name: it.name, price: it.priceInformation?.defaultPriceInRobux ?? null, isForSale: it.isForSale });
    }
    token = page.nextPageToken || "";
  } while (token);
  return out;
}

export async function create(kind, universeId, { name, price, description = "", imagePath, isForSale = true }) {
  if (!KINDS[kind]) throw new Error(`kind must be "pass" or "product", got ${kind}`);
  if (!name || !Number.isInteger(Number(price)) || Number(price) < 1) throw new Error(`"${name}" needs a whole-number price of at least 1 Robux`);
  const k = KINDS[kind];
  const form = new FormData();
  form.set("name", name);
  form.set("description", description);
  form.set("price", String(Number(price)));
  form.set("isForSale", String(isForSale));
  if (imagePath) form.set("imageFile", new Blob([readFileSync(imagePath)]), basename(imagePath));
  const res = await call("POST", k.base(universeId), form);
  const id = res[k.idKey];
  if (!id) throw new Error(`Create ${kind} "${name}" returned no ${k.idKey}: ${JSON.stringify(res).slice(0, 300)}`);
  // Roblox notes a key without write scope can report success without applying it, so read it back.
  await call("GET", `${k.base(universeId)}/${id}/creator`);
  return id;
}

// ---------------------------------------------------------------- config rewriting
function tableBlock(src, table) {
  const start = src.search(new RegExp(`${table.replace(/\./g, "\\.")}\\s*=\\s*\\{`));
  if (start < 0) return null;
  return { start, end: src.indexOf("}", start) };
}

export function readId(src, table, key) {
  const b = tableBlock(src, table);
  if (!b) return 0;
  const m = src.slice(b.start, b.end).match(new RegExp(`\\b${key}\\s*=\\s*(\\d+)`));
  return m ? Number(m[1]) : 0;
}

// Sets `key = id` inside the table. Never overwrites a real (non-zero) id. Drops a REPLACE_WITH_ID marker on that line.
export function writeId(src, table, key, id) {
  const b = tableBlock(src, table);
  if (!b) throw new Error(`Table ${table} not found in config`);
  const block = src.slice(b.start, b.end);
  const re = new RegExp(`(\\b${key}\\s*=\\s*)(\\d+)([^\\n]*)`);
  const m = block.match(re);
  if (!m) throw new Error(`${table}.${key} not found in config. Add a line like: ${key} = 0,`);
  if (m[2] !== "0" && m[2] !== String(id)) return { src, existing: Number(m[2]) };
  const newBlock = block.replace(re, (_, lhs, _old, rest) => lhs + id + rest.replace(/REPLACE_WITH_ID\s*/, "").replace(/\s*--\s*$/, ""));
  return { src: src.slice(0, b.start) + newBlock + src.slice(b.end), existing: null };
}

// ---------------------------------------------------------------- sync
export async function sync({ universeId, configPath, passTable = "Config.Passes", productTable = "Config.Products", items, dryRun = false }, baseDir = ".") {
  if (!universeId || !configPath || !Array.isArray(items) || !items.length) throw new Error("Spec needs universeId, configPath and a non-empty items list");
  const path = resolve(baseDir, configPath);
  let src = readFileSync(path, "utf8");
  for (const it of items) {
    const table = it.kind === "pass" ? passTable : productTable;
    if (!/^[A-Za-z_]\w*$/.test(it.key ?? "")) throw new Error(`Bad key: ${it.key}`);
    const b = tableBlock(src, table);
    if (!b || !new RegExp(`\\b${it.key}\\s*=\\s*\\d+`).test(src.slice(b.start, b.end)))
      throw new Error(`${table}.${it.key} not found in ${configPath}. Add "${it.key} = 0," to that table first.`);
  }
  const existing = { pass: await listAll("pass", universeId), product: await listAll("product", universeId) };
  const report = [];
  for (const it of items) {
    const table = it.kind === "pass" ? passTable : productTable;
    const current = readId(src, table, it.key);
    if (current) { report.push({ key: it.key, action: "kept", id: current }); continue; }
    const match = existing[it.kind].find((e) => e.name.toLowerCase() === it.name.toLowerCase());
    let id = match?.id;
    const action = match ? "reused" : "created";
    if (!id) {
      if (dryRun) { report.push({ key: it.key, action: "would-create", kind: it.kind, name: it.name, price: it.price }); continue; }
      id = await create(it.kind, universeId, { ...it, imagePath: it.imagePath && resolve(baseDir, it.imagePath) });
      await sleep(400); // developer products allow 3 writes/second
    }
    src = writeId(src, table, it.key, id).src;
    report.push({ key: it.key, action, kind: it.kind, id, name: it.name, price: it.price });
  }
  if (!dryRun) writeFileSync(path, src);
  return report;
}

// ---------------------------------------------------------------- self-test (offline)
export function selftest() {
  const cfg = `Config.Passes = {\n\tDoubleCash = 0, -- REPLACE_WITH_ID\n\tLucky = 0, -- REPLACE_WITH_ID (more luck)\n\tVIP = 55,\n}\nConfig.Products = {\n\tCashPack = 0,\n}\n`;
  let { src } = writeId(cfg, "Config.Passes", "DoubleCash", 123);
  src = writeId(src, "Config.Passes", "Lucky", 124).src;
  src = writeId(src, "Config.Products", "CashPack", 456).src;
  const assert = (c, m) => { if (!c) throw new Error("selftest failed: " + m); };
  assert(readId(src, "Config.Passes", "DoubleCash") === 123, "pass id written");
  assert(readId(src, "Config.Products", "CashPack") === 456, "product id written");
  assert(readId(src, "Config.Passes", "VIP") === 55, "other ids untouched");
  assert(writeId(src, "Config.Passes", "VIP", 99).existing === 55, "never overwrites a real id");
  assert(src.includes("DoubleCash = 123,\n"), "placeholder marker removed");
  assert(src.includes("Lucky = 124, -- (more luck)"), "other comment text kept");
  return "selftest ok";
}

// ---------------------------------------------------------------- CLI
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...a] = process.argv.slice(2);
  const print = (v) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
  const run = {
    "set-key": async () => {
      const key = readFileSync(0, "utf8").trim();
      if (key.length < 40 || /\s/.test(key)) throw new Error("That doesn't look like an Open Cloud API key. Copy the full key and try again.");
      mkdirSync(dirname(KEY_FILE), { recursive: true, mode: 0o700 });
      writeFileSync(KEY_FILE, key + "\n", { mode: 0o600 });
      chmodSync(KEY_FILE, 0o600);
      return `Saved to ${KEY_FILE}`;
    },
    check: async () => {
      const [u] = a;
      const passes = await listAll("pass", u);
      const products = await listAll("product", u);
      return `Key works for universe ${u}: ${passes.length} game passes, ${products.length} developer products.`;
    },
    list: async () => ({ passes: await listAll("pass", a[0]), products: await listAll("product", a[0]) }),
    sync: async () => {
      const specPath = resolve(a[0] ?? "monetization.json");
      return sync({ ...JSON.parse(readFileSync(specPath, "utf8")), dryRun: a.includes("--dry") }, dirname(specPath));
    },
    "create-pass": async () => ({ gamePassId: await create("pass", a[0], { name: a[1], price: a[2], description: a[3], imagePath: a[4] }) }),
    "create-product": async () => ({ productId: await create("product", a[0], { name: a[1], price: a[2], description: a[3], imagePath: a[4] }) }),
    selftest: async () => selftest(),
  }[cmd];
  if (!run) {
    console.error("Usage: monetize.mjs <set-key|check|list|sync|create-pass|create-product|selftest> ...  (see SKILL.md)");
    process.exit(2);
  }
  run().then(print, (e) => { console.error(e.message ?? e); process.exit(1); });
}
