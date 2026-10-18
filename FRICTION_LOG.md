# Friction log

Friction I hit while building Nukkad during the hackathon. Each entry lists the task, what I expected, what actually happened, how bad it was, how I worked around it, and a suggestion.

## 1. Bedrock blocked on a new account

* **Task:** call a model from the agent.
* **Expected:** models that show as available in the console can be called.
* **Actual:** every call returned Operation not allowed, in us-east-1 and ap-south-1.
* **Severity:** high.
* **Workaround:** DeepSeek behind a server side proxy on the same Lambda, so the key never reaches the browser.
* **Suggestion:** show the account hold and its reason in the console, with a time estimate.

## 2. No Alexa+ toolkit access

* **Task:** test the server with real Alexa+ rendering.
* **Expected:** a sandbox for participants.
* **Actual:** the toolkit, CLI and simulator are limited to select partners.
* **Severity:** medium.
* **Workaround:** my own web simulator that acts as a strict MCP client: initialize, tools/list, tools/call and resources/read over Streamable HTTP, with an inspector showing every message.
* **Suggestion:** a web sandbox for hackathons.

## 3. No official MCP adapter for Lambda

* **Task:** host Streamable HTTP on a Function URL.
* **Expected:** an example or adapter.
* **Actual:** none, so I wrote the request and response bridge, with a fresh server and transport per request in stateless JSON mode.
* **Severity:** medium.
* **Workaround:** MCP Lambda Kit, in `packages/mcp-lambda-kit`.
* **Suggestion:** an official serverless example in the SDK docs.

## 4. MCP Apps host side

* **Task:** render the cards in a custom web host.
* **Expected:** a minimal host example for a plain web page.
* **Actual:** I wrote the frame handshake, the tool result push and the resizing myself.
* **Severity:** medium.
* **Suggestion:** a small host example next to the view examples.

## 5. Budget alert needed billing access

* **Task:** set a cost alert from the IAM user.
* **Expected:** the user could create a budget.
* **Actual:** billing access had to be turned on for the user first.
* **Severity:** low.
* **Suggestion:** point to this step on the budget page.
