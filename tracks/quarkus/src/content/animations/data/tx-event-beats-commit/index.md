---
id: tx-event-beats-commit
section: data
order: 6
title: The event arrives before the commit
description: Checkout issues the tickets and announces them on Kafka inside one transaction. The mailer reads the event before the commit and finds no tickets. Write the event to an outbox row instead, and a relay sends it only after the commit.
objective: See why an event sent inside a transaction can reach its consumer before the data it announces is committed, and how an outbox row and a relay send it only after the commit.
references:
  - label: 'Quarkus transactions: declarative approach'
    url: https://quarkus.io/guides/transaction/#declarative-approach
  - label: 'Quarkus Kafka: writing entities managed by Hibernate to Kafka'
    url: https://quarkus.io/guides/kafka/#writing-entities-managed-by-hibernate-to-kafka
  - label: 'Quarkus scheduler: creating a scheduled job'
    url: https://quarkus.io/guides/scheduler/#standard-scheduling
views:
  - { id: before, label: Before }
  - { id: after, label: After }
---

In the before view, `confirm()` is one `@Transactional` method. It issues A's tickets, then sends `TicketsIssued` to the `tickets-issued` topic with `sendAndAwait()`, the way the Quarkus Kafka guide sends an entity it has just persisted. The send returns once Kafka has the record, but the transaction commits only after `confirm()` returns. The mailer reads the event in that gap and looks up A's tickets. Other transactions see only committed rows, so it finds none and has nothing to email. The gap is short, but a consumer can still win the race. Chaining a Kafka transaction to the method doesn't close it either, because the Kafka transaction completes inside the method, before the database commits.

In the after view, `confirm()` writes the event to an outbox table instead of sending it. The outbox row commits with the tickets, so both exist or neither does. A relay, a `@Scheduled` method that runs every two seconds, reads the unsent outbox rows, sends each one, and then marks it sent. Its poll at 6 s runs while A's commit is still going and finds nothing, because the row isn't committed yet. The next poll finds it. By the time the mailer gets the event, the tickets are committed, so it finds them and emails them.

The event now leaves up to one polling interval after the commit. The relay can also send a row twice, for example when it stops after the send and before it marks the row, so the mailer has to recognize an event it has already handled.
