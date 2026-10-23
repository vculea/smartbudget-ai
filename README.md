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
- Autentificare: doar cu contul Google; vezi secțiunea **Autentificare** de mai jos (necesită `GOOGLE_CLIENT_ID` în `backend/.env`).
- Date demonstrative: `SEED_ENABLED=true` (implicit în `.env.example`) cu `SEED_USER_ID` încarcă datele demo ale acelui utilizator. Categoriile implicite se creează automat la primul login al fiecărui utilizator.
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

În dialogul „Tranzacție nouă”, butonul **Completează din poză** (pe telefon deschide camera) trimite poza la `POST /transactions/scan`. Un model cu viziune citește suma, data, descrierea și alege o categorie existentă. Pentru un bon sau o factură, formularul se completează, tu verifici/modifici și apeși **Adaugă tranzacția**. Dacă poza conține mai multe plăți (ex. un extras de cont), apare o listă: bifezi tranzacțiile dorite, le corectezi și le salvezi pe toate deodată. Nimic nu se salvează automat. Poza este redusă în browser (max. 1600 px) și nu este stocată. Cât timp AI-ul lucrează, dialogul arată etapa și timpul scurs; butonul **Oprește** anulează citirea.

Modelul de text `llama3.1:8b` nu poate citi imagini; setează un model cu viziune în `backend/.env`:

```
AI_VISION_MODEL=gemma4:26b    # sau llava, llama3.2-vision, qwen2.5vl (ollama pull ...)
```

Fără `AI_VISION_MODEL` se folosește `AI_MODEL`. Citirea locală durează de obicei zeci de secunde (primul apel încarcă modelul); folosește `AI_READ_TIMEOUT=120s`. În modul demo, scanarea întoarce o tranzacție de exemplu.

### Salvarea bonurilor în Google Drive

Fișierul unui bon sau al unei facturi (PDF sau poză JPEG/PNG/WebP, max. 8 MB) se poate arhiva într-un **singur cont Google** ales de tine, în `SmartBudget/yyyy/MM/`, cu numele `2026-10-23_Kaufland_123.45.pdf`. În dialogul „Tranzacție nouă”, după **Completează din poză sau PDF**, apare bifa **Salvează fișierul în Google Drive**; la o tranzacție existentă, **Editează** permite atașarea, înlocuirea sau scoaterea fișierului. În listă, tranzacția cu fișier are o agrafă care deschide fișierul în Drive. Fără configurare, opțiunea nu apare deloc.

Configurare (o singură dată, cu contul care va stoca fișierele):

1. În <https://console.cloud.google.com> (același proiect ca la autentificare) activează **Google Drive API** (*APIs & Services → Library*).
2. La *OAuth consent screen → Data access* adaugă scope-ul `https://www.googleapis.com/auth/drive.file` (aplicația vede doar fișierele create de ea, nu tot Drive-ul). Cât timp aplicația e în modul *Testing*, adaugă contul la *Test users*; în *Testing* refresh token-ul expiră după 7 zile, așa că treci aplicația la *In production* pentru un token de durată.
3. Creează un **OAuth client ID** de tip *Web application* și adaugă la *Authorized redirect URIs* `https://developers.google.com/oauthplayground`.
4. Deschide <https://developers.google.com/oauthplayground>, apasă ⚙ → bifează **Use your own OAuth credentials** și introdu ID-ul și secretul clientului. La *Step 1* scrie scope-ul `https://www.googleapis.com/auth/drive.file`, autorizează cu contul care stochează fișierele, apoi la *Step 2* apasă **Exchange authorization code for tokens** și copiază **Refresh token**.
5. În `backend/.env` setează `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` și `GOOGLE_DRIVE_REFRESH_TOKEN`, apoi `docker compose up -d`. Aplicația își creează singură folderul **SmartBudget** în „Drive-ul meu” (apoi `yyyy/MM` în el). `GOOGLE_DRIVE_FOLDER_ID` este opțional: cu scope-ul `drive.file` aplicația poate folosi doar foldere create de ea, deci un folder creat manual în Drive nu merge (ar cere scope-ul complet `drive`). Sunt **secrete**: există doar în backend, nu se comit și nu ajung în browser. Verificare: `GET /api/v1/drive/status` întoarce `{"enabled": true}`.

Note: un *Service Account* nu poate scrie într-un Drive personal (nu are spațiu propriu), de aceea se folosește OAuth cu refresh token. Linkurile din Drive se deschid doar pentru conturile care au acces la fișier (în practică contul care stochează). La înlocuirea/scoaterea fișierului sau la ștergerea tranzacției, fișierul merge în coșul de gunoi din Drive (recuperabil 30 de zile). Dacă tokenul este revocat, salvarea întoarce o eroare clară și trebuie generat unul nou. În modul demo, salvarea este simulată.

