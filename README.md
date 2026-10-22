# SmartBudget AI

Frontend React + TypeScript pentru gestionarea finanțelor personale: tranzacții, bugete, obiective de economisire și recomandări AI (prin backend Spring Boot).

## Stack

React 19, TypeScript (strict), Vite, Material UI 7, React Router, TanStack Query, Recharts, React Hook Form + Zod, Axios, Lucide, Vitest + Testing Library.

## Pornire rapidă (aplicația completă, Docker)

Necesită Docker. Frontend (nginx) + backend + MongoDB cu volum persistent; MongoDB nu are port publicat, iar backendul și frontendul sunt expuse doar pe `127.0.0.1`.

```bash
cd backend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
# editează .env: MONGO_PASSWORD (obligatoriu) și AI_API_KEY (pentru recomandările AI)
docker compose up -d --build
```

Comenzile `docker compose` se rulează din `backend/`, nu din rădăcina repository-ului.

- Aplicația: <http://localhost:8081> (UI-ul apelează `/api/v1`, proxy nginx către backend; același origin, fără CORS)
- API / Swagger: <http://localhost:8080/api/v1> · <http://localhost:8080/swagger-ui.html>
- Date demonstrative: `SEED_ENABLED=true` (implicit în `.env.example`) le încarcă idempotent în MongoDB.
- Oprire păstrând datele: `docker compose down`; ștergerea datelor: `docker compose down -v`.

## Dezvoltare locală (Vite + Maven + MongoDB în Docker)

Toate comenzile `docker compose` se rulează din folderul `backend/` (acolo sunt fișierele compose și `.env`).

```bash
# 1) MongoDB (publicat doar pe 127.0.0.1:27017, cu autentificare)
cd backend
cp .env.example .env          # o singură dată; setează MONGO_PASSWORD în .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongo

# 2) Backend (JDK 21, profil dev = date demo + loguri debug); URI-ul conține parola din .env
export MONGODB_URI="mongodb://smartbudget:PAROLA_DIN_ENV@localhost:27017/smartbudget?authSource=admin"
export AI_API_KEY="cheia-ta"  # opțional, doar pentru recomandările AI
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 3) Frontend, în alt terminal, din rădăcina repository-ului
npm install
npm run dev                   # http://localhost:5173, folosește API-ul real
```

În PowerShell, variabilele se setează cu `$env:MONGODB_URI="..."` și `$env:AI_API_KEY="..."`.

# Mai simplu, dacă nu vrei să editezi nimic: rulează totul în Docker, cu un singur set de comenzi.

cd backend
cp .env.example .env
docker compose up -d --build

Dacă portul 27017 este deja ocupat (alt container MongoDB), oprește containerul respectiv sau schimbă în `backend/docker-compose.dev.yml` portul din stânga (ex. `127.0.0.1:27018:27017`) și folosește același port în `MONGODB_URI`.

`npm run dev:demo` pornește frontendul în **mod demo** (mock local, fără backend). Modul este ales explicit la build/pornire; nu există trecere automată între mock și API real, iar un backend indisponibil produce erori vizibile în interfață (cu buton „Reîncearcă”).

| Comandă              | Descriere                                               |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | server de dezvoltare, API real                          |
| `npm run dev:demo`   | server de dezvoltare, mod demo (mock în `localStorage`) |
| `npm run build`      | verificare TypeScript + build de producție în `dist/`   |
| `npm run preview`    | servește build-ul local                                 |
| `npm run typecheck`  | doar verificarea tipurilor                              |
| `npm test`           | rulează testele o singură dată                          |
| `npm run test:watch` | teste în mod watch                                      |

## AI local cu Ollama

Backendul vorbește cu orice API compatibil OpenAI, inclusiv Ollama. Cheia/URL-ul AI rămân doar în backend.

```bash
ollama serve                  # dacă nu rulează deja (Windows: aplicația Ollama pornește singură)
ollama pull llama3.1:8b       # o singură dată
```

În `backend/.env` (în loc de valorile OpenAI):

```
AI_BASE_URL=http://host.docker.internal:11434/v1   # backend în Docker
AI_API_KEY=ollama                                  # orice valoare nevidă (Ollama o ignoră, backendul o cere)
AI_MODEL=llama3.1:8b
AI_READ_TIMEOUT=120s                               # modelele locale sunt mai lente
```

Dacă rulezi backendul cu `mvn spring-boot:run`, folosește `AI_BASE_URL=http://localhost:11434/v1` (în PowerShell: `$env:AI_BASE_URL=...`, la fel pentru celelalte). După modificarea `.env`: `docker compose up -d` (recreează backendul). Testat cu `llama3.1:8b`: răspuns în ~50 s la prima cerere (include încărcarea modelului). Timpul total maxim este limitat la ~170 s (timeout-ul din UI și din nginx). Modelele mici pot da recomandări mai puțin precise (ex. economii estimate 0).

