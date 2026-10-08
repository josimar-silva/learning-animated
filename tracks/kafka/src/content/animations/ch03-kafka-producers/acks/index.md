---
id: acks
section: ch03-kafka-producers
order: 2
figure: null
title: What acks buys you
description: The same write under acks=0, acks=1, and acks=all. The producer returns at once, after the leader confirms, or after every in-sync replica confirms. Then the leader crashes, and only the acks=all record is still there.
objective: 'See the trade the acks setting makes: waiting costs latency, and not waiting costs a guarantee.'
---

An authoral animation for **Chapter 3**, not a figure from the book. It animates
the `acks` producer setting described in "Kafka Producers: Writing Messages to
Kafka".

## What it shows

Three lanes run the same write at the same time, one per setting:

- `acks=0`: the producer does not wait for a reply. Fastest, and a failed write
  is invisible to it.
- `acks=1`: the leader replies as soon as it has the record. The producer learns
  about immediate errors and can retry them.
- `acks=all`: every in-sync replica must have the record before the reply. The
  safest setting, and the slowest.

## The animation

The loop has two beats. First the write and the acknowledgement, with a bar per
lane showing how long the producer waited. Then the leader crashes in all three
lanes at once.

Only `acks=all` finished replicating before the crash, so only its record
survives on the followers. The other two lanes lose it: `acks=0` without ever
raising an error, `acks=1` after telling the producer the write had succeeded.

Replication runs at the same speed in all three lanes; `acks` never changes how
fast a follower replicates. What differs is whether the producer waited for it:
the crash is timed to land while replication is still in flight, which is the
window `acks=1` leaves open and `acks=all` closes.

That is the trade in one frame: waiting costs latency, and not waiting costs a
guarantee.
