---
id: avro-serialization
section: ch03-kafka-producers
order: 3
figure: 3-2
title: Serialization and deserialization of Avro records
description: The producer sends the current version of its schema to the Schema Registry, then writes a message carrying only a schema ID through the broker. The consumer reads the ID and asks the registry for the matching schema before it can deserialize.
objective: See why an Avro message travelling through Kafka carries a schema ID instead of the schema itself.
---

Animates **Figure 3-2** from Chapter 3, "Kafka Producers: Writing Messages to
Kafka".

## What it shows

Four actors and the four arrows that connect them:

- The **Producer** holds a **Serializer** and the **Consumer** holds a
  **Deserializer**, exactly as the book draws them.
- The **Kafka Broker** sits on the path between the two.
- The **Schema Registry** sits below, off the Kafka path entirely.

## The animation

One loop, four beats, in the order the parts actually happen:

1. The producer sends the current version of its schema to the registry.
2. The serializer writes a message carrying a schema ID to the broker.
3. The broker hands the message to the consumer.
4. The consumer reads the ID and asks the registry for the matching schema, and
   the deserializer decodes the record.

Watch what travels on each arrow. The schema only ever moves between an actor
and the registry. Everything on the Kafka path carries `id 1`, never the schema.

That split is the figure's whole argument. The schema is written down once, in
one place, and every message after that refers to it by a number. A schema can
be large, a message is often small, and paying for the schema on every single
record would cost more than the record itself.

The deeper mechanics get their own animations: the bytes on the wire and the
caching in `wire-format`, and what happens when the schema changes in
`schema-evolution`.
