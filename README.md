# roblox-monetize

[![test](https://github.com/rpatty-dev/roblox-monetize/actions/workflows/test.yml/badge.svg)](https://github.com/rpatty-dev/roblox-monetize/actions/workflows/test.yml)
![Windows | macOS | Linux](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![license MIT](https://img.shields.io/badge/license-MIT-green)

**Stop copy-pasting game pass IDs out of Creator Hub.** Tell Claude "add a VIP pass for 299 Robux" and it creates the pass on Roblox, puts it on sale, and writes the real ID into your game's config.

A Claude Code skill that creates your Roblox **game passes and developer products for you** and writes their real IDs straight into your game's code. No more copying IDs out of Creator Hub.

You describe the items once (name, price, description). Then you run one command, or ask Claude to "set up monetization". Every item gets created, put on sale, and wired into your config.

- **Safe to re-run:** existing IDs are kept, and items with the same name are reused, never duplicated.
- **Zero dependencies:** a single Node script using Roblox's official Open Cloud API.
- **Two ways to use it:** a Claude skill (default) or an MCP server (optional).

## Requirements

- Node.js 18 or newer
- Claude Code
- A Roblox experience you own (or can edit in a group)

## Install with Claude (easiest)

Copy this whole block and paste it into Claude Code. It works on Windows, macOS and Linux.

```text
Install the roblox-monetize Claude Code skill for me from https://github.com/rpatty-dev/roblox-monetize. Do these steps in order and stop to tell me if any of them fails:

1. Check that git and Node.js 18 or newer are installed (`git --version`, `node -v`). If either is missing, tell me exactly how to install it for my operating system and wait for me.
2. Clone the repo into a folder named roblox-monetize in my home directory (if it is already there, run `git pull` in it instead).
3. In that folder run `node install.mjs --mcp`. It must print "selftest ok" and "Skill installed".
4. Walk me through creating a Roblox Open Cloud API key, one step at a time:
   create.roblox.com > Open Cloud > API Keys > Create API Key; add "game-passes" with read + write and "developer-products" with read + write for my experience; set Accepted IP Addresses to 0.0.0.0/0; save and copy the key.
   Never ask me to paste the key into this chat. Once I have copied it, tell me to type this myself (with the ! at the start), using the real path on my machine:
   ! node "<home>/.claude/skills/roblox-monetize/scripts/monetize.mjs" set-key
   That reads the key from my clipboard and stores it privately.
5. Ask me for my universe ID (the number in my Creator Hub URL after /experiences/) and run the `check` command to prove the key works.
6. Tell me to restart Claude Code, then say "set up monetization for this game" inside my game project.
```

## Install by hand

```bash
git clone https://github.com/rpatty-dev/roblox-monetize.git
cd roblox-monetize
node install.mjs          # skill only
node install.mjs --mcp    # skill + MCP server
```

Same commands on Windows (PowerShell or cmd), macOS and Linux. The installer links the skill into `~/.claude/skills/roblox-monetize` (a junction on Windows, no admin needed) and runs a self-test. Restart Claude Code afterwards so it picks up the skill.

## One-time setup: API key

1. Go to [create.roblox.com](https://create.roblox.com), then **Open Cloud > API Keys > Create API Key**.
2. Under **Access Permissions**, add:
   - **game-passes**, with operations **read** and **write**, for your experience
   - **developer-products**, with operations **read** and **write**, for your experience
3. Under **Accepted IP Addresses**, enter `0.0.0.0/0` (any IP) or your own IP.
4. Save, then copy the key.
5. With the key still on your clipboard, run:

```bash
# macOS / Linux
node ~/.claude/skills/roblox-monetize/scripts/monetize.mjs set-key
```

```powershell
# Windows (PowerShell)
node "$HOME\.claude\skills\roblox-monetize\scripts\monetize.mjs" set-key
```

It reads the key straight from the clipboard, so it never lands in a chat or your shell history. Piping also works: `echo $KEY | node ... set-key`.

The key is saved to `~/.config/roblox-monetize/api-key` (on Windows `%USERPROFILE%\.config\roblox-monetize\api-key`) with owner-only permissions. You can also set it with the `ROBLOX_API_KEY` environment variable instead.

Check it works (the universe ID is the number in your Creator Hub URL: `/experiences/<universeId>/`):

```bash
node ~/.claude/skills/roblox-monetize/scripts/monetize.mjs check <universeId>
```

## Usage

### With Claude

Open your game project in Claude Code and say something like:

> set up monetization for this game: a 2x cash pass for 149 and a cash pack for 49

Claude finds your ID table, writes `monetization.json`, shows you a dry run, creates the items and fills in the IDs.

### By hand

1. Make sure your config has a table with a zero for each item:

```lua
Config.Passes = {
	DoubleCash = 0,
}
Config.Products = {
	CashPack = 0,
}
```

2. Create `monetization.json` (see [`examples/monetization.json`](skills/roblox-monetize/examples/monetization.json)):

```json
{
  "universeId": 1234567890,
  "configPath": "src/shared/Config.luau",
  "items": [
    { "key": "DoubleCash", "kind": "pass", "name": "2x Cash", "price": 149, "description": "Every action pays double. Forever." },
    { "key": "CashPack", "kind": "product", "name": "Cash Pack", "price": 49, "description": "A big pile of cash, instantly." }
  ]
}
```

3. Run it:

```bash
S=~/.claude/skills/roblox-monetize/scripts/monetize.mjs
node $S sync monetization.json --dry   # preview
node $S sync monetization.json         # create + write IDs
```

Result:

```lua
Config.Passes = {
	DoubleCash = 2070181984,
}
```

### Spec fields

| Field | Required | Notes |
|---|---|---|
| `universeId` | yes | Experience (universe) ID, not the place ID |
| `configPath` | yes | Luau file holding the ID tables, relative to the spec |
| `passTable` | no | Default `Config.Passes` |
| `productTable` | no | Default `Config.Products` |
| `items[].key` | yes | Key inside the table, e.g. `DoubleCash` |
| `items[].kind` | yes | `pass` (one-time) or `product` (consumable) |
| `items[].name` | yes | Shown in the purchase prompt |
| `items[].price` | yes | Whole Robux, 1 or more |
| `items[].description` | no | |
| `items[].imagePath` | no | PNG/JPG icon, relative to the spec |

### All commands

```bash
node monetize.mjs set-key                          # save the key from the clipboard (or stdin)
node monetize.mjs check <universeId>               # test the key
node monetize.mjs list <universeId>                # list passes and products
node monetize.mjs sync <spec.json> [--dry]         # create what's missing, write IDs
node monetize.mjs create-pass <universeId> "<name>" <price> ["desc"] [icon.png]
node monetize.mjs create-product <universeId> "<name>" <price> ["desc"] [icon.png]
node monetize.mjs selftest                         # offline test
```

### MCP tools (with `--mcp`)

`list_monetization`, `create_game_pass`, `create_developer_product`, `sync_config`.

## Troubleshooting

| Error | Fix |
|---|---|
| `No API key` | Do the one-time setup |
| `401` | The key was copied wrongly or revoked. Regenerate it and run `set-key` again |
| `403 Scope not authorized` | Edit the key: add read and write for both APIs, plus the IP list |
| `... not found in config` | Add `Key = 0,` to that table first |
| `429` | Rate limited. Retries happen automatically |

## Why

Every Roblox dev has done this: make a pass in Creator Hub, copy the ID, paste it into `Config.luau`, repeat ten times, typo one, wonder why the purchase prompt is broken. This makes it one sentence to Claude, and it is safe to run again whenever you add items.

If it saved you time, a star helps other devs find it.

## Notes

- Purchases only work in the **published** game. Inside Studio they are free test purchases.
- Paid random items (crates, loot boxes) must show their odds before purchase, and some regions block them. Check with `PolicyService:GetPolicyInfoForPlayerAsync`.
- This tool uses Roblox's Open Cloud monetization endpoints, which Roblox marks as beta.

## License

MIT © rpatty-dev
