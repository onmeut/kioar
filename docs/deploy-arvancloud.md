# Deploying Kioar to ArvanCloud (Cloud Server IaaS)

End-to-end production runbook for self-hosting Kioar on a single ArvanCloud
Cloud Server using the repo's first-class Docker Compose + Caddy stack
(`docker-compose.prod.yml` + `caddy/Caddyfile`).

> **Decisions encoded in this guide** (confirmed up-front):
>
> - Topology: Docker Compose + Caddy (auto TLS), as shipped.
> - Primary domain: **`kioar.com`** only at launch. Other branded share
>   domains (`.me/.bio/.link/.ir/.app`) are deferred — Section 12 covers the
>   one-line Caddyfile change when you're ready.
> - Uploads: ArvanCloud Object Storage (S3-compatible) from day one.
> - Build: on the server (`git pull && docker compose build`).
> - Backups: daily `pg_dump` to local disk + offsite to Object Storage.
> - Scale: pre-launch beta. **2 vCPU / 4 GB RAM / 50 GB SSD**.

> **Codebase facts that drive specific choices below** (so you can sanity-check):
>
> - The runner Docker image uses `output: "standalone"` and **does not include
>   `node_modules` or source** — `pnpm db:migrate` cannot run inside it. We
>   run migrations from a sidecar `node:22-alpine` container joined to the
>   compose network (Section 7).
> - `src/lib/storage.ts` uploads with `ACL: "public-read"` and serves images
>   directly from `S3_PUBLIC_URL_BASE`. The bucket policy in Section 4 is
>   non-negotiable; without it, every image 403s in production.
> - There is **no SMTP / email** anywhere in the codebase. All
>   transactional notifications go through Kavenegar SMS. Don't waste time
>   provisioning an SMTP relay you don't need.
> - Zarinpal callback path is hard-coded to `/api/billing/callback`
>   ([src/app/api/billing/callback/route.ts](../src/app/api/billing/callback/route.ts)).

---

## Phase 0 — Pre-flight (do all of this BEFORE provisioning the VM)

The two items with multi-day lead times are **Zarinpal merchant approval**
and **Kavenegar template approval**. Start them first; everything else can
be done in an afternoon. None of this requires SSH access — most of it
needs to be queued days ahead so the server isn't sitting idle while a
third party reviews paperwork.

### 0.1 — Domain + DNS access

- [ ] `kioar.com` is registered and not expiring within the next 12 months.
- [ ] You have admin access to the registrar.
- [ ] DNS is delegated to **ArvanCloud Abr DNS** (panel → DNS → add domain
      → copy the two `ns*.arvancloud.com` nameservers → set them at the
      registrar). Wait until `dig NS kioar.com @8.8.8.8` returns Arvan's
      NS records globally before continuing — this can take up to 48h on a
      cold delegation.
- [ ] Subdomain `staging.kioar.com` is reserved for the dress-rehearsal VM
      (Section 5 will add the A record once you have an IP).

### 0.2 — SSH key

- [ ] Local SSH keypair generated (`ed25519` preferred):
      `ssh-keygen -t ed25519 -C "deploy@kioar" -f ~/.ssh/kioar_deploy`.
- [ ] **Public** key (`~/.ssh/kioar_deploy.pub`) uploaded to ArvanCloud
      panel → Account → SSH Keys. Name it `kioar-deploy`.
- [ ] Private key has a strong passphrase (or you've added it to
      `ssh-agent`). Do not commit it anywhere.
- [ ] `~/.ssh/config` has a host alias so you don't fat-finger the IP:
      `    Host kioar-staging
HostName <fill-after-provisioning>
User deploy
IdentityFile ~/.ssh/kioar_deploy`

### 0.3 — Zarinpal merchant account (multi-day lead time)

- [ ] Business account at <https://zarinpal.com> is **approved** (Iranian
      legal entity / national ID required; review usually takes 2–5 business
      days).
- [ ] Merchant ID issued (UUID format) and saved in your password manager
      as `ZARINPAL_MERCHANT_ID`.
- [ ] In the merchant panel → Webgate → **Callback URLs**, the production
      callback `https://kioar.com/api/billing/callback` is whitelisted.
      For dress rehearsal, also whitelist `https://staging.kioar.com/api/billing/callback`.
- [ ] You have access to the **sandbox** (`sandbox.zarinpal.com`) for
      end-to-end checkout testing without real money.

### 0.4 — Kavenegar SMS account (multi-day lead time)

- [ ] Account at <https://kavenegar.com> created and verified.
- [ ] **Sender line** purchased + approved (Iranian regulatory body must
      approve each line; allow 1–3 business days).
- [ ] **OTP template** approved — the Persian text used by
      [src/lib/kavenegar.ts](../src/lib/kavenegar.ts) for OTP delivery.
      The template name (not the body) becomes `KAVENEGAR_TEMPLATE` in
      `.env.production`. Submission turnaround is also 1–3 business days
      and the template body must include `%token` for the OTP code.
