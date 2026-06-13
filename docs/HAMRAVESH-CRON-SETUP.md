# Hamravesh / Darkube — Cron Job setup (REQUIRED)

The Kioar app has 5 HTTP endpoints that MUST be called on a schedule by an
external trigger. Without them, trials never expire, transactional SMS never
sends, sessions/OTPs never get cleaned up, etc. As of 2026-06-12 NONE of these
were scheduled in production (the `billing_transitions_log` table was empty),
which is why ~1400 trials froze in `trialing`.

Create one **Cron Job** (scheduled task) in Hamravesh per row below. Each runs a
tiny `curlimages/curl` (or `alpine/curl`) container that POSTs to the app.

| # | Endpoint                     | Cron expression | Cadence       | Why it matters                                  |
|---|------------------------------|-----------------|---------------|-------------------------------------------------|
| 1 | `/api/cron/billing`          | `0 3 * * *`     | daily 03:00   | **Expires trials, grace→Free. THE trial fix.**  |
| 2 | `/api/cron/sms`              | `* * * * *`     | every minute  | Sends all transactional SMS (OTP, reminders).   |
| 3 | `/api/cron/cleanup`          | `*/15 * * * *`  | every 15 min  | GC expired OTPs / sessions / rate-limit buckets.|
| 4 | `/api/cron/affiliate-unlock` | `0 4 * * *`     | daily 04:00   | Unlock matured affiliate commissions.           |
| 5 | `/api/cron/expire-transfers` | `0 * * * *`     | hourly        | Expire pending page-ownership transfers.        |

## Command each job runs

Replace `<name>` with the endpoint name (e.g. `billing`). `BASE_URL` should be
the **internal** cluster service address so traffic stays on the cluster network
(no CDN bandwidth burn):

```sh
curl --fail --silent --show-error --max-time 60 \
  --request POST \
  --header "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/cron/<name>"
```

- `BASE_URL` = internal service URL, e.g. `http://<app-service>.<namespace>.svc:3000`
  (use the same internal address Hamravesh shows for the Kioar app service).
- `CRON_SECRET` = **the exact same value** as the app's `CRON_SECRET` env var.
  Set it as an encrypted env var on each cron job. If it doesn't match, the
  endpoint returns 401 and nothing happens.

## Image
`curlimages/curl:latest` (or `alpine/curl`). No app code needed — it's just curl.

## How to verify it worked
After the billing job runs once (or trigger it manually), this should be > 0
and growing daily:

```sql
SELECT transition_type, count(*), max(key_date)
FROM billing_transitions_log GROUP BY 1;
```

A manual one-off test from any shell with cluster/network access:

```sh
curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" \
  "https://kioar.com/api/cron/billing"
# expect JSON like {"ok":true,"scanned":<N>,"applied":...}
```

## Alternative if Hamravesh has no native cron
Use an external uptime monitor (UptimeRobot / Better Stack / Cronitor) pointed at
the **public** domain (`https://kioar.com/api/cron/<name>`) with the
`Authorization: Bearer <CRON_SECRET>` header set as a custom HTTP header, on the
cadence above. Works without any cluster-side scheduler.
