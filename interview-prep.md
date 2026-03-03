# Interview Preparation Guide: LightE Project

Audience: Data Scientist without a traditional Software Engineering background  
Goal: Help you confidently explain this project in interviews, understand how pieces fit together, and answer technical questions in practical, business-aware language.

---

## 1) Executive Summary (2-minute version)

LightE is an AI assistant running inside Microsoft Teams. It helps users:

- Find Eurolux product details (price, stock, SKU, lumens, status)
- Build and manage a quote inside a conversation
- Retrieve supporting content from Microsoft Graph/SharePoint to ground answers

Think of it as a **conversation orchestrator** that combines:

1. **LLM reasoning** (Azure OpenAI)  
2. **Deterministic tools/actions** (search products, fetch SKU, quote operations)  
3. **External data retrieval** (Graph + Eurolux API)

The architecture is modular and follows a clear flow:

User message -> Bot endpoint -> Teams adapter -> AI planner -> Tool/actions/data sources -> Response.

---

## 2) What problem this project solves

### Business problem

Sales/support users need quick product and quote information without leaving Teams.

### Product value

- Faster product lookups
- More accurate stock/price responses
- Better productivity via conversational quote workflows

### Why this is interesting in interviews

This project demonstrates practical AI application design:

- Blending LLM with structured APIs
- Retrieval augmentation
- Tool-calling patterns
- Stateful interactions (quote building)

---

## 3) Architecture in plain language

## 3.1 Analogy-first explanation

Imagine a call center:

- **Reception desk (Express in src/index.js)** receives incoming requests
- **Switchboard operator (adapter.js)** routes and handles major failures
- **Conversation manager (app.js)** decides what to do next
- **Specialists (actions/data sources)** fetch facts and execute tasks
- **Knowledge binder (prompt files + data sources)** gives context to the AI

This is exactly what LightE does in software form.

## 3.2 Core components and roles

- `src/index.js`: Starts HTTP server and exposes `/api/messages`
- `src/adapter.js`: Connects Teams/Bot messages to app logic + central error handling
- `src/config.js`: Loads environment-based secrets and runtime settings
- `src/app/app.js`: Main “brain wiring” (planner, actions, auth, message handlers)
- `src/app/dataSources/euroluxApiDataSource.js`: Pulls/caches product catalog and supports filtering/statistics
- `src/app/graphDataSource.js`: Searches Microsoft Graph and injects relevant content
- `src/prompts/chat/*`: Prompt configuration + instruction template for model behavior
- `src/public/auth-start.html`, `src/public/auth-end.html`: Authentication helper pages

---

## 4) End-to-end flow (what happens when user sends a message)

## 4.1 Runtime flow

1. User sends a Teams message.
2. Teams/Bot Framework calls `POST /api/messages`.
3. Express route (`index.js`) forwards to adapter.
4. Adapter passes context to `app.run(context)`.
5. Planner decides whether to:
   - Answer directly, or
   - Call an action like `searchProducts` / `getProductBySku` / quote actions.
6. Action runs deterministic code and returns data.
7. Bot sends final response to Teams.

## 4.2 Why this matters

- LLM gives language intelligence.
- Actions give precision and reliability.
- Data sources provide grounding in real data.

This balance is often the key interview talking point for production AI apps.

---

## 5) AI orchestration concepts (for non-SWE audiences)

## 5.1 Planner

The planner decides: “Do I need to call a tool, and which one?”

- Uses prompt instructions + action schema
- Can loop and invoke multiple actions
- Helps convert natural language into structured operations

## 5.2 Prompt Manager

Loads prompt templates and prompt config:

- Behavioral instructions (tone, role, constraints)
- Action declarations and parameter schema
- Generation settings (token limits, temperature)

## 5.3 Actions (tool calls)

Actions are deterministic functions exposed to the LLM.

Examples in this project:

- Product search with filters
- SKU lookup
- Product statistics
- Quote operations (add/show/clear)

This is like giving the model access to “approved calculators/APIs” rather than asking it to guess.

## 5.4 Data Sources

Data sources provide external context to improve response quality.

- Eurolux source supplies product-related capabilities
- Graph source retrieves document content/citations from M365

This supports a retrieval-augmented approach.

---

## 6) Data architecture and retrieval strategy

## 6.1 Eurolux data source

File: `src/app/dataSources/euroluxApiDataSource.js`

### What it does

- Authenticates to Eurolux API via Basic auth credentials
- Fetches product list
- Caches list in memory
- Exposes search, lookup, and aggregate stats methods

### Why caching exists

Without cache, every lookup would call the upstream API, increasing latency and fragility.

### Trade-off

- Pro: faster interactions after initial load
- Con: cache can become stale unless refreshed

## 6.2 Graph data source

File: `src/app/graphDataSource.js`

### What it does

- Uses user auth token
- Queries Graph Search for drive items
- Downloads content from matched files
- Adds citations and keeps context within token budget

### Conceptually

