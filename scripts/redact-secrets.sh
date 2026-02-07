#!/usr/bin/env bash
# redact-secrets.sh — 掃描 OpenClaw 聊天記錄並打碼密鑰
# 用法: ./redact-secrets.sh [--dry-run]
# 排程: 搭配 cron 每小時執行一次

set -euo pipefail

SESSIONS_ROOT="${HOME}/.openclaw/agents"
DRY_RUN=false
REDACTED_COUNT=0
FILE_COUNT=0

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

COUNT_SCRIPT='
  my $count = 0;
  open(F, "<", $ARGV[0]) or die "Cannot open: $!";
  while (<F>) {
    while (/sk-[A-Za-z0-9_-]{20,}/g) { $count++; }
    while (/ntn_[A-Za-z0-9]{20,}/g) { $count++; }
    while (/sk_[a-f0-9]{20,}/g) { $count++; }
    while (/AIzaSy[A-Za-z0-9_-]{20,}/g) { $count++; }
    while (/[0-9]{7,13}:AA[A-Za-z0-9_-]{20,}/g) { $count++; }
    while (/secret_[A-Za-z0-9_-]{20,}/g) { $count++; }
    while (/ghp_[A-Za-z0-9]{20,}/g) { $count++; }
    while (/gho_[A-Za-z0-9]{20,}/g) { $count++; }
    while (/xox[bpras]-[A-Za-z0-9-]{20,}/g) { $count++; }
    while (/AKIA[A-Z0-9]{12,}/g) { $count++; }
    while (/sk-or-[A-Za-z0-9-]{20,}/g) { $count++; }
  }
  print $count;
'

REDACT_SCRIPT='
  # 替換規則：保留前綴辨識用字元，其餘打碼
  s/(sk-[A-Za-z0-9_-]{4})[A-Za-z0-9_-]{16,}/${1}***REDACTED***/g;
  s/(ntn_[A-Za-z0-9]{4})[A-Za-z0-9]{16,}/${1}***REDACTED***/g;
  s/(sk_[a-f0-9]{4})[a-f0-9]{16,}/${1}***REDACTED***/g;
  s/(AIzaSy[A-Za-z0-9_-]{4})[A-Za-z0-9_-]{16,}/${1}***REDACTED***/g;
  s/([0-9]{7,13}:AA[A-Za-z0-9_-]{3})[A-Za-z0-9_-]{17,}/${1}***REDACTED***/g;
  s/(secret_[A-Za-z0-9_-]{6})[A-Za-z0-9_-]{14,}/${1}***REDACTED***/g;
  s/(ghp_[A-Za-z0-9]{4})[A-Za-z0-9]{16,}/${1}***REDACTED***/g;
  s/(gho_[A-Za-z0-9]{4})[A-Za-z0-9]{16,}/${1}***REDACTED***/g;
  s/(xox[bpras]-[A-Za-z0-9-]{4})[A-Za-z0-9-]{16,}/${1}***REDACTED***/g;
  s/(AKIA[A-Z0-9]{4})[A-Z0-9]{8,}/${1}***REDACTED***/g;
  s/(sk-or-[A-Za-z0-9-]{4})[A-Za-z0-9-]{16,}/${1}***REDACTED***/g;
'

redact_file() {
  local file="$1"
  local tmp="${file}.redacting"

  local matches
  matches=$(perl -e "$COUNT_SCRIPT" "$file")

  if [[ "$matches" -eq 0 ]]; then
    return 0
  fi

  log "  📄 ${file##*/}: ${matches} 個密鑰"

  if $DRY_RUN; then
    REDACTED_COUNT=$((REDACTED_COUNT + matches))
    return 0
  fi

  perl -pe "$REDACT_SCRIPT" "$file" > "$tmp"

  # 驗證行數一致（安全檢查）
  local orig_lines new_lines
  orig_lines=$(wc -l < "$file")
  new_lines=$(wc -l < "$tmp")

  if [[ "$orig_lines" -ne "$new_lines" ]]; then
    log "  ❌ 行數不一致，跳過 (${orig_lines} → ${new_lines})"
    rm -f "$tmp"
    return 1
  fi

  # 驗證替換後確實少了密鑰
  local after_matches
  after_matches=$(perl -e "$COUNT_SCRIPT" "$tmp")

  if [[ "$after_matches" -gt 0 ]]; then
    log "  ⚠️  仍有 ${after_matches} 個殘留（可能是新模式），繼續套用"
  fi

  mv "$tmp" "$file"
  REDACTED_COUNT=$((REDACTED_COUNT + matches - after_matches))
  log "  ✅ 已打碼 $((matches - after_matches)) 個密鑰"
  return 0
}

main() {
  log "🔐 開始掃描聊天記錄密鑰..."
  $DRY_RUN && log "⚡ DRY RUN 模式（不會實際修改）"

  for agent_dir in "${SESSIONS_ROOT}"/*/sessions; do
    [[ -d "$agent_dir" ]] || continue
    local agent_name
    agent_name=$(basename "$(dirname "$agent_dir")")
    log "🤖 Agent: ${agent_name}"

    for jsonl in "${agent_dir}"/*.jsonl; do
      [[ -f "$jsonl" ]] || continue
      FILE_COUNT=$((FILE_COUNT + 1))
      redact_file "$jsonl" || true
    done
  done

  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "✅ 掃描 ${FILE_COUNT} 個檔案，打碼 ${REDACTED_COUNT} 個密鑰"
  $DRY_RUN && log "💡 移除 --dry-run 以實際執行"
}

main
