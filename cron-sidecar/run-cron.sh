#!/bin/sh
# run-cron.sh <endpoint-name>
#
# Performs a single cron tick: POST $BASE_URL/api/cron/<name> with the bearer.
# Logs loudly to stdout (so Hamravesh's log viewer shows every run) and exits
# non-zero on failure — closing the "silent failure" gap that bare cron + a
# dead app would otherwise have. A non-zero exit is visible in crond's log and
# can be alerted on.
#
# Required env (set on the Hamravesh service):
#   BASE_URL     internal app address, e.g. http://<app-service>.<ns>.svc:3000
#   CRON_SECRET  EXACT same value as the app's CRON_SECRET env var
set -eu

NAME="$1"
TS="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

if [ -z "${BASE_URL:-}" ] || [ -z "${CRON_SECRET:-}" ]; then
  echo "[$TS] cron/$NAME FATAL: BASE_URL or CRON_SECRET not set" >&2
  exit 1
fi

# --fail        -> non-2xx becomes a non-zero exit (visible failure)
# --show-error  -> print the error body on failure
# --max-time 60 -> never hang a tick
# -w status     -> log the HTTP code + timing for every run
HTTP_OUT="$(
  curl --fail --silent --show-error --max-time 60 \
    --request POST \
    --header "Authorization: Bearer ${CRON_SECRET}" \
    --write-out '\n[http_status=%{http_code} time=%{time_total}s]' \
    "${BASE_URL}/api/cron/${NAME}" 2>&1
)" && RC=0 || RC=$?

if [ "$RC" -eq 0 ]; then
  echo "[$TS] cron/$NAME OK ${HTTP_OUT}"
else
  echo "[$TS] cron/$NAME FAILED rc=$RC ${HTTP_OUT}" >&2
fi
exit "$RC"
