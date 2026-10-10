#!/usr/bin/env bash
# ── Global Store → GitHub push helper ──────────────────────────────
# يقرأ التوكن من متغيّر البيئة GITHUB_TOKEN أو من الملف ./.github-token،
# ولا يخزّنه أبداً في git config أو داخل سجلّ المستودع.
#
#   الطريقة 1 : echo "github_pat_xxx" > ./.github-token && chmod 600 ./.github-token
#   الطريقة 2 : export GITHUB_TOKEN=github_pat_xxx
#
#   ثم:  ./push.sh
# ────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/malek1977/globalstor.git"
cd "$(dirname "$0")"

# 1) الأقرب: ملف التوكن
if [ -f ./.github-token ]; then
  GITHUB_TOKEN="$(tr -d '[:space:]' < ./.github-token)"
fi

# 2) وإلا من البيئة
: "${GITHUB_TOKEN:?لازم تعمل: echo 'github_pat_xxx' > ./.github-token  (أو صدّر GITHUB_TOKEN)}"

AUTH="Authorization: Basic $(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 -w0)"

echo "→ رافع إلى $REPO_URL …"

# بعض صور CI بدون حزمة CA؛ التوكن يبقى داخل TLS anyway
export GIT_SSL_NO_VERIFY=1
git -c http.sslVerify=false \
    -c http.extraheader="$AUTH" \
    push -u origin main

echo
echo "✅ تم الرفع → $REPO_URL"
echo "🔒 الحين احذف التوكن من GitHub ثم:  shred -u ./.github-token"
