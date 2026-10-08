---
id: tx-retry-calls-again
section: data
order: 2
title: A retry calls the provider again
description: Checkout charges the card, then fails to confirm the order, so its transaction rolls back. When the caller retries, the provider charges the card a second time. With the order's id as an idempotency key, the retry gets the first charge back instead.
objective: See why a rollback can't undo a call to the payment provider, and how an idempotency key lets the provider answer a retry with the charge it already made.
references:
  - label: 'Quarkus transactions: declarative approach'
    url: https://quarkus.io/guides/transaction/#declarative-approach
  - label: 'Quarkus transactions: programmatic approach'
    url: https://quarkus.io/guides/transaction/#programmatic-approach
  - label: 'RFC 9110, HTTP semantics: idempotent methods'
    url: https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods
  - label: 'IETF draft: the Idempotency-Key HTTP header field'
    url: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07#section-2.6
views:
  - { id: before, label: Before }
  - { id: after, label: After }
---

`@Transactional` on `checkout()` opens a transaction when the method starts, and a `RuntimeException` that leaves the method rolls it back. In the before view, `orders.confirm()` throws after the payment provider has charged the card. The rollback undoes the seat hold, so A12 and A13 are free again, but it can't undo the charge. The transaction covers only the database: Quarkus doesn't support distributed transactions, so the HTTP call to the provider was never part of it. The programmatic API, `QuarkusTransaction`, has the same limit, and by default it rolls back on any exception.

The caller gets a 500 and sends the same order again, so `checkout()` runs from the top: it holds the seats and calls `payments.charge(order)` a second time. To the provider that's a new `POST /charges`, and POST isn't idempotent, so it charges the card again. The retry commits and A gets 200 OK. The card has been charged twice, and the database has no record of the first charge, because its transaction rolled back.

In the after view, the REST client method takes the key as a `@HeaderParam("Idempotency-Key")` parameter, so `payments.charge(order.id(), order)` sends the order's id in that header. The provider stores the key with the result of the first charge, and when the same key comes back it returns that result instead of charging again. The key has to come from the order: a fresh UUID on each call would look like a new charge every time.