- [ ] API key copied (panel → API → REST). Save as `KAVENEGAR_API_KEY`.
- [ ] Sender line copied. Save as `KAVENEGAR_SENDER`.
- [ ] Account credit topped up enough for launch traffic + a margin for
      OTP-spam abuse before app-level rate limits kick in.

### 0.5 — Google OAuth + Maps (rotate the leaked credentials)

The previous `.env.example` leaked real client secrets. Treat them as
compromised and rotate **before** the staging VM goes live.

- [ ] Google Cloud Console → APIs & Services → **Credentials**: delete
      the old OAuth client and the old Maps API keys (they've been
      removed from the repo but anyone who cloned before the rotation
      still has them).
- [ ] Create a **new OAuth 2.0 client** (Web application). Authorized
      redirect URIs (add all four):
  - `https://kioar.com/api/oauth/google/callback`
  - `https://staging.kioar.com/api/oauth/google/callback`
  - `http://localhost:3000/api/oauth/google/callback` (for dev only)
- [ ] OAuth consent screen scopes: `openid email profile
https://www.googleapis.com/auth/calendar.events`. Submit for
      verification only when you're ready to publish the app to external
      users — internal/testing mode is fine for the dress rehearsal.
- [ ] Enable APIs in this project: **Google Calendar API**, **Maps
      JavaScript API**, **Places API**, **Geocoding API**.
- [ ] Create two API keys for Maps:
  - Server key restricted to your VM's egress IP, used as
    `GOOGLE_MAPS_API_KEY`.
  - Public key restricted to your domains (`*.kioar.com`,
    `localhost:3000`), used as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- [ ] All four values saved in your password manager.

> Skipping Google entirely is fine for launch — the booking integration
> with Google Calendar/Meet is optional. Bookings still work without it
> (event blocks render an address, host gets the booking, no
> auto-created calendar invite). Decide before launch and document either
> way.

### 0.6 — Zoom OAuth (rotate the leaked credentials)

- [ ] <https://marketplace.zoom.us/develop/create> → delete the old
      OAuth (User-managed) app.
- [ ] Create a new OAuth (User-managed) app. Scopes: `meeting:write:meeting`,
      `user:read:user`. Redirect URLs:
  - `https://kioar.com/api/oauth/zoom/callback`
  - `https://staging.kioar.com/api/oauth/zoom/callback`
- [ ] Client ID + secret saved as `ZOOM_OAUTH_CLIENT_ID` /
      `ZOOM_OAUTH_CLIENT_SECRET`.
- [ ] App is in **development** mode (no marketplace review needed for
      internal use); only request publication when external hosts beyond
      your own team need it.

> Skipping Zoom is also fine for launch — booking still creates the
> appointment row, the host just doesn't get an auto-generated meeting
> link.

### 0.7 — ArvanCloud account

- [ ] ArvanCloud account verified (Iranian phone + national ID).
- [ ] Billing source loaded with enough credit for ~1 month of: 2-vCPU VM + Object Storage + Abr DNS + (optional) snapshots. Estimate from
      the panel calculator before topping up.
- [ ] Object Storage **buckets created** (you can create them now and
      attach keys later in Section 4):
  - `kioar-uploads` — Public-read, region matching where the VM will
    live.
  - `kioar-backups` — Private, same region. Separate bucket, separate
    access key.
- [ ] **Region picked and locked.** Tehran (AT1 or AT2) for Iranian
      audience. The VM, both buckets, and the (optional) future CDN must
      all live in the same region for free intra-region bandwidth.

### 0.8 — Local prerequisites (your laptop)

- [ ] `ssh`, `dig`, `curl`, `git`, `docker` (for the restore-verification
      step in Section 10) — all installed.
- [ ] Repo cloned locally; `npm install` succeeds; `npm run typecheck` and
      `npm test` pass on `main`. **Do not deploy from a branch with
      failing tests.**
- [ ] Latest `pg_dump` from any existing prod DB (if migrating) saved
      offline; otherwise N/A.

### 0.9 — Decisions you should write down NOW

These can't be derived from the code; you'll be asked for them mid-deploy.

- [ ] **Admin phone numbers** (comma-separated E.164) — list of phones
      that get `/admin` access. At minimum your own.
- [ ] **VAT rate** to charge invoices (`BILLING_VAT_RATE`). Confirmed with
      your accountant. Decimal in `[0, 0.5]`. Most likely `0.10`.
- [ ] **Initial admin user**: phone number that will receive the first
      OTP and become the founding admin.

If any of `0.3`, `0.4`, `0.5`, `0.6` aren't done, the dress rehearsal will
stall waiting for an external party. Start them in parallel today.

---

## Phase 2 — ArvanCloud notes (relevant only)

- **Cloud Server (IaaS)**: standard OpenStack-style VMs. Pick Ubuntu 24.04 LTS
  (latest LTS at time of writing); 22.04 also fine. Public IPv4 included.
- **Security Groups**: stateful firewall in front of the VM. Rules apply
  _before_ host-level `ufw`; both layers are recommended.
