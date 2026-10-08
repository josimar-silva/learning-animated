---
id: idle-consumer
section: ch04-kafka-consumers
order: 4
figure: 4-4
title: More consumers than partitions
description: Each of four consumers owns one partition of topic T1 when a fifth joins the group. The group rebalances, but every partition already has an owner, so Consumer 5 gets none and sits idle.
objective: 'See why a group gains nothing from more consumers than partitions: the extra consumer receives no messages at all.'
---

## What it shows

Consumer Group 1 already has one consumer per partition of topic T1 when
Consumer 5 joins. The group rebalances, but within a group a partition belongs
to only one consumer, and all four are taken. Consumer 5 gets no partition, so
it receives no messages at all.

Adding more consumers to a group than the topic has partitions gains nothing.
The extra consumers sit idle.

## The animation

The loop opens on Figure 4-3's state, one partition per consumer. Consumer 5
joins and the group rebalances, but no arrow moves and nothing turns amber,
because nothing changes hands. Once the group has settled, messages flow to
Consumers 1 to 4, and Consumer 5 is labelled idle.

## A note on the caption

The book captions this figure "More consumer groups than partitions means
missed messages". The figure and the text show five consumers in one group,
and the text says the extra consumer sits idle. No message is missed, since
all four partitions are still read. This animation follows the text.
