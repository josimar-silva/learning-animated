---
id: wire-format
section: ch03-kafka-producers
order: 4
figure: null
title: The Avro wire format and the schema cache
description: The serializer writes a magic byte, a four byte schema ID, and the Avro payload. The first record costs a registry call on each side. The second finds both caches warm and reaches the consumer without the registry being asked at all.
objective: See what the five bytes in front of every Avro record buy, and why the registry is asked once per schema rather than once per message.
---

An authoral animation for **Chapter 3**, not a figure from the book. It animates
what the Confluent Avro serializer actually puts on the wire, described in
"Using Avro Records with Kafka".

## What it shows

Figure 3-2 says a message travels with a schema ID. This is that message, opened
up:

| Field   | Width   | What it is                                |
| ------- | ------- | ----------------------------------------- |
| `0x00`  | 1 byte  | the magic byte, the format version        |
| id      | 4 bytes | the registry's ID for the writer's schema |
| payload | varies  | the Avro-encoded record                   |

Five bytes in front of every record, whatever the schema costs.

## The animation

Two beats, one record each.

The first record finds both caches cold. The serializer asks the registry for
the ID of its schema, and once the record reaches the far side, the
deserializer asks the registry for the schema that ID stands for. Two calls,
one on each side.

The second record finds both caches warm. Nothing changes on the wire, the
frame is byte for byte the same, but the registry is never asked. The record
goes producer to broker to consumer and decodes.

That is the whole economy of the thing. A schema is fetched once per ID and
then remembered, so the cost is paid per schema rather than per message. A topic
doing a million records a second with one schema makes one registry call, not a
million.

Watch the colour of the ID field. It is the registry's colour, riding inside
every message: a four byte pointer to something that lives somewhere else.
