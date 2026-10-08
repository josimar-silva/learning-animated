---
id: response-vs-typed-return
section: rest
order: 1
title: Response vs a concrete return type
description: Two checkout endpoints send the same JSON. The one that returns Response looks up a body writer on every request, and the one that returns TicketResult gets its writer once, before the first request.
objective: See why an endpoint with a concrete return type and one @Produces media type gets its body writer before the first request, while an endpoint that returns Response looks one up on every request.
references:
  - label: 'Quarkus REST: returning a response body'
    url: https://quarkus.io/guides/rest/#returning-a-response-body
  - label: 'Quarkus REST: manually setting the response'
    url: https://quarkus.io/guides/rest/#manually-setting-the-response
steps:
  - at: 0
    text: "Before the first request, Quarkus sets up each endpoint. Response hides the body's type, so that endpoint gets no writer."
  - at: 1
    text: 'TicketResult names the type and @Produces names one media type, so Quarkus picks the JSON writer now.'
  - at: 3
    text: 'Request 1: both methods return the same tickets, one inside a Response and one as a plain TicketResult.'
  - at: 4
    text: 'After the method returns, the Response endpoint looks up a writer. The TicketResult endpoint uses the one it has.'
  - at: 5
    text: 'Both clients get the same 200 OK and the same JSON body.'
  - at: 6
    text: 'Requests 2 and 3 repeat it. The Response endpoint looks up its writer again each time; the TicketResult endpoint does not.'
  - at: 12
    text: 'Both sent the same JSON. Response looked up a writer 3 times, once per request; TicketResult once, before any request.'
---

Quarkus REST decides how to serialize a response from the method's return type and its `@Produces` media type. When a method returns a concrete type such as `TicketResult` and names one media type, Quarkus finds the JSON writer while it sets up the endpoint, before the first request arrives. Every request then calls that writer directly.

A method that returns `Response` hides the body's type until it runs, since `Response` is not typed to its entity. Quarkus can't pick a writer in advance, so after the method returns it looks up writers for the entity's class and the negotiated media type, and it does that on every request. The client gets the same JSON either way. `Uni<Response>` and `CompletionStage<Response>` behave the same.

If you need a status code or headers, return `RestResponse<TicketResult>`. Quarkus reads its type argument, so the writer is still chosen up front. In dev mode, the endpoint scores in Dev UI mark each endpoint that picks its writer per request with "Run time writers required".
