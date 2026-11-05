# Changelog

## 1.1.0

- Windows support: `node install.mjs` works in PowerShell and cmd (junction, no admin rights needed).
- `set-key` reads the key from the clipboard on Windows, macOS and Linux.
- Fixed: the CLI printed nothing when run through the installed skill link.
- Fixed: configs with Windows (CRLF) line endings lost line endings when `REPLACE_WITH_ID` was removed.
- Self-test runs in CI on Windows, macOS and Linux.

## 1.0.0

- First release: create game passes and developer products through Open Cloud and write their IDs into Luau config.