This is **RAG-lite**: retrieve docs first, then feed context to LLM.

### Interview angle

You can frame this as reducing hallucination by grounding responses in enterprise content.

---

## 7) State and memory concepts

Current storage is `MemoryStorage`.

### What that means

- Conversation quote state is kept in app memory
- State disappears if process restarts or scales out

### Interview implication

Good for prototyping and demos; production would typically use durable storage.

### Quote state shape (conceptual)

- `quote.items[]` with sku, description, quantity, unitPrice, lineTotal
- Total computed by helper utility

---

## 8) Authentication and security basics

## 8.1 Auth setup

Graph access is configured through environment variables and OAuth/MSAL settings.

- Scope includes `Files.Read.All`
- Sign-in helpers are in `src/public` auth pages

## 8.2 Security considerations you can discuss

- Secrets are loaded from environment variables (not hardcoded)
- Least-privilege scopes should be reviewed regularly
- API credentials should rotate and be managed with secret stores
- Logging should avoid sensitive payload exposure

---

## 9) Current strengths and current gaps

## 9.1 Strengths

- Clear modular structure
- Good separation of deterministic tools vs language model behavior
- Helpful debug paths (`/status`, `/stock`, debug actions)
- Flexible action architecture for future extension

## 9.2 Gaps / technical debt

- Prompt action schema lists fewer actions than implemented in code
- `generateQuote` is placeholder (no export/upload implementation)
- Logging is mostly console-based; logger module exists but is underused
- In-memory storage is non-durable
- Some placeholder files are empty or not fully wired (e.g., messageHandlers)

These are not failures; they are normal iteration-stage realities and good interview discussion material.

---

## 10) Interview narrative templates

Use these as reusable scripts.

## 10.1 “Tell me about the project” (60-90 sec)

“I worked on a Teams AI assistant called LightE that helps sales users find product details and manage quote workflows conversationally. Architecturally, it combines Azure OpenAI reasoning with deterministic action handlers and retrieval from external sources like Eurolux API and Microsoft Graph. I focused on making the system practical: actions for precise operations, prompt-driven orchestration for flexibility, and debug/observability paths for reliability. The design is modular, so adding new tools or retrieval sources is straightforward.”

## 10.2 “What was your contribution?” (customize)

“I contributed to understanding and documenting the runtime architecture, action ecosystem, data retrieval patterns, and operational trade-offs. I also mapped extension paths and identified where production hardening would be needed, especially around persistence, action schema alignment, and logging standardization.”

## 10.3 “What would you improve next?”

“First, align prompt action schema with all implemented actions so planner-tool reliability improves. Second, replace in-memory state with durable storage for continuity across restarts. Third, complete quote generation and external upload. Finally, standardize structured logging and add evaluation metrics for action success and retrieval quality.”

---

## 11) Glossary for Data Scientists

- **Adapter**: Integration layer between message platform and app logic.
- **Action**: Deterministic function callable by the LLM (tool/function call).
- **Prompt**: Instruction + template guiding model behavior.
- **Planner**: Component that chooses whether/how to call actions.
- **RAG**: Retrieval-Augmented Generation; retrieve context before generating.
- **Token budget**: Max text units model can process in one request.
- **State**: Conversation memory (e.g., quote items).
- **Schema**: Structured definition of action parameters and expected shape.
- **Latency**: Response time.
- **Observability**: Ability to inspect logs/metrics/traces to diagnose behavior.

---

## 12) Deep-dive concepts interviewers may probe

## 12.1 Why not let LLM answer everything directly?

Because operations like SKU lookup and quote totals need deterministic correctness. LLM-only answers can be fluent but wrong. Tool calls reduce this risk.

## 12.2 Why include retrieval from Graph?

To ground responses in enterprise documents and reduce unsupported claims.

## 12.3 How do you handle prompt/context length?

Data source code tracks token budget and truncates content when necessary.

## 12.4 What are failure modes?

- Missing credentials
- API timeouts or errors
- Auth token issues
- Action schema mismatch
- State loss due to memory-only storage

## 12.5 How would you evaluate this system?

Track both product KPIs and ML/system KPIs:

- Response latency p50/p95
- Action invocation success rate
- Factual correctness for SKU/stock answers
- Quote workflow completion rate
- User satisfaction/feedback loop signals

---

## 13) Data-science framing: metrics and evaluation design

## 13.1 Suggested evaluation dimensions

1. **Task success**
   - Did user get correct product or quote outcome?
2. **Groundedness**
   - Are claims supported by tool output or retrieved docs?
3. **Action precision/recall**
   - Does planner call right action when needed?
4. **Latency and reliability**
   - End-to-end response and failure rate
5. **User experience quality**
   - Clarity, conciseness, and usefulness

## 13.2 Example offline evaluation set

Build a benchmark table with columns:

- User utterance
- Expected action(s)
- Expected key fields (sku, quantity, filters)
- Expected final answer characteristics
- Ground-truth source reference

## 13.3 Online evaluation ideas

