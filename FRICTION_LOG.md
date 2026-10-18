# Friction log

Friction I hit while building Nukkad during the Amazon Build, Ship, Shape hackathon. Each entry lists the task, the steps, what I expected against what actually happened, the severity, the workaround and a suggestion.

## 1. Bedrock blocked on a new account

* **Task:** call a model from the Nukkad agent through Amazon Bedrock.
* **Steps:** picked a model that the Bedrock console listed as available, called it in the North Virginia region, then tried again in the Mumbai region.
* **Expected:** a model listed as available can be called.
* **Actual:** every call returned Operation not allowed, in both regions, with no reason shown in the console.
* **Severity:** High.
* **Workaround:** moved the agent to DeepSeek behind a server side proxy on the same Lambda, so the key never reaches the browser.
* **Suggestion:** show the account hold and its reason in the Bedrock console, with a time estimate.

## 2. No Alexa+ toolkit access

* **Task:** test the Nukkad MCP server with real Alexa+ rendering.
* **Steps:** followed the Alexa+ addon docs to the MCP toolkit, CLI and web simulator setup.
* **Expected:** a sandbox or simulator that hackathon participants can use.
* **Actual:** the toolkit, CLI and simulator are limited to select partners.
* **Severity:** Medium.
* **Workaround:** built my own web simulator that acts as a strict MCP client: initialize, tools list, tools call and resources read over Streamable HTTP, with an inspector showing every message.
* **Suggestion:** open a web sandbox for hackathon participants.

## 3. No official MCP adapter for Lambda

* **Task:** host a Streamable HTTP MCP server on a Lambda Function URL.
* **Steps:** looked for an official sample or adapter in the MCP SDK and AWS docs, then wrote the bridge myself.
* **Expected:** an example or adapter for Lambda.
* **Actual:** none, so I wrote the request and response bridge, with a fresh server and transport per request in stateless JSON mode.
* **Severity:** Medium.
* **Workaround:** MCP Lambda Kit, now a reusable package in the repo.
* **Suggestion:** an official serverless example in the SDK docs or AWS samples.

## 4. MCP Apps host side

* **Task:** render the MCP Apps cards in a custom web host.
* **Steps:** read the MCP Apps view examples, then built the host side in the simulator.
* **Expected:** a minimal host example for a plain web page.
* **Actual:** I wrote the frame handshake, the tool result push and the resizing myself.
* **Severity:** Medium.
* **Workaround:** a small host component in the simulator.
* **Suggestion:** a small host example next to the view examples.

## 5. Function URL permissions

* **Task:** make the Function URL public so any MCP client can reach it.
* **Steps:** created the Function URL with auth type NONE, then added resource policy statements.
* **Expected:** choosing auth type NONE is enough for a public URL.
* **Actual:** the function also needs two resource policy statements, one for InvokeFunctionUrl and one for InvokeFunction through the Function URL. This is easy to miss.
* **Severity:** Low.
* **Workaround:** added both statements to the first time deploy steps in `deploy/README.md`.
* **Suggestion:** have the console and CLI offer to add both statements when a NONE auth URL is created.
