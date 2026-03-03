# LightE Public 3 - Codebase Guide

This repository contains **LightE**, a Microsoft Teams AI bot focused on:

- Product lookup and stock/price discovery from the Eurolux API
- Quote-building workflows in conversation state
- Retrieval-augmented responses using Microsoft Graph search/content

The project is intentionally small and centered around one runtime pipeline: **Express -> Teams Adapter -> Teams AI Application -> Planner/Actions/Data Sources**.

---

## 1) High-level architecture

```text
User (Teams chat)
  -> Bot Framework activity POST /api/messages
    -> src/index.js (Express route)
      -> src/adapter.js (TeamsAdapter, error boundary)
        -> src/app/app.js (Application + AI planner)
          -> PromptManager + Prompt files
          -> DataSources (Graph + Eurolux)
          -> Action handlers (search, SKU lookup, quote ops, debug)
            -> Activity responses back to Teams
```

### Core responsibilities

- **Transport/runtime shell**: `src/index.js`
- **Bot adapter + cross-cutting error handling**: `src/adapter.js`
- **Environment/config object**: `src/config.js`
- **AI orchestration + actions + auth + message handlers**: `src/app/app.js`
- **RAG data source (M365 Graph search/content)**: `src/app/graphDataSource.js`
- **Eurolux product data source + filtering/cache**: `src/app/dataSources/euroluxApiDataSource.js`
- **Prompt behavior and action schema**: `src/prompts/chat/config.json`, `src/prompts/chat/skprompt.txt`
- **Auth popup pages for Graph sign-in flow**: `src/public/auth-start.html`, `src/public/auth-end.html`

---

## 2) Repository structure

```text
.
├─ src/
│  ├─ index.js                      # Express server + HTTP routes
│  ├─ adapter.js                    # TeamsAdapter and onTurnError
│  ├─ config.js                     # Env-driven app + model settings
│  ├─ logger.js                     # Winston logger (currently not widely wired)
│  ├─ app/
│  │  ├─ app.js                     # Main app composition and action handlers
│  │  ├─ customSayCommand.js        # Custom SAY renderer with citation handling (not currently wired)
│  │  ├─ graphDataSource.js         # Graph Search -> file content -> prompt context
│  │  ├─ handlers/
│  │  │  └─ messageHandlers.js      # Empty placeholder currently
│  │  ├─ dataSources/
│  │  │  └─ euroluxApiDataSource.js # Eurolux API client + cache + filtering + stats
│  │  └─ utils/
│  │     └─ quoteUtils.js           # Quote total helper
│  ├─ data/
│  │  ├─ Contoso Electronics_PerkPlus_Program.txt
│  │  ├─ Contoso_Electronics_Company_Overview.txt
│  │  └─ Contoso_Electronics_Plan_Benefits.txt
│  ├─ prompts/
│  │  └─ chat/
│  │     ├─ config.json             # Prompt/runtime behavior and action schema
│  │     └─ skprompt.txt            # Prompt instructions/template
│  └─ public/
│     ├─ auth-start.html            # Auth popup start page
│     └─ auth-end.html              # Auth popup callback page
└─ README.md                        # This file
```

---

## 3) Runtime and message lifecycle

## 3.1 Process startup

1. `src/index.js` starts an Express app.
2. It listens on `process.env.port || process.env.PORT || 3978`.
3. It logs startup diagnostics to console.
4. It registers:
   - `POST /api/messages` (bot activities)
   - `GET /auth-start.html` and `GET /auth-end.html` (auth helper pages)

## 3.2 Incoming activity path

1. Teams/Bot Framework posts an activity to `/api/messages`.
2. `adapter.process(req, res, async (context) => app.run(context))` is invoked.
3. `Application` in `src/app/app.js` resolves message flow:
   - AI planner path (prompt + action calls)
   - explicit message handlers (e.g. `/status`, `/stock ...`)
