---
id: tx-failure-after-accept
section: data
order: 3
title: The provider accepted, then the commit failed
description: Checkout charges the card inside its transaction, and then the commit fails. The rollback frees the seats but can't undo the charge. Commit a PENDING payment before the charge, and the failure leaves a record that reconciliation settles.
objective: See why a rollback can't undo what a remote service has already done, and how a PENDING payment committed before the charge lets reconciliation finish the order.
references:
  - label: 'Quarkus transactions: declarative approach'
    url: https://quarkus.io/guides/transaction/#declarative-approach
  - label: 'Quarkus transactions: programmatic approach'
    url: https://quarkus.io/guides/transaction/#programmatic-approach
  - label: 'Quarkus scheduler: creating a scheduled job'
    url: https://quarkus.io/guides/scheduler/#standard-scheduling
views:
  - { id: before, label: Before }
  - { id: after, label: After }
---

In the before view, `checkout()` is one `@Transactional` method. It holds A12 and A13, has the payment provider charge the card, and confirms the order, all in one transaction. The charge goes through, and then the commit fails. Commits do fail: the database connection can drop, or a write that Hibernate held back until the commit can break a constraint. The rollback undoes the hold and the order, so the seats are free again. It can't undo the charge, because Quarkus doesn't support distributed transactions and the provider was never part of this one. A gets a 500 and no tickets, the card stays charged, and nothing in the database records the charge.

The after view writes to the database before any money moves. `QuarkusTransaction.requiringNew().run(...)` commits a short transaction that holds the seats and stores the payment as PENDING. The charge runs with no transaction open, and a second short transaction confirms the order. When that commit fails, only the second transaction rolls back, so the seats stay held and the payment stays PENDING. A still gets a 500, but the database now shows that a charge may exist.

A reconciliation job, a `@Scheduled` method, looks for payments left in PENDING and asks the provider about each one. It asks by the order id, which checkout stored in the PENDING row and sent with the charge. A reference returned by the provider would have been lost with the failed commit. The provider answers that the card was charged, so the job confirms the order in a transaction of its own, sells the seats to A, and emails the tickets. Had the provider found no charge, the job would release the seats instead.
