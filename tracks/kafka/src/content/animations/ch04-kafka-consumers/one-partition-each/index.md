---
id: one-partition-each
section: ch04-kafka-consumers
order: 3
figure: 4-3
title: Four consumers, one partition each
description: Two consumers share topic T1 until Consumers 3 and 4 join. The group rebalances, partition 2 moves to Consumer 3 and partition 3 to Consumer 4, and each of the four consumers ends up reading a single partition.
objective: See that once a group has as many consumers as the topic has partitions, each consumer reads exactly one, the furthest the group can spread the work.
---

## What it shows

Consumer Group 1 grows from two consumers to four. The group rebalances again:
partition 2 moves from Consumer 1 to Consumer 3, and partition 3 moves from
Consumer 2 to Consumer 4. Each consumer now reads exactly one partition.

With as many consumers as partitions, the group has spread the work as far as
it can. The partition count sets that limit, which is why the book recommends
creating topics with a large number of partitions: it leaves room to add
consumers when the load grows.

## The animation

The loop opens on Figure 4-2's state. Consumers 3 and 4 join together, and the
arrows for partitions 2 and 3 switch to them, amber while they are new.
Partitions 0 and 1 stay with Consumers 1 and 2. Once the group has settled,
messages flow in four separate streams, one per consumer.

## A note on the caption

The book captions this figure "Four consumer groups to one partition each".
The figure and the text both show four consumers in one group, so this
animation follows them.
