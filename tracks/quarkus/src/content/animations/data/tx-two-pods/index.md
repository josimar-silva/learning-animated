---
id: tx-two-pods
section: data
order: 7
title: Two pods take the same order
description: The buyer's app sends the same checkout twice, and the two copies land on different pods. If each pod reads the order's status before it charges, both read PENDING and both charge the card. Claim the order with a conditional UPDATE, and only one pod charges.
objective: See why reading a status and then acting on it lets two pods charge the same order, and how a conditional UPDATE lets only one of them claim it.
references:
  - label: 'Quarkus transactions: declarative approach'
    url: https://quarkus.io/guides/transaction/#declarative-approach
  - label: 'PostgreSQL: Read Committed isolation level'
    url: https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED
views:
  - { id: before, label: Before }
  - { id: after, label: After }
---

A buyer taps Pay twice, or the app retries after a dropped connection, and the same checkout for order 42 arrives twice. The load balancer sends one copy to pod 1 and the other to pod 2. In the before view, `orders.requirePending(order)` reads the order's status and lets checkout go on if it says PENDING. A plain `SELECT` takes no lock, and neither pod writes anything until its charge is done, so both pods read PENDING and both call the payment provider. The card is charged twice. Each pod then marks the order PAID in a short transaction of its own, and both copies get 200 OK.

In the after view, one statement does the check and the write. `orders.claim(order)` is a `@Transactional` method that runs `UPDATE orders SET status = 'CHARGING' WHERE id = :id AND status = 'PENDING'` and throws if the update changed no row. A's UPDATE locks the row and commits when `claim()` returns, before the charge starts. B's UPDATE reaches the row while A's transaction is still open, so PostgreSQL makes it wait for A's lock. Once A commits, PostgreSQL checks B's `WHERE` clause again against the row A committed, finds CHARGING, and B's UPDATE changes nothing. The exception rolls B's transaction back, an exception mapper turns it into 409 Conflict, and pod 2 never calls the provider.

Moving the write closer to the read only narrows the gap, because two pods can still both read PENDING before either one writes. The conditional UPDATE reads and writes in one step, so no gap is left. An idempotency key on the charge would also stop the provider from charging twice, but both pods would still run the whole checkout. The claim stops pod 2 before it calls anyone.