4. `context.sendActivity(...)` returns output to Teams channel.

## 3.3 Error path

- `src/adapter.js` configures `adapter.onTurnError`.
- On unhandled errors for message activities, it:
  1. Sends a trace activity
  2. Sends user-facing fallback messages

This centralizes turn-level failure handling and avoids silent crashes.

---

## 4) Configuration model

`src/config.js` maps environment variables into a single object:

### Bot identity/auth

- `BOT_ID` -> `MicrosoftAppId`
- `BOT_TYPE` -> `MicrosoftAppType`
- `BOT_TENANT_ID` -> `MicrosoftAppTenantId`
- `BOT_PASSWORD` -> `MicrosoftAppPassword`

### Azure OpenAI settings

- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT_NAME`

### Planner prompt path

- Prompt folder resolved to `src/prompts`

### Graph auth settings used in `src/app/app.js`

- `AAD_APP_CLIENT_ID`
- `AAD_APP_CLIENT_SECRET`
- `AAD_APP_OAUTH_AUTHORITY_HOST`
- `AAD_APP_TENANT_ID`
- `BOT_DOMAIN` (used to generate sign-in link)

### Eurolux API credentials

- `EUROLUX_USERNAME`
- `EUROLUX_PASSWORD`

### Logging

- `LOG_LEVEL` is consumed by `src/logger.js` (console transport)

---

## 5) AI composition in `src/app/app.js`

`app.js` is the heart of the project and does four main jobs:

1. **Create AI primitives**:
   - `OpenAIModel`
   - `PromptManager`
   - `ActionPlanner` with:
     - `defaultPrompt: "chat"`
     - `allowLooping: true`
     - `allowMultipleActions: true`

2. **Register data sources**:
   - `GraphDataSource("graph-ai-search")`
   - `EuroluxApiDataSource("eurolux-products")`

3. **Create Teams AI Application** with:
   - `MemoryStorage`
   - planner + feedback loop
   - Graph authentication (`autoSignIn: true`)

4. **Register actions and message handlers**.

---

## 6) Action surface (what the AI can call)

These are registered in `src/app/app.js`:

### Built-in SAY action

- `AI.SayCommandActionName`
- Sends `data.response` as activity output.

### Debug actions

- `debugSayName`
- `debugTest`

Useful for validating planner/action routing and state visibility.

### Product intelligence actions

- `searchProducts`
  - Accepts a filter object (SKU/description/price/stock/lumens/status/limit)
  - Calls `euroluxDataSource.searchProducts`
  - Formats multi-item markdown response

- `getProductBySku`
  - Validates `sku`
  - Calls `euroluxDataSource.getProductBySku`
  - Returns price, stock, status, lumens details

- `getProductStats`
  - Calls `euroluxDataSource.getProductStats`
  - Returns aggregate metrics

### Quote workflow actions

- `addToQuote`
  - Ensures quote exists in conversation state
  - Resolves product by SKU
  - Adds line item with quantity and computed line total

- `showQuote`
  - Renders all line items and computed total

- `generateQuote`
  - Placeholder; announces that export/upload step is still pending

- `clearQuote`
  - Resets `state.conversation.quote`

---

## 7) Message command handlers

These bypass planner action-selection and are explicit command routes:

- `/status`
  - Displays high-level bot/data-source readiness

- `/stock {SKU}`
  - Manual stock lookup via Eurolux data source

These handlers are useful for deterministic debug paths and manual verification.

---

## 8) Data sources and how they feed the model

## 8.1 Eurolux API data source (`euroluxApiDataSource.js`)

### Purpose

Provide product inventory/price metadata and filtering APIs to actions and, conditionally, context to prompts.

### Implementation notes

- Uses `axios` with Basic auth to call:
  - `https://www.eurolux-portal.co.za/fw/api/products/getproductlist`
- Maintains in-memory cache:
  - `_products`
  - `_lastSync`
