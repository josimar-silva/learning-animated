---
id: echo-response-headers
section: request-context
order: 3
title: Echo headers on the response
description: A response filter copies X-Correlation-Id onto the 200 OK that checkout() returns, and onto the 409 Conflict that an exception mapper builds when checkout() throws.
objective: See why a response filter is the place to echo X-Correlation-Id. It runs after checkout() returns and also after an exception mapper builds an error response, so both answers carry the id.
references:
  - label: 'Quarkus REST: request or response filters'
    url: https://quarkus.io/guides/rest/#request-or-response-filters
steps:
  - at: 0
    text: 'Request A calls POST /checkout with X-Correlation-Id 7f3a.'
  - at: 2.5
    text: 'checkout() returns a TicketResult. Before Quarkus writes the 200 OK, the response filter runs.'
  - at: 5
    text: 'The filter reads X-Correlation-Id from the request and sets it on the response, so the 200 OK leaves with 7f3a.'
  - at: 7.5
    text: 'Request B calls POST /checkout with X-Correlation-Id c41e, for a seat someone else already holds.'
  - at: 10
    text: 'checkout() throws SeatAlreadyTaken, so it never returns a response of its own.'
  - at: 12.5
    text: 'The @ServerExceptionMapper turns SeatAlreadyTaken into a 409 Conflict response.'
  - at: 15
    text: 'Response filters also run for handled exceptions, so the filter sets c41e on the 409.'
  - at: 17.5
    text: 'Each caller gets its own id back. The same filter echoed it on the 200 and on the 409.'
---

A caller that sends `X-Correlation-Id` wants the same id back on the answer, so it can match the answer to its request. That only works if error responses carry it too.

A method annotated with `@ServerResponseFilter` runs after the endpoint method, and it can change the response before Quarkus writes it. It can take both the `ContainerRequestContext` and the `ContainerResponseContext`, so it reads the id with `getHeaderString` and sets it on the response with `putSingle`. If the request has no `X-Correlation-Id`, the filter adds nothing.

When `checkout()` throws `SeatAlreadyTaken`, it never returns, and no code after the throw runs. The `@ServerExceptionMapper` builds the 409 instead, and the Quarkus guide says response filters also run for handled exceptions. So the filter, unlike the endpoint, sees both answers. Only `X-Correlation-Id` is echoed. The caller set `X-Box-Office` itself, so seeing it again would tell it nothing new.
