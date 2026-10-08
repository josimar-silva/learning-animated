---
id: multi-datacenter
section: ch01-meet-kafka
order: 4
figure: 1-8
title: Multiple datacenter architecture
description: Datacenters A and B each run local producers and consumers on a local Kafka cluster. In every datacenter a MirrorMaker consumes the local clusters and produces into an aggregate cluster, and datacenter C reads a mirrored aggregate.
objective: See how MirrorMaker mirrors local clusters into aggregate clusters so consumers can read a combined, cross-datacenter view.
---

## What it shows

Three datacenters run Kafka. Datacenters A and B are local sites where
applications live; datacenter C is a read site fed by mirroring.

- **A and B**: local producers write to a **local** Kafka cluster, and local
  consumers read from it.
- A **MirrorMaker** in each datacenter consumes from **both** local clusters and
  produces into that datacenter's **aggregate** cluster, so every aggregate holds
  a complete, cross-datacenter copy.
- **C**: its MirrorMaker consumes datacenter B's aggregate and produces into a
  local aggregate cluster that two consumers read.

MirrorMaker is just a consumer plus a producer: it consumes from a source cluster
and produces the same records into a target cluster, which is how data crosses
cluster and datacenter boundaries.

## The animation

- Amber dots: producers append to the local clusters.
- Blue dots: consumers read (locally in A and B, and from the aggregate in C).
- Pink dots: MirrorMaker consumes each local cluster and produces into an
  aggregate; the crossing pair shows each aggregate collecting both A and B. The
  B aggregate is then mirrored onward into datacenter C.
