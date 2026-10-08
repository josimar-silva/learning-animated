---
id: share-group
section: ch04-kafka-consumers
order: 6
figure: null
title: 'Share groups: consumers sharing a partition'
description: 'Three consumers read a topic with one partition. A consumer group gives the partition to one of them and leaves the other two idle. A share group gives it to all three: the broker locks each record to one consumer until it is acknowledged, and a record whose lock runs out goes to another consumer.'
objective: See how a share group (KIP-932) lets consumers outnumber partitions by tracking every record instead of one position per partition.
---

An authoral animation for **Chapter 4**, not a figure from the book. It animates
share groups from
[KIP-932: Queues for Kafka](https://cwiki.apache.org/confluence/display/KAFKA/KIP-932%3A+Queues+for+Kafka),
which came after the second edition. Share groups shipped as early access in
Apache Kafka 4.0 and have been production ready since 4.2.

## What it shows

Figure 4-4 shows the limit of a consumer group: each partition goes to exactly
one consumer, so consumers beyond the partition count sit idle. A share group
removes that limit. It can assign one partition to several consumers, because
the broker hands out records instead of whole partitions:

- Handing out a record acquires it, which locks it to that consumer for 30
  seconds by default.
- Each consumer acknowledges its records one by one, in any order.
- When a lock runs out, the record becomes available again, and its next
  delivery counts as the second.

The share group still keeps a start offset. Every record before it is
finished, and it cannot move past a record that is still in flight.

## The animation

The loop has five beats:

1. A consumer group reads a topic with one partition. Consumer 1 owns it, and
   Consumers 2 and 3 sit idle.
2. A share group takes over, and all three consumers get partition 0.
3. The broker hands out offsets 0 to 2, one per consumer. Consumer 3 finishes
   first, so offset 2 is acknowledged before offset 0, and the start offset
   moves up behind them.
4. Consumer 2 stalls on offset 4. The others finish offsets 3 and 5, but the
   start offset stops at 4.
5. The lock on offset 4 runs out. The record is available again, Consumer 3
   gets it as its second delivery, and the start offset jumps to 6.

The log itself never changes. The row beneath it is the share group's view of
each record, which the broker keeps alongside the partition.

## What it leaves out

- The broker hands out records in batches, not one at a time.
- A consumer can also release a record for another delivery, reject it
  outright, or renew its lock while it works.
- A record that keeps failing is archived once it reaches the delivery limit,
  five deliveries by default.
- A consumer that crashes drops its connection, and the broker can free its
  records without waiting for the lock. The lock covers what the broker cannot
  see: a consumer that stays connected but stops making progress.