- **Snapshots**: panel-driven, scheduled or manual. **Cost warning** —
  snapshots are billed against the source disk size. A 50 GB VM × 7 daily
  snapshots ≈ 350 GB of snapshot storage, which on most plans costs more
  than the VM itself. Check the Object Storage / snapshot pricing tab in the
  panel before enabling daily retention; consider weekly + manual-pre-deploy
  instead.
- **Abr DNS**: ArvanCloud's authoritative DNS. A/AAAA/CNAME/MX/TXT/CAA all
  supported. CAA matters here so Let's Encrypt can issue.
- **Object Storage**: S3-compatible, path-style. Endpoint hostnames are
  **region-scoped** — when you create the bucket, the panel shows the exact
  endpoint URL on the bucket detail page, e.g.
  `https://s3.ir-thr-at1.arvanstorage.ir` for Tehran-AT1. Don't guess; copy
  it from the panel. (See Section 4.)
- **Iran / sanctions caveats**:
  - Docker Hub: usually reachable from inside Iran via ArvanCloud's network,
    but unreliable. If pulls fail, configure ArvanCloud's Docker registry
    mirror (Section 3).
  - npm registry: `registry.npmjs.org` is geo-blocked from Iranian IPs.
    The Dockerfile's `npm ci` will fail without a
    mirror. Fix in Section 3.
  - GitHub (`api.github.com`, `codeload.github.com`): typically reachable;
    if not, push to Gitea/GitLab inside Iran or rsync from your laptop.
  - NTP: use Iran NTP pool (`ir.pool.ntp.org`).
  - Timezone: set host to **Asia/Tehran** so cron timers fire when expected.

---

## Phase 3 — Step-by-step deployment

### 1. Provision the Cloud Server

In the ArvanCloud panel → **Cloud → Servers → Create**:

