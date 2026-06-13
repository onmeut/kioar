# Kioar cron sidecar — the self-hosted equivalent of cron-job.org.
#
# A tiny always-on Alpine container that runs Unix `crond` and curls the
# app's /api/cron/* endpoints on a schedule. This is "option 3" from
# docs/cron.md. Deploy it on Hamravesh as its own service alongside the app.
#
# Why a sidecar and not in-process node-cron: keeps scheduling OUT of the web
# process (no competition with request latency, no multi-replica double-fire),
# survives app deploys/restarts independently, and the schedule is committed
# to the repo. The app's own pg_advisory_lock + billing_transitions_log make
# duplicate triggers a safe no-op regardless.
FROM alpine:3.20

# curl for the HTTP calls; tzdata so cron fires on a known zone.
RUN apk add --no-cache curl tzdata

# crontab + the wrapper that performs one tick with loud logging + the
# entrypoint that captures runtime env for the jobs.
COPY crontab /etc/crontabs/root
COPY run-cron.sh /usr/local/bin/run-cron.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/run-cron.sh /usr/local/bin/entrypoint.sh \
 && chmod 0644 /etc/crontabs/root

# Healthcheck: crond must be running. If it dies, Hamravesh restarts the
# container — so a dead scheduler can't silently persist (the failure mode
# that caused the trial freeze).
HEALTHCHECK --interval=60s --timeout=5s --retries=3 \
  CMD pgrep crond >/dev/null || exit 1

# entrypoint writes /etc/cron-env then exec's crond in the foreground.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
