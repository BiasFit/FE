# Localhost API Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run dev` serve the BiasFit frontend and existing `/api/**` handlers locally without Vercel, then verify the real UI with three personal and three group runs.

**Architecture:** Add one Vite development-only middleware that adapts Node requests and responses to the existing Vercel-style API handler interface. Load only `OPENAI_API_KEY` and `OPENAI_MODEL` into the server process; no value is exposed to browser code.

**Tech Stack:** Vite 6, TypeScript, Vitest, Node HTTP, existing React application and API handlers.

## Global Constraints

- Work on the `localhost` branch and preserve all pre-existing uncommitted changes.
- Do not use, link, or configure Vercel.
- Keep production `/api/**` handler files as the source of truth.
- Verify with the real `npm run dev` UI by clicking and typing, not only test files.

---

### Task 1: Local API middleware

**Files:**
- Create: `dev/localApiPlugin.test.ts`
- Create: `dev/localApiPlugin.ts`

**Interfaces:**
- Consumes: existing default API handlers with `(ApiRequest, ApiResponse) => Promise<void>`.
- Produces: `createLocalApiMiddleware(routes)` and `localApiPlugin(options)`.

- [ ] **Step 1: Write the failing middleware tests**

Create real HTTP-server tests proving a registered `/api/**` route receives a POST body and an unknown route reaches the next middleware.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- dev/localApiPlugin.test.ts`

Expected: FAIL because `dev/localApiPlugin.ts` does not exist.

- [ ] **Step 3: Implement the minimal middleware**

Implement exact-path routing, raw request-body collection, the existing `status().json()` response contract, and five existing BiasFit API route registrations.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- dev/localApiPlugin.test.ts`

Expected: both middleware tests PASS.

### Task 2: Vite development integration

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.node.json`

**Interfaces:**
- Consumes: `localApiPlugin({ environment })`.
- Produces: local `/api/**` availability during `npm run dev`.

- [ ] **Step 1: Load server-only environment variables**

Use Vite `loadEnv(mode, process.cwd(), "")` and pass only `OPENAI_API_KEY` and `OPENAI_MODEL` to the local API plugin.

- [ ] **Step 2: Register the middleware after React**

Return Vite plugins in the order `[react(), localApiPlugin(...)]` and include `dev/**/*.ts` in the Node TypeScript project.

- [ ] **Step 3: Run build and full automated tests**

Run: `npm.cmd test` and `npm.cmd run build`.

Expected: exit code 0 for both commands.

### Task 3: Real local UI verification

**Files:**
- No source files.

**Interfaces:**
- Consumes: `npm run dev` at a local URL.
- Produces: six recorded UI outcomes.

- [ ] **Step 1: Start the actual development server**

Run: `npm.cmd run dev -- --host 127.0.0.1 --port 5180`.

- [ ] **Step 2: Verify the API boundary**

POST a valid request to `/api/ai/priority-options` and confirm the response is not 404 and has four priority options.

- [ ] **Step 3: Complete three personal UI runs**

Click and type different valid values and select different priorities; record the generated priority choice, Style DNA, and resulting recommendation data.

- [ ] **Step 4: Complete three group UI runs**

Click and type different valid A/B values and select different priorities; record the generated priority choice, group Style DNA, combination result, and recommendation data.

- [ ] **Step 5: Report exact failures**

For any blocked run, state the mode, input/selection condition, visible error, and the stage where data stopped changing or being delivered.