| Setting         | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Distribution    | Ubuntu 24.04 LTS (or 22.04 LTS)                            |
| Plan            | 2 vCPU / 4 GB RAM / 50 GB SSD                              |
| Region          | Tehran (closest to your users; Object Storage same region) |
| Public IP       | Yes (IPv4 required for Let's Encrypt HTTP-01)              |
| SSH key         | Upload your public key first (Account → SSH Keys)          |
| Snapshot policy | Weekly, retain 4 (or skip — see cost note above)           |

In **Security Group** rules attached to the VM:

| Direction | Protocol | Port | Source     | Purpose          |
| --------- | -------- | ---- | ---------- | ---------------- |
| Inbound   | TCP      | 22   | your IP/32 | SSH (key only)   |
| Inbound   | TCP      | 80   | 0.0.0.0/0  | HTTP → ACME +301 |
| Inbound   | TCP      | 443  | 0.0.0.0/0  | HTTPS            |
| Outbound  | any      | any  | 0.0.0.0/0  | default allow    |

> Open port 22 to your office/home IP only. If you have a dynamic IP, use
> ArvanCloud's web SSH or a bastion later.

### 2. Initial server hardening

SSH in as `root`, then:

```bash
# 2.1 — create sudo user
adduser --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

> **STOP. Open a SECOND terminal on your laptop and run
> `ssh deploy@<server-ip>`. Confirm you get a shell.** If that fails, fix
> the key copy _now_ — do not run the next block. The next block disables
> root SSH and password auth; if `deploy` can't log in, you're locked out.

```bash
# 2.2 — disable root SSH + password auth (only after deploy login is verified)
sed -ri 's/^#?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -ri 's/^#?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh

# 2.3 — base utilities + security
apt-get update
apt-get -y upgrade
apt-get -y install ufw fail2ban unattended-upgrades curl ca-certificates \
                   gnupg lsb-release git rsync jq htop tzdata postgresql-client \
                   awscli

# 2.4 — automatic security updates
dpkg-reconfigure --priority=low unattended-upgrades

# 2.5 — firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 2.6 — fail2ban (sshd jail enabled by default)
systemctl enable --now fail2ban

# 2.7 — timezone + NTP
timedatectl set-timezone Asia/Tehran
timedatectl set-ntp true

# 2.8 — swap (4 GB) — Postgres + Node + sharp can spike
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10
echo 'vm.swappiness=10' > /etc/sysctl.d/99-kioar.conf

# 2.9 — disk-full early warning (mails root if /srv > 85%)
cat >/etc/cron.daily/kioar-disk-check <<'EOF'
#!/bin/sh
USAGE=$(df --output=pcent /srv | tail -1 | tr -dc '0-9')
[ "$USAGE" -ge 85 ] && echo "[KIOAR] /srv at ${USAGE}% on $(hostname)" \
  | logger -t kioar-disk -p user.warning
EOF
chmod +x /etc/cron.daily/kioar-disk-check
```

> `fail2ban` here only protects port 22. **Application-layer abuse**
> (OTP-spam against `/auth/*`, scraping `/api/places/*`) is enforced by
> `src/lib/rate-limit.ts` inside the app — confirm those buckets are wired
> on every public mutation route before launch. Adding a fail2ban jail on
> Caddy access logs is a separate hardening pass; defer to post-launch.

Reconnect as `deploy@<server-ip>` from now on. **Verify a fresh SSH session
works before closing your existing one.**

### 3. Install Docker (with Iran-friendly mirrors)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get -y install docker-ce docker-ce-cli containerd.io \
                        docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

**Log out and back in** (as `deploy`) so the new group membership applies.
`newgrp docker` only affects the current shell — subsequent SSH sessions
won't see it. Verify with:

```bash
docker compose version   # must work without sudo
```

#### Docker registry mirror (use ArvanCloud's) and log rotation

```bash
sudo tee /etc/docker/daemon.json <<'JSON'
{
  "registry-mirrors": ["https://docker.arvancloud.ir"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" }
}
JSON
sudo systemctl restart docker
```

> Verify the mirror URL on the live ArvanCloud panel before launch — they
> occasionally rename it. The `log-opts` cap container log growth at
> 250 MB/container so the disk doesn't fill silently.

#### npm registry — no action needed

The Docker image is built **locally on your laptop** (via `deploy.sh`) where
`registry.npmjs.org` is fully accessible. The image is then streamed to the
server via `docker save | gzip | ssh | docker load`. npm never runs on the
server itself, so the geo-block on `registry.npmjs.org` from Iranian IPs is
never hit.

The migration sidecar (Section 7) still runs `npm ci` on the server, but it
only installs `drizzle-kit` and a handful of deps — a much lighter install
that is less likely to hit network timeouts. The Runflare mirror is
configured there for reliability (`https://mirror-npm.runflare.com`).

### 4. Create the Object Storage bucket

In **ArvanCloud panel → Object Storage → Create Bucket**:

- Name: `kioar-uploads`
- Permission: **Public-read** (required — see policy below)
- Region: same as your VM (e.g. Tehran-AT1)

Then **Generate Access Key**. Note the four values:

- **Endpoint URL** — copied verbatim from the bucket detail page in the
  panel, including region. Common Tehran values:
  - `https://s3.ir-thr-at1.arvanstorage.ir`
  - `https://s3.ir-thr-at2.arvanstorage.ir`
  - These hostnames change per region; `<region>` is not a literal.
- Access Key ID
- Secret Access Key
- Bucket name (`kioar-uploads`)

#### Required bucket policy

The codebase ([src/lib/storage.ts](../src/lib/storage.ts)) writes objects
with `ACL: "public-read"` and constructs plain HTTP URLs from
`S3_PUBLIC_URL_BASE` (no presigning). Therefore the bucket _must_ allow
public reads on the upload prefixes. Apply this policy in the panel
(Bucket → Policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadKioarUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::kioar-uploads/avatars/*",
        "arn:aws:s3:::kioar-uploads/link-covers/*",
        "arn:aws:s3:::kioar-uploads/link-icons/*",
        "arn:aws:s3:::kioar-uploads/events/*",
        "arn:aws:s3:::kioar-uploads/product-items/*"
      ]
    }
  ]
}
```

> Without this policy, every avatar and product image 403s in production.
> The five prefixes match `UploadFolder` in
> [src/lib/storage.ts](../src/lib/storage.ts#L17-L22). If you add a new
> upload folder later, extend the policy.

> The **backups** bucket (Section 10) is a separate bucket with **no public
> policy** and a different access key. Never share keys between
> `kioar-uploads` and `kioar-backups`.

### 5. Point DNS

In **Abr DNS → kioar.com**:

| Type | Name  | Value                       | TTL  |
| ---- | ----- | --------------------------- | ---- |
| A    | `@`   | `<server-IPv4>`             | 3600 |
| A    | `www` | `<server-IPv4>`             | 3600 |
| CAA  | `@`   | `0 issue "letsencrypt.org"` | 3600 |

Wait until `dig +short kioar.com @8.8.8.8` returns your IP from outside
Iran before issuing certs (Let's Encrypt validates from outside).

### 6. Clone & configure the repo

```bash
sudo mkdir -p /srv/kioar
sudo chown deploy:deploy /srv/kioar
cd /srv/kioar
git clone https://github.com/<your-org>/kioar-app.git app
cd app
cp .env.example .env.production
chmod 600 .env.production
```

Generate strong secrets up-front:

```bash
echo "AUTH_SECRET=$(openssl rand -hex 64)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 32)"
```

Edit `.env.production`. **Every variable the codebase touches** is below —
fill the required ones, leave optional integrations empty if unused.

```dotenv
# ─── Core ────────────────────────────────────────────────────────────
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://kioar.com   # primary auth/dashboard origin
APP_DOMAIN=kioar.com                    # used by Caddy for TLS
TRUST_PROXY=true                        # Caddy is in front; honor X-Forwarded-For

# ─── Auth (SECRETS) ──────────────────────────────────────────────────
AUTH_SECRET=<openssl rand -hex 64>
CRON_SECRET=<openssl rand -hex 32>
ADMIN_PHONE_NUMBERS=+989XXXXXXXXX       # comma-separated; grants /admin

# ─── Database (compose wires these) ──────────────────────────────────
POSTGRES_DB=kioar
POSTGRES_USER=kioar
POSTGRES_PASSWORD=<openssl rand -hex 32>
DATABASE_URL=postgres://kioar:<same-password>@postgres:5432/kioar
DATABASE_POOL_MAX=10
DATABASE_STATEMENT_TIMEOUT_MS=15000
DATABASE_IDLE_TX_TIMEOUT_MS=10000
DATABASE_SSL=                           # off — we're inside docker network

# ─── Redis (in-network; required in prod) ────────────────────────────
REDIS_URL=redis://redis:6379

# ─── ArvanCloud Object Storage (S3-compatible) ───────────────────────
# Both URLs use the EXACT endpoint hostname from the bucket detail page.
# Example for Tehran-AT1 below — replace if your bucket lives elsewhere.
S3_ENDPOINT=https://s3.ir-thr-at1.arvanstorage.ir
S3_ACCESS_KEY_ID=<from panel>
S3_SECRET_ACCESS_KEY=<from panel>
S3_BUCKET=kioar-uploads
S3_REGION=us-east-1                     # SDK requires a value; Arvan ignores it
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL_BASE=https://s3.ir-thr-at1.arvanstorage.ir/kioar-uploads

# ─── Zarinpal (Iran payment gateway — REQUIRED for billing) ──────────
ZARINPAL_MERCHANT_ID=<UUID from zarinpal.com>
ZARINPAL_SANDBOX=                       # leave empty in prod
BILLING_VAT_RATE=0.10                   # 10% — confirm with your accountant

# ─── Kavenegar (transactional SMS — REQUIRED for OTP) ────────────────
KAVENEGAR_API_KEY=<from kavenegar.com panel>
KAVENEGAR_TEMPLATE=<approved template name>
KAVENEGAR_SENDER=<approved sender line>

# ─── OAuth integrations (optional; bookings/Zoom/Google Meet) ────────
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
ZOOM_OAUTH_CLIENT_ID=
ZOOM_OAUTH_CLIENT_SECRET=

# ─── Google Maps (optional; address autocomplete on event blocks) ────
GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# ─── Misc tunables ───────────────────────────────────────────────────
IMAGE_PROCESSING_CONCURRENCY=           # default min(4, cpus); leave empty
LOG_DEBUG=                              # set to 1 only while debugging
```

> **No SMTP variables.** The codebase has no email transport — every
> notification is SMS via Kavenegar. Don't provision a relay you won't use.

#### Add resource limits + Postgres tuning to compose

Default Postgres on a 4 GB box will misallocate `shared_buffers`. Create
[`docker-compose.override.yml`](../docker-compose.override.yml) (compose
auto-merges it on top of `-f docker-compose.prod.yml`):

```yaml
# docker-compose.override.yml — host-specific tuning for a 4 GB VM.
# Picked up automatically alongside docker-compose.prod.yml.
services:
  app:
    mem_limit: 1500m
    mem_reservation: 768m

  postgres:
    mem_limit: 1500m
    mem_reservation: 1024m
    command:
      - postgres
      - -c
      - shared_buffers=1GB
      - -c
      - effective_cache_size=2GB
      - -c
      - work_mem=16MB
      - -c
      - maintenance_work_mem=128MB
      - -c
      - max_connections=50
      - -c
      - log_min_duration_statement=500
      - -c
      - log_destination=stderr
      - -c
      - logging_collector=off

  redis:
    mem_limit: 256m

  caddy:
    mem_limit: 256m
```

> Caddy and Postgres now log to **stderr only**, captured by Docker's
> json-file driver (capped at 50 MB × 5 from Section 3). No file-based log
> rotation needed.

### 7. First boot — build, migrate, seed

```bash
cd /srv/kioar/app

# 7.1 — build the app image LOCALLY on your laptop (not on the server).
# npm install runs on your machine where registry.npmjs.org is accessible.
# Run this from your laptop, then ship the image:
#
#   DOCKER_BUILDKIT=1 docker buildx build --platform linux/amd64 --load -t kioar-app:latest /path/to/kioar-app/
#   docker save kioar-app:latest | gzip | ssh -i ~/.ssh/kioar_deploy deploy@<server-ip> "docker load"
#
# The rsync + build + ship steps are all wrapped in ~/deploy.sh on your laptop.
# For the very first boot, run deploy.sh from your laptop before continuing here.

# 7.2 — bring up postgres + redis only.
docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d postgres redis

# 7.3 — run migrations from a sidecar container that joins the compose
# network. The runner image strips node_modules+source (output: standalone),
# so we use a fresh node:22-alpine and mount the repo.
NETWORK=$(docker compose -f docker-compose.prod.yml --env-file .env.production \
  ps --format '{{.Name}}' postgres | head -1 | xargs -I{} \
  docker inspect {} --format '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}}{{end}}')
echo "compose network: $NETWORK"

# Read POSTGRES_PASSWORD from .env.production WITHOUT exporting it to the shell.
PG_PW=$(grep '^POSTGRES_PASSWORD=' .env.production | cut -d= -f2-)

docker run --rm \
  --network "$NETWORK" \
  -v "$PWD:/app" -w /app \
  -e DATABASE_URL="postgres://kioar:${PG_PW}@postgres:5432/kioar" \
  -e CI=1 \
  node:22-alpine sh -lc '
    apk add --no-cache git &&
    npm config set registry https://mirror-npm.runflare.com --global &&
    npm config set strict-ssl false --global &&
    npm ci &&
    npm run db:migrate &&
    npm run db:seed:plans &&
    npm run db:seed:sms
  '

# 7.4 — bring the full stack up.
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 7.5 — watch logs until Caddy issues the cert and Next prints "Ready".
docker compose -f docker-compose.prod.yml logs -f app caddy
```

The app image is built on your **laptop** (7.1) where npm has unrestricted
internet access, then shipped to the server as a pre-built image — npm never
runs on the server for the app itself.

The sidecar (7.3) still runs `npm ci` on the server, but it only installs
`drizzle-kit` + a small set of deps. That install is much lighter (~30 packages)
and uses the Liara mirror for reliability.

If Caddy can't obtain a cert, the most common causes are: DNS hasn't
propagated yet, port 80 isn't reachable from the public internet, or the
CAA record is missing.

### 8. Smoke-test

From your laptop:

```bash
curl -I https://kioar.com                         # 200 OK, valid TLS
curl -vI https://kioar.com 2>&1 | grep 'subject:' # cert subject = kioar.com
# Try the OTP flow in a browser; verify SMS arrives via Kavenegar.
# Try a Zarinpal sandbox checkout (set ZARINPAL_SANDBOX=1, redeploy).
```

### 9. Cron — systemd timers (host-level, hits the app over HTTPS)

The repo expects four timers. Pattern is documented in
[docs/cron.md](./cron.md); installation on this server:

```bash
sudo mkdir -p /etc/kioar
sudo tee /etc/kioar/cron.env >/dev/null <<EOF
BASE_URL=https://kioar.com
CRON_SECRET=$(grep '^CRON_SECRET=' /srv/kioar/app/.env.production | cut -d= -f2-)
EOF
sudo chmod 600 /etc/kioar/cron.env

sudo tee /etc/systemd/system/kioar-cron@.service >/dev/null <<'EOF'
[Unit]
Description=Kioar cron tick (%i)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/kioar/cron.env
ExecStart=/usr/bin/curl --fail --silent --show-error --max-time 60 \
  --request POST \
  --header "Authorization: Bearer ${CRON_SECRET}" \
  "${BASE_URL}/api/cron/%i"
EOF

# cleanup — every 15 min
sudo tee /etc/systemd/system/kioar-cron-cleanup.timer >/dev/null <<'EOF'
[Unit]
Description=Kioar cleanup cron
[Timer]
OnBootSec=2min
OnUnitActiveSec=15min
Unit=kioar-cron@cleanup.service
Persistent=true
[Install]
WantedBy=timers.target
EOF

# billing — daily 03:00 Asia/Tehran
sudo tee /etc/systemd/system/kioar-cron-billing.timer >/dev/null <<'EOF'
[Unit]
Description=Kioar billing cron
[Timer]
OnCalendar=*-*-* 03:00:00
Unit=kioar-cron@billing.service
Persistent=true
[Install]
WantedBy=timers.target
EOF

# sms — every minute
sudo tee /etc/systemd/system/kioar-cron-sms.timer >/dev/null <<'EOF'
[Unit]
Description=Kioar SMS worker
[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
Unit=kioar-cron@sms.service
Persistent=true
[Install]
WantedBy=timers.target
EOF

# affiliate-unlock — daily 03:30
sudo tee /etc/systemd/system/kioar-cron-affiliate-unlock.timer >/dev/null <<'EOF'
[Unit]
Description=Kioar affiliate unlock cron
[Timer]
OnCalendar=*-*-* 03:30:00
Unit=kioar-cron@affiliate-unlock.service
Persistent=true
[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now \
  kioar-cron-cleanup.timer \
  kioar-cron-billing.timer \
  kioar-cron-sms.timer \
  kioar-cron-affiliate-unlock.timer

systemctl list-timers 'kioar-cron-*'
journalctl -u 'kioar-cron@*.service' -f
```

### 10. Backups

#### Daily logical `pg_dump` (local + offsite to Object Storage)

Create the offsite bucket separately: panel → Object Storage → Create
**`kioar-backups`** as **Private**, with its own access key. **Do not
reuse `kioar-uploads` keys.**

`/srv/kioar/scripts/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/srv/kioar/backups
RETENTION_DAYS=14
TS=$(date -u +%Y%m%dT%H%M%SZ)
FILE="kioar-${TS}.sql.gz"
ENV_FILE=/srv/kioar/app/.env.production
COMPOSE=/srv/kioar/app/docker-compose.prod.yml

mkdir -p "$BACKUP_DIR"

# Read POSTGRES_PASSWORD without exporting it.
PGPASSWORD=$(grep '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

docker compose -f "$COMPOSE" --env-file "$ENV_FILE" \
  exec -T -e PGPASSWORD="$PGPASSWORD" postgres \
  pg_dump -U kioar -d kioar --no-owner --format=plain \
  | gzip -9 > "${BACKUP_DIR}/${FILE}"

# Offsite copy → ArvanCloud Object Storage (S3-compatible).
# NOTE: use a SEPARATE access key issued for kioar-backups, not the uploads key.
AWS_ACCESS_KEY_ID="<backups-access-key-id>" \
AWS_SECRET_ACCESS_KEY="<backups-secret-access-key>" \
aws --endpoint-url "<S3_ENDPOINT-from-panel>" \
    s3 cp "${BACKUP_DIR}/${FILE}" "s3://kioar-backups/postgres/${FILE}"

# Local retention.
find "$BACKUP_DIR" -name 'kioar-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
```

```bash
sudo install -d -o deploy -g deploy /srv/kioar/scripts
sudo install -m 750 -o deploy -g deploy backup.sh /srv/kioar/scripts/backup.sh
sudo crontab -u deploy -l 2>/dev/null \
  | { cat; echo '15 2 * * * /srv/kioar/scripts/backup.sh >> /var/log/kioar-backup.log 2>&1'; } \
  | sudo crontab -u deploy -
```

Set a 30-day lifecycle expiration on the `kioar-backups` bucket via the
panel.

#### Verify a restore — once, before launch

```bash
# Spin up a throwaway Postgres locally on your laptop:
docker run --rm -d --name kioar-restore -e POSTGRES_PASSWORD=test -p 5544:5432 postgres:17-alpine
zcat kioar-<latest>.sql.gz | docker exec -i kioar-restore psql -U postgres
docker exec -it kioar-restore psql -U postgres -c '\dt'   # tables present
docker rm -f kioar-restore
```

A backup that's never been restored isn't a backup.

#### ArvanCloud snapshots (optional, see cost note in Phase 2)

Weekly snapshot with 4-week retention is a reasonable budget compromise.
Treat them as VM disaster recovery only — not a substitute for `pg_dump`.

### 11. Zero-downtime redeploy

The canonical redeploy workflow is the same as `deploy.sh` on your laptop:
build the image locally, ship it, run migrations on the server, then restart
the container. Run this **from your laptop**, not from the server:

```bash
#!/usr/bin/env bash
# ~/deploy.sh — run from your laptop
set -euo pipefail

SERVER="deploy@37.152.187.2"
SSH_KEY="$HOME/.ssh/kioar_deploy"
REMOTE_PATH="/srv/kioar/app"
LOCAL_PATH="$HOME/kioar-app/"
IMAGE="kioar-app:latest"
ENV_FILE=".env.production"
COMPOSE="docker-compose.prod.yml"

echo "→ syncing code..."
rsync -avz --delete -e "ssh -i $SSH_KEY" \
  --exclude '.next' --exclude '.git' --exclude 'node_modules' \
  --exclude '.npm' --exclude '.env.local' --exclude '.env.development' \
  --exclude '*.log' --exclude '.DS_Store' \
  "$LOCAL_PATH" "$SERVER:$REMOTE_PATH/"

echo "→ building image locally (linux/amd64)..."
DOCKER_BUILDKIT=1 docker buildx build \
  --platform linux/amd64 --load -t "$IMAGE" "$LOCAL_PATH"

echo "→ shipping image to server..."
docker save "$IMAGE" | gzip | ssh -i "$SSH_KEY" "$SERVER" "docker load"

echo "→ migrating DB (sidecar on server)"
PG_PW=$(ssh -i "$SSH_KEY" "$SERVER" \
  "grep '^POSTGRES_PASSWORD=' $REMOTE_PATH/$ENV_FILE | cut -d= -f2-")
NETWORK=$(ssh -i "$SSH_KEY" "$SERVER" \
  "docker compose -f $REMOTE_PATH/$COMPOSE --env-file $REMOTE_PATH/$ENV_FILE \
   ps --format '{{.Name}}' postgres | head -1 | xargs -I{} \
   docker inspect {} --format '{{range \$k,\$_ := .NetworkSettings.Networks}}{{\$k}}{{end}}'")
ssh -i "$SSH_KEY" "$SERVER" "docker run --rm \
  --network $NETWORK \
  -v $REMOTE_PATH:/app -w /app \
  -e DATABASE_URL=postgres://kioar:${PG_PW}@postgres:5432/kioar \
  node:22-alpine sh -lc '
    npm config set registry https://mirror-npm.runflare.com --global &&
    npm config set strict-ssl false --global &&
    npm ci &&
    npm run db:migrate &&
    npm run db:seed:plans
  '"

echo "→ rolling app container..."
ssh -i "$SSH_KEY" "$SERVER" \
  "cd $REMOTE_PATH && \
   docker compose -f $COMPOSE --env-file $ENV_FILE up -d && \
   docker image prune -f"

echo "✓ deployed!"
```

**Rollback**:

```bash
git -C /srv/kioar/app reset --hard <previous-good-sha>
/srv/kioar/scripts/deploy.sh
# If a migration was destructive, restore the latest pg_dump first:
zcat /srv/kioar/backups/kioar-<ts>.sql.gz \
  | docker compose -f /srv/kioar/app/docker-compose.prod.yml exec -T postgres \
    psql -U kioar -d kioar
```

### 12. Caddy — `www` redirect now, other share domains later

The Section 5 DNS table adds both `kioar.com` and `www.kioar.com`. The
shipped [caddy/Caddyfile](../caddy/Caddyfile) only declares `$APP_DOMAIN`,
so requests to `www.kioar.com` will fail TLS issuance. Edit the Caddyfile
to handle both at the apex with a permanent redirect:

```caddyfile
www.{$APP_DOMAIN} {
	redir https://{$APP_DOMAIN}{uri} permanent
}

{$APP_DOMAIN} {
	# ...existing config from caddy/Caddyfile...
}
```

Reload Caddy: `docker compose -f docker-compose.prod.yml restart caddy`.

When you're later ready to also serve `kioar.me/.bio/.link/.ir/.app`:

1. Point A records for each domain at the server IP in Abr DNS.
2. Replace the host line in the main block:
   ```
   kioar.com, kioar.me, kioar.bio, kioar.link, kioar.ir, kioar.app {
   ```
3. `docker compose -f docker-compose.prod.yml restart caddy`

Caddy auto-issues a separate cert per host. No wildcard needed — the app
does _path-based_ profile URLs (`https://kioar.me/<slug>`), not subdomains.

> ⚠️ **Cookie scoping:** sessions are set without an explicit `domain`, so
> a user who signs in on `kioar.com` is not authenticated on `kioar.me`.
> That's intentional given the codebase — auth lives only on the primary.
> Always link to `https://kioar.com/...` from dashboard UI, and treat the
> share domains as serving unauthenticated public profile views only.

### 13. Observability

```bash
# App logs (structured JSON via lib/log.ts):
docker compose -f docker-compose.prod.yml logs -f --tail=200 app

# Caddy access + ACME:
docker compose -f docker-compose.prod.yml logs -f --tail=200 caddy

# Postgres slow queries (>500ms via log_min_duration_statement):
docker compose -f docker-compose.prod.yml logs --tail=200 postgres

# Cron history:
journalctl -u 'kioar-cron@*.service' --since '24 hours ago' --no-pager

# Disk + container stats:
df -h ; docker stats --no-stream
```

External monitoring at minimum:

- **HTTP uptime** — UptimeRobot/BetterStack pinging `https://kioar.com`
  every 5 min. Catches full outages only.
- **Disk-full pager** — Section 2.9 cron writes a syslog warning. For
  paging, point a free uptime monitor at a custom `/api/health/disk`
  endpoint (not currently in code; build later) or run `node_exporter` on
  the host and scrape from Grafana Cloud free tier.
- **Postgres connection pool** — watch `pg_stat_activity` count manually
  for the first weeks; alert on `> 30` sustained.

### 14. First-launch checklist

- [ ] DNS propagated worldwide (`dig kioar.com @1.1.1.1` returns server IP).
- [ ] Valid TLS cert for both `kioar.com` and `www.kioar.com`
      (`curl -vI https://www.kioar.com 2>&1 | grep 'HTTP/'` → 308 → 200).
- [ ] OTP login works end-to-end — SMS arrives, login completes.
- [ ] Page editor saves a link, public profile renders it at `/<slug>`.
- [ ] Avatar upload lands in `kioar-uploads/avatars/...` and renders via
      `/_next/image?url=...`. (If 403, the bucket policy in Section 4
      isn't applied.)
- [ ] **Zarinpal merchant panel:** callback URL whitelisted as
      `https://kioar.com/api/billing/callback` (exact path —
      [src/app/api/billing/callback/route.ts](../src/app/api/billing/callback/route.ts)
      is the canonical handler).
- [ ] Zarinpal sandbox checkout succeeds end-to-end → invoice flips to
      `paid`, subscription period rolls forward.
- [ ] Kavenegar template approved + sender line live.
- [ ] All four cron timers green: `systemctl list-timers 'kioar-cron-*'`.
- [ ] Today's backup present in both `/srv/kioar/backups` and the
      `kioar-backups` bucket.
- [ ] **Restored** that backup to a throwaway Postgres on your laptop.
- [ ] Production `.env.production` is `chmod 600`, owned by `deploy`.
- [ ] `docker stats` shows all four services within their `mem_limit`.

### 15. When to scale, in order

1. **Bigger DB plan first** — Postgres CPU + I/O is always the first
   ceiling. Bump VM disk and `shared_buffers`; consider a managed Postgres
   only if you outgrow self-hosted.
2. **PgBouncer** — switch on the `pgbouncer` profile in compose, point
   `DATABASE_URL` at `postgres://kioar:...@pgbouncer:6432/kioar`. Required
   before adding a second app instance.
3. **Two app replicas** — `docker compose up -d --scale app=2`. Caddy
   already load-balances on `app:3000`; Redis already handles shared
   rate-limit state.
4. **Move static profile traffic to a CDN** — ArvanCloud's CDN sitting in
   front of Caddy gives Iran-edge caching for `/<slug>` profile pages.
5. **Split DB onto a dedicated VM** — only when one box can't keep
   `pg_stat_activity` quiet under peak load.
