# Chat contract fixtures (provisional)

Everything here except `http/responses/` is **provisional**: stream B recorded it on 2026-11-25
from eve 1.5.0 (the pinned `useEveAgent` client) against a local mock agent (`mockModel`, the
four tools with fake KB data), so the page and the Worker could be built before stream A's
spike gate (build plan 2A.1). `scripts/vendor-chat-contract.mjs <agent-commit>` replaces
`streams/` and `http/requests/` with A's recordings; B owns `http/responses/` and
`../http/http-errors.ts`.

- `streams/NN-*.ndjson`: the durable session log (`stream?follow=false`), transport lines removed.
  The dev fake eve (`worker/dev/fakes.ts`) replays them; the fixture is picked by the first
  message (`fixture:NN …`).
- `http/requests/*.json`: the requests the pinned hook sends to eve, as recorded.

Facts learned while recording (eve 1.5.0, local dev):
- create returns `202 {ok, sessionId, deliveryId}` and `x-eve-session-id`.
- create **rejects** `idempotencyKey` (400, "Unknown field"); its accepted fields are message,
  clientContext, outputSchema, operationId, callback, protocolVersion, capabilities, stubs,
  forwardedPrincipal. Follow-ups accept `idempotencyKey` and de-duplicate on it.
- cancel sends `{}` when no `turnId` is given.
- user parts in `delivery.consumed` are `{kind: "text", text}`.