### Import din CSV / Excel

În **Tranzacții → Importă CSV / Excel** încarci un fișier `.csv` sau `.xlsx` (prima foaie, max. 5 MB și 1000 de rânduri). Fișierul se citește în browser, apoi **AI-ul ales în Setări AI** (server, model local sau cheie proprie):

1. recunoaște coloanele (data, descrierea, suma sau debit/credit, tipul, categoria, formatul datei și rândul cu antet) din primele rânduri, deci fișierul nu trebuie să respecte un format anume (`POST /transactions/import/columns`);
2. propune categoria fiecărei tranzacții dintre categoriile tale, pe loturi de 40 de descrieri unice (`POST /transactions/import/categories`). Unde AI-ul nu e sigur, categoria rămâne goală și rândul e marcat „AI-ul nu a știut – alege categoria”; **Adaugă** se activează abia după ce alegi categoria sau debifezi rândul.

Înainte de AI, importul caută în **categoriile învățate** din alegerile tale anterioare (`POST /category-memory/match`); rândurile găsite sunt marcate „Din alegerile tale” și nu mai ajung la AI. Pentru restul, AI-ul primește în prompt și câteva dintre alegerile tale (comercianți înrudiți întâi), ca să-ți urmeze obiceiurile.

Cu modelul local / cheia proprie, backendul construiește prompturile și validează răspunsul (`.../columns|categories/prompt` și `.../result`), ca la citirea bonurilor. Modelul primește doar primele rânduri și descrierile tranzacțiilor. Dacă AI-ul nu răspunde, coloanele se recunosc după titluri (`Data`, `Descriere`, `Suma`/`Debit`/`Credit`, `Tip`, `Categorie`) și categoriile rămân de ales manual; în modul demo nu există model AI, doar o potrivire simplă după comercianți uzuali.

În previzualizare poți corecta data, descrierea, tipul, categoria și suma sau debifa rânduri; categoria aleasă pentru un rând se pune și pe celelalte rânduri cu aceeași descriere pe care nu le-ai ales încă. **Adaugă N tranzacții** salvează tot printr-un singur apel `POST /transactions/bulk` (totul sau nimic).

**Fără dubluri la reimport:** după citirea fișierului, toate rândurile sunt verificate printr-un singur apel `POST /transactions/import/existing` (în paralel cu categoriile învățate). Un rând există deja dacă are același tip, aceeași dată, sumă și descriere (fără diferențe de majuscule, diacritice sau punctuație) ca o tranzacție salvată; fiecare tranzacție salvată acoperă un singur rând, deci două cafele identice în aceeași zi, din care una e deja salvată, marchează doar un rând. Rândurile găsite sunt marcate „Există deja”, debifate și nu mai ajung la AI; le poți bifa la loc dacă sunt tranzacții noi. Backendul caută doar zilele și sumele exacte din fișier (indexul `userId + transactionDate`). Dacă verificarea nu reușește, importul continuă cu un avertisment.

### Categorii învățate

La salvarea importului, aplicația reține categoria păstrată pentru fiecare comerciant (`POST /category-memory/learn`); la fel când adaugi o tranzacție de mână sau îi schimbi categoria. Comerciantul e identificat după cuvintele din descriere, fără cifre (card, sucursală, terminal), forme juridice (SRL, SA) și cuvinte de plată (POS, Plata la): „KAUFLAND 1234 CLUJ-NAPOCA SRL” devine `kaufland cluj napoca`, iar alte magazine („Kaufland Brașov”) sunt recunoscute după primul cuvânt.

- O categorie este completată automat doar dacă are cel puțin 80% din alegerile tale pentru acel comerciant; dacă îl împarți între categorii (ex. eMAG), alegi tu sau AI-ul.
- O **corectură** (ai schimbat categoria propusă de memorie sau de AI) înlocuiește ce era reținut: ultima corectură câștigă.
- La ștergerea unei categorii, alegerile ei trec în categoria înlocuitoare.
- Pagina **Categorii** arată ce a învățat aplicația și permite ștergerea unei asocieri greșite sau a tuturor (`GET /category-memory`, `DELETE /category-memory?type=&key=`, `DELETE /category-memory/all`).

## Model AI ales din interfață (Setări AI)

În pagina **Setări AI** (meniul din stânga) alegi unde rulează AI-ul, separat pentru fiecare browser (setările se păstrează în `localStorage`):

