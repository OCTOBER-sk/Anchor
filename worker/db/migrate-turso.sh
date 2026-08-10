#!/usr/bin/env bash
# Migrate a fresh Turso DB using worker/db/turso/schema.sql via the libsql HTTP pipeline API.
# No turso CLI/browser login needed — works headless with a DB-scoped bearer token.
# Idempotent: safe to re-run (schema uses CREATE TABLE/INDEX IF NOT EXISTS).
# Usage:
#   TURSO_URL=libsql://... TURSO_AUTH_TOKEN=<db-scoped token> ./migrate-turso.sh
set -euo pipefail
: "${TURSO_URL:?set TURSO_URL}" "${TURSO_AUTH_TOKEN:?set TURSO_AUTH_TOKEN}"

SQL_FILE="$(cd "$(dirname "$0")" && pwd)/turso/schema.sql"
python3 - "$TURSO_URL" "$TURSO_AUTH_TOKEN" "$SQL_FILE" <<'PY'
import json, pathlib, re, sys, urllib.request

url, token, sql_file = sys.argv[1], sys.argv[2], sys.argv[3]
sql = pathlib.Path(sql_file).read_text()
# strip -- line comments first (safe: schema has no -- inside string literals),
# then split on ; (none inside string literals either)
sql = "\n".join(re.sub(r"--.*$", "", line) for line in sql.splitlines())
stmts = [s.strip() for s in sql.split(";") if s.strip()]
requests = [{"type": "execute", "stmt": {"sql": s}} for s in stmts]

http_url = url.replace("libsql://", "https://", 1)
req = urllib.request.Request(
    f"{http_url}/v2/pipeline",
    data=json.dumps({"requests": requests}).encode(),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    },
)
with urllib.request.urlopen(req, timeout=60) as r:
    d = json.loads(r.read())

errs = [res.get("error") for res in d.get("results", []) if res.get("type") == "error"]
if errs:
    print("MIGRATION ERRORS:")
    for e in errs:
        print(" -", e)
    sys.exit(1)
print(f"Turso migration OK — {len(requests)} statements executed against {url}")
PY
