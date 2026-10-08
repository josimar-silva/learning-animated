---
id: propagate-outbound-headers
section: request-context
order: 2
title: Propagate headers on outbound calls
description: When checkout() calls the payment provider through a REST client, a ClientHeadersFactory copies the headers stored in the request's duplicated context onto the call, so each call carries its own request's values.
objective: See how a ClientHeadersFactory puts stored headers on every REST client call, and why each call gets the values of the request that made it.
references:
  - label: 'REST client: custom headers support'
    url: https://quarkus.io/guides/rest-client/#custom-headers-support
  - label: 'Duplicated context: context local data'
    url: https://quarkus.io/guides/duplicated-context/#context-local-data
steps:
  - at: 0
    text: "Requests A and B are in checkout(). Each one's duplicated context already holds its headers."
  - at: 1.5
    text: "A's checkout() calls charge() on PaymentClient, the REST client for the payment provider."
  - at: 3
    text: "Before the call leaves, the client runs its ClientHeadersFactory, which reads A's context."
  - at: 5.5
    text: 'update() returns 7f3a and web as headers, and POST /charges carries them to the provider.'
  - at: 8.5
    text: "B's checkout() calls charge() while the provider is still handling A's call."
  - at: 10
    text: "The same factory runs for B's call, reads B's context, and returns c41e and kiosk."
  - at: 12.5
    text: "B's call leaves with c41e and kiosk, and A's call still carries 7f3a and web."
  - at: 16
    text: 'One factory serves both calls, but each call carries the headers of the request that made it.'
---

`checkout()` charges the order through `PaymentClient`, a REST client for the payment provider. Annotating that interface with `@RegisterClientHeaders(ContextHeadersFactory.class)` registers a `ClientHeadersFactory` for it. On every call, before the request leaves, the client calls the factory's `update` method and adds the headers it returns to the outgoing request.

`ContextHeadersFactory` reads `X-Correlation-Id` and `X-Box-Office` with `ContextLocals.get`, which returns the values the request filter stored when the request arrived. The call starts on the duplicated context of the request that makes it, and Quarkus keeps that context's locals visible to the client, so each call gets its own request's values. One `@ApplicationScoped` factory with no state serves every call: A's call carries 7f3a and web, and B's carries c41e and kiosk, even while both are in flight.

If a header only needs to pass through unchanged, `@RegisterClientHeaders` without a factory class uses the default factory. For calls made from a REST resource, it copies the headers listed in `org.eclipse.microprofile.rest.client.propagateHeaders` from the resource's request to the client's request. A factory of your own decides which headers to send and where their values come from.
