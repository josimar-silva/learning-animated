---
id: lookup-outcomes
section: cdi-config
order: 2
title: What a lookup answers
description: 'Checkout looks up its payment adapter through Instance<PaymentGateway> in three setups. With no bean left the lookup is unsatisfied, with two it is ambiguous, and only with exactly one does get() return a bean.'
objective: 'See how Instance answers by the number of beans whose lookup conditions hold: get() returns a bean only when exactly one is left, and throws when none or two are.'
references:
  - label: 'Quarkus CDI reference: choose beans for programmatic lookup'
    url: https://quarkus.io/guides/cdi-reference/#declaratively-choose-beans-that-can-be-obtained-by-programmatic-lookup
  - label: 'Jakarta CDI 4.1: the Instance interface'
    url: https://jakarta.ee/specifications/cdi/4.1/jakarta-cdi-spec-4.1.html#dynamic_lookup
steps:
  - at: 0
    text: "The application starts without payment.gateway, and the lookup checks each adapter's condition against it."
  - at: 3
    text: 'Neither condition holds, so no bean is left: isUnsatisfied() is true and get() throws UnsatisfiedResolutionException.'
  - at: 6.5
    text: 'Restarted with payment.gateway=card, the lookup checks both conditions again.'
  - at: 9.5
    text: "Only CardGateway's condition holds, so one bean is left: isResolvable() is true and get() returns CardGateway."
  - at: 13
    text: 'Next, SandboxGateway loses its @LookupIfProperty, so no condition can skip it. The new build starts with card.'
  - at: 16
    text: 'CardGateway passes too, so two beans are left: isAmbiguous() is true and get() throws AmbiguousResolutionException.'
---

Checkout injects `Instance<PaymentGateway>` and calls `get()`, as in the runtime view of the previous lesson. Both adapters are beans in every setup here. `@LookupIfProperty` never removes a bean: it only decides whether a lookup may return it. The lookup skips each bean whose condition fails against the configuration the application started with, and its answer depends on how many beans are left.

With none left, `isUnsatisfied()` is true and `get()` throws `UnsatisfiedResolutionException`. A property that isn't set fails the condition, because `lookupIfMissing` defaults to `false`. With two left, `isAmbiguous()` is true and `get()` throws `AmbiguousResolutionException`. A bean without a lookup condition is never skipped, which is how the third setup ends up with two. Only with exactly one bean left is `isResolvable()` true, and then `get()` returns that bean.

The build checks none of this. A plain `@Inject PaymentGateway` that matches no bean, or two, fails the build, but a lookup depends on configuration the build never sees. The same mistake shows up only when `get()` runs, on the first checkout. Checking `isResolvable()` when the application starts reports it earlier.
