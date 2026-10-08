---
id: tx-ambiguous-timeout
section: data
order: 4
title: A timeout is not a failure
description: Checkout calls the payment provider, and the read times out. If checkout rolls back as though the charge failed, it loses a charge the provider makes anyway. If it records the payment as UNKNOWN, a status query by idempotency key settles it later.
objective: See why a read timeout leaves the outcome of a charge unknown, and how to record it as UNKNOWN and settle it with a status query by idempotency key.
references:
  - label: 'Quarkus transactions: declarative approach'
    url: https://quarkus.io/guides/transaction/#declarative-approach
  - label: 'Quarkus transactions: programmatic approach'
    url: https://quarkus.io/guides/transaction/#programmatic-approach
  - label: 'REST client: read timeout'
    url: https://quarkus.io/guides/rest-client/#quarkus-rest-client-config_quarkus-rest-client-read-timeout
  - label: 'Quarkus scheduler: creating a scheduled job'
    url: https://quarkus.io/guides/scheduler/#standard-scheduling
views:
  - { id: before, label: Before }
  - { id: after, label: After }
---

A read timeout means checkout stopped waiting for the payment provider. The provider may still be working on the charge. The REST client stops waiting after `quarkus.rest-client.read-timeout` milliseconds (30 seconds by default, and each client can set its own), but the request has already left, and nothing stops the provider from finishing it. In the before view, the timeout reaches `checkout()` as a runtime exception, and a runtime exception that leaves a `@Transactional` method rolls its transaction back. The rollback undoes the seat hold, and the buyer gets a 500. Then the provider charges the card, and nothing in the database records the charge.

The after view gives the charge three outcomes: charged, declined, and unknown. The hold commits first in a transaction of its own, so the timeout can't undo it. When the read times out, `payments.charge(order)` returns `UNKNOWN` instead of throwing, a second short transaction records the payment as unknown, and the buyer gets `202 Accepted` while the seats stay held.

The charge carries the order's idempotency key. After a timeout, that key is the only handle checkout has, because the charge id the provider assigned was in the reply that never arrived. A reconciliation job, a `@Scheduled` method, picks up UNKNOWN payments and asks the provider for the status of the charge under that key. Here the provider reports the card as charged, so the job confirms the order and sells the seats. Had the provider found no charge under that key, the job would have released the seats.
