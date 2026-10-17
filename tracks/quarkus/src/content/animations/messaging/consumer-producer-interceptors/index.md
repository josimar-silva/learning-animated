---
id: consumer-producer-interceptors
section: messaging
order: 4
title: Consumer and producer interceptors
description: An IncomingInterceptor gets each ticket order before charge() does, then hears whether it was acked or nacked. An OutgoingInterceptor gets each order before it is sent, then hears back once the broker has written it.
objective: See when each interceptor callback runs around a Kafka message, and why onMessageAck and onMessageNack wait for the connector to finish.
references:
  - label: 'SmallRye Reactive Messaging: intercepting incoming and outgoing messages'
    url: https://smallrye.io/smallrye-reactive-messaging/latest/concepts/decorators/#intercepting-incoming-and-outgoing-messages
  - label: 'SmallRye Reactive Messaging: failure management'
    url: https://smallrye.io/smallrye-reactive-messaging/latest/kafka/receiving-kafka-records/#failure-management
views:
  - { id: consumer, label: Consumer }
  - { id: producer, label: Producer }
---

An interceptor adds behavior to every message on one channel without touching the code that sends or consumes it. Implement `IncomingInterceptor` or `OutgoingInterceptor`, qualify the bean with `@Identifier("ticket-orders")`, and SmallRye Reactive Messaging calls it around each message on that connector channel. Only one interceptor binds to a channel. The one in this lesson logs each callback.

On the consumer side, `afterMessageReceive` gets each message before `charge()` does, and `charge()` receives whatever message `afterMessageReceive` returns. When `charge()` returns, the message is acked, and `onMessageAck` runs once the connector has finished with that ack. When `charge()` throws, the message is nacked, and `onMessageNack` gets the exception after the failure strategy is done with the record: here, after offset 45 is on `ticket-orders-dlq`. Under the default strategy, `fail`, the nack itself fails and the channel stops consuming, so `onMessageNack` never runs.

On the producer side, `beforeMessageSend` runs before the connector sends the record, so it can still change it. This one adds an `X-Correlation-Id` header. `onMessageAck` waits until the broker has confirmed the write, and by then the message's `OutgoingMessageMetadata` holds the broker's answer: the partition and the offset of the record. If the send fails, `onMessageNack` runs instead.
