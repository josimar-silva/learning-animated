---
id: capture-inbound-headers
section: request-context
order: 1
title: Capture inbound headers
description: A request filter reads two headers before checkout() runs and stores them in the request's duplicated context, so two requests in flight keep separate values.
objective: See why a request filter is the place to read inbound headers, and why the duplicated context keeps each request's values apart.
references:
  - label: 'Quarkus REST: request or response filters'
    url: https://quarkus.io/guides/rest/#request-or-response-filters
  - label: 'Duplicated context: context local data'
    url: https://quarkus.io/guides/duplicated-context/#context-local-data
steps:
  - at: 0
    text: 'Request A arrives at POST /checkout with X-Correlation-Id 7f3a and X-Box-Office web.'
  - at: 1.8
    text: 'Routing has picked checkout(), but the request filter runs first and reads both headers.'
  - at: 3.6
    text: "The filter puts both values in A's duplicated context. Vert.x creates one for every request."
  - at: 6
    text: "Request B arrives while checkout() is still running for A. The same filter reads B's headers."
  - at: 8.4
    text: "B's values go into B's own duplicated context. A's context still holds 7f3a and web."
  - at: 11
    text: "A's checkout() reads its context and gets 7f3a and web, not B's values."
  - at: 13.4
    text: "B's checkout() reads c41e and kiosk from its own context."
  - at: 15.6
    text: 'The filter code and the keys are the same, but each request keeps its own values.'
---

A checkout request carries two headers that later code needs: `X-Correlation-Id`, which ties one purchase together across services, and `X-Box-Office`, which says where the sale started. A method annotated with `@ServerRequestFilter` runs after routing and before the endpoint method, so it can read both with `getHeaderString` before `checkout()` starts.

The filter stores them with `ContextLocals.put`, which writes to the current duplicated context. Vert.x creates a new duplicated context for every HTTP request, and the endpoint runs on that same context, whether on the event loop or on a worker thread. `checkout()` reads the values back with `ContextLocals.get`.

A thread local can't do this job. One event loop serves many requests at once, so every request on it would see the same value. Each duplicated context belongs to one request, which is why A and B never see each other's values.
