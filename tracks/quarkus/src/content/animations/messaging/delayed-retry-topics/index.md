---
id: delayed-retry-topics
section: messaging
order: 2
title: Delayed retry topics keep the partition moving
description: Record 3 fails and waits in a retry topic while records 4 and 5 go through. When the retry topics run out, it lands on ticket-orders-dlq.
objective: See how failure-strategy=delayed-retry-topic retries a failed record later without holding up the records behind it, and where that record goes when every retry fails.
references:
  - label: 'SmallRye Reactive Messaging: delayed retry topic'
    url: https://smallrye.io/smallrye-reactive-messaging/latest/kafka/receiving-kafka-records/#delayed-retry-topic
  - label: 'SmallRye Reactive Messaging: dead letter queue'
    url: https://smallrye.io/smallrye-reactive-messaging/latest/kafka/receiving-kafka-records/#dead-letter-queue
steps:
  - at: 0
    text: 'Record 3 fails: the payment provider answers 503, charge() throws, and the record is nacked.'
  - at: 3
    text: 'The failure strategy copies record 3 to ticket-orders_retry_5000 and commits its offset anyway.'
  - at: 6
    text: "Records 4 and 5 don't wait: both are charged and acked during record 3's 5 s delay."
  - at: 11.5
    text: 'After 5 s, the retry-topic consumer delivers record 3 to charge() again. It fails and moves to ticket-orders_retry_30000.'
  - at: 18
    text: 'After 30 s, the third attempt fails too. No retry topic is left, so record 3 lands on ticket-orders-dlq.'
---

With `failure-strategy=delayed-retry-topic`, a nacked record doesn't hold up its partition. The Kafka connector writes it to the first retry topic and commits its offset anyway, so the next record goes through without waiting for it. The strategy also runs a consumer of its own on the retry topics. That consumer waits until a record's delay has passed, then hands the record back to the same `@Incoming` method.

Each retry topic name ends with its delay in milliseconds, so `ticket-orders_retry_5000` holds a record back for 5 seconds. A record that fails again moves to the next topic in `delayed-retry-topic.topics`, carrying headers such as `delayed-retry-count` and `delayed-retry-offset`. When its last retry fails, it goes to the topic that `dead-letter-queue.topic` names, here `ticket-orders-dlq`. Without that property, the strategy gives up on the record. It also stops early, and sends the record to the dead-letter topic if there is one, when the next retry would come more than `delayed-retry-topic.timeout` (120 seconds by default) after the first failure.

The price is ordering: record 3 is handled after records 4 and 5, so this strategy suits records that don't depend on each other. Retrying in place with SmallRye Fault Tolerance keeps the order, but every record behind the failed one waits until the retries end. The strategy doesn't create its topics either, so create the retry topics and the dead-letter topic with as many partitions as `ticket-orders`.
