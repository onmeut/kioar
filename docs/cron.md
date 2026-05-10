# Cron endpoints

Kioar exposes a few HTTP "cron" endpoints under `/api/cron/*` that an
external timer is expected to hit on a schedule. We deliberately do not
ship `pg_cron`, BullMQ, or an in-process scheduler — Next.js boots fresh
on every deploy, and we already require Postgres + a host capable of
running a systemd timer.

All cron routes share the same shape:

- `POST` and `GET` are both accepted (some hosted timers can only emit
  GET).
- Authentication is `Authorization: Bearer ${CRON_SECRET}`, compared in
  constant time. Missing secret returns `503` (fail closed).
- A `pg_try_advisory_lock` guards the body so overlapping invocations
  exit cleanly with `{ ok: true, skipped: true }`. Each route uses a
  distinct lock key so different crons never block each other.
- Per-row idempotency lives in DB tables (e.g.
  `billing_transitions_log`), not in the lock. Running a cron twice on
  the same day is always safe.

## Endpoints

| Endpoint                     | Cron expression | Cadence      | Method | Auth header                          | Purpose                                                                                                 |
| ---------------------------- | --------------- | ------------ | ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `/api/cron/cleanup`          | `*/15 * * * *`  | every 15 min | POST   | `Authorization: Bearer $CRON_SECRET` | Garbage-collect expired OTPs, sessions, rate-limit buckets.                                             |
| `/api/cron/billing`          | `0 3 * * *`     | daily 03:00  | POST   | `Authorization: Bearer $CRON_SECRET` | Subscription state machine: trial reminders, period-end → grace, grace → expired, plan-change rollover. |
| `/api/cron/sms`              | `* * * * *`     | every minute | POST   | `Authorization: Bearer $CRON_SECRET` | Drain `sms_queue`: dispatch transactional SMS via Kavenegar, retry with backoff, give up after 3 tries. |
| `/api/cron/affiliate-unlock` | `0 4 * * *`     | daily 04:00  | POST   | `Authorization: Bearer $CRON_SECRET` | Unlock matured affiliate commissions past their hold window.                                            |

> Cron expressions assume the scheduler runs in UTC. Day-keys inside the routes
> already anchor to Asia/Tehran via `tehranIsoDate(now)`, so the trigger TZ
> doesn't matter for correctness — pick whatever the scheduler defaults to.

## Production scheduling on Hamravesh (Darkube)

The legacy systemd-timer setup (documented below) is no longer used. On
Hamravesh, use one of these approaches in priority order:

1. **Hamravesh "Cron Job" / scheduled task** (preferred). For each row in the
   table above, create a job that runs an `alpine/curl` (or `curlimages/curl`)
   container with:

   ```sh
   curl --fail --silent --show-error --max-time 60 \
     --request POST \
     --header "Authorization: Bearer $CRON_SECRET" \
     "$BASE_URL/api/cron/<name>"
   ```

   `BASE_URL` should point at the **internal** service address
   (`http://kioar.onmeut-production.svc:3000`) so cron traffic stays on the
   cluster network and doesn't burn ArvanCloud CDN bandwidth. `CRON_SECRET` is
   the same value the app reads — set it as an encrypted env on the cron job.

2. **External uptime monitor** (UptimeRobot, Cronitor, Better Stack, etc.)
   pointed at the public domain with the bearer header set as a custom HTTP
   header. Works without any cluster-side scheduler. Downside: cron traffic
   crosses the public edge and shows up in CDN analytics.

3. **A long-lived cron sidecar app** on Hamravesh running `cron` + `curl` from
   a tiny image. Same effect as option 1, packaged as a single deployable.

Whichever you pick, the route's `pg_try_advisory_lock` will collapse any
accidental overlap to `{ ok: true, skipped: true }`, so duplicate triggers are
safe.

## Legacy: systemd timers (ArvanCloud VPS)

## systemd timer/service example

Drop these into `/etc/systemd/system/` on the host that should drive the
crons. The `BASE_URL` and `CRON_SECRET` come from the Kioar environment.

### `kioar-cron.service`

```ini
[Unit]
Description=Kioar cron tick (%i)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/kioar/cron.env
ExecStart=/usr/bin/curl --fail --silent --show-error \
  --max-time 60 \
  --request POST \
  --header "Authorization: Bearer ${CRON_SECRET}" \
  "${BASE_URL}/api/cron/%i"
```

`/etc/kioar/cron.env` (mode `0600`, owned by root):

```
BASE_URL=https://kioar.com
CRON_SECRET=<same value as the app's CRON_SECRET>
```

### `kioar-cron-cleanup.timer`

```ini
[Unit]
Description=Kioar cleanup cron (every 15 minutes)

[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
Unit=kioar-cron@cleanup.service
Persistent=true

[Install]
WantedBy=timers.target
```

### `kioar-cron-billing.timer`

```ini
[Unit]
Description=Kioar billing cron (daily at 03:00)

[Timer]
OnCalendar=*-*-* 03:00:00
Unit=kioar-cron@billing.service
Persistent=true

[Install]
WantedBy=timers.target
```

`Persistent=true` means a missed run (host down, container restart) will
fire on the next boot. Combined with the per-row idempotency in
`billing_transitions_log`, a missed daily billing run can be safely
backfilled by simply triggering the unit once.

### `kioar-cron-sms.timer`

```ini
[Unit]
Description=Kioar SMS worker (every minute)

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
Unit=kioar-cron@sms.service
Persistent=true

[Install]
WantedBy=timers.target
```

The SMS worker is intentionally cheap to call: each tick claims at most
50 due rows via `FOR UPDATE SKIP LOCKED` and the route's advisory lock
collapses overlapping ticks to a no-op. Missing a minute is fine — the
next tick picks up everything still due.

### Templated unit alias

The `%i` token resolves to the instance name passed in the timer's
`Unit=kioar-cron@<name>.service` directive — install the service as a
template:

```bash
sudo cp kioar-cron.service /etc/systemd/system/kioar-cron@.service
sudo cp kioar-cron-cleanup.timer /etc/systemd/system/
sudo cp kioar-cron-billing.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kioar-cron-cleanup.timer
sudo systemctl enable --now kioar-cron-billing.timer
sudo systemctl enable --now kioar-cron-sms.timer
```

Verify with:

```bash
systemctl list-timers 'kioar-cron-*'
journalctl -u 'kioar-cron@*.service' -f
```

## Adding a new cron

1. Implement the route under `src/app/api/cron/<name>/route.ts` reusing
   the auth + advisory-lock skeleton from `cleanup` or `billing`.
2. Pick a fresh advisory-lock `BigInt` (don't reuse another route's).
3. Make every side effect idempotent — either via a unique constraint
   (e.g. `payments.authority`) or a dedicated `*_log` table with a
   composite PK keyed on a deterministic `key_date` derived from
   subscription/state, never from `now()`.
4. Add a `kioar-cron-<name>.timer` and document its cadence here.
