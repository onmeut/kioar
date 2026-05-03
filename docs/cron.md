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

| Endpoint            | Cadence       | Purpose                                                                                                 |
| ------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `/api/cron/cleanup` | every ~15 min | Garbage-collect expired OTPs, sessions, rate-limit buckets.                                             |
| `/api/cron/billing` | once a day    | Subscription state machine: trial reminders, period-end → grace, grace → expired, plan-change rollover. |
| `/api/cron/sms`     | every minute  | Drain `sms_queue`: dispatch transactional SMS via Kavenegar, retry with backoff, give up after 3 tries. |

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