- A/B prompt variants for action call reliability
- Compare retrieval strategies (strict vs broad query rewrite)
- Monitor drift in product API schema or catalog behavior

---

## 14) Likely interview questions and model answers

## 14.1 “How does this system reduce hallucinations?”

Model answer:

“By routing fact-based requests through deterministic actions and external APIs rather than relying on generative memory. For document-backed answers, Graph retrieval adds supporting context. That creates a grounded hybrid approach.”

## 14.2 “What are the main production risks?”

Model answer:

“State durability, credential management, action schema alignment, and observability maturity. In this version, MemoryStorage is non-durable and quote export is still placeholder.”

## 14.3 “How would you scale this architecture?”

Model answer:

“Move to durable state storage, add cache refresh strategy and retries/circuit breakers for external APIs, standardize structured logs, and establish automated evals for action routing and factual accuracy.”

## 14.4 “What did you learn?”

Model answer:

“High-quality AI applications are less about one prompt and more about orchestration: tool contracts, retrieval quality, state management, and failure handling.”

## 14.5 “Where does a Data Scientist add value here?”

Model answer:

“Designing evaluations, defining outcome metrics, detecting drift, analyzing failure clusters, tuning retrieval and prompt strategies, and quantifying business impact.”

---

## 15) Whiteboard-ready architecture script

Use this if asked to draw the system:

1. Draw user/Teams on left.
2. Draw API endpoint `/api/messages`.
3. Draw adapter and error boundary box.
4. Draw application core with planner.
5. From planner, branch to:
   - prompt/template
   - actions
   - data sources
6. Under actions, list SKU search, quote ops.
7. Under data sources, list Eurolux API + Graph retrieval.
8. Draw response back to user.
9. Add side annotations:
   - env secrets
   - memory state
   - logs/monitoring

This shows systems thinking, not just model usage.

---

## 16) Talking about trade-offs like a senior candidate

## 16.1 Flexibility vs control

- Prompt/planner gives flexibility
- Deterministic actions give control
- Best design intentionally combines both

## 16.2 Speed vs freshness

- Caching speeds responses
- Freshness may degrade without invalidation strategy

## 16.3 Simplicity vs durability

- Memory storage is simple
- Durable storage is required for reliable long-running workflows

## 16.4 Rich context vs token cost

- More retrieved text can help quality
- Too much context can increase cost and dilute relevance

---

## 17) 30-60-90 second answer bank

## 17.1 30-second

“LightE is a Teams AI assistant that combines Azure OpenAI, deterministic API actions, and Graph retrieval to answer product questions and manage quote workflows. Its value is grounded, actionable responses in a conversational interface.”

## 17.2 60-second

“Technically, requests enter through Express, pass to a Teams adapter, and then to an AI application with an action planner. The planner can call structured actions like product search or quote management. External data comes from Eurolux API and Graph retrieval, and conversation state tracks quote items. This hybrid approach balances language flexibility with operational accuracy.”

## 17.3 90-second

“From a systems perspective, LightE demonstrates an enterprise AI pattern: orchestration over pure generation. There is clear separation between transport, adapter, planner, actions, and data sources. Key next steps for production hardening are durable state, schema alignment, standardized logging, and complete quote output automation. As a Data Scientist, I view this as a measurable decision system where action precision, groundedness, latency, and business outcomes can all be instrumented and optimized.”

---

## 18) Practical prep checklist before interview

- Can you explain architecture in < 2 minutes without jargon?
- Can you distinguish LLM behavior vs deterministic tool behavior?
- Can you name at least 3 risks and 3 improvements?
- Can you explain why retrieval improves trustworthiness?
- Can you discuss evaluation metrics beyond BLEU-style text similarity?
- Can you speak to business value (speed, correctness, workflow completion)?

If yes, you are in strong shape.

---

## 19) File map to mention in interview

- `src/index.js`: inbound message endpoint and server startup
- `src/adapter.js`: platform adapter + turn-level error handling
- `src/config.js`: secret/config injection
- `src/app/app.js`: planner, action registration, auth, command handlers
- `src/app/dataSources/euroluxApiDataSource.js`: API client, filtering, cache, stats
- `src/app/graphDataSource.js`: enterprise retrieval and citation context
- `src/prompts/chat/config.json`: model/action behavior contract
- `src/prompts/chat/skprompt.txt`: behavioral instructions

---

## 20) Optional “If they ask coding depth” response

If asked deeper engineering questions, use this line:

“I focus on AI system behavior, data quality, and evaluation outcomes first, and I collaborate with software engineers on implementation details like deployment topology, resilience, and infrastructure hardening. In this project, I can clearly map where these boundaries are and how they interact.”

This is honest and strong for DS profiles.

---

## 21) Closing statement you can use

“LightE is a practical example of applied AI engineering: not just model prompts, but a full decision pipeline integrating APIs, retrieval, state, and user workflows. My contribution is understanding and optimizing that pipeline for correctness, trust, and business usefulness.”
