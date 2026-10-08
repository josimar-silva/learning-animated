---
id: producer-components
section: ch03-kafka-producers
order: 1
figure: 3-1
title: Kafka producer components
description: A ProducerRecord carries a topic, an optional partition and key, and a value. send() hands it to the serializer, then the partitioner picks a partition, and the record waits in a per-partition batch until the client dispatches it to a broker.
objective: Follow one record through the producer, and see what happens when the broker accepts it, when the error is retriable, and when it is not.
---

## What it shows

A ProducerRecord is built from a topic, an optional partition, an optional key,
and a value. Calling `send()` hands it to the producer client, drawn as the
dashed boundary:

- The serializer turns the key and the value into byte arrays.
- The partitioner picks a partition, using the key when there is one.
- The record joins a batch for that exact topic and partition.
- A background thread sends whole batches to the broker.

## The animation

The loop runs the same journey three times, once per outcome:

1. **Success.** The broker accepts the batch and metadata returns to the caller.
2. **Retriable error.** `Fail?` is yes and `Retry?` is yes, so the batch goes
   round again. This is how a producer rides out a leader election.
3. **Non-retriable error.** `Fail?` is yes and `Retry?` is no, so an exception is
   thrown back to the caller.

Amber dots carry the record, green marks the metadata that comes back, and red
marks a failure.
