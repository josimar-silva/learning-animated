---
id: two-consumers
section: ch04-kafka-consumers
order: 2
figure: 4-2
title: Four partitions split between two consumers
description: Consumer 1 owns all four partitions of topic T1 until Consumer 2 joins the group. The group rebalances, partitions 1 and 3 move to Consumer 2, and from then on each consumer reads two partitions.
objective: See how adding a consumer splits the partitions between the members of a group, while each message still goes to exactly one of them.
---

## What it shows

Consumer 2 joins Consumer Group 1, where Consumer 1 already reads all four
partitions of topic T1. The group rebalances: partitions 0 and 2 stay with
Consumer 1, and partitions 1 and 3 move to Consumer 2. Each consumer now gets
the messages from two partitions, and no message goes to both.

Adding consumers to a group is the main way to scale how fast it reads a topic.

## The animation

The loop opens on Figure 4-1's state, with Consumer 1 owning every partition.
Consumer 2 joins, and the arrows for partitions 1 and 3 switch to it, amber
while they are new. Partitions 0 and 2 never move. Messages start to flow once
the group has settled.

## A note on the caption

The book captions this figure "Four partitions split to two consumer groups".
The figure and the text both show two consumers in one group, so this
animation follows them.
