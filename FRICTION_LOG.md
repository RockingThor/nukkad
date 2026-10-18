# Friction Log

Detailed log of friction points for 10% judging bonus.

---

## 1. MCP SDK Testing Without Documentation

**Task:** Write tests for the Nukkad MCP server.

**Steps:**
1. Created `src/index.test.ts` following standard Vitest patterns
2. Tried to call request handlers directly: `server._requestHandlers.get('tools/list')`
3. Got Zod validation errors: `"method": expected "tools/list"`

**Expected:** Request handlers would accept a simple params object.

**Actual:** Newer MCP SDK requires full JSON-RPC request format with method matching schema.

**Severity:** Medium. Tests are important but the server works with real clients.

**Workaround:** Skipped internal tests, relied on manual testing with web client.

**Suggestion:** Provide `@modelcontextprotocol/sdk/testing` with helpers like `createMockRequest('tools/list', params)`.

---

## 2. AWS Account Verification Delay (India)

**Task:** Set up AWS account for Bedrock Nova testing.

**Steps:**
1. Created new AWS India (AISPL) account
2. Provided card details and identity document
3. Waited for CERT-In verification email

**Expected:** "Instant for Amazon Nova" per Bedrock docs.

**Actual:** Verification email took 12+ hours (still pending at time of writing).

**Severity:** High. Blocked Bedrock testing entirely for hackathon.

**Workaround:** Implemented Bedrock provider interface with mock LLM fallback.

**Suggestion:** Offer pre-verified sandbox accounts for hackathons, or clearer timeline ("up to 24 hours").

---

## 3. No Official MCP Lambda Adapter

**Task:** Run MCP server on AWS Lambda.

**Steps:**
1. Searched for `@modelcontextprotocol/sdk-lambda` or similar
2. Found no official package
3. Tried using `SSEServerTransport` — doesn't fit Lambda's request/response model

**Expected:** An official adapter like `createLambdaHandler(server)`.

**Actual:** Had to build `mcp-lambda-kit` from scratch (which became the Open Source deliverable).

**Severity:** Medium. Took 2–3 hours to figure out stateless request handling.

**Workaround:** Built own library.

**Suggestion:** Publish `@modelcontextprotocol/server-lambda` with Lambda Function URL support.

---

## 4. MCP Apps Spec vs. Implementation Gap

**Task:** Render MCP Apps `ui://` resources in the Alexa+ simulator.

**Steps:**
1. Read MCP Apps spec (2026-01-26)
2. Looked for `@modelcontextprotocol/ext-apps` on npm
3. Found it, but AppBridge module is incomplete (no docs on custom host integration)

**Expected:** `import { AppBridge } from '@modelcontextprotocol/ext-apps'` with clear API.

**Actual:** Spec exists, but no working host implementation example.

**Severity:** Medium. Built a simple JSON card renderer instead.

**Workaround:** Render resource contents as formatted JSON.

**Suggestion:** Publish a reference AppBridge implementation for custom hosts (not just VS Code).

---

## 5. DeepSeek API Key Not Available

**Task:** Test LLM orchestrator with DeepSeek.

**Steps:**
1. Implemented DeepSeek provider (OpenAI-compatible)
2. Signed up for DeepSeek account
3. Waited for API key approval

**Expected:** Instant API key.

**Actual:** Manual approval (pending).

**Severity:** Low. Mock LLM works for demo.

**Workaround:** Used mock LLM with scripted responses.

**Suggestion:** N/A — this is a DeepSeek issue, not Amazon's.

---

## 6. Hinglish Alias Matching Complexity

**Task:** Support queries like "ek kilo atta aur do packet doodh".

**Steps:**
1. Added `aliases` field to products (e.g., `['atta', 'aata', 'wheat flour']`)
2. Implemented deterministic search in `searchCatalog` tool
3. Tested various transliteration styles

**Expected:** Simple string matching.

**Actual:** Many variants (atta, aata, aataa, attta) — hard to cover all.

**Severity:** Low. Works for common cases.

**Workaround:** Manually added 3–4 aliases per product.

**Suggestion:** For production, use phonetic matching (Soundex for Devanagari) or LLM-based normalization.

---

## 7. Next.js App Router with React 19

**Task:** Build web app with Next.js 15.

**Steps:**
1. Created app with `create-next-app@latest`
2. Got React 19 by default
3. Hit some TypeScript errors with new `use()` hook

**Expected:** Stable types.

**Actual:** React 19 is still new — some type inference issues.

**Severity:** Low. Easy to work around with `any`.

**Workaround:** Added explicit types where needed.

**Suggestion:** Next.js should wait for React stable before making it default.

---

## 8. No Alexa+ Toolkit Access

**Task:** Test MCP server with real Alexa+ rendering.

**Steps:**
1. Read FAQ: "toolkit is available to select partners only"
2. No way to apply or get access

**Expected:** Public beta or hackathon-specific sandbox.

**Actual:** Build own simulator.

**Severity:** Medium. Limits confidence that MCP Apps cards will render correctly.

**Workaround:** Built simulated Alexa+ host with protocol panel.

**Suggestion:** Offer a web-based Alexa+ sandbox for hackathons (no device needed).

---

## 9. pnpm Workspace Path Resolution

**Task:** Import `@nukkad/mcp-server` in Next.js app.

**Steps:**
1. Added `"@nukkad/mcp-server": "workspace:*"` to `apps/web/package.json`
2. Tried to import from `'@nukkad/mcp-server/dist/storage/memory.js'`
3. Got TypeScript error: "Cannot find module"

**Expected:** Workspace packages work like npm packages.

**Actual:** TypeScript needs explicit `paths` config for pnpm workspaces.

**Severity:** Low. One-time setup.

**Workaround:** None needed — worked after build.

**Suggestion:** Document pnpm workspace + TypeScript patterns better in Next.js docs.

---

## 10. Speech Recognition Accuracy for Hinglish

**Task:** Support voice input in English and Hinglish.

**Steps:**
1. Used Web Speech API with `lang: 'en-IN'`
2. Tested phrases like "ek kilo atta"

**Expected:** Accurate transcription.

**Actual:** ~70% accuracy. "Ek kilo atta" sometimes becomes "1 kg atta" (good!) or "one killer data" (bad).

**Severity:** Low. Good enough for demo.

**Workaround:** Fall back to typed input.

**Suggestion:** Amazon Transcribe with custom vocabulary would be better for production.

---

## Summary

**Most impactful friction:**
1. AWS account verification delay (High)
2. No official MCP Lambda adapter (Medium)
3. No Alexa+ toolkit access (Medium)

**Overall:** Friction was manageable. Most issues were due to ecosystem immaturity (MCP is new) or hackathon constraints (toolkit access). Documentation and official adapters would help a lot.
