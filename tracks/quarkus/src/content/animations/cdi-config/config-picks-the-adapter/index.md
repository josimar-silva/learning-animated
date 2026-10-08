---
id: config-picks-the-adapter
section: cdi-config
order: 1
title: Configuration picks the adapter
description: 'Checkout pays through one of two adapters. With @IfBuildProperty, the build keeps only the adapter a property names. With @LookupIfProperty, both stay, and a lookup returns the one the property names when the application starts.'
objective: 'See why switching an adapter chosen by @IfBuildProperty takes a rebuild, while one chosen by @LookupIfProperty takes only a restart: both adapters stay beans, and the lookup goes by the value the application started with.'
references:
  - label: 'Quarkus CDI reference: enable beans for build properties'
    url: https://quarkus.io/guides/cdi-reference/#enable_build_properties
  - label: 'Quarkus CDI reference: choose beans for programmatic lookup'
    url: https://quarkus.io/guides/cdi-reference/#declaratively-choose-beans-that-can-be-obtained-by-programmatic-lookup
views:
  - { id: build-time, label: Build time }
  - { id: runtime, label: Runtime }
---

Checkout charges the buyer through a `PaymentGateway`, and two classes implement it: `CardGateway` charges a real card, and `SandboxGateway` fakes the charge, so a test deployment moves no money. The property `payment.gateway` names the one to use. Depending on the annotation, Quarkus acts on it at build time or at startup, and that decides what it takes to switch.

In the build-time view, both classes carry `@IfBuildProperty`. The build reads `payment.gateway` and makes only the matching class a bean. The other class is still compiled, but the application has no bean for it, so a plain `@Inject PaymentGateway` finds exactly one. Setting the property when the application starts changes nothing, because runtime values have no effect on these annotations. Switching to the sandbox takes a new build.

In the runtime view, both classes carry `@LookupIfProperty`, and both become beans. A plain `@Inject PaymentGateway` would match two beans, which CDI rejects as ambiguous, so checkout injects `Instance<PaymentGateway>` and calls `get()`. The lookup skips every bean whose property doesn't match the value the application started with. One build returns `CardGateway` when started with `payment.gateway=card`, and `SandboxGateway` after a restart with `sandbox`.
