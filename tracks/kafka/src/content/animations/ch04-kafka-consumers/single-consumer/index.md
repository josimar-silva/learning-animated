---
id: single-consumer
section: ch04-kafka-consumers
order: 1
figure: 4-1
title: A consumer group with a single consumer
description: Topic T1 has four partitions and Consumer Group 1 starts empty. Consumer 1 joins, the group assigns it all four partitions, and every message in the topic goes to that one consumer.
objective: See that a consumer alone in its group owns every partition, so it has to keep up with the whole topic by itself.
---

## What it shows

Topic T1 has four partitions. Consumer 1 is the only member of Consumer Group 1,
so when it subscribes to T1 the group gives it all four partitions. Every
message in the topic goes to that one consumer.

## The animation

The loop opens on the group before anyone has joined it. Consumer 1 joins, and
an arrow draws in from each partition, amber while the assignment is new. Once
the group settles, messages flow from all four partitions into the same
consumer.

No message moves before the group has settled. What a live group does while
partitions change hands is its rebalance protocol, which Figures 4-6 and 4-7
cover.

A lone consumer keeps up only while it can process messages as fast as
producers write them. The next figures add consumers to the group.
