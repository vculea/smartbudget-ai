# SmartBudget AI – Backend

REST API for SmartBudget AI: transactions, budgets, savings goals, dashboard and an AI financial coach.
Spring Boot 3.5 · Java 21 · MongoDB · Maven.

## Stack and version choices

| Component | Version | Note |
| --- | --- | --- |
| Java | 21 (LTS) | `java.version` in `pom.xml` |
| Spring Boot | 3.5.16 | stable 3.x line; manages Spring Data MongoDB 4.5, Testcontainers 1.21 |
| springdoc-openapi | 2.8.17 | the 2.8 line targets Spring Boot 3.4+ |
| MongoDB | 7.0 | Docker image `mongo:7.0` |
| AI client | Spring `RestClient` | OpenAI-compatible `/chat/completions` API |

**Why not Spring AI?** The spec allows either. A small `RestClient` adapter avoids coupling to a Spring AI / Spring Boot
version matrix, works with any OpenAI-compatible provider (OpenAI, Groq, Gemini's OpenAI endpoint, Ollama, ...) just by
changing `AI_BASE_URL`/`AI_MODEL`, and is easy to test. The provider is hidden behind the `AiAnalysisService` interface
(`com.smartbudget.ai`), so it can be replaced without touching the financial logic.

## Structure

```
src/main/java/com/smartbudget/
  config/       Mongo conversions (Decimal128, UTC dates), CORS, OpenAPI, demo data seeder
  common/       ApiException, GlobalExceptionHandler (@RestControllerAdvice), ApiError, PageResponse, Money
  category/     document, repository, service, controller
  transaction/  CRUD + filters/pagination (MongoTemplate) + aggregation stats
  budget/       budgets with spent/remaining/percentage/status
  goal/         savings goals and contributions (accumulated amount is derived, never stored)
  dashboard/    monthly indicators (DashboardCalculator holds the formulas)
  ai/           AiAnalysisService port, OpenAI-compatible adapter, response validator, controller
```

Each module has document, repository, service, controller and request/response DTOs; documents are never exposed.
Collections reference each other by id (`categoryId`, `goalId`); nothing is embedded.

## Run

Prerequisites: JDK 21, Maven 3.9+, Docker.

### Everything in Docker (frontend + backend + MongoDB)

```bash
cd backend
cp .env.example .env        # edit MONGO_PASSWORD and AI_API_KEY
docker compose up -d --build
```

* UI: <http://localhost:8081> (nginx serves the React build and proxies `/api/` to the backend, same origin)
* API: <http://localhost:8080/api/v1> · Swagger UI: <http://localhost:8080/swagger-ui.html> · Health: <http://localhost:8080/actuator/health>
* Backend and frontend ports are published on `127.0.0.1` only. MongoDB has **no published port** (reachable only from the backend over the compose network), requires authentication and stores data in the named volume `mongo-data`.
* `SEED_ENABLED=true` (default in `.env.example`) loads idempotent demo data for `SEED_USER_ID`. Categories belong to each user: every new user gets the default set on first login.

### Local development (backend from Maven, MongoDB in Docker)

```bash
cd backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongo   # needs MONGO_PASSWORD in .env; binds 127.0.0.1 only
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

With the `dev` profile the demo data is seeded automatically. If you do not use compose, any MongoDB works:
`MONGODB_URI=mongodb://localhost:27017/smartbudget` is the default.

### Frontend

In the repository root run `npm run dev` (real API, `http://localhost:8080/api/v1` by default; `npm run dev:demo` uses the local mock instead).
CORS allows `http://localhost:5173` by default (`CORS_ALLOWED_ORIGINS`, comma separated; add `http://127.0.0.1:5173` if you browse that way).

### Build and tests

```bash
mvn clean package        # compiles, runs all tests, builds target/smartbudget-backend.jar
mvn test                 # tests only
```

The integration tests start a throw-away MongoDB with Testcontainers (Docker required; they are skipped when Docker is
unavailable). No test calls a real AI provider: the AI interface is mocked, and the HTTP adapter is tested against
`MockRestServiceServer` and a local slow HTTP server (real timeout).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | – (`dev` in compose) | `dev`: debug logs + demo data; `prod`: quiet logs, no seed, Swagger off unless `SWAGGER_ENABLED=true` |
| `SERVER_PORT` | `8080` | HTTP port |
| `MONGODB_URI` | `mongodb://localhost:27017/smartbudget` | MongoDB connection string |
| `AI_API_KEY` | – (required for AI) | provider key; never logged or returned |
| `AI_MODEL` | `gpt-4o-mini` | model name |
| `AI_VISION_MODEL` | same as `AI_MODEL` | model with image input used by `POST /transactions/scan` (e.g. `gpt-4o-mini`, local `gemma4:26b`, `llava`) |
| `AI_BASE_URL` | `https://api.openai.com/v1` | any OpenAI-compatible base URL |
| `AI_CONNECT_TIMEOUT` / `AI_READ_TIMEOUT` | `5s` / `30s` | provider timeouts |
| `AI_JSON_MODE` | `true` | send `response_format: json_object` (set `false` if the provider rejects it) |
| `SEED_ENABLED` | `true` in `dev`, `false` otherwise | demo data seeding (only with `SEED_USER_ID`) |
| `SEED_USER_ID` | – | internal id of the user who receives the demo transactions/budgets/goals |
| `GOOGLE_CLIENT_ID` | – (required for sign-in) | OAuth client id of the Google sign-in; without it `POST /auth/google` answers 503 |
| `JWT_SECRET` | – (random per start, with a warning) | signs the session tokens; at least 32 characters |
| `AUTH_TOKEN_TTL` | `12h` | session lifetime |
| `ALLOWED_EMAILS` | – (any verified Google account) | comma separated Google accounts allowed to sign in |
| `SWAGGER_ENABLED` | `true` in dev, `false` in prod | Swagger UI / OpenAPI docs in prod |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | comma separated origins |

Indexes are created at startup (`auto-index-creation: true`): `{userId, transactionDate}`, `categoryId`, `type` on `transactions`;
unique `{userId, month, categoryId}` on `budgets`; `userId` on `savings_goals`; unique `googleSub` on `users`; `{goalId, contributionDate}` on `goal_contributions`; unique `{userId, name, type}` on `categories`.

## Data formats

* Money: JSON **number** with at most 2 decimals (`1234.50`). `BigDecimal` in Java and DTOs, BSON `Decimal128` in MongoDB. Input amounts
  must be between `0.01` and `1000000000` with ≤ 2 decimals.
* Dates: `YYYY-MM-DD` (stored as UTC midnight). Months: `YYYY-MM`. Timestamps: ISO-8601 UTC instants.
* Ids: MongoDB ObjectId strings (demo data uses readable ids such as `demo-tx-2026-10-03`).
* Errors: `{ "status": 409, "error": "Conflict", "message": "...", "fieldErrors": { "amount": "..." }, "timestamp": "..." }`
  (`fieldErrors` only for validation errors).
* Pages: `{ "content": [...], "page": 0, "size": 20, "totalElements": 57, "totalPages": 3 }` (`page` is 0-based).

## Endpoints (`/api/v1`)

Interactive documentation: Swagger UI (use *Authorize* with the token returned by `/auth/google`). All endpoints below except `/auth/google` and `/actuator/health` require `Authorization: Bearer <token>`. Summary:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/google` | public; body `{ "credential": "<Google ID token>" }` → `{ token, expiresAt, user }`; 401 / 403 / 503 |
| GET | `/auth/me` | the signed-in user |
| GET | `/dashboard?month=YYYY-MM` | month defaults to the current one |
| GET | `/transactions` | filters `type`, `categoryId`, `startDate`, `endDate` (inclusive), `search`; `page`, `size` (≤ 100), `sort=transactionDate\|amount\|createdAt,asc\|desc` |
| GET | `/transactions/{id}` | 404 if missing |
| POST / PUT | `/transactions`, `/transactions/{id}` | 201 / 200; category must exist and match the transaction type (422 otherwise) |
| DELETE | `/transactions/{id}` | 204 |
| POST | `/transactions/scan` | multipart field `image` (JPEG/PNG/WebP, ≤ 8 MB, type checked from the file signature). The vision model reads amount, date, description and picks an existing category; returns `{ type, amount, description, transactionDate, categoryId }` (`amount`/`categoryId` may be `null`) **without saving**; the client reviews it and calls `POST /transactions`. 413 / 415 / 422 (nothing recognized) / 429 / 502 / 503 / 504 |
| GET | `/categories` | the caller's categories, sorted by type and name |
| POST / PUT | `/categories`, `/categories/{id}` | 201 / 200; body `{ name, type, color?, icon? }`; 409 if the name already exists for that type (case-insensitive) or if the type changes while transactions/budgets use the category |
| GET | `/categories/{id}/usage` | `{ transactions, budgets }` using the category |
| DELETE | `/categories/{id}?replacementId=` | 204; when in use, `replacementId` (same type, 422 otherwise) is required (409 without it): transactions and budgets move there; a budget whose month already has one for the replacement is removed |
| GET | `/budgets?month=YYYY-MM` | |
| POST | `/budgets` | 201; 409 if the category already has a budget for that month; expense categories only |
| GET | `/goals` | |
| POST | `/goals` | 201; `targetDate` optional but not in the past |
| POST | `/goals/{id}/contributions` | 201, returns the updated goal; 409 for completed goals |
| POST | `/ai/insights` | body `{ "month": "YYYY-MM" }` (optional) |
| GET | `/actuator/health` | liveness/readiness: `/actuator/health/liveness`, `/readiness` |

### Formulas

* `balance = totalIncome - totalExpenses`
* `savingsRate = balance / totalIncome * 100` when `totalIncome > 0`, else `0` (can be negative when spending exceeds income)
* `budgetUsedPercentage = Σ spent on budgeted categories / Σ budget limits * 100`, else `0`; categories without a budget are ignored
* Budget `percentageUsed = spent / limit * 100`; status `NORMAL` (< 80 %), `WARNING` (80 % up to and including 100 %), `EXCEEDED` (> 100 %)
* `remainingAmount = limit - spent` (negative when exceeded)
* Goal `currentAmount` = sum of its contributions (aggregation), `progressPercentage` capped at 100;
  the goal becomes `COMPLETED` when `currentAmount >= targetAmount`.
  **Rule:** completed goals reject new contributions (409) because their target is reached and they are closed.

### Examples

```http
POST /api/v1/transactions
{ "type": "EXPENSE", "amount": 42.50, "description": "Supermarket", "transactionDate": "2026-10-03", "categoryId": "demo-cat-groceries" }

201 { "id": "...", "type": "EXPENSE", "amount": 42.50, "description": "Supermarket", "transactionDate": "2026-10-03",
      "categoryId": "demo-cat-groceries", "categoryName": "Alimente", "createdAt": "...", "updatedAt": "..." }
```

```http
POST /api/v1/budgets
{ "categoryId": "demo-cat-transport", "month": "2026-11", "limitAmount": 400 }

201 { "id": "...", "categoryId": "demo-cat-transport", "categoryName": "Transport", "month": "2026-11",
      "limitAmount": 400.00, "spentAmount": 0.00, "remainingAmount": 400.00, "percentageUsed": 0.00, "status": "NORMAL" }
```

```http
GET /api/v1/dashboard?month=2026-10
200 { "month": "2026-10", "totalIncome": 7700.00, "totalExpenses": 4685.00, "balance": 3015.00, "savingsRate": 39.16,
      "budgetUsedPercentage": 82.06,
      "topCategories": [ { "categoryId": "demo-cat-rent", "categoryName": "Chirie", "amount": 1800.00, "percentage": 38.42 } ],
      "expensesByCategory": [ ... ], "monthlyTrend": [ { "month": "2026-05", "income": 0.00, "expenses": 0.00 } ],
      "budgets": [ ... ], "goals": [ ... ], "recentTransactions": [ ... ] }
```

```http
POST /api/v1/goals/{id}/contributions
{ "amount": 500, "contributionDate": "2026-10-20", "note": "Economii lunare" }

201 { "id": "...", "name": "Laptop nou", "targetAmount": 5000.00, "currentAmount": 2500.00, "targetDate": "2027-04-22",
      "status": "ACTIVE", "progressPercentage": 50.00, ... }
```

```http
POST /api/v1/ai/insights
{ "month": "2026-10" }

200 { "month": "2026-10", "summary": "Luna a fost în general echilibrată...",
      "insights": [ { "title": "Reduce cheltuielile la divertisment", "reason": "Ai depășit bugetul cu 85 RON.",
                      "suggestedMonthlySaving": 85.00, "priority": "MEDIUM" } ],
      "generatedAt": "2026-10-22T08:40:00Z" }
```

AI error responses (never a fabricated answer): `422` month without data, `429` provider rate limit, `502` invalid AI answer or rejected
credentials, `503` provider unavailable / `AI_API_KEY` missing, `504` provider timeout. The frontend can offer a retry.

### AI design

* Only the month is accepted from the client; every figure is recomputed from MongoDB.
* The provider receives an aggregated JSON summary (totals, per-category spending, budget usage, goal progress, previous months).
  No transaction descriptions, user data or ids are sent.
* The system prompt requires prudent, concrete advice based only on the summary, at most 3 recommendations and a strict JSON answer.
* The answer is validated before it is returned: non-empty summary, 1–3 insights (extra ones are dropped), non-blank title/reason,
  `priority` ∈ LOW/MEDIUM/HIGH, `0 ≤ suggestedMonthlySaving ≤ totalExpenses`.
* The model only produces text; it has no tool or database access.

## Authentication

Sign-in is done **only with a Google account** (Google Identity Services, ID-token flow):

1. The frontend shows the "Sign in with Google" button and receives a Google ID token (a signed JWT).
2. `POST /api/v1/auth/google` `{ "credential": "<ID token>" }`: the backend verifies the signature against Google's public keys
   (`https://www.googleapis.com/oauth2/v3/certs`), the issuer, the audience (`GOOGLE_CLIENT_ID`), the expiry and `email_verified`,
   creates the user on first login (collection `users`, keyed by the Google `sub`) and returns `{ token, expiresAt, user }`.
3. Every other endpoint needs `Authorization: Bearer <token>` (HS256 JWT signed with `JWT_SECRET`, subject = internal user id,
   lifetime `AUTH_TOKEN_TTL`, default 12 h). Missing/invalid/expired token: `401` with the usual error body.
4. `GET /auth/me` returns the signed-in user. Public: `POST /auth/google`, `/actuator/health`, `/actuator/info` and the API docs.

Transactions, budgets, goals (and the contributions of a goal) and categories are scoped to the user: lists and aggregations only see the caller's
documents, and reading/changing/deleting another user's id answers `404`. A new user receives the 11 default categories on first login
(`DefaultCategories`). Data created before accounts existed
has no owner and is not visible to anyone (it stays in MongoDB; the old global unique budget and category indexes are dropped at startup).
Categories that used to be shared (no `userId`) are migrated at startup by `CategoryOwnershipMigration`: every known user gets an own copy,
their transactions and budgets are pointed at the copies, and the shared documents are removed.

Google setup: <https://console.cloud.google.com/apis/credentials> → *Create credentials* → *OAuth client ID* → *Web application*;
add the URLs the app is opened from under *Authorized JavaScript origins* (e.g. `http://localhost:8081`, `http://localhost:5173`).
No redirect URI is needed. The first time, the *OAuth consent screen* must be configured; in *Testing* mode add your Google account as a test user.

## Demo data

`DemoDataSeeder` (dev profile or `SEED_ENABLED=true`) needs `SEED_USER_ID` (the
internal id of a user, visible in `GET /auth/me`): it makes sure that user has the default categories and creates ~57 transactions over the current and previous two months,
budgets for 6 categories per month, and 4 goals (one completed) with contributions, all owned by that user. Every document has a deterministic id and is inserted
only when missing, so restarts do not duplicate data. For the current month it yields budgets in all states: `NORMAL`
(groceries, utilities, restaurants), `WARNING` (transport 82.5 %, rent exactly 100 %) and `EXCEEDED` (entertainment 128 %), plus spending in
categories without a budget.

## Differences from the current frontend contract (`src/api`, `src/types`)

The backend follows the specification; these points need a small frontend adaptation (the frontend was intentionally not modified):

1. **Ids are strings** (MongoDB), the frontend types declare `number`.
2. **AI response**: backend returns `{ month, summary, insights[{ title, reason, suggestedMonthlySaving, priority }], generatedAt }`; the frontend
   expects `recommendations[{ id, title, explanation, priority, estimatedMonthlySavings, categoryId }]`.
3. **Goals**: statuses are `ACTIVE | COMPLETED` (no `OVERDUE`), `targetDate` is optional, `currentAmount` on goal creation is not accepted
   (the amount comes only from contributions), and the contribution endpoint returns `201`.
4. Budgets: `remainingAmount` can be negative; extra fields `status` (and `icon` on categories) are additive.

Dashboard (`monthlyTrend`, `expensesByCategory`, `budgets`, `goals`, `recentTransactions`) and budgets (`percentageUsed`) already match
the frontend types and additionally expose `topCategories` and `budgetUsedPercentage` from the spec.

## Not implemented / known limitations

* Authentication: sign-in with Google only (see "Authentication"). Transactions, budgets, goals and categories belong to the signed-in user.
* No budget update/delete, goal update/delete or contribution listing endpoints (not required by the MVP).
* Real AI provider calls were not exercised in automated tests (by design); verify manually with a key in `AI_API_KEY`.
* No per-client rate limiting of `/ai/insights` (each call is billable at the provider).
* A completed goal could in theory accept a contribution that races with the completing one (no transactions/locking in the MVP).
