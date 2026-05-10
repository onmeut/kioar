# Error monitoring — Sentry vs GlitchTip

## TL;DR

**Recommendation: self-hosted GlitchTip, deployed alongside the existing app
via `docker-compose.prod.yml`.** No code is being installed yet — this doc
captures the reasoning so the decision is reviewable before we wire up an SDK.

## Constraints in play

1. **App is hosted in Iran on ArvanCloud.** SaaS error monitoring vendors are
   subject to the same access uncertainty as any other US-based PaaS. Sentry
   Cloud sign-ups, billing, and data ingest can break overnight depending on
   sanctions tooling, payment routing, or ASN blocks on either side. We
   cannot rely on it as a production dependency.
2. **Solo founder, pre-revenue.** Sentry's paid tier ($26/mo "Team" minimum,
   higher once event volume grows) is a recurring cost we can avoid. The free
   tier is capped at 5k errors/month and one user, which is workable but
   awkward as soon as we add a teammate or a noisy bug ships.
3. **Existing infra is Docker Compose** (Caddy + Next app + Postgres + Redis).
   Adding one more service is cheap; adding an external paid dependency is a
   step change in how the system is operated.
4. **Data sovereignty.** Error payloads contain stack traces, request URLs,
   user IDs, and sometimes user-supplied content. Keeping that on
   Iranian-hosted infrastructure simplifies privacy posture and avoids
   cross-border data questions.
5. **Lock-in risk.** GlitchTip implements the Sentry SDK ingest protocol.
   Whatever client code we write today (`@sentry/nextjs` calls) works against
   either backend by switching `SENTRY_DSN`. If GlitchTip ever stops being
   the right choice, the migration is a DSN swap — not a rewrite.

## Why not Sentry Cloud

- **Iran access risk** — described above; too high a probability of an
  outage we cannot fix.
- **Cost grows with traffic** — error volume tracks user volume, so the bill
  scales precisely when budget is tightest.
- **Data leaves the country** — adds compliance surface area for no clear
  upside.

The one real argument *for* Sentry Cloud is "zero ops". That's a real
benefit, but it's negated by point 1 above.

## Why not Sentry self-hosted

Sentry's self-hosted bundle is honest about its own footprint: it requires
~14 services (Kafka, Redis, Postgres, ClickHouse, Snuba, Symbolicator,
Relay, multiple workers, multiple web tiers) and >4 GB RAM minimum. That's
larger than the entire current Kioar production footprint. Maintenance
burden — version upgrades, ClickHouse migrations, Kafka topic rebalancing —
is not something a solo founder should sign up for to track exceptions.

## Why GlitchTip

- **Drop-in protocol-compatible** with the Sentry SDK we'd use anyway
  (`@sentry/nextjs`). No vendored client.
- **Tiny footprint**: one Django app + one Postgres (can share our existing
  one or run an isolated instance) + Redis (we already have one). Fits the
  Compose pattern.
- **AGPL, actively maintained** by burkesoftware. Roadmap aligns with the
  Sentry features we'd actually use (issues, breadcrumbs, releases,
  performance is in beta).
- **No external dependency**, no outbound egress for ingest, no billing
  account that can lapse.
- **Keeps the door open** to migrating to Sentry SaaS later if the
  geopolitical picture changes — same DSN-shaped configuration.

## What we lose vs Sentry SaaS

- **Performance / tracing** — GlitchTip has it in beta but it's not as
  polished as Sentry's distributed tracing UI. Acceptable: at this stage we
  need exception capture, not span analysis.
- **Profiling, replays, crons monitoring** — Sentry-only premium features.
  We don't need them yet; profile-cache metrics + structured logs already
  cover the ground we care about.
- **Source map upload tooling** — GlitchTip supports source maps, but the
  upload UX is rougher. Worth a small one-time scripting investment.

## Deployment sketch (not yet wired)

```yaml
# docker-compose.prod.yml — illustrative, not committed
glitchtip:
  image: glitchtip/glitchtip:latest
  environment:
    DATABASE_URL: postgres://glitchtip:${GLITCHTIP_DB_PASSWORD}@postgres:5432/glitchtip
    SECRET_KEY: ${GLITCHTIP_SECRET_KEY}
    PORT: "8000"
    EMAIL_URL: ${GLITCHTIP_EMAIL_URL}
    GLITCHTIP_DOMAIN: https://errors.kioar.example
    DEFAULT_FROM_EMAIL: errors@kioar.example
    REDIS_URL: redis://redis:6379/2
  depends_on: [postgres, redis]

glitchtip-worker:
  image: glitchtip/glitchtip:latest
  command: ./bin/run-celery-with-beat.sh
  environment: *glitchtip-env
  depends_on: [postgres, redis]
```

Caddy gets a new `errors.kioar.example` host pointing at `glitchtip:8000`.
DB: a separate logical database in the existing Postgres instance is fine
at our scale; we can split if it ever competes for IO.

## When we'd revisit

- Team grows past 2–3 people and the per-seat math changes.
- Event volume crosses 100k/month and the GlitchTip Postgres needs
  attention more often than once a quarter.
- The geopolitical situation changes such that Sentry Cloud becomes
  reliable from Iran AND the data sovereignty story becomes a non-issue.

Until any of those land, GlitchTip is the right answer.
