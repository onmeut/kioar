# Security

## Environment setup

Copy `.env.example` to `.env` and fill in your values:

```sh
cp .env.example .env
```

**Never commit `.env` files.** The `.gitignore` already blocks all `.env*` files except `.env.example`.

## Generating secrets

```sh
# AUTH_SECRET — session signing key
openssl rand -hex 64

# CRON_SECRET — bearer token for /api/cron/* endpoints
openssl rand -base64 32

# MEILI_MASTER_KEY — Meilisearch master key
openssl rand -base64 32
```

## Environment separation

Use **separate credentials** for development and production:

- **Google OAuth** — create two OAuth 2.0 client IDs in Google Cloud Console: one for dev (`localhost:3000` redirect) and one for production. Never share the same client ID/secret across environments.
- **Zoom OAuth** — create two separate Zoom Marketplace apps (one for dev, one for production).
- **AUTH_SECRET** — generate a fresh value independently for dev and prod. If the same secret is used in both environments, a dev session token would be valid in production.

## File permissions

Keep env files readable only by your user:

```sh
chmod 600 .env .env.production
```

## Rotating a compromised secret

If any secret is exposed (e.g. accidentally committed, logged, or copied into a shared document):

| Secret                                      | Where to rotate                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                               | Generate new value → deploy → all existing sessions are invalidated (users must re-login) |
| `CRON_SECRET`                               | Generate new value → update env and any external cron scheduler configs simultaneously    |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Rotate in your S3-compatible provider console                                             |
| `KAVENEGAR_API_KEY`                         | Rotate in the Kavenegar dashboard                                                         |
| `GOOGLE_OAUTH_CLIENT_SECRET`                | Rotate in Google Cloud Console → OAuth credentials                                        |
| `ZOOM_OAUTH_CLIENT_SECRET`                  | Rotate in Zoom Marketplace app settings                                                   |
| `ZARINPAL_MERCHANT_ID`                      | Contact Zarinpal support                                                                  |
| `DATABASE_URL` password                     | Change in Postgres, update env, redeploy                                                  |
| `REDIS_URL` password                        | Change in Redis config, update env, redeploy                                              |

## Reporting a vulnerability

Please report security vulnerabilities privately to the project maintainers rather than opening a public issue.
