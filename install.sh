#!/usr/bin/env bash
# Kept for existing docs; the real installer is install.mjs (works on Windows too).
exec node "$(dirname "$0")/install.mjs" "$@"
