---
id: tx-remote-call-inside
section: data
order: 1
title: A remote call inside the transaction
description: Checkout holds two seats, charges the card, then confirms the order. With one transaction around all of it, the seat rows stay locked while the payment provider works. Commit the hold first, and no row stays locked during the charge.
objective: See why a transaction shouldn't stay open across a remote call, and how to commit the seat hold before the charge and record the result in a second short transaction.
references:
  - label: 'Quarkus transactions: declarative approach'
    url: https://quarkus.io/guides/transaction/#declarative-approach
  - label: 'Quarkus transactions: programmatic approach'
    url: https://quarkus.io/guides/transaction/#programmatic-approach
  - label: 'PostgreSQL: row-level locks'
    url: https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS
views:
  - { id: before, label: Before }
  - { id: after, label: After }
---

`@Transactional` on `checkout()` opens a transaction when the method starts and commits it when the method returns, so everything in between runs inside it, the call to the payment provider included. Holding the seats is an `UPDATE`, and PostgreSQL keeps the row locks an `UPDATE` takes until the transaction ends. In the before view, A12 and A13 stay locked for as long as the provider takes to charge the card. Checkout B wants the same seats, so its `UPDATE` waits on those locks through the whole charge, then fails with a 409.

The transaction can't undo the charge either. It covers only the database: Quarkus doesn't support distributed transactions, so the HTTP call to the provider can't join it. In the after view, each database step gets a transaction of its own. `QuarkusTransaction.requiringNew().run(...)` commits the hold at once, which stores the seats as held and releases their locks. The charge runs with no transaction open, and a second short transaction records it and sells the seats. `@Transactional(TxType.NEVER)` makes `checkout()` throw if a caller has already opened a transaction, since that transaction would span the charge again.

A waits just as long in both views. B doesn't: it reads the committed hold and gets its 409 at once. Because the hold is now committed data rather than a lock, nothing undoes it on its own, so a failed charge has to release the seats in a transaction of its own.
