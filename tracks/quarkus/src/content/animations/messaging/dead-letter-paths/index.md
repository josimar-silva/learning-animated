---
id: dead-letter-paths
section: messaging
order: 3
title: Three ways into the dead-letter topic
description: Three ticket orders fail in charge(). A 400 and an unreadable record go straight to ticket-orders-dlq, a 503 goes through three retry topics first, and the partition never waits for any of them.
objective: See how the delayed-retry-topic strategy routes a failed record. A nack that names the dead-letter topic skips the retries, a plain nack walks the retry topics first, and either way the consumer moves past the failed offset.
references:
  - label: 'SmallRye Reactive Messaging: failure management'
    url: https://smallrye.io/smallrye-reactive-messaging/latest/kafka/receiving-kafka-records/#failure-management
  - label: 'SmallRye Reactive Messaging: delayed retry topic'
    url: https://smallrye.io/smallrye-reactive-messaging/latest/kafka/receiving-kafka-records/#delayed-retry-topic
  - label: 'SmallRye Reactive Messaging: dead letter queue'
    url: https://smallrye.io/smallrye-reactive-messaging/latest/kafka/receiving-kafka-records/#dead-letter-queue
  - label: 'Quarkus Kafka: handling deserialization failures'
    url: https://quarkus.io/guides/kafka/#handling-deserialization-failures
steps:
  - at: 0
    text: 'charge() reads offset 41, and CardGateway answers 400 Bad Request. Retrying that charge would get the same answer.'
  - at: 3
    text: 'So charge() nacks 41 with ticket-orders-dlq as the topic. It skips the retry topics, and the consumer moves on to 42.'
  - at: 6
    text: 'Offset 42 is not valid JSON. The deserializer fails, so charge() receives a null payload instead of an order.'
  - at: 9
    text: 'charge() nacks it to ticket-orders-dlq the same way. The dead letter keeps the original bytes.'
  - at: 12
    text: 'CardGateway answers 503 for offset 43. That may not last, so charge() nacks it plainly, and it goes to the first retry topic.'
  - at: 15
    text: 'Meanwhile the consumer charges 44 and 45. After each delay, charge() reads 43 again, gets another 503, and nacks it again.'
  - at: 21.5
    text: 'After the third retry fails, 43 lands on ticket-orders-dlq too, with delayed-retry-count 3 and the 503 as its reason.'
---

`charge()` reads `ticket-orders` with `failure-strategy=delayed-retry-topic` and `dead-letter-queue.topic=ticket-orders-dlq`. When it nacks a record, the connector still commits that offset and writes the record to a retry topic, so the consumer moves on right away. The retry topics take the channel's name: by default `ticket-orders_retry_10000`, `_20000`, and `_50000`, where the number is the delay in milliseconds. After each delay, `charge()` reads the record again, and when the last retry fails, the record goes to `ticket-orders-dlq`.

A retry only helps when the failure might go away. A 400 from CardGateway will not, so `charge()` calls `nack()` with `OutgoingKafkaRecordMetadata` that names `ticket-orders-dlq` as the topic, and the record skips the retry topics. An unreadable record gets the same treatment. With `fail-on-deserialization-failure=false`, a value that does not deserialize reaches `charge()` as a `null` payload instead of marking the application unhealthy, and the dead letter keeps the original bytes.

Every record this strategy forwards carries `delayed-retry-*` headers, dead letters included. `delayed-retry-count` says how many retries ran, and `delayed-retry-reason` holds the message of the exception passed to `nack()`. The `dead-letter-*` headers come only from the `dead-letter-queue` strategy. And `delayed-retry-topic.timeout`, 120 seconds after the first failure by default, can send a record to the dead-letter topic before it has been through every retry topic.
