# Kioar cron sidecar

Self-hosted equivalent of cron-job.org. A tiny Alpine container running Unix
`crond` that POSTs to the app's `/api/cron/*` endpoints on schedule. This is the
permanent fix for "the billing cron never runs in production" (the bug that
froze ~1400 trials, and would also freeze every monthly/yearly paid expiry).

## What it runs

| Endpoint                     | Schedule (UTC)  | Purpose                                  |
|------------------------------|-----------------|------------------------------------------|
| `/api/cron/cleanup`          | every 15 min    | GC OTPs / sessions / rate-limit buckets  |
| `/api/cron/billing`          | daily 03:00     | **trials + monthly + yearly expirations**|
| `/api/cron/sms`              | every minute    | send queued transactional SMS            |
| `/api/cron/affiliate-unlock` | daily 04:00     | unlock matured affiliate commissions     |
| `/api/cron/expire-transfers` | hourly          | expire pending ownership transfers       |

One daily `billing` tick handles trials AND paid renewals — they share the same
state machine. No per-cycle setup needed.

## Deploy on Hamravesh (as its own service)

1. **Create a new app/service** from this directory's `Dockerfile`
   (`cron-sidecar/`). It's a worker — it has no HTTP port, just runs `crond`.

2. **Set two env vars** on the service:
   - `BASE_URL` — the app's **internal** cluster address, e.g.
     `http://<app-service>.<namespace>.svc:3000` (keeps traffic off the public
     CDN). The exact internal hostname is shown in Hamravesh for the app service.
   - `CRON_SECRET` — **the exact same value** as the app's `CRON_SECRET`. Set it
     encrypted. If it doesn't match, every call gets 401 and nothing happens.

3. **Deploy.** Watch the logs — you should see, every minute:
   `[...] cron/sms OK {...}` and, at 03:00, `[...] cron/billing OK {"scanned":N}`.

## Verify it's working

- Container logs show `OK` lines (and `FAILED`/`FATAL` loudly if something's
  wrong — failures are never silent).
- In the DB, this grows daily once `billing` has run:
  ```sql
  SELECT transition_type, count(*), max(key_date)
  FROM billing_transitions_log GROUP BY 1;
  ```
- The container HEALTHCHECK restarts it if `crond` dies, so a dead scheduler
  can't silently persist.

## Local smoke test

```sh
docker build -t kioar-cron cron-sidecar/
# point BASE_URL at a reachable app and run one tick by hand:
docker run --rm -e BASE_URL=http://host.docker.internal:3000 -e CRON_SECRET=... \
  --entrypoint /usr/local/bin/run-cron.sh kioar-cron billing
```

## Notes

- Times are UTC; correctness does not depend on the trigger zone (the app
  anchors day-keys to Asia/Tehran internally).
- Duplicate/overlapping triggers are safe: the app routes guard with
  `pg_try_advisory_lock` + per-row `billing_transitions_log` idempotency.
- This replaces the need for cron-job.org / UptimeRobot / Hamravesh native cron.
  Any one of those would also work; this one keeps everything in your repo and
  on the cluster network.
