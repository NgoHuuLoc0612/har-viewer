# HAR Viewer

A full-stack HTTP Archive (HAR) analyzer with deep request inspection, waterfall charts, AI-powered analysis, PII scanning, security auditing, certificate inspection, and performance profiling.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Windows](#windows)
  - [WSL2 / Linux](#wsl2--linux)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Generating HAR Files](#generating-har-files)
- [Troubleshooting](#troubleshooting)

---

## Features

### Dashboard
- Request summary — total, successful, failed, redirects, client errors, server errors, cached, service worker
- Transfer summary — bytes transferred vs decoded, compression savings, header/body breakdown
- Timing summary — avg, min, max, P50/P75/P90/P95/P99 duration and TTFB
- Resource summary — unique domains, IPs, MIME types, HTTP methods, protocols, cookies

### Request Table
- Virtualized rendering — smooth at 10,000+ entries
- Columns: #, Method, Status, Domain, Path, Type, MIME, Duration, TTFB, Size, Protocol, Cache, Waterfall
- Inline waterfall bar with colored timing segments per row
- Click any row to open the detail panel
- Sortable, searchable, column visibility toggles
- Filters: method, status range (2xx/3xx/4xx/5xx), domain, MIME type, protocol, duration range, size range, cache status, HTTPS-only

### Request Detail Panel
- Resizable split — table + detail side by side
- **General** — full URL, method, protocol, IP, port, connection ID, cache state
- **Request Headers** — searchable, raw mode, one-click copy
- **Response Headers** — security header highlights, raw mode
- **Cookies** — request and response cookies, Secure / HttpOnly / SameSite flag audit
- **Params** — query string parameters with URL-decoded values, form data
- **Request Body** — JSON tree, raw text, hex dump, base64, HTML/image preview
- **Response Body** — JSON tree, XML, HTML sandboxed preview, image preview, hex dump, raw, base64
- **Timing** — stacked bar chart, phase breakdown table (DNS, Connect, TLS, TTFB, Download), summary metrics

### Waterfall View
- ECharts-powered waterfall with colored timing phases
- Zoom (scroll wheel or buttons), pan (drag)
- Filter by URL text or resource type
- Per-row tooltip: full timing phase breakdown

### Statistics
- HTTP method distribution (donut)
- Status code distribution (donut)
- Resource type distribution (donut)
- Response time histogram (20 buckets)
- TTFB percentile bar chart (P50 → P99)
- Top domains by request count
- Transfer size by domain
- Cache hit/miss distribution
- Compression: transferred vs decoded sizes

### Domain Analytics
- Per-domain table: request count, error count, total size, avg latency, avg TTFB
- Expandable rows: success/error rate, slowest request, largest resource, protocol breakdown, MIME breakdown
- Sortable, searchable

### Security Analysis
- Overall security score (0–100)
- HTTPS coverage percentage
- Security header audit: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CORP, COOP
- TLS version detection, old-version warnings, cipher suite listing
- Mixed content detection
- Cookie flag audit: missing Secure, HttpOnly, SameSite

### Certificate Inspector
- Full TLS certificate chain viewer
- Subject, issuer, validity dates, SANs
- Key algorithm, size, signature algorithm
- Self-signed and expiry warnings
- Export: PEM, JSON, OpenSSL-style text

### PII Scanner
- Categories: Email, Phone, Credit Card, Identity, Authentication, Crypto, Cloud, Database
- Severity: Critical → High → Medium → Low → Info
- Multiple false-positive reduction layers:
  - Binary/image response bodies are skipped entirely
  - Generic patterns require keyword context nearby (±300–600 chars)
  - Entropy thresholds per rule
  - Luhn check for credit cards
  - Allowlist for common non-sensitive patterns
- Reveal All / Mask All toggle
- Export report, Copy value, Filter by category/severity

### Performance Analysis
- Performance score (0–100)
- Slow requests (>3 s threshold)
- Large resources (>1 MB threshold)
- High TTFB (>600 ms)
- Uncompressed compressible resources
- Missing cache headers on cacheable assets
- Duplicate request detection
- Redirect chain detection
- Render-blocking resource detection

### Compare Mode
- Select any two uploaded HAR files
- Diff: added requests, removed requests, modified requests
- Header diffs (added / removed / modified) per request
- Cookie diffs, body change detection
- Timing regression chart (sorted by absolute delta)
- Size change chart

### Search
- Full-text across URL, domain, path, method, status, MIME type
- Regex mode toggle
- Per-field search: `url:`, `domain:`, `method:`, `status:`, `mime:`
- Keyboard shortcut: `⌘K` / `Ctrl+K`

### AI Analysis (Groq)
- Live model list from Groq API
- Quick presets: General / Performance / Security
- Free-form chat with full HAR context injected
- Suggested prompts
- Markdown rendering with syntax highlighting
- Chat export to Markdown
- Supported models: `llama-3.3-70b`, `llama-3.1-8b`, `mixtral-8x7b`, `gemma2-9b`, `deepseek-r1`, `qwen-qwq`

### Export
- **JSON** — full analysis result
- **CSV** — request list with all metrics
- **Markdown** — formatted report with summary tables
- **HTML** — self-contained styled report

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| UI | shadcn/ui, Radix UI, Framer Motion |
| State | Zustand |
| Table | TanStack Table + TanStack Virtual |
| Charts | ECharts |
| Forms | React Hook Form + Zod |
| Backend | NestJS, Fastify |
| Database | PostgreSQL 18, Drizzle ORM |
| Queue | BullMQ + Redis |
| AI | Groq SDK |
| Monorepo | npm workspaces |

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | Required by Next.js 15 |
| PostgreSQL | 18 | Port 5432 |
| Redis | 7+ | Port 6379 — use [Memurai](https://www.memurai.com/) on Windows |
| Groq API Key | — | Free at [console.groq.com](https://console.groq.com) — optional, only needed for AI features |

---

## Installation

### Windows

#### 1. Install dependencies

```powershell
git clone https://github.com/NgoHuuLoc0612/har-viewer
cd har-viewer
npm install --legacy-peer-deps
```

#### 2. Configure environment

```powershell
copy apps\api\.env.example apps\api\.env
notepad apps\api\.env
```

```powershell
copy apps\web\.env.local.example apps\web\.env.local
notepad apps\web\.env.local
```

#### 3. Start PostgreSQL

PostgreSQL 18 via [EDB installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads):

```powershell
# Check the service is running
Get-Service postgresql*

# Start it if stopped
Start-Service postgresql-x64-18

# Verify connection
psql -U postgres -c "SELECT version();"
```

#### 4. Start Memurai (Redis for Windows)

Memurai runs as a Windows service automatically after install:

```powershell
# Check status
Get-Service Memurai

# Start if stopped
Start-Service Memurai

# Test
memurai-cli ping   # → PONG
```

#### 5. Set up database

```powershell
node scripts/setup-db.js
```

#### 6. Run

```powershell
npm run dev
```

---

### WSL2 / Linux

#### 1. Install dependencies

```bash
git clone https://github.com/NgoHuuLoc0612/har-viewer
cd har-viewer
npm install --legacy-peer-deps
```

#### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env

cp apps/web/.env.local.example apps/web/.env.local
nano apps/web/.env.local
```

#### 3. Set up PostgreSQL 18

```bash
# Ubuntu / Debian — add PostgreSQL repo
sudo apt install -y curl ca-certificates
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt update && sudo apt install -y postgresql-18

# Start
sudo pg_ctlcluster 18 main start
# or
sudo systemctl start postgresql

# Set password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'yourpassword';"
```

If you get `peer authentication failed`, edit `pg_hba.conf`:

```bash
sudo nano /etc/postgresql/18/main/pg_hba.conf
```

Change these lines:
```
# Before
local   all   postgres   peer
host    all   all   127.0.0.1/32   ident

# After
local   all   postgres   md5
host    all   all   127.0.0.1/32   md5
```

```bash
sudo pg_ctlcluster 18 main restart
psql -U postgres -h localhost -c "\l"   # verify
```

#### 4. Set up Redis

**Option A — Redis inside WSL2:**

```bash
sudo apt update && sudo apt install -y redis-server

# Optional: allow external connections
sudo nano /etc/redis/redis.conf
# Change: bind 127.0.0.1 ::1
# To:     bind 0.0.0.0

sudo service redis-server start
redis-cli ping   # → PONG
```

**Option B — Use Memurai on Windows host from WSL2:**

```bash
# Find Windows host IP
ip route show | grep -i default | awk '{print $3}'
# or
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'

# Set in apps/api/.env
nano apps/api/.env
# REDIS_HOST=<windows-host-ip>
# Note: with WSL2 mirrored networking mode, use REDIS_HOST=127.0.0.1
```

#### 5. Set up database

```bash
node scripts/setup-db.js
```

#### 6. Run

```bash
npm run dev
```

---

## Environment Variables

### `apps/api/.env`

```env
# ── Database ────────────────────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_NAME=har_viewer
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# ── Redis / BullMQ ──────────────────────────────────────────────────────────
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=                     # leave blank if no auth

# ── AI (optional) ───────────────────────────────────────────────────────────
GROQ_API_KEY=gsk_your_key_here      # get free at console.groq.com

# ── Server ──────────────────────────────────────────────────────────────────
PORT=3001
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Running the App

### Development (both services, one command)

```bash
npm run dev
```

### Development (separately, for cleaner logs)

```bash
# Terminal 1 — API
npm run dev --workspace=apps/api

# Terminal 2 — Web
npm run dev --workspace=apps/web
```

### Production build

```bash
npm run build
npm run start
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Swagger docs | http://localhost:3001/api/docs |

---

## Project Structure

```
har-viewer/
├── apps/
│   ├── web/                          # Next.js 15 frontend
│   │   ├── app/
│   │   │   ├── page.tsx              # Upload page / file list
│   │   │   ├── viewer/[id]/          # Main analysis viewer
│   │   │   │   └── page.tsx
│   │   │   └── compare/              # HAR comparison page
│   │   ├── components/
│   │   │   ├── dashboard/            # Stats cards, summary panels
│   │   │   ├── request-table/        # TanStack Table + Virtual + filters
│   │   │   ├── request-detail/       # Split panel, 8 tabs
│   │   │   ├── waterfall/            # ECharts waterfall renderer
│   │   │   ├── charts/               # Statistics + domain charts
│   │   │   ├── security/             # Security audit + PII scanner
│   │   │   ├── performance/          # Performance issues list
│   │   │   ├── certificate/          # TLS cert chain viewer
│   │   │   ├── compare/              # HAR diff view
│   │   │   ├── groq/                 # AI chat + quick analysis
│   │   │   ├── body-viewer/          # Multi-format body inspector
│   │   │   └── layout/               # Header, sidebar, nav
│   │   ├── lib/
│   │   │   ├── api.ts                # Axios client + all API calls
│   │   │   ├── enrichment.ts         # Frontend status/MIME enrichment
│   │   │   └── utils.ts              # Formatters, color helpers
│   │   └── store/
│   │       └── har-store.ts          # Zustand global state
│   │
│   └── api/                          # NestJS + Fastify backend
│       └── src/
│           ├── main.ts               # Bootstrap, Fastify adapter
│           ├── app.module.ts         # Root module, BullMQ config
│           ├── har/
│           │   ├── har.controller.ts        # Upload, list, delete endpoints
│           │   ├── har.service.ts           # File management, queue dispatch
│           │   ├── har-parser.service.ts    # HAR parsing, browser detection
│           │   ├── har-enrichment.service.ts # Status/MIME enrichment, scoring
│           │   └── har-analysis.processor.ts # BullMQ worker, analysis pipeline
│           ├── pii/
│           │   └── pii-scanner.service.ts   # PII detection, 40+ rules
│           ├── certificate/
│           │   └── certificate.service.ts   # TLS cert chain fetcher
│           ├── groq/
│           │   ├── groq.controller.ts       # /models, /analyze, /chat
│           │   └── groq.service.ts          # Groq SDK wrapper
│           ├── export/
│           │   └── export.service.ts        # JSON/CSV/Markdown/HTML export
│           └── database/
│               ├── schema.ts                # Drizzle schema definitions
│               └── migrate.ts               # Migration runner
│
├── packages/
│   └── shared/
│       └── src/index.ts              # Shared TS types, HTTP status defs, MIME categories
│
└── scripts/
    ├── setup-db.js                   # Database init + migration
    └── rebuild-api.sh                # WSL/Linux: rebuild NestJS API
```

---

## API Reference

### HAR Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/har/upload` | Upload HAR file content (JSON body, up to 500 MB) |
| `GET` | `/api/har` | List all uploaded HAR files |
| `GET` | `/api/har/:uuid` | Get file metadata |
| `DELETE` | `/api/har/:uuid` | Delete file and all associated data |
| `GET` | `/api/har/:uuid/status` | Get processing status |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/har/:uuid/analysis` | Full analysis result (dashboard, stats, security, performance) |
| `GET` | `/api/har/:uuid/entries` | Paginated entries with filters |
| `GET` | `/api/har/:uuid/entries/:index` | Single entry with full detail |
| `GET` | `/api/har/:uuid/search` | Search entries — `?q=text&fields=url,domain,method` |
| `GET` | `/api/har/:uuid/export` | Export — `?format=json\|csv\|markdown\|html` |

### Comparison

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/har/compare` | Compare two HAR files — body: `{ "uuidA": "...", "uuidB": "..." }` |

### Certificate

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/certificate/:host` | Fetch TLS certificate chain for a host |

### PII

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pii/scan/:uuid` | Run PII scan on a HAR file |

### AI (Groq)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/groq/models` | List available Groq models |
| `POST` | `/api/groq/analyze/:uuid` | Quick analysis — body: `{ "preset": "general\|performance\|security", "model": "..." }` |
| `POST` | `/api/groq/chat/:uuid` | Chat — body: `{ "message": "...", "history": [...], "model": "..." }` |

---

## Generating HAR Files

### Chrome / Edge / Brave

1. Open DevTools → **Network** tab (`F12`)
2. Navigate to the website
3. Right-click anywhere in the request list → **Save all as HAR with content**

### Firefox

1. Open DevTools → **Network** tab (`F12`)
2. Click the **⚙ gear** icon → **Save All As HAR**

### Safari

1. Enable Developer menu: **Safari → Settings → Advanced → Show features for web developers**
2. Open **Web Inspector** → **Network** tab
3. Click **Export** (↓ icon) in the toolbar

### Charles Proxy

**File → Export Session → HTTPArchive (.har)**

### Fiddler

**File → Export Sessions → HTTPArchive v1.2**

### Programmatically

**Playwright** — recommended, built-in HAR support, no extra packages:

```bash
# Install once
npm install -g playwright
npx playwright install chromium

# Interactive — opens browser, you interact, close window to save HAR
npx playwright codegen --save-har=output.har https://example.com

# Headless script (save as capture.mjs, run with: node capture.mjs <url>)
```

```js
// capture.mjs  —  tested ✓  (generates HAR 1.2, creator: Playwright)
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://example.com';
const output = process.argv[3] || 'output.har';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  recordHar: { path: output, mode: 'full' },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
await ctx.close();       // flush HAR to disk before closing
await browser.close();
console.log('Saved:', output);
```

```bash
node capture.mjs https://example.com output.har
```

**Puppeteer + puppeteer-har** — no CLI, must use as a script:

```bash
npm install puppeteer puppeteer-har
```

```js
// capture-puppeteer.mjs  —  tested ✓  (generates HAR 1.2, creator: chrome-har)
import puppeteer from 'puppeteer';
import PuppeteerHar from 'puppeteer-har';

const url = process.argv[2] || 'https://example.com';
const output = process.argv[3] || 'output.har';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
const har = new PuppeteerHar(page);
await har.start({ path: output });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
await har.stop();
await browser.close();
console.log('Saved:', output);
```

```bash
node capture-puppeteer.mjs https://example.com output.har
```

> **Note:** `puppeteer-har` is a library, not a CLI — there is no `puppeteer-har <url>` command.

---

## Troubleshooting

### API won't start — `ECONNREFUSED` to PostgreSQL

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# WSL2
sudo pg_ctlcluster 18 main start

# Windows
Start-Service postgresql-x64-18
```

Check `pg_hba.conf` uses `md5` not `peer` — see [WSL2 PostgreSQL setup](#3-set-up-postgresql-18).

---

### API won't start — `ECONNREFUSED` to Redis

```bash
# Check Redis
redis-cli ping

# Start
sudo service redis-server start
# or
sudo systemctl start redis
```

If using Memurai on Windows from WSL2, ensure `REDIS_HOST` in `.env` points to the Windows host IP, not `127.0.0.1` (unless mirrored networking is enabled).

---

### Upload fails — `Request body exceeded 10MB`

Already handled: `next.config.mjs` sets `middlewareClientMaxBodySize: '500mb'` and a streaming Route Handler exists at `app/api/har/upload/route.ts`. If the error recurs, restart both dev servers.

---

### Upload succeeds but analysis stays `pending`

The BullMQ worker requires Redis. Check:

```bash
redis-cli ping       # must return PONG
```

Then check the API terminal for worker errors. If the queue is stuck:

```bash
redis-cli FLUSHDB    # ⚠ clears all queued jobs
```

---

### `Failed to proxy` / `ECONNREFUSED 127.0.0.1:3001`

The API (NestJS) is not running. Start it:

```bash
npm run dev --workspace=apps/api
```

Wait for `Nest application successfully started` before uploading files.

---

### Rebuild API after TypeScript changes (WSL2)

```bash
bash scripts/rebuild-api.sh
```

---

### Browser shows "Unknown Unknown"

Browser is detected in priority order: `log.browser` → User-Agent header → `sec-ch-ua` Client Hints → creator field. If all are absent from the HAR, it falls back to "Unknown". Re-export the HAR from your browser's DevTools (not a third-party tool) for best detection.

