---
id: simple-cluster
section: ch02-installing-kafka
order: 1
figure: 2-2
title: A simple Kafka cluster
description: 'A three-broker cluster hosts one partition each: topic A partition 0 on broker 1, topic A partition 1 on broker 2, and topic B partition 0 on broker 3. One producer writes both topic A partitions, another writes topic B, and a single consumer reads every partition.'
objective: See how a cluster spreads a topic across brokers so producers and consumers fan out over independent partitions.
---

## What it shows

A single Kafka cluster made of three brokers, each hosting one partition:

- Broker 1: topic A, partition 0.
- Broker 2: topic A, partition 1.
- Broker 3: topic B, partition 0.

Topic A is spread across two brokers, so one topic is served by more than one
broker. Producers and consumers connect to the whole cluster, not to a single
machine:

- The top producer writes topic A, so its messages fan out to partition 0 on
  broker 1 and partition 1 on broker 2.
- The bottom producer writes topic B, which lands on broker 3.
- One consumer reads every partition, pulling from all three brokers.

## The animation

- Amber dots: producers write into the partition that owns each message.
- Blue dots: the consumer reads each partition back out of its broker.

The staggered timing keeps the three produce and three consume paths readable as
independent streams rather than one synchronized pulse.
