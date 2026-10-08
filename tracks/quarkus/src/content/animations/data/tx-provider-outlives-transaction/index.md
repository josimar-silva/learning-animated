---
id: tx-provider-outlives-transaction
section: data
order: 5
title: The provider outlives the transaction
description: Checkout charges the card inside a transaction with a 5-second timeout. The provider takes longer, so the transaction reaper rolls the checkout back mid-charge, and the provider's answer finds nothing left to update. Charge with no transaction open, and only the REST client's read timeout limits the call.
objective: See why a transaction timeout can roll back a checkout while the payment provider is still charging the card, and why the call belongs outside the transaction, where only the REST client's read timeout limits it.
references:
  - label: 'Quarkus transactions: configuring the transaction timeout'
    url: https://quarkus.io/guides/transaction/#configuring-the-transaction-timeout
  - label: 'Quarkus transactions: configuring the transaction reaper'
    url: https://quarkus.io/guides/transaction/#configuring-the-transaction-reaper
  - label: 'Quarkus transactions: transaction configuration'
    url: https://quarkus.io/guides/transaction/#transaction-configuration
  - label: 'Quarkus transactions: programmatic approach'
    url: https://quarkus.io/guides/transaction/#programmatic-approach
  - label: 'REST client: read timeout'
    url: https://quarkus.io/guides/rest-client/#quarkus-rest-client-config_quarkus-rest-client-read-timeout
views:
  - { id: before, label: Before }
  - { id: after, label: After }
---

Every transaction has a timeout. It is 60 seconds unless `quarkus.transaction-manager.default-transaction-timeout` says otherwise, and `@TransactionConfiguration(timeout = 5)` gives the before view's `checkout()` 5 seconds. When a transaction runs past its timeout, the transaction reaper, a background thread in the transaction manager, rolls it back. The reaper doesn't stop the thread that runs `checkout()`. That thread is still waiting on the payment provider while the rollback undoes the seat hold and frees A12 and A13.

The provider is slow, but it answers within the REST client's read timeout, so from checkout's side the call succeeds and the card is charged. By then the transaction is gone. Confirming the order fails because no transaction is active, and A gets a 500. The provider has the money, and the database has no hold, no order, and no payment for the charge to update. A longer timeout only moves the problem, and it keeps the seat rows locked for longer.

The after view keeps the call out of every transaction. A short transaction holds the seats, stores the payment as PENDING, and commits before the charge. `@Transactional(TxType.NEVER)` makes `checkout()` throw if a caller has already opened a transaction around it. With no transaction open, the reaper has nothing to roll back, and the only limit on the wait is the REST client's read timeout (`quarkus.rest-client.read-timeout`, 30 seconds by default, and each client can set its own). Unlike the reaper, that timeout ends the wait: the call throws, and checkout decides what happens next. Here the provider answers in time, and a second short transaction confirms the PENDING payment and sells the seats.
