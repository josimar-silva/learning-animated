---
id: retry-holds-the-channel
section: messaging
order: 1
title: '@Retry on @Incoming holds the channel'
description: charge() retries a failing ticket order in place. Until its last attempt fails, no other record in the channel moves, on any partition.
objective: See why @Retry on a blocking @Incoming method holds the whole channel while one record retries, and what the failure strategy does after the last attempt.
references:
  - label: 'Quarkus Kafka: retrying processing'
    url: https://quarkus.io/guides/kafka/#retrying-processing
  - label: 'Quarkus Kafka: error handling strategies'
    url: https://quarkus.io/guides/kafka/#error-handling
  - label: 'Quarkus: SmallRye Fault Tolerance'
    url: https://quarkus.io/guides/smallrye-fault-tolerance/
steps:
  - at: 0
    text: 'Record 3 from partition 0 reaches charge(). @Blocking runs the method on a worker thread.'
  - at: 2
    text: 'The payment provider is down and answers 503, so the call throws. @Retry catches it and sleeps through the delay.'
  - at: 5.5
    text: '@Retry calls again with the same record 3. Records 4 and 5 wait, partition 1 waits too, and new orders pile up.'
  - at: 10
    text: 'The fourth 503 uses up maxRetries = 3. Record 3 is nacked, and the failure strategy writes it to ticket-orders-dlq.'
  - at: 12
    text: 'Only now does the channel move. The payment provider is back, and record 4 is acked after one call.'
  - at: 14.5
    text: 'Partition 1 had no failing record, yet record 11 waited through every attempt on record 3.'
  - at: 17
    text: 'While one record retries in place, no other record in the channel moves, on any partition.'
---

`@Retry` on an `@Incoming` method retries inside the call. When `charge()` throws because `CardGateway` answers 503, SmallRye Fault Tolerance catches the exception, sleeps through the delay, and calls the method again with the same record on the same worker thread. Kafka never delivers the record a second time, and its offset stays uncommitted, because Reactive Messaging acknowledges a record only after its processing succeeds.

`@Blocking` keeps the order by default, so the channel processes one record at a time. While record 3 retries, nothing else in the channel runs: not records 4 and 5 behind it, and not partition 1, which has no failing record at all. `maxRetries` defaults to 3, so a record that keeps failing costs four calls and three delays, and the default jitter moves each delay by up to 200 ms either way. During an outage every record pays that price, and the lag grows on every partition.

After the last attempt, the exception reaches Reactive Messaging, which nacks the record and applies the channel's failure strategy. The default, `fail`, fails the application, and no more records are processed. Here the channel sets `failure-strategy=dead-letter-queue` with `dead-letter-queue.topic=ticket-orders-dlq`, so record 3 lands on the dead-letter topic, its offset is committed, and record 4 finally gets its turn.
