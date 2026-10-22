# SmartBudget AI

Frontend React + TypeScript pentru gestionarea finanțelor personale: tranzacții, bugete, obiective de economisire și recomandări AI (prin backend Spring Boot).

## Stack

React 19, TypeScript (strict), Vite, Material UI 7, React Router, TanStack Query, Recharts, React Hook Form + Zod, Axios, Lucide, Vitest + Testing Library.

## Instalare și pornire

```bash
npm install
npm run dev        # http://localhost:5173
```

| Comandă              | Descriere                                             |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | server de dezvoltare                                  |
| `npm run build`      | verificare TypeScript + build de producție în `dist/` |
| `npm run preview`    | servește build-ul local                               |
| `npm run typecheck`  | doar verificarea tipurilor                            |
| `npm test`           | rulează testele o singură dată                        |
| `npm run test:watch` | teste în mod watch                                    |

## Variabile de mediu

Copiază `.env.example` în `.env.local` și ajustează:

| Variabilă              | Implicit                               | Rol                                                 |
| ---------------------- | -------------------------------------- | --------------------------------------------------- |
| `VITE_API_BASE_URL`    | `http://localhost:8080/api/v1`         | URL-ul API-ului Spring Boot                         |
| `VITE_DEMO_MODE`       | `false` (`true` în `.env.development`) | `true` = mock API local; `false` = doar API-ul real |
| `VITE_MOCK_LATENCY_MS` | `400`                                  | latență simulată în modul demo                      |

Pentru a lucra cu backendul real: `VITE_DEMO_MODE=false` în `.env.local`. Nu există trecere automată la mock când backendul eșuează; erorile sunt afișate în interfață.

## Mod demo

Cu `VITE_DEMO_MODE=true`, serviciile din `src/api/index.ts` folosesc implementările din `src/mocks/` (date seed realiste pe 6 luni, salvate în `localStorage`). Butonul de resetare din header readuce datele la starea inițială. Mock-ul este separat de clientul HTTP real și implementează aceleași contracte (`src/api/contracts.ts`).

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

## Contract API așteptat

`GET /dashboard?month=YYYY-MM`, `GET|POST /transactions`, `PUT|DELETE /transactions/{id}`, `GET /categories`, `GET /budgets?month=YYYY-MM`, `POST /budgets`, `GET|POST /goals`, `POST /goals/{id}/contributions`, `POST /ai/insights`.

`GET /transactions` primește: `page` (de la 0), `size`, `type`, `categoryId`, `startDate`, `endDate`, `search`, `sort` (ex. `transactionDate,desc`) și returnează `{ content, page, size, totalElements, totalPages }`. Toate tipurile sunt în `src/types/`.
