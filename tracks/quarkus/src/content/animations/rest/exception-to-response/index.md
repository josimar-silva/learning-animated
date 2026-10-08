---
id: exception-to-response
section: rest
order: 2
title: How an exception becomes a response
description: Two checkouts fail inside the service. SeatAlreadyTaken has a mapper and becomes 409 Conflict. A database failure has none and becomes 500.
objective: See how Quarkus REST turns an exception that escapes an endpoint into a response. The matching @ServerExceptionMapper picks the status, and an exception with no mapper becomes 500.
references:
  - label: 'Quarkus REST: exception mapping'
    url: https://quarkus.io/guides/rest/#exception-mapping
  - label: 'Jakarta REST 3.1: exception mapping providers'
    url: https://jakarta.ee/specifications/restful-ws/3.1/jakarta-restful-ws-spec-3.1.html#exceptionmapper
steps:
  - at: 0
    text: 'A buyer checks out seat F14. The request goes through the endpoint and the service to the inventory database.'
  - at: 3.5
    text: 'F14 is already held, so the service throws SeatAlreadyTaken. Nothing in the service or the endpoint catches it.'
  - at: 6.5
    text: 'Quarkus REST finds the @ServerExceptionMapper that takes SeatAlreadyTaken, and the mapper answers 409 Conflict.'
  - at: 9.5
    text: 'A second buyer checks out, but the inventory database is down.'
  - at: 13
    text: 'The seat query throws PersistenceException, which escapes the service and the endpoint the same way.'
  - at: 16
    text: 'No mapper takes PersistenceException, so Quarkus answers 500 Internal Server Error.'
---

The endpoint has no try/catch. When `SeatAlreadyTaken` escapes `checkout()`, Quarkus REST looks for an `@ServerExceptionMapper` method whose parameter type is that exception's class or one of its superclasses, picks the closest match, and sends the response the method returns. Here the response is `409 Conflict`, so the buyer knows to pick another seat.

A mapper declared inside an endpoint class only handles exceptions thrown from that class. `CheckoutMappers` is a class of its own, so its mapper covers every endpoint.

An exception that no mapper handles still gets an answer: `500 Internal Server Error`. That suits failures nobody planned for, such as a database that is down. `WebApplicationException` and its subclasses, such as `NotFoundException`, work differently: each one carries its own response, so it needs no mapper.