- **Serverul aplicației** – implicit; backendul apelează modelul configurat în `backend/.env` (ex. OpenAI), iar cheia serverului nu ajunge în browser.
- **Cheia mea API (furnizor cu plată)** – îți folosești propriul cont la OpenAI, Groq, Google Gemini sau alt furnizor compatibil OpenAI (alegi furnizorul, introduci cheia și, opțional, modelele). Browserul apelează direct furnizorul; cheia se păstrează doar în `localStorage`-ul acestui browser și nu este trimisă backendului. Adresele HTTP (necriptate) sunt refuzate pentru cheie, cu excepția localhost.
- **Model local pe calculatorul meu (gratuit)** – browserul apelează direct Ollama (sau alt server OpenAI-compatibil) de pe calculatorul tău. Funcționează și când aplicația rulează în cloud, pentru că cererea pornește din browser, nu din server; modelul trebuie să ruleze pe același calculator cu browserul.

Cu modelul local sau cu cheia proprie, backendul rămâne sursa de adevăr: construiește promptul din cifrele din MongoDB (`POST /ai/local/insights/prompt`, `POST /ai/local/budget-plan/prompt`, `GET /ai/local/receipt/prompt`) și validează răspunsul modelului (`POST /ai/local/insights/result`, `POST /ai/local/budget-plan/result`, `POST /ai/local/receipt/result`), exact ca pentru modelul din server. Furnizorul primește doar cifre agregate (recomandări, propunere de buget) sau poza bonului (citire bon). Răspunsul modelului este cerut în flux (`stream: true`): „Timp maxim fără răspuns” din Setări AI (implicit 300 s pentru modelul local) se aplică doar pauzelor, deci un răspuns lung care curge nu este întrerupt. Furnizorul trebuie să permită apeluri din browser (CORS); OpenAI, Groq și Gemini o permit. Pentru Ollama, pornește-l cu `OLLAMA_ORIGINS` setat la adresa site-ului (Setări AI o afișează) și apasă **Testează conexiunea**. Chrome/Edge permit apeluri de la o pagină HTTPS către `http://localhost` (Chrome poate cere permisiunea pentru rețeaua locală); Safari le blochează.

## Variabile de mediu

Frontend (publice, compilate în bundle; **nu** conțin secrete). Pentru suprascrieri locale copiază `.env.example` în `.env.local`:

| Variabilă              | Implicit                                                      | Rol                                                 |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `VITE_API_BASE_URL`    | `http://localhost:8080/api/v1` (`/api/v1` în imaginea Docker) | URL-ul API-ului Spring Boot                         |
| `VITE_DEMO_MODE`       | `false` (`true` doar în `.env.demo`)                          | `true` = mock API local; `false` = doar API-ul real |
| `VITE_MOCK_LATENCY_MS` | `400`                                                         | latență simulată în modul demo                      |
| `VITE_GOOGLE_CLIENT_ID` | – (în Docker vine din `GOOGLE_CLIENT_ID`)                    | ID-ul clientului OAuth pentru „Sign in with Google” |

Backend (în `backend/.env`, citit de Docker Compose; vezi `backend/.env.example` și `backend/README.md`): `MONGO_USER`, `MONGO_PASSWORD`, `SPRING_PROFILES_ACTIVE`, `BACKEND_PORT`, `FRONTEND_PORT`, `CORS_ALLOWED_ORIGINS`, `SEED_ENABLED`, `SEED_USER_ID`, `SWAGGER_ENABLED`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `AUTH_TOKEN_TTL`, `ALLOWED_EMAILS`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` (și opțional `GOOGLE_DRIVE_FOLDER_ID`). Cheia AI există doar în backend; frontendul apelează `POST /ai/insights`.

## Autentificare (doar cu contul Google)

Aplicația cere autentificare; fiecare utilizator vede doar propriile tranzacții, bugete, obiective și categorii. Nu există parolă proprie: doar „Sign in with Google”.

1. În <https://console.cloud.google.com/apis/credentials> creează un **OAuth client ID** de tip *Web application* (la prima utilizare configurează și *OAuth consent screen*; în modul *Testing* adaugă-ți contul Google ca test user).
2. La *Authorized JavaScript origins* adaugă adresele de pe care deschizi aplicația: `http://localhost:8081` (Docker) și/sau `http://localhost:5173` (`npm run dev`). Nu e nevoie de redirect URI.
3. Pune ID-ul în `backend/.env` ca `GOOGLE_CLIENT_ID` (și un `JWT_SECRET` de minimum 32 de caractere), apoi `docker compose up -d --build` (ID-ul intră și în bundle-ul frontendului). Pentru `npm run dev` pune `VITE_GOOGLE_CLIENT_ID` în `.env.local`.
4. Opțional, `ALLOWED_EMAILS=tu@gmail.com,altcineva@gmail.com` limitează cine se poate autentifica (gol = orice cont Google verificat).

