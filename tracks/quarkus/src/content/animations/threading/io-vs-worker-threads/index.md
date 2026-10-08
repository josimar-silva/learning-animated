---
id: io-vs-worker-threads
section: threading
order: 1
title: I/O thread vs worker thread
description: Two requests wait on the same database. One holds no thread while it waits; the other parks a worker for the whole call.
objective: See why an endpoint that returns Uni runs on the event loop and frees it while waiting, and why blocking code gets a worker.
references:
  - label: 'Quarkus REST: execution model, blocking, non-blocking'
    url: https://quarkus.io/guides/rest/#execution-model-blocking-non-blocking
  - label: 'Quarkus reactive architecture: the reactive execution model'
    url: https://quarkus.io/guides/quarkus-reactive-architecture/#reactive-execution-model
  - label: 'Vert.x reference: event loop pool size'
    url: https://quarkus.io/guides/vertx-reference/#quarkus-vertx_quarkus-vertx-event-loops-pool-size
  - label: Duplicated context
    url: https://quarkus.io/guides/duplicated-context/
steps:
  - {
      at: 0,
      text: 'A calls availableSeats(), which returns Uni<…>, so Quarkus runs it on the I/O thread.',
    }
  - {
      at: 1.9,
      text: 'B calls salesReport(), which returns a plain object, so the I/O thread hands it to a worker.',
    }
  - {
      at: 3.4,
      text: "Both now wait on PostgreSQL. A's query holds no thread; B's JDBC call parks executor-thread-1.",
    }
  - { at: 4.5, text: 'While both wait, the I/O thread is free and keeps serving other requests.' }
  - {
      at: 6.9,
      text: "A's rows arrive. Its continuation runs on the same event loop, which writes the response.",
    }
  - {
      at: 8.1,
      text: "B's JDBC call returns. The worker finishes salesReport(); the I/O thread writes the bytes.",
    }
  - {
      at: 10.3,
      text: "Same database latency for A and B. A's wait held no thread; B's wait held a worker the whole time.",
    }
---

Quarkus serves HTTP on a few event-loop threads, named `vert.x-eventloop-thread-N`: by default one per CPU core, and at least two. An endpoint that returns `Uni`, `Multi`, or `CompletionStage` runs on one of them, and while it waits on the database that thread goes back to serving other requests.

An endpoint that returns a plain type runs on a worker thread (`executor-thread-N`), because Quarkus assumes it may block. A JDBC call parks that worker until the database answers. The pool grows to max(200, 8 × cores) by default, so blocking there is expected, but every wait costs a thread. Block an event-loop thread instead and every request on that loop stalls; Vert.x warns after 2 seconds.