### Tranzacție din poză (bon, factură)

În dialogul „Tranzacție nouă”, butonul **Completează din poză** (pe telefon deschide camera) trimite poza la `POST /transactions/scan`. Un model cu viziune citește suma, data, descrierea și alege o categorie existentă; formularul se completează, tu verifici/modifici și apeși **Adaugă tranzacția** (nimic nu se salvează automat). Poza este redusă în browser (max. 1600 px) și nu este stocată.

Modelul de text `llama3.1:8b` nu poate citi imagini; setează un model cu viziune în `backend/.env`:

```
AI_VISION_MODEL=gemma4:26b    # sau llava, llama3.2-vision, qwen2.5vl (ollama pull ...)
```

Fără `AI_VISION_MODEL` se folosește `AI_MODEL`. Citirea locală durează de obicei zeci de secunde (primul apel încarcă modelul); folosește `AI_READ_TIMEOUT=120s`. În modul demo, scanarea întoarce o tranzacție de exemplu.

## Variabile de mediu

Frontend (publice, compilate în bundle; **nu** conțin secrete). Pentru suprascrieri locale copiază `.env.example` în `.env.local`:

| Variabilă              | Implicit                                                      | Rol                                                 |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `VITE_API_BASE_URL`    | `http://localhost:8080/api/v1` (`/api/v1` în imaginea Docker) | URL-ul API-ului Spring Boot                         |
| `VITE_DEMO_MODE`       | `false` (`true` doar în `.env.demo`)                          | `true` = mock API local; `false` = doar API-ul real |
| `VITE_MOCK_LATENCY_MS` | `400`                                                         | latență simulată în modul demo                      |

Backend (în `backend/.env`, citit de Docker Compose; vezi `backend/.env.example` și `backend/README.md`): `MONGO_USER`, `MONGO_PASSWORD`, `SPRING_PROFILES_ACTIVE`, `BACKEND_PORT`, `FRONTEND_PORT`, `CORS_ALLOWED_ORIGINS`, `SEED_ENABLED`, `SWAGGER_ENABLED`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`. Cheia AI există doar în backend; frontendul apelează `POST /ai/insights`.

## Mod demo

Cu `VITE_DEMO_MODE=true`, serviciile din `src/api/index.ts` folosesc implementările din `src/mocks/` (date seed realiste pe 6 luni, salvate în `localStorage`). Butonul de resetare din header readuce datele la starea inițială. Mock-ul este separat de clientul HTTP real și implementează aceleași contracte (`src/api/contracts.ts`) și aceeași formă de date ca backendul (id-uri string, `status` la bugete etc.).

## Structură

```
src/
  app/            providers, rute, temă, context lună, toast
  api/            client Axios, contracte, servicii HTTP, query keys
  mocks/          API demo (seed, persistență, handlere)
  types/          tipuri request/response
  utils/          formatare RON (ro-RO), date, validare, bugete
  components/
    layout/       sidebar, header, shell
    common/       StatCard, SectionCard, EmptyState, ErrorState, ConfirmDialog, ...
  features/
    dashboard/ transactions/ budgets/ goals/ ai-insights/ categories/
```

## Contract API

Id-urile sunt string-uri (ObjectId MongoDB sau `demo-*`), sumele sunt numere cu max. 2 zecimale, datele `YYYY-MM-DD`, lunile `YYYY-MM`.

`GET /dashboard?month=YYYY-MM`, `GET|POST /transactions`, `POST /transactions/scan`, `PUT|DELETE /transactions/{id}`, `GET /categories`, `GET /budgets?month=YYYY-MM`, `POST /budgets`, `GET|POST /goals`, `POST /goals/{id}/contributions`, `POST /ai/insights`.

`GET /transactions` primește: `page` (de la 0), `size`, `type`, `categoryId`, `startDate`, `endDate`, `search`, `sort` (ex. `transactionDate,desc`) și returnează `{ content, page, size, totalElements, totalPages }`. Toate tipurile sunt în `src/types/`.

Particularități: bugetele au `status` (`NORMAL` / `WARNING` de la 80% / `EXCEEDED` peste 100%) calculat de backend; obiectivele au statusul `ACTIVE` / `COMPLETED` (UI-ul deduce „termen depășit” din `targetDate`, care este opțională); `POST /ai/insights` returnează `insights[]` (`title`, `reason`, `suggestedMonthlySaving`, `priority`), mapate în UI de `src/api/services/aiInsightsApi.ts` în recomandări.
