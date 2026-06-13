#!/bin/sh
# entrypoint.sh — capture the container's runtime env into /etc/cron-env so the
# crontab jobs (which run with an empty environment under Alpine crond) can
# source BASE_URL and CRON_SECRET. Then hand off to crond in the foreground.
set -eu

if [ -z "${BASE_URL:-}" ] || [ -z "${CRON_SECRET:-}" ]; then
  echo "FATAL: BASE_URL and CRON_SECRET must be set on the service env" >&2
  exit 1
fi

# Persist only the vars the jobs need. Quote values so special chars survive.
{
  printf 'export BASE_URL=%s\n' "$(printf %s "$BASE_URL" | sed "s/'/'\\\\''/g; s/^/'/; s/$/'/")"
  printf 'export CRON_SECRET=%s\n' "$(printf %s "$CRON_SECRET" | sed "s/'/'\\\\''/g; s/^/'/; s/$/'/")"
} > /etc/cron-env
chmod 0600 /etc/cron-env

echo "[entrypoint] cron-env written; starting crond. BASE_URL=${BASE_URL}"
exec crond -f -l 8 -L /dev/stdout
