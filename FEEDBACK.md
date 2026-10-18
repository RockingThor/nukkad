# Product feedback

Feedback on every tool and service used to build Nukkad during the Amazon Build, Ship, Shape hackathon.

## AWS services used and how

* **AWS Lambda.** One Node 22 function on arm64 runs the whole product. It serves the MCP endpoint over Streamable HTTP, the agent proxy, the shop console API and the static web app. A Function URL gives it a public HTTPS address with no API Gateway in front.
* **Amazon DynamoDB.** One table in on demand mode, single table design. It stores shops, products with stock, customers and their usual order, orders with their status, and the khata accounts with every ledger entry. The `place_order` tool checks the credit limit at each shop before it writes anything.
* **AWS IAM.** A dedicated role for the function with basic logging and access to this one table only.
* **Amazon CloudWatch Logs.** Function logs, including errors from the agent proxy.
* **AWS Budgets.** A monthly budget alert so the demo never runs up a bill.
* **Amazon Bedrock.** Planned for the agent, but blocked on my account during the hackathon. See below.

## MCP TypeScript SDK and the Streamable HTTP transport

* **What I used it for:** the Nukkad server, its tools, resources and prompts, and the web standard Streamable HTTP transport inside Lambda.
* **What worked well:** registering tools with zod schemas is clean, and the web standard transport made Lambda possible with very little glue code. JSON responses in stateless mode are easy to debug.
* **What needs work:** the stateless serverless setup is not documented as a first class path. A short official example for Lambda or any function runtime would save people hours.
* **Onboarding:** getting a first tool to answer over HTTP was quick. The serverless setup was the slow part.
* **Would I build with it again:** yes. It is the right abstraction and the SDK is solid.

## MCP Apps

* **What I used it for:** the cart, khata and order tracker cards, served as UI resources and linked from the tools.
* **What worked well:** a tool simply points at its view, and the view gets the structured result. One card format works for any host that supports MCP Apps.
* **What needs work:** the host side is where the effort goes. A minimal example of a plain web page acting as a host would help a lot.
* **Onboarding:** the views were quick to write, the host side took much longer.
* **Would I build with it again:** yes. The cards are what make the voice answer believable.

## AWS Lambda with Function URLs

* **What I used it for:** hosting the MCP server, the agent proxy and the web app in one function.
* **What worked well:** deploys are one zip upload, the Function URL is ready right away, and cost at demo scale is close to zero.
* **What needs work:** public Function URLs need resource policy statements on top of choosing no auth, which is easy to miss. There is also no Amazon example for hosting an MCP server this way.
* **Onboarding:** straightforward with the AWS CLI.
* **Would I build with it again:** yes. Stateless MCP and Lambda fit each other well.

## Amazon DynamoDB

* **What I used it for:** all product data and state.
* **What worked well:** on demand mode means no capacity planning.
* **What needs work:** nothing blocking. Batch writes returning unprocessed items still need a retry loop in every project.
* **Onboarding:** quick with the AWS CLI and the document client.
* **Would I build with it again:** yes.

## Amazon Bedrock

* **What I used it for:** it was meant to run the agent.
* **What worked well:** the model catalog and the console made it look ready to go.
* **What needs work:** on a new account every call returned Operation not allowed with no clear reason in the console. A visible account status and a time estimate would have saved a lot of guessing.
* **Onboarding:** blocked during the hackathon.
* **Would I build with it again:** yes, once the account is cleared. Moving the agent over is a small change in the proxy.

## Alexa+ developer documentation and toolkit

* **What I used it for:** the requirements in the MCP QuickStart, the latency target and the add-on manifest format.
* **What worked well:** the requirements are concrete, which made it easy to build towards them.
* **What needs work:** the toolkit, CLI and web simulator are limited to select partners. A sandbox for hackathon participants would let us test real rendering.
* **Onboarding:** reading only, no hands on access.
* **Would I build with it again:** yes, and I would like to deploy Nukkad there as soon as it opens.

## DeepSeek API

* **What I used it for:** the language model behind the agent loop, with tool calling.
* **What worked well:** OpenAI compatible tool calling, fast replies and a low price.
* **What needs work:** nothing that blocked me.
* **Onboarding:** minutes.
* **Would I build with it again:** yes, as the backup model.

## Next.js

* **What I used it for:** the overview page, the Alexa+ simulator and the shop console, as a static export served from Lambda.
* **What worked well:** static export kept hosting to a single function.
* **What needs work:** nothing major.
* **Would I build with it again:** yes.

## Vitest and pnpm

* **What I used them for:** tests for the server and the kit, and the workspace with three packages.
* **What worked well:** fast tests, simple workspace linking.
* **What needs work:** nothing major.
* **Would I build with them again:** yes.

## Web Speech API

* **What I used it for:** the mic button and spoken replies in the simulator.
* **What worked well:** no setup at all in Chrome.
* **What needs work:** support differs between browsers, so typed input is always there as a fallback.
* **Would I build with it again:** for a prototype yes, for production I would move to Amazon Polly and Amazon Transcribe.