- Cache is lazy-loaded by `#ensureCache()`.

### Public methods

- `getProductBySku(sku)`
- `searchProducts(filters)`
- `getProductStats()`
- `renderData(...)` (returns lightweight context only for product-like queries)

### Filter dimensions in `searchProducts`

- SKU contains match
- Description contains match
- Price min/max
- In stock (JHB or CPT)
- Min stock / JHB stock / CPT stock
- Status equality match
- Lumens min/max
- Result limit

## 8.2 Graph data source (`graphDataSource.js`)

### Purpose

Retrieve potentially relevant M365/SharePoint content at prompt time.

### Flow

1. Read user input from `memory.getValue("temp.input")`.
2. Initialize Graph client using auth token from `memory.temp.authTokens["graph"]`.
3. Optionally rewrite some query intents (`perksplus`, `company/history`, `northwind/health`).
4. Execute `POST /search/query` with `entityTypes: ["driveItem"]`.
5. For each hit, download file text through `/shares/{encodedUrl}/driveItem/content`.
6. Append content + citation metadata until token budget is exhausted.
7. Return as `<context> ... </context>`.

This is a classic retrieval-then-inline-context pattern.

---

## 9) Prompt system

## 9.1 Prompt config (`src/prompts/chat/config.json`)

Defines:

- Chat completion mode
- Input/history inclusion
- Token and decoding parameters
- Augmentation sequence and data-source budget (`eurolux-products`)
- Action schema currently declared in prompt:
  - `getProductBySku`
  - `searchProducts`

## 9.2 Prompt text (`src/prompts/chat/skprompt.txt`)

Instructs LightE to:

- Help with product info and quotes
- Use available actions for product lookups and quote management
- Be concise and helpful

Placeholders injected by planner:

- `{{$actions}}`
- `{{$history}}`
- `{{$input}}`

---

## 10) State model

The app uses `MemoryStorage` from Bot Framework:

- Fast for local development
- **Non-persistent** (resets on restart/redeploy)
- Quote state lives under `state.conversation.quote`

Quote shape used by actions:

```json
{
  "items": [
    {
      "sku": "B110B",
      "description": "...",
      "quantity": 5,
      "unitPrice": 123.45,
      "lineTotal": 617.25
    }
  ]
}
```

`calculateQuoteTotal` in `src/app/utils/quoteUtils.js` sums `lineTotal` and returns fixed 2-decimal output.

---

## 11) Authentication path

Graph integration is configured in `Application` auth settings in `src/app/app.js`:

- Scope: `Files.Read.All`
- MSAL auth settings from env variables
- Sign-in link: `https://${BOT_DOMAIN}/auth-start.html`
- `autoSignIn: true`

The popup helper pages in `src/public/` drive the sign-in start/callback flow used by Teams bot authentication.

---

## 12) Logging and observability

### Current style

- Heavy use of `console.log` / `console.error` across actions and data sources.
- `src/logger.js` defines a Winston logger, but app code currently logs mostly via `console`.

### Practical implication

- Logs are verbose and useful for debugging.
- Logging is not fully standardized yet.

---

## 13) Important fit-and-finish notes (current code reality)

1. **Prompt schema vs registered actions**
   - Prompt config explicitly declares only two actions.
   - `app.js` registers more actions (quote/debug/stats).
   - If you expect the model to call all actions reliably, align prompt action schema with registered action set.

2. **Unused/partially wired modules**
   - `src/app/customSayCommand.js` is present but not wired into planner SAY path.
   - `src/logger.js` exists but not consistently used.
   - `src/app/handlers/messageHandlers.js` is empty.

3. **`generateQuote` is intentionally incomplete**
   - Currently a placeholder message; no file generation/upload implementation.

4. **Credential-dependent behavior**
   - Missing Eurolux credentials results in empty product dataset.
   - Missing Graph auth settings impacts RAG/document retrieval.

---

## 14) How to extend this codebase safely

