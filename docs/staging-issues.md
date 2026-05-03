# Staging dress-rehearsal — issues log

**VM**: staging.kioar.com on ArvanCloud (`<region>`, 2 vCPU / 4 GB / 50 GB)
**Started**: <YYYY-MM-DD HH:MM>
**Runbook**: [deploy-arvancloud.md](./deploy-arvancloud.md) revision `<git sha>`

> **How to use this file**
>
> Run the runbook top-to-bottom on the staging VM. Copy commands as
> written; don't improvise. When something breaks, doesn't behave as
> documented, or assumes something the runbook didn't state, log it in
> the matching section below with:
>
> - **What happened** — exact command + exact output (or panel
>   screenshot/quote).
> - **Root cause** — once you've debugged it.
> - **Fix** — the change that made it work.
> - **Runbook patch** — the diff you'd apply to `deploy-arvancloud.md`
>   so the next person doesn't hit it. Phrase it as `Section X.Y: replace
"..." with "..."`.
>
> When fully resolved, tick the section's `[ ] resolved` box. Sections
> with no issues stay empty — that's a useful signal too.

---

## Phase 0 — Pre-flight

- [ ] resolved (no issues)

### 0.1 — Domain + DNS access

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 0.2 — SSH key

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 0.3 — Zarinpal merchant

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 0.4 — Kavenegar SMS

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 0.5 — Google OAuth + Maps

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 0.6 — Zoom OAuth

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 0.7 — ArvanCloud account / buckets

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 0.8 — Local prerequisites

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 0.9 — Decisions

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 1 — Provision the Cloud Server

- [ ] resolved (no issues)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 2 — Initial server hardening

- [ ] resolved (no issues)

### 2.1 — sudo user

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 2.2 — disable root SSH (and the deploy-login verification gate)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 2.3 — base utilities

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 2.4 — unattended-upgrades

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 2.5 — ufw

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 2.6 — fail2ban

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 2.7 — timezone / NTP

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 2.8 — swap

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### 2.9 — disk-full check

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 3 — Install Docker (incl. mirrors)

- [ ] resolved (no issues)

### Apt repo + install

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Docker registry mirror (`/etc/docker/daemon.json`)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### npm/pnpm registry mirror in Dockerfile

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 4 — Object Storage bucket + policy

- [ ] resolved (no issues)

### Bucket creation

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Bucket policy JSON applied

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Endpoint URL copied verbatim

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 5 — DNS

- [ ] resolved (no issues)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 6 — Clone & configure repo (`.env.production`)

- [ ] resolved (no issues)

### Secret generation

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Variable values (any that needed adjustment from the template)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### `docker-compose.override.yml` tuning

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 7 — First boot (build + migrate + seed)

- [ ] resolved (no issues)

### `docker compose build`

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Sidecar migration container

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### `pnpm db:seed:plans` + `db:seed:sms`

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Caddy obtained TLS

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 8 — Smoke test

- [ ] resolved (no issues)

### TLS / curl

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### OTP flow end-to-end (Kavenegar)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Page editor + public profile renders

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Avatar upload → Object Storage URL renders

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Zarinpal sandbox checkout

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 9 — Cron timers

- [ ] resolved (no issues)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 10 — Backups

- [ ] resolved (no issues)

### `backup.sh` runs cleanly

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Offsite copy lands in `kioar-backups`

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Restore-verification on laptop

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 11 — Redeploy / rollback

- [ ] resolved (no issues)

### `deploy.sh` end-to-end

```
What happened:
Root cause:
Fix:
Runbook patch:
```

### Rollback path

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 12 — Caddy `www` redirect

- [ ] resolved (no issues)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 13 — Observability

- [ ] resolved (no issues)

```
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Section 14 — First-launch checklist

- [ ] resolved (no issues)

Items that didn't pass on first attempt:

```
Item:
What happened:
Root cause:
Fix:
Runbook patch:
```

---

## Cross-cutting issues

Anything that doesn't belong to a single section — Iran-network gotchas
that affected multiple steps, ArvanCloud panel quirks, surprises in
Caddy/Postgres/Next behavior, etc.

```
Issue:
Sections affected:
Resolution:
Runbook patch:
```

---

## Post-rehearsal — runbook patches to apply

Consolidate every `Runbook patch:` from above into ordered diffs here.
Apply them to `deploy-arvancloud.md`, commit, then destroy the staging
VM and run the corrected runbook against the production VM.

- [ ] All patches applied to `deploy-arvancloud.md`
- [ ] Diff reviewed by another set of eyes (or one full re-read after a
      break)
- [ ] Staging VM destroyed
- [ ] Object Storage staging buckets emptied or kept (decision: \_\_\_)
- [ ] DNS A record for `staging.kioar.com` removed (or repurposed)
- [ ] Zarinpal + Zoom + Google staging redirect URIs removed from
      respective panels (cleanup)

---

## Time log (optional but valuable)

Tracks where time actually went. Compare against your gut estimate.

| Section               | Estimated | Actual | Notes |
| --------------------- | --------- | ------ | ----- |
| Phase 0 (pre-flight)  |           |        |       |
| 1 — provision         |           |        |       |
| 2 — hardening         |           |        |       |
| 3 — Docker            |           |        |       |
| 4 — Object Storage    |           |        |       |
| 5 — DNS               |           |        |       |
| 6 — repo + .env       |           |        |       |
| 7 — first boot        |           |        |       |
| 8 — smoke test        |           |        |       |
| 9 — cron              |           |        |       |
| 10 — backups          |           |        |       |
| 11 — redeploy         |           |        |       |
| 12 — Caddy multi-host |           |        |       |
| 13 — observability    |           |        |       |
| 14 — checklist        |           |        |       |
| **Total**             |           |        |       |
