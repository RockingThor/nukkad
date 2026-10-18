# Nukkad: the corner store, on Alexa+

Built for the Amazon Build, Ship, Shape hackathon, Alexa+ track.

Big brands get Alexa+ integrations. The kirana down the road does not. Nukkad is one multi tenant MCP server that puts every independent shop on a street into Alexa+. A customer says one sentence, and Nukkad recalls the usual order, scales it for guests, checks live stock across shops, swaps what is short, checks store credit and sends a separate order to each shop.

## Testing instructions

No login and no install are needed. Chrome on a desktop works best.

| What | URL |
| --- | --- |
| Overview | https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/ |
| Simulated Alexa+ host | https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/alexa |
| Shop console | https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/shop |
| MCP endpoint, Streamable HTTP | https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/mcp |

1. Open the simulated Alexa+ host at https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/alexa
2. Tap the first suggestion, the party order for six friends, or type it. Nukkad recalls the usual order, scales it, swaps Biscuits for Cake Rusk, checks the khata limit at each shop and places three orders, one per shop. The MCP inspector shows every JSON RPC message over Streamable HTTP, and the cart, order tracker and khata cards render as MCP Apps views.
3. Ask: what is my khata balance. Then ask: where is my order.
4. Open the shop console at https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/shop, switch between Kirana, Bakery and Dairy, and accept an order. Ask the simulator where the order is again to see the new status.
5. Ask: do you have atta and doodh. This shows the Hinglish search.
6. Point any MCP client that speaks Streamable HTTP at https://sg7rrjgz36ukucf6okmydj7gpi0ecppw.lambda-url.us-east-1.on.aws/mcp to call the 9 tools, read the 3 `ui://` views and use the 2 prompts directly.

The mic button uses the browser speech API. Typing works everywhere. The demo data resets every night at 3 AM IST, so stock and khata balances are fresh each day. The seeded credit limits leave room for several party orders a day. If a khata order is refused, that is the credit limit check working. Ask to pay cash instead and the order goes through.

## The headline flow

> I'm having six friends over on Saturday for chai and snacks. Get what I usually get, enough for everyone, and put it on my khata.

First `get_usual` recalls the order. Then `build_cart` scales it three times, and `check_stock_and_substitute` swaps Biscuits, with only 4 left, for Cake Rusk from the bakery. Next `place_order` checks each shop's credit limit and creates three orders on khata, one per shop. Finally `khata_balance` shows the updated credit. The shop console shows the orders live.

## How it fits together

```
Browser: /alexa                         AWS Lambda Function URL, one function
  real MCP client  ── POST /mcp ──▶     mcp-lambda-kit ─▶ Nukkad McpServer ─▶ DynamoDB on demand
  MCP Apps host, sandboxed iframes      9 tools, 3 ui:// views, 2 prompts
  agent loop       ── POST /api/chat ─▶ LLM proxy, key stays server side
/shop console      ── GET /api/shop/:id
```

* **MCP 2025-11-25 over Streamable HTTP.** Stateless: each request gets a fresh server and transport from the official SDK, JSON responses, `MCP-Protocol-Version` negotiated on initialize.
* **MCP Apps.** Six of the 9 tools, `build_cart`, `check_stock_and_substitute`, `place_order`, `track_order`, `khata_balance` and `khata_add_entry`, declare `_meta.ui.resourceUri` and link to one of the 3 views: cart, order tracker and khata. The views are `text/html;profile=mcp-app` resources. The host reads them with `resources/read`, renders them in a sandboxed iframe and pushes results over the `ui/*` postMessage protocol.
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

## MCP tools, views and prompts

* **9 tools:** find_shops, search_catalog, get_usual, build_cart, check_stock_and_substitute, khata_balance, place_order, track_order, khata_add_entry.
* **3 `ui://` views:** `ui://nukkad/cart`, `ui://nukkad/order-tracker`, `ui://nukkad/khata`.
* **2 prompts:** `reorder-usual`, `party-order`.

## Nightly demo reset

The demo data resets once a day at 3 AM IST. The first request after 3 AM claims that day's reset with a conditional write in DynamoDB, so exactly one instance runs it, and it restores the seeded shops, stock, customers, orders and khata balances from `packages/nukkad-mcp/src/data/seed.ts` and `src/storage/seed-state.ts`. A direct Lambda invoke with the event `{ "nukkad": "reset" }` runs the same reset, which is what an optional EventBridge Scheduler schedule in `deploy/README.md` uses to fire on the dot. Function URL events always carry an HTTP request context, so nobody can trigger a reset from the public URL.

## Disclosure

Nukkad was inspired by an earlier project of mine, DukaanOS. No code was reused. All shop names, people and data are fictional.

## License

MIT