Fluxul: butonul Google returnează un ID token → `POST /auth/google` îl verifică (semnătură, emitent, audiență, expirare, e-mail verificat) și întoarce un token de sesiune (12 h) trimis apoi ca `Authorization: Bearer`. Sesiunea se păstrează în `localStorage`; la 401 utilizatorul este readus la pagina de login. Modul demo (`VITE_DEMO_MODE=true`) rămâne fără autentificare.

## Categorii

Fiecare utilizator are propriile categorii. La primul login primește un set implicit (Salariu, Alimente, Transport, …), pe care îl poate apoi modifica liber din pagina **Categorii**: adaugă, redenumește, schimbă culoarea sau tipul, șterge. Numele sunt unice pe tip (fără să conteze literele mari/mici). Tipul se poate schimba doar cât timp categoria nu are tranzacții sau bugete. La ștergerea unei categorii folosite alegi categoria (de același tip) în care se mută tranzacțiile și bugetele ei; dacă acea categorie are deja buget într-o lună, bugetul categoriei șterse din luna respectivă se elimină.

La pornire, backendul migrează automat categoriile comune din versiunile anterioare: fiecare utilizator primește o copie proprie, iar tranzacțiile și bugetele lui sunt mutate pe copii.

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

`GET /dashboard?month=YYYY-MM`, `GET|POST /transactions`, `POST /transactions/scan`, `POST|DELETE /transactions/{id}/attachment` (bon/factură în Google Drive), `GET /drive/status`, `POST /transactions/bulk`, `POST /transactions/import/existing`, `POST /transactions/import/{columns|categories}` (+ `/prompt`, `/result`), `PUT|DELETE /transactions/{id}`, `GET|POST /categories`, `PUT|DELETE /categories/{id}` (`DELETE` cu `?replacementId=` dacă e folosită), `GET /categories/{id}/usage`, `POST /category-memory/{match|learn}`, `GET|DELETE /category-memory` (+ `DELETE /category-memory/all`), `GET /budgets?month=YYYY-MM`, `GET /budgets/income?month=YYYY-MM`, `POST /budgets`, `POST /budgets/year`, `GET|POST /goals`, `POST /goals/{id}/contributions`, `POST /ai/insights`, `POST /ai/budget-plan`.

Dashboardul, bugetele și AI Coach pot fi cerute și pe un an întreg: `GET /dashboard?year=YYYY`, `GET /budgets?year=YYYY` (limitele lunare ale fiecărei categorii sunt însumate pe an) și `POST /ai/insights` cu `{ "year": 2026 }`. `month` și `year` nu pot fi trimise împreună.

Bugetul pe un an întreg: `POST /budgets/year` cu `{ "year": 2027, "months": [1, …, 12], "items": [{ "categoryId": "…", "limitAmount": 1200 }] }` salvează aceeași sumă lunară pe categorie în lunile alese și întoarce `{ created, skipped }`; lunile care au deja o sumă pe acea categorie rămân neschimbate. Pentru categoriile de cheltuieli suma este limita, iar pentru cele de venit este **venitul planificat**. `GET /budgets` întoarce doar limitele de cheltuieli (folosite și de dashboard și AI Coach); veniturile planificate se citesc din `GET /budgets/income?month=YYYY-MM` sau `?year=YYYY`, cu `expectedAmount`, `receivedAmount`, `remainingAmount`, `percentageReceived` și `status` (`REACHED` / `PENDING` / `BELOW` când perioada s-a încheiat sub sumă). `POST /ai/budget-plan` cu `{ "year": 2027 }` propune (fără să salveze) `budgets[]` (limite) și `incomes[]` (venituri așteptate, estimate prudent), pe baza mediilor lunare din anul ales și anul anterior (doar lunile încheiate; pentru un an viitor se folosesc anul curent și cel trecut); în UI, propunerea precompletează dialogul „Buget anual”, care arată și soldul planificat (venituri − limite) și poate fi modificat înainte de salvare.

`GET /transactions` primește: `page` (de la 0), `size`, `type`, `categoryId`, `startDate`, `endDate`, `search`, `sort` (ex. `transactionDate,desc`) și returnează `{ content, page, size, totalElements, totalPages }`. Toate tipurile sunt în `src/types/`.

Particularități: bugetele au `status` (`NORMAL` / `WARNING` de la 80% / `EXCEEDED` peste 100%) calculat de backend; obiectivele au statusul `ACTIVE` / `COMPLETED` (UI-ul deduce „termen depășit” din `targetDate`, care este opțională); `POST /ai/insights` returnează `insights[]` (`title`, `reason`, `suggestedMonthlySaving`, `priority`), mapate în UI de `src/api/services/aiInsightsApi.ts` în recomandări.
