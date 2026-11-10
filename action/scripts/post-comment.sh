#!/usr/bin/env bash
# Upsert a sticky PR comment from a nightowl report JSON file.
# Usage: post-comment.sh <report.json> <pr-number>
# Requires: GITHUB_TOKEN, gh (preferred) or curl. Warn-and-exit-0 on soft failures when called from action.yml.

set -euo pipefail

REPORT_PATH="${1:-}"
PR_NUMBER="${2:-}"
MARKER='<!-- nightowl-evals-report -->'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${REPORT_PATH}" || -z "${PR_NUMBER}" ]]; then
  echo "usage: post-comment.sh <report.json> <pr-number>" >&2
  exit 1
fi

if [[ ! -f "${REPORT_PATH}" ]]; then
  echo "report file not found: ${REPORT_PATH}" >&2
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required for sticky comments" >&2
  exit 1
fi

BODY="$(node "${SCRIPT_DIR}/format-report.mjs" "${REPORT_PATH}")"
if [[ "${BODY}" != *"${MARKER}"* ]]; then
  echo "formatted body missing sticky marker" >&2
  exit 1
fi

OWNER="${GITHUB_REPOSITORY_OWNER:-${GITHUB_REPOSITORY%%/*}}"
REPO="${GITHUB_REPOSITORY##*/}"
API_ROOT="${GITHUB_API_URL:-https://api.github.com}"

find_existing_comment_id() {
  if command -v gh >/dev/null 2>&1; then
    gh api \
      --paginate \
      "repos/${OWNER}/${REPO}/issues/${PR_NUMBER}/comments" \
      --jq ".[] | select(.body | contains(\"${MARKER}\")) | .id" \
      | head -n 1
    return 0
  fi

  local page=1
  local id=""
  while true; do
    local response
    response="$(curl -fsSL \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "${API_ROOT}/repos/${OWNER}/${REPO}/issues/${PR_NUMBER}/comments?per_page=100&page=${page}")"
    id="$(BODY_JSON="${response}" MARKER="${MARKER}" node -e '
      const comments = JSON.parse(process.env.BODY_JSON);
      const marker = process.env.MARKER;
      const hit = comments.find((c) => typeof c.body === "string" && c.body.includes(marker));
      if (hit) process.stdout.write(String(hit.id));
    ')"
    if [[ -n "${id}" ]]; then
      echo "${id}"
      return 0
    fi
    # Stop when page is empty or short
    local count
    count="$(BODY_JSON="${response}" node -e 'process.stdout.write(String(JSON.parse(process.env.BODY_JSON).length))')"
    if [[ "${count}" -lt 100 ]]; then
      break
    fi
    page=$((page + 1))
  done
  echo ""
}

upsert_with_gh() {
  local existing_id="$1"
  local body_file
  body_file="$(mktemp)"
  printf '%s' "${BODY}" >"${body_file}"
  if [[ -n "${existing_id}" ]]; then
    gh api \
      --method PATCH \
      "repos/${OWNER}/${REPO}/issues/comments/${existing_id}" \
      -F "body=@${body_file}" >/dev/null
    echo "Updated sticky NightOwl comment ${existing_id}"
  else
    gh api \
      --method POST \
      "repos/${OWNER}/${REPO}/issues/${PR_NUMBER}/comments" \
      -F "body=@${body_file}" >/dev/null
    echo "Created sticky NightOwl comment on PR #${PR_NUMBER}"
  fi
  rm -f "${body_file}"
}

upsert_with_curl() {
  local existing_id="$1"
  local body_file
  body_file="$(mktemp)"
  # JSON-encode body via node
  BODY="${BODY}" node -e 'process.stdout.write(JSON.stringify({ body: process.env.BODY }))' >"${body_file}"
  if [[ -n "${existing_id}" ]]; then
    curl -fsSL \
      -X PATCH \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "Content-Type: application/json" \
      --data @"${body_file}" \
      "${API_ROOT}/repos/${OWNER}/${REPO}/issues/comments/${existing_id}" >/dev/null
    echo "Updated sticky NightOwl comment ${existing_id}"
  else
    curl -fsSL \
      -X POST \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "Content-Type: application/json" \
      --data @"${body_file}" \
      "${API_ROOT}/repos/${OWNER}/${REPO}/issues/${PR_NUMBER}/comments" >/dev/null
    echo "Created sticky NightOwl comment on PR #${PR_NUMBER}"
  fi
  rm -f "${body_file}"
}

EXISTING_ID="$(find_existing_comment_id || true)"
EXISTING_ID="$(echo "${EXISTING_ID}" | tr -d '[:space:]')"

if command -v gh >/dev/null 2>&1; then
  export GH_TOKEN="${GITHUB_TOKEN}"
  upsert_with_gh "${EXISTING_ID}"
else
  upsert_with_curl "${EXISTING_ID}"
fi
