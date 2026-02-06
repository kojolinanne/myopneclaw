#!/usr/bin/env bash
# deploy.sh — Upload code, create version, update deployment, git push
# Usage: deploy.sh <version_desc>
#
# Required env vars or edit inline:
#   SCRIPT_TOKEN_FILE  — path to .script_token.json (default: workspace/.script_token.json)
#   SCRIPT_ID          — Apps Script project ID
#   DEPLOY_ID          — Deployment ID
#   CODE_GS            — path to Code.gs
#   INDEX_HTML         — path to Index.html
#   CLIENT_ID / CLIENT_SECRET — OAuth credentials (for token refresh)

set -euo pipefail

DESC="${1:-update}"
WORKSPACE="${WORKSPACE:-/home/codespace/.openclaw/workspace}"
SCRIPT_TOKEN_FILE="${SCRIPT_TOKEN_FILE:-$WORKSPACE/.script_token.json}"
SCRIPT_ID="${SCRIPT_ID:-}"
DEPLOY_ID="${DEPLOY_ID:-}"
CODE_GS="${CODE_GS:-$WORKSPACE/finance-app/Code.gs}"
INDEX_HTML="${INDEX_HTML:-$WORKSPACE/finance-app/Index.html}"
CLIENT_ID="${CLIENT_ID:-}"
CLIENT_SECRET="${CLIENT_SECRET:-}"

# --- Refresh access token ---
refresh_token() {
  local RT
  RT=$(python3 -c "import json; print(json.load(open('$SCRIPT_TOKEN_FILE'))['refresh_token'])")
  local RESP
  RESP=$(curl -s -X POST https://oauth2.googleapis.com/token \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET" \
    -d "refresh_token=$RT" \
    -d "grant_type=refresh_token")
  echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['access_token'])"
}

# If token file has access_token and it's fresh, use it; otherwise refresh
get_token() {
  if [ -n "${ACCESS_TOKEN:-}" ]; then
    echo "$ACCESS_TOKEN"
    return
  fi
  # Try existing access_token
  local AT
  AT=$(python3 -c "import json; print(json.load(open('$SCRIPT_TOKEN_FILE')).get('access_token',''))" 2>/dev/null || echo "")
  if [ -n "$AT" ]; then
    # Test if valid
    local CODE
    CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $AT" \
      "https://script.googleapis.com/v1/projects/$SCRIPT_ID")
    if [ "$CODE" = "200" ]; then
      echo "$AT"
      return
    fi
  fi
  refresh_token
}

TOKEN=$(get_token)

# --- 1. Upload code ---
echo ">>> Uploading code..."
CODE_SRC=$(python3 -c "import json; print(json.dumps(open('$CODE_GS').read()))")
HTML_SRC=$(python3 -c "import json; print(json.dumps(open('$INDEX_HTML').read()))")
MANIFEST='{"timeZone":"Asia/Taipei","dependencies":{},"webapp":{"access":"ANYONE_ANONYMOUS","executeAs":"USER_DEPLOYING"},"exceptionLogging":"STACKDRIVER","runtimeVersion":"V8"}'
MANIFEST_ESC=$(python3 -c "import json; print(json.dumps('$MANIFEST'))")

UPLOAD=$(curl -s -X PUT "https://script.googleapis.com/v1/projects/${SCRIPT_ID}/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"files\":[
    {\"name\":\"Code\",\"type\":\"SERVER_JS\",\"source\":${CODE_SRC}},
    {\"name\":\"Index\",\"type\":\"HTML\",\"source\":${HTML_SRC}},
    {\"name\":\"appsscript\",\"type\":\"JSON\",\"source\":${MANIFEST_ESC}}
  ]}")

echo "$UPLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Upload:', 'OK' if 'scriptId' in d else d)"

# --- 2. Create version ---
echo ">>> Creating version: $DESC"
VERSION=$(curl -s -X POST "https://script.googleapis.com/v1/projects/${SCRIPT_ID}/versions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"description\": \"$DESC\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('versionNumber','ERROR'))")
echo "Version: $VERSION"

if [ "$VERSION" = "ERROR" ]; then
  echo "Failed to create version" >&2
  exit 1
fi

# --- 3. Update deployment ---
echo ">>> Updating deployment..."
DEPLOY=$(curl -s -X PUT "https://script.googleapis.com/v1/projects/${SCRIPT_ID}/deployments/${DEPLOY_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"deploymentConfig\":{\"scriptId\":\"$SCRIPT_ID\",\"versionNumber\":$VERSION,\"manifestFileName\":\"appsscript\",\"description\":\"$DESC\"}}")

echo "$DEPLOY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Deploy:', 'OK' if 'deploymentId' in d else d)"

# --- 4. Git commit + push ---
echo ">>> Git push..."
cd "$WORKSPACE"
git add -A
git commit -m "deploy: $DESC" || echo "(nothing to commit)"
git push || echo "(push failed or no remote)"

echo ">>> Done! ✅"
