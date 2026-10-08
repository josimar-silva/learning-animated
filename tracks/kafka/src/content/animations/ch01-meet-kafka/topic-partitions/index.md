---
id: topic-partitions
section: ch01-meet-kafka
order: 1
figure: 1-5
title: A topic with multiple partitions
description: A topic is split into partitions. Each partition is an append-only log of offset-numbered messages, and every new write lands at the tail.
objective: See why a topic is a set of ordered, append-only partition logs rather than a single queue.
---

## What it shows

A single topic (`topicName`) split into four partitions. Each partition is an
append-only log: an ordered, immutable sequence of messages, each identified by
its **offset**. New messages are always written to the **tail** (the dashed slot
holding the next offset). The four partitions grow independently and reach
different lengths, which is exactly why order is guaranteed within a partition
but not across the whole topic.

## The animation

A warm message dot travels from the "Message Writes" bus into the tail of each
partition. As it lands, the tail slot flashes as a freshly appended cell. The
writes are staggered across partitions to show they happen in parallel.
