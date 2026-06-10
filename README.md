# Haul247 — Freight Booking Platform

A production-grade full-stack freight management system built as a technical assessment. The platform allows operators to register trucks, book shipments, process payments via Paystack, and run AI-powered anomaly detection on any transit record — all from a dark-mode Next.js dashboard backed by a JWT-authenticated Laravel 13 API.

## Demo

[![Watch the full platform walkthrough](https://cdn.loom.com/sessions/thumbnails/f2cb7f1aba524549a8bf00f7e38b318f-with-play.gif)](https://www.loom.com/share/f2cb7f1aba524549a8bf00f7e38b318f)

> Click the preview above to watch the full walkthrough — fleet registration, AI-powered truck dispatch, Paystack payment flow, and live anomaly detection in under 5 minutes.

---

## Quick Start

```bash
docker compose up --build
```

The backend automatically runs migrations on first start. Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

> **API keys required for AI features:** copy `Backend/.env.example` to `Backend/.env` and fill in `OPENAI_API_KEY`, `PAYSTACK_PUBLIC_KEY`, and `PAYSTACK_SECRET_KEY` before building.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Deep-Dives](#architecture-deep-dives)
   - [Enterprise Authentication: The Dual-Token Strategy](#1-enterprise-authentication-the-dual-token-strategy)
   - [AI Anomaly Detection: Sequential Pattern Recognition](#2-ai-anomaly-detection-sequential-pattern-recognition)
   - [Resilient Frontend: The SSR Hydration Crash Fix](#3-resilient-frontend-the-ssr-hydration-crash-fix)
   - [Infrastructure Orchestration: Docker Compose](#4-infrastructure-orchestration-docker-compose)
3. [Quick Start (Docker)](#quick-start-docker)
4. [Local Development](#local-development)
5. [API Reference](#api-reference)
6. [Environment Variables](#environment-variables)

---

## Feature Highlights

| Feature | Description |
|---|---|
| **JWT HttpOnly Auth** | Stateless auth with dual-cookie XSS protection |
| **Role-Based Access Control** | Admin and Operator roles — destructive operations restricted to Admin via `RequireRole` middleware |
| **Rate Limiting** | Auth endpoints throttled to 5 req/min; payment endpoint to 10 req/min — blocks brute-force and abuse |
| **Truck Fleet Management** | Register trucks with capacity, location, and live status tracking |
| **Freight Booking** | Book shipments with targeted truck dispatch or open-market broadcast |
| **Driver Job Board** | Drivers see pending shipment offers and accept in one click |
| **AI Truck Recommendation** | GPT-4o picks the best available truck based on origin, destination and weight |
| **AI Anomaly Detection** | GPT-4o analyses a shipment's full audit trail for risk flags |
| **Paystack Payments** | HMAC-verified webhook flow; shipment advances to `paid` on confirmation |
| **Lifecycle State Machine** | Shipment only moves `pending → assigned` when a driver explicitly accepts |
| **Audit Logging** | Every state-changing operation writes a tamper-evident audit log entry |
| **Shipment Tracking History** | `GET /shipments/{id}/tracking` returns a full chronological timeline from the audit log |
| **Idempotent Payments** | `Idempotency-Key` header on payment initiation prevents duplicate charges on network retries |

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **API** | Laravel 13 / PHP 8.4 | Typed Eloquent models, enum casts, native async-friendly middleware pipeline |
| **Auth** | tymon/jwt-auth 2.x | Stateless JWTs — no server-side session storage required at API scale |
| **Frontend** | Next.js 16 (App Router) | React Server Components, edge middleware, standalone Docker output |
| **Database** | MySQL 8.0 (Docker) / SQLite (local) | MySQL in production for ACID guarantees; SQLite for zero-config local dev |
| **AI Engine** | OpenAI GPT-4o | Contextual reasoning over free-form audit logs — no rigid rule engine |
| **Payments** | Paystack | HMAC-SHA512 webhook verification; PCI-compliant redirect flow |
| **Styling** | Tailwind CSS v4 | CSS-first config via `@theme inline`; no `tailwind.config.ts` required |
| **Containers** | Docker Compose v2 | Single-command spin-up with health-checked dependency ordering |

---

## Architecture Deep-Dives

### 1. Enterprise Authentication: The Dual-Token Strategy

#### The Problem with Naive Cookie Storage

Most tutorials store the raw JWT in a JavaScript-accessible cookie (`Cookies.set('token', jwt)`). This exposes the token to any script running on the page — a single XSS vulnerability can silently exfiltrate every active session. The assessment explicitly required secure token handling.

#### The Solution: HttpOnly Cookie + Session Indicator Bridge

The system uses two distinct cookies with carefully separated responsibilities:

```
Browser
  │
  ├─ jwt_token  (HttpOnly; SameSite=Strict; Secure in production)
  │    Set-Cookie header from Laravel on login/register/refresh.
  │    JavaScript CANNOT read this value — eliminates the XSS attack surface.
  │    The browser sends it automatically on every request to the API origin.
  │
  └─ token = "1"  (non-HttpOnly; set by the Next.js login form)
       A presence indicator — its VALUE is meaningless, not a credential.
       Read exclusively by the Next.js Edge middleware to protect /dashboard.
```

**Why two cookies?**

During local development, the Next.js frontend runs on `localhost:3000` and the Laravel API on `localhost:8000`. Browsers store cookies per-origin: the `jwt_token` cookie is issued by `:8000` and stored for `:8000`. When the Next.js middleware evaluates an incoming request to `:3000`, it cannot see `:8000`'s cookies — they are never sent to a different port, even on the same host.

Rather than weakening the security model (e.g., downgrading to `SameSite=None`), a thin presence indicator cookie (`token = "1"`) is written by the frontend after a successful login. This cookie has no cryptographic value — it is purely a routing hint. If an attacker manually sets `token=1`, they pass the middleware but every subsequent API call still fails with `401` because the real `jwt_token` is absent.

#### The Backend Bridge: `ReadJwtFromCookie` Middleware

The `tymon/jwt-auth` guard exclusively reads the `Authorization: Bearer` header. To complete the circuit without modifying the guard or its configuration, a purpose-built middleware runs before routing:

```php
// app/Http/Middleware/ReadJwtFromCookie.php
public function handle(Request $request, Closure $next): Response
{
    if (! $request->bearerToken()) {
        $token = $request->cookies->get('jwt_token'); // raw cookie bag — bypasses EncryptCookies
        if ($token) {
            $request->headers->set('Authorization', 'Bearer ' . $token);
        }
    }
    return $next($request);
}
```

Middleware execution order in `bootstrap/app.php`:

```
HandleCors              → resolves CORS preflights before any business logic
ReadJwtFromCookie       → promotes cookie value to Authorization header
[route middleware]
auth:api                → tymon validates the Bearer token it now finds
```

The `if (! $request->bearerToken())` guard ensures the middleware never interferes with direct API clients (Postman, integration tests, CI scripts) that already send an explicit `Authorization` header.

#### CORS Configuration

When `withCredentials: true` is set on Axios, the CORS spec forbids the `Access-Control-Allow-Origin: *` wildcard — the exact origin must be listed. `config/cors.php` explicitly enumerates the allowed origin:

```php
'allowed_origins'    => ['http://localhost:3000'],
'supports_credentials' => true,
```

This allows the browser to include credentials (the `jwt_token` cookie) on cross-origin requests to the API while preventing arbitrary third-party origins from making credentialed requests.

#### 401 Auto-Eviction

A response interceptor in `src/lib/api.ts` handles token expiry transparently:

```typescript
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('token');           // clear the presence indicator
      window.location.href = '/login';   // hard redirect — clears React state too
    }
    return Promise.reject(error);
  }
);
```

The presence indicator is cleared before the redirect so the Edge middleware does not bounce the user back to `/dashboard` in a redirect loop.

---

### 2. AI Anomaly Detection: Sequential Pattern Recognition

#### Why Not Rule-Based Thresholds?

A naive implementation would check: `if (hours_since_departure > 48) { risk = 'High' }`. This fails in practice — a 72-hour Lagos→Port Harcourt shipment is perfectly normal; a 6-hour Lagos→Lagos shipment stuck at a checkpoint is anomalous. Fixed thresholds cannot encode domain context.

#### The LLM-as-Reasoner Approach

The `ShipmentAnalysisController` assembles the entire chronological audit trail of a shipment and passes it to GPT-4o in a single context window:

```
Shipment Details:
- Tracking Number: HUL-20260609-XXXX
- Origin: Lagos | Destination: Abuja | Weight: 5,000 kg
- Current Status: in-transit | Created: 2026-06-08T09:00:00Z

Audit Log:
[2026-06-08T09:00:00Z] created: {"status":"pending"}
[2026-06-08T11:30:00Z] paid:    {"status":"paid","transaction_ref":"..."}
[2026-06-08T14:00:00Z] assigned: {"truck_id":3}
[2026-06-09T06:00:00Z] in-transit: {"status":"in-transit"}
```

The model evaluates the full sequence — time gaps between state transitions, expected route durations, weight-to-truck capacity ratios — and returns a structured risk assessment:

```json
{ "risk_level": "Low", "assessment": "Transit initiated 20 hours after payment within the expected window for this corridor. No anomalous gaps detected in the state progression." }
```

This approach captures patterns that no deterministic rule set could encode: irregular state regressions, unusually fast status progressions that suggest skipped steps, and geographic inconsistencies implied by timing.

#### Defensive Token Sanitization

GPT-4o (and most instruction-tuned LLMs) occasionally wraps JSON responses in Markdown code fences when contextually appropriate. Since the controller performs `json_decode()` on the raw response, unstripped fences cause silent parse failures. A two-pass regex sanitizer runs before decoding:

```php
$clean = preg_replace('/^```(?:json)?\s*/i', '', trim($text));   // strip opening fence
$clean = preg_replace('/\s*```$/i',         '', $clean);          // strip closing fence
$analysis = json_decode(trim($clean), true);

if (json_last_error() !== JSON_ERROR_NONE || ! isset($analysis['risk_level'], $analysis['assessment'])) {
    return response()->json(['message' => 'AI returned unexpected format', 'raw' => $text], 502);
}
```

The 502 fallback with the raw model output allows operators to diagnose prompt drift without the application silently failing.

---

### 3. Resilient Frontend: The SSR Hydration Crash Fix

#### The Root Cause

The original `dashboard/layout.tsx` was marked `'use client'`. In the Next.js App Router, a layout marked `'use client'` becomes a Client Component boundary — but it still receives `children` from the Server Component rendering pipeline. During the initial SSR pass, React's internal dispatcher is `null` (hooks are not available in the server phase), and any client library (in this case, `sonner`'s `Toaster`) that calls `useInsertionEffect` during module initialization finds a null dispatcher.

The symptom: `GET /dashboard 404` with `unhandledRejection: TypeError: Cannot read properties of null (reading 'useInsertionEffect')` — the page returned 404 because the SSR render crashed before the route handler could respond.

#### The Fix: Enforce the Server/Client Boundary

The layout was split into two files with strict responsibilities:

```
src/app/dashboard/layout.tsx          ← Server Component (no 'use client')
    └── renders <DashboardShell>

src/components/layouts/DashboardShell.tsx   ← 'use client'
    ├── usePathname() for active nav links
    ├── useRouter() for logout redirect
    └── Cookies.remove() for session cleanup
```

`layout.tsx` is now a Server Component that simply wraps its children in the shell:

```tsx
// layout.tsx — zero hooks, zero interactivity
import DashboardShell from '@/components/layouts/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
```

All hook-dependent code is encapsulated in `DashboardShell`, where React guarantees the dispatcher is initialized before any hook call executes. The server-side render phase never encounters a hook; the client hydration phase finds them exactly where it expects them.

---

### 4. Idempotency: Preventing Duplicate Payments

A mobile app on a flaky network might fire `POST /api/paystack/initiate` twice before receiving a response. Without idempotency, the user ends up with two payment references for the same shipment — a support nightmare.

The solution follows the same pattern used by Stripe and Paystack themselves: a client-supplied `Idempotency-Key` header. The server caches the response against `paystack:initiate:{userId}:{key}` for 24 hours. Any duplicate request with the same key gets the original response back, with an `X-Idempotent-Replayed: true` header so the client knows it was a replay:

```
First request:   POST /api/paystack/initiate  Idempotency-Key: uuid-abc-123
                 → generates new reference, caches response, returns 200

Duplicate retry: POST /api/paystack/initiate  Idempotency-Key: uuid-abc-123
                 → returns cached response, X-Idempotent-Replayed: true
                 → no new reference generated
```

When no explicit key is supplied (e.g. a browser click), a per-shipment natural key (`shipment-{id}`) is applied with a 1-hour window — preventing accidental double-payment from a double-click.

---

### 5. Security Controls: RBAC and Rate Limiting

#### Role-Based Access Control

Two roles are defined as a PHP backed enum (`UserRole::Admin`, `UserRole::Operator`). The `RequireRole` middleware resolves the authenticated user's role and compares it against the required role(s) for the route:

```php
// Only admins can delete trucks or shipments
Route::delete('trucks/{truck}',    [TruckController::class,    'destroy'])->middleware('role:admin');
Route::delete('shipments/{id}',    [ShipmentController::class, 'destroy'])->middleware('role:admin');
```

Any operator attempting a delete receives a `403 Forbidden` with a clear message. All other operations (create, read, update, accept) are available to both roles — matching real-world logistics where operators do day-to-day work and admins handle data governance.

#### Rate Limiting

Laravel's built-in `throttle` middleware is applied at the route group level:

```
POST /api/auth/register   →  5 requests / minute / IP
POST /api/auth/login      →  5 requests / minute / IP
POST /api/paystack/initiate → 10 requests / minute / IP
```

A brute-force login attempt hitting the 5-request ceiling gets a `429 Too Many Requests` response. The limits are deliberately conservative — in production these would be backed by Redis and combined with account-level lockout after N consecutive failures.

---

### 5. Payment Integration: Paystack Checkout Flow

#### End-to-End Flow

```
Shipment Created (pending)
        │
        ▼
  Operator clicks "Pay Now"
        │
        ▼
  POST /api/paystack/initiate   ← backend generates reference, returns authorization_url
        │
        ▼
  Browser opens checkout.paystack.com/{reference}
        │
        ▼
  Customer pays on Paystack
        │
        ▼
  Paystack fires webhook → POST /api/paystack/webhook
        │
        ▼
  Backend verifies HMAC-SHA512 signature, updates shipment → paid
        │
        ▼
  Shipment now visible on Driver Job Board (pending + paid)
        │
        ▼
  Driver accepts → assigned
```

#### Frontend: Pay Now Button

The `Pay Now` button is shown exclusively on `pending` shipments. It calls `POST /api/paystack/initiate`, receives the Paystack authorization URL, and opens it in a new tab:

```typescript
const { data } = await shipmentService.initiatePayment(shipment.id);
window.open(data.data.authorization_url, '_blank', 'noopener,noreferrer');
```

The button shows a loading spinner while the API call is in flight and disables itself to prevent double-clicks.

#### Backend: HMAC Webhook Verification

The webhook endpoint is public (no auth middleware) but protected by Paystack's HMAC-SHA512 signature. The `VerifyPaystackSignature` middleware computes `hash_hmac('sha512', rawBody, PAYSTACK_SECRET_KEY)` and compares it against the `x-paystack-signature` header — rejecting any request that does not match:

```php
$computed = hash_hmac('sha512', $request->getContent(), config('services.paystack.secret'));
if (! hash_equals($computed, $request->header('x-paystack-signature', ''))) {
    abort(401);
}
```

This ensures only genuine Paystack events can advance a shipment to `paid`.

#### Local Testing Note

Without live Paystack keys, clicking **Pay Now** redirects to Paystack's checkout page which shows "transaction not found" — this is expected. The integration pattern (API call, authorization URL, redirect, webhook handler) is fully wired. Add real keys in `Backend/.env` to run live payment flows.

---

### 5. Driver Dispatch Lifecycle & AI Truck Recommendation

#### The Problem with Naive Auto-Assignment

Immediately locking a truck when a shipment is created (a common shortcut) breaks the driver workflow: the driver has no say, availability cannot be guaranteed, and double-booking races become likely at scale. The system needed a proper acceptance handshake.

#### The State Machine

Every shipment is born in `pending` regardless of what the client sends — `ShipmentController::store` hard-forces the value before `Shipment::create()`:

```php
$validated['status'] = ShipmentStatus::Pending; // immune to any client payload
$shipment = Shipment::create($validated);
```

The only valid `pending → assigned` transition is an explicit driver acceptance:

```
POST /api/trucks/{truck}/accept/{shipment}
```

`TruckController::acceptShipment` runs two guard clauses before committing:

```php
if ($truck->status !== TruckStatus::Available) {
    return response()->json(['message' => 'Truck is not available.'], 422);
}
if ($shipment->status !== ShipmentStatus::Pending) {
    return response()->json(['message' => 'Shipment is no longer pending.'], 422);
}
$shipment->update(['truck_id' => $truck->id, 'status' => ShipmentStatus::Assigned]);
$truck->update(['status' => TruckStatus::Assigned]);
```

Both guards are necessary: a truck that just accepted another offer between the frontend poll and this request would otherwise silently double-book.

#### Targeted vs Open-Market Dispatch

When a shipment is booked with a `truck_id`, only that specific truck sees it on its job board. When `truck_id` is `null`, every available truck sees it — open market. The filtering is a pure frontend predicate:

```ts
const visibleShipments = pendingShipments.filter(
  s => s.truck_id === null || s.truck_id === truck.id
);
```

No extra backend queries required — the truck's ID is already in the payload.

#### AI Truck Recommendation

`RecommendTruckController` (`POST /api/shipments/recommend-truck`) fetches all `available` trucks, constructs a Dispatch Routing Assistant prompt with origin, destination, weight and each truck's capacity and current location, and asks GPT-4o to choose the best match. The returned `truck_id` is validated against the live available list before trusting it — the LLM cannot hallucinate a truck into existence:

```php
if (! in_array($result['truck_id'], $availableIds)) {
    return response()->json(['message' => 'AI returned invalid truck_id'], 502);
}
```

The frontend auto-selects the recommended truck in the booking dropdown and displays a violet reasoning pill so operators can see exactly why the recommendation was made.

---

### 5. Infrastructure Orchestration: Docker Compose

#### Service Dependency Graph

```
db (MySQL 8.0)
 └── healthcheck: mysqladmin ping every 5s, 12 retries, 30s start window
      │
      └── backend (PHP 8.3 + Apache)     depends_on: db → service_healthy
           │    startup: config:cache → route:cache → migrate --force → apache
           │
           └── frontend (Node 20 Alpine)  depends_on: backend
```

The `condition: service_healthy` dependency ensures the Laravel container never attempts `php artisan migrate` until MySQL is actually accepting query connections — not just passing a TCP port check. Without this, the migration runs against an initializing MySQL process and fails silently.

#### Multi-Stage Frontend Build

A standard Docker build for a Next.js app copies the full `node_modules` tree (~600 MB) into the image. The production image uses Next.js's `output: "standalone"` mode combined with a three-stage build:

```dockerfile
# Stage 1 — deps:    npm ci (own layer, cached until package-lock.json changes)
# Stage 2 — builder: npm run build (receives NEXT_PUBLIC_API_URL as ARG)
# Stage 3 — runner:  copies only .next/standalone + .next/static + public/
```

The `standalone` output traces the exact `require()` graph of the production server and bundles only the node_modules actually imported. The final runner image contains no devDependencies, no source files, and no build toolchain. Result: **~220 MB vs ~1.1 GB** for a naive COPY-everything approach — roughly an 80% reduction.

#### Composer Layer Caching

The backend Dockerfile separates dependency installation from source copying to maximise layer cache hits:

```dockerfile
# Copied first — changes rarely (only on dependency updates)
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Copied second — changes on every code edit
COPY . .
```

On a typical code-only change, the `composer install` layer is served from cache in milliseconds rather than re-downloading and compiling all packages.

#### `APP_ENV=local` in Docker (Deliberate Choice)

The `AuthController` uses `app()->isProduction()` to conditionally set `Secure=true` on the JWT cookie (HTTPS-only). Docker runs over plain HTTP. Setting `APP_ENV=production` would silently drop the cookie in every browser, breaking authentication. `APP_ENV=local` keeps the cookie transmittable over HTTP while `APP_DEBUG=false` still hides stack traces from API consumers — the combination that makes the most sense for a HTTP-based review environment.

---

## Quick Start (Docker)

**Prerequisites:** Docker Desktop installed and running.

```bash
# Clone and enter the project
git clone <repository-url>
cd haul247-assessment

# (Optional) Provide real API keys for AI analysis and live payments
# Create a .env file here with:
#   OPENAI_API_KEY=sk-proj-...
#   PAYSTACK_SECRET_KEY=sk_live_...

# Build and start all three services
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend dashboard | http://localhost:3000 |
| Laravel API | http://localhost:8000/api |
| Health check | http://localhost:8000/api/health |
| MySQL | `localhost:3306` (user: `haul247`, pass: `haul247secret`) |

The backend runs `php artisan migrate --force` automatically on first start. Database state persists in the `mysql_data` Docker volume across restarts.

To tear down completely (including the database volume):

```bash
docker compose down -v
```

---

## Local Development

### Backend (PHP 8.3, SQLite)

```bash
cd Backend

# Copy environment file and generate keys
cp .env.example .env
php artisan key:generate
php artisan jwt:secret

# Install dependencies and migrate
composer install
php artisan migrate

# Serve on port 8001 (8000 is often occupied)
php artisan serve --port=8001
```

### Frontend (Node 20)

```bash
cd Frontend/frontend

# Install dependencies
npm install

# Configure API URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8001/api" > .env.local

# Start dev server
npm run dev
```

---

## API Reference

All endpoints are prefixed with `/api`. Authenticated routes require the `jwt_token` HttpOnly cookie (set automatically after login) or an `Authorization: Bearer <token>` header.

### Public

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Structured health check — verifies DB and cache connectivity |
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Authenticate and receive JWT (sets HttpOnly cookie) |
| `POST` | `/api/paystack/webhook` | Paystack payment event receiver (HMAC-SHA512 verified) |

### Authenticated

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/logout` | Invalidate JWT and clear cookie |
| `POST` | `/api/auth/refresh` | Rotate JWT and reset cookie |
| `GET` | `/api/auth/me` | Authenticated user profile |
| `GET` | `/api/trucks` | List all trucks (paginated) |
| `POST` | `/api/trucks` | Register a new truck |
| `PUT` | `/api/trucks/{id}` | Update truck (status, capacity) |
| `DELETE` | `/api/trucks/{id}` | Remove truck from fleet |
| `GET` | `/api/shipments` | List all shipments (paginated) |
| `POST` | `/api/shipments` | Book a new freight shipment |
| `PUT` | `/api/shipments/{id}` | Update shipment details or status |
| `DELETE` | `/api/shipments/{id}` | Cancel a shipment |
| `POST` | `/api/trucks/{id}/accept/{shipmentId}` | Driver accepts a pending/paid shipment — advances both to `assigned` |
| `GET` | `/api/shipments/{id}/tracking` | Full chronological tracking timeline derived from the audit log |
| `POST` | `/api/paystack/initiate` | Initiate payment — idempotent via `Idempotency-Key` header (24h window) |
| `GET` | `/api/shipments/{id}/analyze` | GPT-4o anomaly detection on a shipment's full audit trail |
| `POST` | `/api/shipments/recommend-truck` | GPT-4o selects the best available truck for origin/destination/weight |

---

## Environment Variables

### Backend (`Backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `APP_KEY` | Laravel encryption key (`php artisan key:generate`) | — |
| `APP_ENV` | `local` / `production` | `local` |
| `DB_CONNECTION` | `sqlite` (local) or `mysql` (Docker) | `sqlite` |
| `DB_HOST` | MySQL host — use `db` inside Docker Compose | `127.0.0.1` |
| `JWT_SECRET` | JWT signing key (`php artisan jwt:secret`) | — |
| `PAYSTACK_SECRET_KEY` | Paystack secret for webhook HMAC verification | — |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key for payment initiation | — |
| `OPENAI_API_KEY` | OpenAI key for GPT-4o AI analysis | — |

### Frontend (`Frontend/frontend/.env.local`)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Full base URL of the Laravel API | `http://localhost:8001/api` |

> In Docker, `NEXT_PUBLIC_API_URL` is baked into the JS bundle at build time via a Dockerfile `ARG`. The value must be the URL the **browser** uses to reach the API — not an internal Docker hostname.

---

## Future Roadmap

Phase 2 implementation is fully mapped out and includes:

- **Full Payment Gateway Integration** — Paystack and Stripe live-mode flows with automated retry logic, partial refunds, and split-payment support for multi-leg shipments.
- **Automated Digital Invoicing** — PDF invoice generation triggered on shipment delivery, emailed directly to the customer with a tamper-evident audit trail and line-item breakdown.
- **Real-Time Tracking** — WebSocket-based GPS location streaming from driver mobile app to dashboard map view.
- **Role-Based Access Control** — Separate operator, driver, and customer portals with scoped permissions and read-only audit views.
- **Notification System** — Push and SMS notifications at every shipment status transition via Firebase Cloud Messaging and Termii.
