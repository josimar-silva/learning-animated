---
id: second-consumer-group
section: ch04-kafka-consumers
order: 5
figure: 4-5
title: Adding a second consumer group
description: Consumer Group 1 reads topic T1 with one consumer per partition when Consumer Group 2 subscribes to the same topic. Group 2 splits the four partitions between its own two consumers, and from then on every message reaches both groups.
objective: See that every group gets every message in the topic, independent of the other groups, while within a group each message still goes to one consumer.
---

## What it shows

Consumer Group 1 reads topic T1 with one consumer per partition. A second
application then subscribes to the same topic in a group of its own, Consumer
Group 2, which has two consumers. Group 2 splits the four partitions between
them the way Group 1 did in Figure 4-2: partitions 0 and 2 go to its Consumer
1, and partitions 1 and 3 to its Consumer 2.

Every message now reaches both groups, one consumer in each. Group 2 gets all
of T1 no matter what Group 1 does, and Group 1 carries on as before. Add
consumers to a group to share its work, and add a group for each application
that needs every message.

## The animation

The loop opens on Group 1 alone. Group 2 appears, and its four assignments
draw in amber, where the book uses red. Group 1's arrows never move. Once
Group 2 has settled, each message leaves its partition twice at the same
moment, once for each group.

## A note on the figure

The figure labels the new group "Consumer Group 1", the same name as the
first. The text calls it G2, so this animation labels it Consumer Group 2. The
figure also draws Group 1 with four consumers rather than the five of Figure
4-4, and the animation opens on that state.
