# Product Feedback

Feedback for Amazon "Build, Ship, Shape" hackathon, Alexa+ track.

## MCP TypeScript SDK (@modelcontextprotocol/sdk ^1.32.1)

### What did you use it for?
Building the Nukkad MCP server with 9 tools, 3 MCP Apps resources, and 2 prompts. Implemented over Streamable HTTP for Alexa+.

### What worked well?
- TypeScript types are comprehensive and well-documented
- The `Server` class abstracts transport details nicely
- Request handler pattern with Zod schemas is clean
- Protocol negotiation works seamlessly

### What needs work?
- Testing the server internals is tricky — need better test utilities or examples
- Some schema imports (`ListToolsRequestSchema`, etc.) aren't obvious from docs
- Would benefit from an official Lambda adapter (hence why we built `mcp-lambda-kit`)
- Error handling could have more built-in helpers

### Onboarding (zero to hello world)?
Good. The TypeScript examples are clear. Would recommend more transport examples beyond stdio (SSE, HTTP).

### Would you build with it again?
**Yes.** MCP is the right abstraction for tool calling. The SDK is production-ready once you understand the request handler patterns.

---

## MCP Spec 2025-11-25 (Streamable HTTP)

### What did you use it for?
The transport layer between the Alexa+ simulator (web client) and the Nukkad MCP server.

### What worked well?
- Stateless HTTP is perfect for serverless (Lambda)
- JSON-RPC 2.0 is simple and debuggable
- Protocol version negotiation is explicit

### What needs work?
- No official "how to test Streamable HTTP" guide — we built a custom client
- Spec doesn't cover auth in detail (we implemented RFC 9728 on our own)

### Onboarding?
Moderate. The spec is thorough, but examples of client implementations would help.

### Would you build with it again?
**Yes.** Stateless HTTP is the right choice for production MCP servers.

---

## MCP Apps (ui:// resources, planned for @modelcontextprotocol/ext-apps)

### What did you use it for?
Defined `ui://cart`, `ui://order-tracker`, and `ui://khata` resources. Rendered them as JSON cards in the Alexa+ simulator.

### What worked well?
- The resource pattern is straightforward
- URI scheme (`ui://`) is intuitive

### What needs work?
- No official AppBridge implementation available yet for custom hosts
- Rendering examples would help (we built a simple JSON preview)
- Schema for card contents isn't standardized

### Onboarding?
Limited. We relied on the spec and extrapolated from the MCP Apps docs.

### Would you build with it again?
**Yes, once AppBridge is stable.** The concept is sound — Alexa+ native rendering will be powerful.

---

## AWS Lambda (Function URLs)

### What did you use it for?
Planned deployment target for the Nukkad MCP server (not deployed in demo, but built `mcp-lambda-kit` library for it).

### What worked well?
- Function URLs are perfect for public MCP servers
- CORS support is built-in
- Node 22 runtime is fast

### What needs work?
- Cold starts can be 1–2 seconds (impacts Alexa+ 500ms requirement)
- No official MCP Lambda examples from Amazon

### Onboarding?
Easy. CDK/SAM templates are mature.

### Would you build with it again?
**Yes.** Lambda is the natural fit for stateless MCP servers. Just need to warm it (e.g., scheduled pings).

---

## Amazon DynamoDB

### What did you use it for?
Planned storage backend (implemented interface, used in-memory for demo).

### What worked well?
- Single-table design works well for multi-tenant (shops, customers, orders, khata)
- DynamoDB Local is great for dev

### What needs work?
- Free tier limits on new accounts are unclear (mentioned in plan, didn't test)

### Onboarding?
Standard AWS experience. No surprises.

### Would you build with it again?
**Yes.** DynamoDB is perfect for MCP server state.

---

## Amazon Bedrock (Nova Lite) — NOT USED IN DEMO

### What did you use it for?
Planned LLM provider (implemented interface, used mock LLM for demo).

### What worked well?
N/A — account setup blocked.

### What needs work?
- Account verification took too long (India AISPL identity check)
- Documentation says "instant for Nova" but we couldn't test in time

### Onboarding?
Blocked. Would have been smoother with existing AWS account.

### Would you build with it again?
**Would like to.** Nova's pricing and latency look promising for Alexa+ use cases.

---

## DeepSeek (OpenAI-compatible API) — IMPLEMENTED BUT NOT TESTED

### What did you use it for?
Implemented as LLM provider option (OpenAI-compatible tool calling).

### What worked well?
- API is 1:1 compatible with OpenAI format
- Documentation is clear

### What needs work?
N/A — didn't test with real key.

### Would you build with it again?
**Yes, with a key.** The compatibility makes it a good fallback.

---

## Alexa+ Developer Tools (MCP Toolkit, CLI, Web Simulator) — NOT AVAILABLE

### What did you use it for?
N/A — not available to hackathon participants.

### What worked well?
N/A

### What needs work?
- Hackathon FAQ says "build a self-hosted MCP server and demo it via your own simulator"
- Would have loved to test the real Alexa+ rendering of our MCP Apps cards
- A public sandbox or gated preview invite would help future hackathons

### Onboarding?
N/A — blocked.

### Would you build with it again?
**Would love to.** Once the toolkit opens, integrating Nukkad with real Alexa+ devices is the natural next step.

---

## Web Speech API (Browser)

### What did you use it for?
Voice input in the Alexa+ simulator (`webkitSpeechRecognition` with `en-IN` locale).

### What worked well?
- Works out of the box in Chrome
- Hindi/English code-switching is decent (not perfect)

### What needs work?
- Not available in all browsers (needs feature detection)
- Accuracy for Hinglish queries is ~70%

### Onboarding?
Instant. One API call.

### Would you build with it again?
**Yes, for prototypes.** For production, would use Amazon Polly + Transcribe.

---

## Next.js 15 (React 19, App Router)

### What did you use it for?
Web app: Alexa+ simulator, shop console, MCP API route.

### What worked well?
- App Router is stable and fast
- API routes are perfect for MCP server proxy
- TypeScript support is excellent

### What needs work?
- React 19 is still new — some types are incomplete

### Onboarding?
Seamless. Next.js is mature.

### Would you build with it again?
**Yes.** Next.js is the best React framework for full-stack apps.

---

## Vitest

### What did you use it for?
Testing `mcp-lambda-kit` and `nukkad-mcp`.

### What worked well?
- Fast and reliable
- ESM support is great

### What needs work?
- MCP SDK testing patterns need examples (internal handlers are hard to test)

### Onboarding?
Easy. Drop-in Jest replacement.

### Would you build with it again?
**Yes.** Standard choice for modern TypeScript projects.

---

## pnpm (monorepo)

### What did you use it for?
Managing 3 packages: `mcp-lambda-kit`, `nukkad-mcp`, `web`.

### What worked well?
- Workspaces are fast and reliable
- `pnpm dev` with `--parallel` runs all dev servers

### What needs work?
- Nothing major.

### Onboarding?
Instant for anyone familiar with npm/yarn.

### Would you build with it again?
**Yes.** Best monorepo tool for Node.js.

---

## Overall Hackathon Experience

### What worked well?
- Clear rules and creative vs. obvious guidance
- Office Hours (we didn't attend but nice to have)
- FAQ updates were helpful

### What needs work?
- Alexa+ toolkit availability — even a sandbox would help
- AWS credits ran out early (mentioned in updates)
- Would love more MCP examples (Lambda, Bedrock integration)

### Would you recommend this hackathon?
**Yes.** Well-organized and the Alexa+ track has real-world potential.
