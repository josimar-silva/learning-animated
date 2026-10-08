---
id: partition-replication
section: ch01-meet-kafka
order: 3
figure: 1-7
title: Replicating partitions across brokers
description: Topic A has two partitions replicated across two brokers. The producer writes to each partition leader, replication keeps the follower in sync, and the consumer reads from the leaders.
objective: Trace how leaders, followers, and replication give Kafka durability without blocking producers or consumers.
---

## What it shows

Topic A has two partitions, and both are replicated across a two-broker cluster.
Every partition has one **leader** replica and one or more **follower** replicas
on other brokers:

- Partition 0: leader on Broker 1, follower on Broker 2.
- Partition 1: leader on Broker 2, follower on Broker 1.

Producers and consumers always talk to the **leader** of a partition. Followers
exist for durability: they copy the leader so that if a broker fails, a follower
can take over without data loss.

## The animation

- Amber dots: the producer writes each partition to its leader.
- Pink dots: replication copies the leader to the follower on the other broker
  (A/0 downward, A/1 upward).
- Blue dots: the consumer reads each partition from its leader.
