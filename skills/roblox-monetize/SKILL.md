---
name: roblox-monetize
description: Create Roblox game passes and developer products automatically through Open Cloud and write their real IDs into the game's Luau config. Use when the user wants to set up monetization, add game passes or developer products, replace placeholder IDs (0 / REPLACE_WITH_ID), list existing passes/products, or make store items actually work in a Roblox game.
---

# Roblox Monetize

Turns a short item list into live, for-sale game passes and developer products, then writes each ID into the game's config so purchases work in game. Re-running it is safe: existing IDs are kept and items with the same name are reused, never duplicated.

The script lives next to this file: `scripts/monetize.mjs`. It needs Node 18+ and has no dependencies. Below, `$S` means the absolute path to that script.

## 1. Make sure there is a working API key

Run `node $S check <universeId>`.

- If it says `No API key`, ask the user to create one. Give them these exact steps:
  1. Go to create.roblox.com, then Open Cloud > API Keys > Create API Key.
  2. Under Access Permissions, add **game-passes** and pick operations **read** and **write**, for their experience.
  3. Add **developer-products** with **read** and **write**, for the same experience.
  4. Under Accepted IP Addresses, enter `0.0.0.0/0` (or their own IP).
  5. Save, copy the key, then type in the chat: `! pbpaste | node $S set-key`

  Never ask the user to paste the key into the chat. If they do anyway, save it with `set-key` and suggest they regenerate it afterwards.
- If it says `Key is missing permissions` (403), the key exists but lacks scopes or the IP list. Repeat steps 2 to 4 by editing the existing key; no new key is needed.

To find the universe ID, look at the Creator Hub URL (`/experiences/<universeId>/`). In Studio, `game.GameId` is the universe ID; it is not the place ID.

## 2. Find where the game stores IDs

Search the game's Luau source for the pass/product ID tables, for example:

```lua
Config.Passes = {
	DoubleCash = 0, -- REPLACE_WITH_ID
}
Config.Products = {
	CashPack = 0,
}
```

Every item needs a `Key = 0,` line inside the matching table before syncing. If the game has no such table yet, add one and make the purchase code read from it (game passes: `MarketplaceService:UserOwnsGamePassAsync` and `PromptGamePassPurchase`; products: `PromptProductPurchase` plus a `ProcessReceipt` handler that grants the item and returns `PurchaseGranted`).

## 3. Write the spec

Create `monetization.json` in the game repo. Paths are relative to this file.

```json
{
  "universeId": 1234567890,
  "configPath": "src/shared/Config.luau",
  "passTable": "Config.Passes",
  "productTable": "Config.Products",
  "items": [
    { "key": "DoubleCash", "kind": "pass", "name": "2x Cash", "price": 149, "description": "Every action pays double. Forever." },
    { "key": "CashPack", "kind": "product", "name": "Cash Pack", "price": 49, "description": "A big pile of cash, instantly.", "imagePath": "icons/cashpack.png" }
  ]
}
```

- `kind` is `pass` (one-time, permanent) or `product` (consumable, buy many times).
- `price` is whole Robux and at least 1. A good ladder is a cheap entry item (19 to 99), a main pass (149 to 249) and a big-ticket option.
- `imagePath` is optional (PNG or JPG icon, 512x512 works well).
- `passTable` and `productTable` default to `Config.Passes` and `Config.Products`.
- If an item is a paid random reward (crates, loot boxes), the game must show its odds before purchase. Put the odds in the description too.

## 4. Dry run, then sync

```bash
node $S sync path/to/monetization.json --dry   # shows what would be created
node $S sync path/to/monetization.json         # creates items and writes IDs
```

Show the user the dry-run table and confirm before the real run, because creating items is visible on their Roblox account. Each report line says `created`, `reused` or `kept`, with the ID.

## 5. Verify

- `node $S list <universeId>` shows every item, its price and whether it is for sale.
- Open the config file and confirm each `Key = 0` is now a real ID.
- If the game runs in Studio with the MCP connected, call `MarketplaceService:GetProductInfoAsync(id, Enum.InfoType.GamePass or Enum.InfoType.Product)` on the server to confirm the game sees each item.
- Tell the user the game must be published (File > Publish to Roblox) for real purchases. Purchases inside Studio are free test purchases.

## Other commands

```bash
node $S create-pass <universeId> "<name>" <price> ["description"] [icon.png]
node $S create-product <universeId> "<name>" <price> ["description"] [icon.png]
node $S selftest      # offline check of the config rewriting
```

## Errors

| Message | Fix |
|---|---|
| `No API key` | Step 1 |
| `401` | Key copied wrongly or revoked. Regenerate and `set-key` again |
| `403 ... Scope not authorized` | Add the read/write operations and the IP list to the key |
| `... not found in config` | Add `Key = 0,` to that table first |
| `429` | Rate limited. The script retries automatically |
