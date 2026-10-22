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
* `SEED_ENABLED=true` (default in `.env.example`) loads idempotent demo data. Categories are reference data the API cannot create: if the database has none, default categories are inserted even when seeding is disabled.

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
| `SEED_ENABLED` | `true` in `dev`, `false` otherwise | demo data seeding |
| `SWAGGER_ENABLED` | `true` in dev, `false` in prod | Swagger UI / OpenAPI docs in prod |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | comma separated origins |

Indexes are created at startup (`auto-index-creation: true`): `transactionDate`, `categoryId`, `type` on `transactions`;
unique `{month, categoryId}` on `budgets`; `{goalId, contributionDate}` on `goal_contributions`; unique `{name, type}` on `categories`.

## Data formats

* Money: JSON **number** with at most 2 decimals (`1234.50`). `BigDecimal` in Java and DTOs, BSON `Decimal128` in MongoDB. Input amounts
  must be between `0.01` and `1000000000` with ≤ 2 decimals.
* Dates: `YYYY-MM-DD` (stored as UTC midnight). Months: `YYYY-MM`. Timestamps: ISO-8601 UTC instants.
* Ids: MongoDB ObjectId strings (demo data uses readable ids such as `demo-cat-salary`).
* Errors: `{ "status": 409, "error": "Conflict", "message": "...", "fieldErrors": { "amount": "..." }, "timestamp": "..." }`
  (`fieldErrors` only for validation errors).
* Pages: `{ "content": [...], "page": 0, "size": 20, "totalElements": 57, "totalPages": 3 }` (`page` is 0-based).

## Endpoints (`/api/v1`)

Interactive documentation: Swagger UI. Summary:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/dashboard?month=YYYY-MM` | month defaults to the current one |
| GET | `/transactions` | filters `type`, `categoryId`, `startDate`, `endDate` (inclusive), `search`; `page`, `size` (≤ 100), `sort=transactionDate\|amount\|createdAt,asc\|desc` |
| GET | `/transactions/{id}` | 404 if missing |
| POST / PUT | `/transactions`, `/transactions/{id}` | 201 / 200; category must exist and match the transaction type (422 otherwise) |
| DELETE | `/transactions/{id}` | 204 |
| POST | `/transactions/scan` | multipart field `image` (JPEG/PNG/WebP, ≤ 8 MB, type checked from the file signature). The vision model reads amount, date, description and picks an existing category; returns `{ type, amount, description, transactionDate, categoryId }` (`amount`/`categoryId` may be `null`) **without saving**; the client reviews it and calls `POST /transactions`. 413 / 415 / 422 (nothing recognized) / 429 / 502 / 503 / 504 |
| GET | `/categories` | |
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

## Demo data

`DemoDataSeeder` (dev profile or `SEED_ENABLED=true`) creates 11 categories, ~57 transactions over the current and previous two months,
budgets for 6 categories per month, and 4 goals (one completed) with contributions. Every document has a deterministic id and is inserted
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

* No authentication or multi-user support (out of MVP scope): all data belongs to a single anonymous user. Do not expose the API publicly as is.
* No category CRUD, budget update/delete, goal update/delete or contribution listing endpoints (not required by the MVP).
* Real AI provider calls were not exercised in automated tests (by design); verify manually with a key in `AI_API_KEY`.
* No per-client rate limiting of `/ai/insights` (each call is billable at the provider).
* A completed goal could in theory accept a contribution that races with the completing one (no transactions/locking in the MVP).