## 14.1 Add a new AI action

1. Register handler in `src/app/app.js`:
   - `app.ai.action("actionName", async (context, state, data) => { ... })`
2. Add/extend action schema in `src/prompts/chat/config.json`.
3. Update prompt guidance in `src/prompts/chat/skprompt.txt` so model knows when to call it.
4. Log action entry + validated inputs + outcome.

## 14.2 Add a new data source

1. Create file under `src/app/dataSources/`.
2. Implement `renderData(context, memory, tokenizer, maxTokens)` for prompt-time augmentation.
3. Register in planner via `planner.prompts.addDataSource(...)` in `src/app/app.js`.
4. Optionally expose direct action wrappers if deterministic retrieval is needed.

## 14.3 Persist quote state across restarts

- Replace `MemoryStorage` with durable storage (Cosmos DB / Blob / Redis pattern depending platform conventions).
- Keep quote object contract stable so action code remains unchanged.

---

## 15) Local run checklist

> This repository snapshot does not include a package manifest at root in the visible tree. If your local clone has one elsewhere, use that. Otherwise, create one before installing dependencies.

Minimum prerequisites:

- Node.js LTS
- Bot/channel credentials (`BOT_*`)
- Azure OpenAI credentials
- Graph auth variables (if Graph retrieval needed)
- Eurolux credentials (for product actions)

Typical startup expectation:

1. Set environment variables.
2. Start Node app so `src/index.js` listens on port 3978 (or configured port).
3. Send activity to `/api/messages` from Bot Framework/Teams.

---

## 16) Troubleshooting map

### Symptom: bot responds with generic error

- Check adapter `onTurnError` output in `src/adapter.js`.
- Inspect action-specific `console.error` logs in `src/app/app.js`.

### Symptom: no products found for every query

- Verify `EUROLUX_USERNAME` and `EUROLUX_PASSWORD`.
- Confirm Eurolux endpoint availability.
- Check cache fetch logs in `euroluxApiDataSource.js`.

### Symptom: model not invoking expected action

- Verify action is declared in prompt config schema.
- Ensure prompt instructions mention use criteria for that action.
- Confirm handler registration name exactly matches schema action name.

### Symptom: Graph context missing

- Validate Graph auth env variables and sign-in flow.
- Confirm user consent and token presence in `memory.temp.authTokens["graph"]`.

---

## 17) File-by-file quick map

- `src/index.js` - HTTP server and endpoint wiring
- `src/adapter.js` - Teams adapter and global turn error policy
- `src/config.js` - Environment variable mapping for bot/model
- `src/app/app.js` - Main composition root and behavior
- `src/app/dataSources/euroluxApiDataSource.js` - Product cache/query/statistics
- `src/app/graphDataSource.js` - Graph search and document retrieval
- `src/prompts/chat/config.json` - Prompt runtime and action schema
- `src/prompts/chat/skprompt.txt` - Prompt content/instructions
- `src/app/utils/quoteUtils.js` - Quote total utility
- `src/public/auth-start.html` / `src/public/auth-end.html` - auth popup pages
- `src/logger.js` - reusable Winston logger

---

## 18) Recommended next improvements (ordered)

1. **Align prompt action schema with all implemented actions**.
2. **Replace MemoryStorage if quote continuity matters**.
3. **Implement `generateQuote` end-to-end (file creation + upload)**.
4. **Standardize logging through `logger.js`**.
5. **Move command handlers into `handlers/messageHandlers.js` for cleaner composition**.

---

## 19) Summary

LightE is a Teams AI bot with clear separation between transport (`index.js`), adapter (`adapter.js`), orchestration (`app.js`), and external knowledge/data (`graphDataSource`, `euroluxApiDataSource`, prompt files). The design is pragmatic and easy to evolve: add actions for deterministic behaviors, add data sources for retrieval context, and tighten prompt schema alignment to improve model-tool reliability.
