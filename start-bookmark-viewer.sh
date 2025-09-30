#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from the project root even if invoked elsewhere
cd /home/tony/local-git-repo/bookmark-viewer

export PORT="${PORT:-9999}"
export PATH="/home/tony/.nvm/versions/node/v22.19.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

exec /home/tony/.nvm/versions/node/v22.19.0/bin/node server/index.js
