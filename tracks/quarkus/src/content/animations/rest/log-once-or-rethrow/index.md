---
id: log-once-or-rethrow
section: rest
order: 3
title: Log once or rethrow
description: A seat query times out during checkout. When every layer logs and rethrows, the log gets three stack traces. When inner layers add context and rethrow, the mapper logs once.
objective: See why each layer should either rethrow an exception with added context or handle it, never log it and rethrow it, so one failure leaves one log entry.
references:
  - label: 'Quarkus REST: exception mapping'
    url: https://quarkus.io/guides/rest/#exception-mapping
views:
  - { id: before, label: Before }
  - { id: after, label: After }
---

Catching an exception, logging it, and throwing it again looks careful, since every layer leaves a trace. But the stack trace travels with the exception, so every layer that does this prints the same failure again. In the before view, one timed-out seat query reaches the log three times: from the repository, the service, and the endpoint. The three entries carry the same stack trace, and nothing in them says it's one failure.

Each catch should do one of two things: handle the exception or rethrow it. In the after view, the repository and the service rethrow. Each wraps the exception in a new one that says what it was doing (the seats it was holding, the order it was checking out) and keeps the original as the cause. The endpoint doesn't catch it at all. The exception mapper is the one place that handles it: it logs once, with the whole cause chain, and answers 503.

Quarkus REST doesn't log an exception by default, for security reasons, so the mapper's entry is the only one. The mapper is chosen by the type of the exception that reaches it, and the cause normally plays no part, so it maps `CheckoutFailed`, the outermost wrapper.
