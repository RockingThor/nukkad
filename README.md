# Nukkad: the corner store, on Alexa+

Built for the Amazon Build, Ship, Shape hackathon, Alexa+ track.

Big brands get Alexa+ integrations. The kirana down the road does not. Nukkad is one multi tenant MCP server that puts every independent shop on a street into Alexa+. A customer says one sentence, and Nukkad recalls the usual order, scales it for guests, checks live stock across shops, swaps what is short, checks store credit and sends a separate order to each shop.

**Live demo:** https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws

| What | URL |
| --- | --- |
| Overview | https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/ |
| Simulated Alexa+ host | https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/alexa |
| Shop console | https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/shop |
| MCP endpoint, Streamable HTTP | https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/mcp |

## The headline flow

> I'm having six friends over on Saturday for chai and snacks. Get what I usually get, enough for everyone, and put it on my khata.

`get_usual` → `build_cart` scaled 3x → `check_stock_and_substitute` swaps Biscuits, only 4 left, for Cake Rusk from the bakery → `khata_balance` → `place_order` creates three orders, one per shop, on khata. The shop console shows them live.

## How it fits together

```
Browser: /alexa                         AWS Lambda Function URL, one function
  real MCP client  ── POST /mcp ──▶     mcp-lambda-kit ─▶ Nukkad McpServer ─▶ DynamoDB on demand
  MCP Apps host, sandboxed iframes      9 tools, 3 ui:// views, 2 prompts
  agent loop       ── POST /api/chat ─▶ LLM proxy, key stays server side
/shop console      ── GET /api/shop/:id
```

* **MCP 2025-11-25 over Streamable HTTP.** Stateless: each request gets a fresh server and transport from the official SDK, JSON responses, `MCP-Protocol-Version` negotiated on initialize.
* **MCP Apps.** `build_cart`, `check_stock_and_substitute`, `place_order`, `track_order` and `khata_balance` declare `_meta.ui.resourceUri`. The views are `text/html;profile=mcp-app` resources. The host reads them with `resources/read`, renders them in a sandboxed iframe and pushes results over the `ui/*` postMessage protocol.
* **Tools stay fast.** Typical tool calls on Lambda are 50 to 220 ms, under the 500 ms Alexa+ target.
* **Hinglish aware catalog.** atta, doodh, chini, chawal and more resolve to products.
* **Khata.** Credit limits are checked per shop before any order is written, and every order lands in the ledger.

## Packages

* `packages/mcp-lambda-kit`: MIT library that runs any MCP SDK server on a Lambda Function URL. Stateless Streamable HTTP, CORS, optional bearer auth with RFC 9728 protected resource metadata, and extra routes.
* `packages/nukkad-mcp`: the Nukkad MCP server, tools, MCP Apps views, memory and DynamoDB storage, and the Lambda app in `src/app.ts`.
* `apps/web`: Next.js static export with the landing page, the simulated Alexa+ host and the shop console.
* `alexa-addon/addon.json`: Alexa+ add on manifest.

## Run it locally

```bash
pnpm install
pnpm build
pnpm test
cp .env.example packages/nukkad-mcp/.env   # add DEEPSEEK_API_KEY
cd packages/nukkad-mcp && node dist/server.js
# open http://localhost:8787/alexa
```

## Deploy

See `deploy/README.md`. One Lambda, one Function URL, one DynamoDB table, all inside the AWS free tier.

## MCP tools

find_shops, search_catalog, get_usual, build_cart, check_stock_and_substitute, khata_balance, place_order, track_order, khata_add_entry.

## Disclosure

Nukkad was inspired by an earlier project of mine, DukaanOS. No code was reused. All shop names, people and data are fictional.

## License

MIT
