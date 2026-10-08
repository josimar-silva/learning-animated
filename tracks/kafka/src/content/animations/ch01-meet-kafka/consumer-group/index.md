---
id: consumer-group
section: ch01-meet-kafka
order: 2
figure: 1-6
title: A consumer group reading a topic
description: Three consumers share one group. Each partition is read by exactly one consumer, which advances its offset through the log. Consumer 1 owns two partitions.
objective: Understand how a group shares partitions so each message is processed once while reads scale out.
---

## What it shows

One consumer group with three consumers reading the same four-partition topic.
Kafka gives each partition to exactly one consumer in the group, so work is
split without two consumers ever reading the same partition. There are four
partitions and three consumers, so one consumer (Consumer 1) owns two of them.

Each consumer tracks its own **current offset**: the position it has read up to
in the partition it owns. The green outline marks that position as it advances.

## The animation

The green read marker steps forward through the offsets of each partition, and a
blue link connects each consumer to the exact offset it is reading. Consumer 1
forks to both of its partitions at once, mirroring the book's figure.
