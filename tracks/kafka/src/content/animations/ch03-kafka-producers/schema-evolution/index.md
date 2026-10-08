---
id: schema-evolution
section: ch03-kafka-producers
order: 5
figure: null
title: Avro schema evolution through the registry
description: 'Schema v2 drops faxNumber and adds email, both with defaults. A v1 record read with v2, and a v2 record read with v1, both decode: the registry supplies the writer schema, the reader fills what is missing from its defaults, and drops the field it does not know.'
objective: See why a reader and a writer never have to agree on a schema version, as long as the change keeps its defaults.
---

An authoral animation for **Chapter 3**, not a figure from the book. It animates
the customer schema example from "Using Avro Records with Kafka".

## What it shows

Two versions of one schema:

| Version | Fields                    |
| ------- | ------------------------- |
| v1      | `id`, `name`, `faxNumber` |
| v2      | `id`, `name`, `email`     |

v2 drops `faxNumber` and adds `email`. Both carry a default, and that is the
detail the whole thing turns on.

## The animation

Two lanes, running together so the symmetry is visible at once.

The top lane writes a record with v1 and reads it with v2. The bottom lane
writes with v2 and reads with v1. In both, the reader asks the registry for the
schema the record was actually written with, then reconciles it against its own.

The four resolved fields tell the story:

- `id` and `name` are in both schemas, so they come straight from the record.
- The field the reader knows and the writer never wrote comes from its default.
- The field the writer wrote and the reader does not know is dropped.

Neither lane fails. That is the point, and it is why nothing here is painted in
the failure colour.

A reader and a writer never have to agree on a version. They only have to agree
on the rules: keep the defaults, and the registry can hand either side whatever
schema it needs to make sense of the other.
