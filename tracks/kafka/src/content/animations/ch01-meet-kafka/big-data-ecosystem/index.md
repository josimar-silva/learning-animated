---
id: big-data-ecosystem
section: ch01-meet-kafka
order: 5
figure: 1-9
title: A big data ecosystem
description: Kafka sits at the centre as a shared backbone. Metrics, logs, transaction data, and IoT data produce into Kafka, while online applications, stream processing, and offline processing both read from and write back to it.
objective: See how Kafka decouples many producers from many consumers so every system integrates through one shared data pipeline.
---

Animates Figure 1-9 from _Kafka: The Definitive Guide_ (2nd edition).

Kafka sits at the centre as a shared data backbone. Four data sources produce
into it:

- Metrics
- Logs
- Transaction Data
- IoT Data

Three families of systems both read from and write back to Kafka, so the
exchange arrows point both ways:

- Online Applications (Apache Solr, OpenTSDB)
- Stream Processing (Samza, Spark, Storm, Flink)
- Offline Processing (Hadoop)

The point: rather than wiring every source to every destination, each system
integrates once with Kafka. Producers and consumers stay decoupled, and the
single pipeline scales to many independent systems.
