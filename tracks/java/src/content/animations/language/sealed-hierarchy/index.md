---
id: sealed-hierarchy
section: language
order: 1
title: A sealed hierarchy
description: The boarding-pass decoder returns a DecodeResult, either Decoded or Rejected. The sealed interface names both, so a switch over it needs no default, and adding Expired fails the build at that switch until it gets a case.
objective: See why a switch over a sealed interface needs no default, and why adding a subtype fails the build at that switch until the switch handles it.
references:
  - label: 'JEP 409: Sealed Classes'
    url: https://openjdk.org/jeps/409
  - label: 'JEP 441: Pattern Matching for switch'
    url: https://openjdk.org/jeps/441
steps:
  - at: 0
    text: 'The permits clause names every subtype of DecodeResult: Decoded and Rejected. No other class can implement it.'
  - at: 5
    text: 'The switch has a case for each permitted subtype. The compiler knows there are no others, so the switch needs no default.'
  - at: 10
    text: 'Expired joins the permits clause. The switch has no case for it, so the build fails right at that switch.'
  - at: 15
    text: 'With case Expired e added, the switch covers all three subtypes again and compiles, still with no default.'
---

The boarding-pass decoder returns a `DecodeResult` for every record it reads: `Decoded`, which holds the `BoardingPass`, or `Rejected`, which says why the record failed. `sealed interface DecodeResult permits Decoded, Rejected` closes that list. If any other class tries to implement the interface, javac rejects it. Every permitted subtype must also be `final`, `sealed`, or `non-sealed`, and records are `final` already.

Because the list is closed, the compiler can check a `switch` over a `DecodeResult`. A `case` for `Decoded` and one for `Rejected` cover every value it can hold, so the switch needs no `default`. JEP 441 recommends leaving it out: a `default` would also catch any subtype added later, and the compiler could no longer point you to the switches that need a new case.

Say the decoder learns to spot a pass for a flight that has already left, and returns a new record for it, `Expired`. Once `Expired` is in the `permits` clause, javac fails the build at the `switch` with "the switch expression does not cover all possible input values" until the switch gets a `case Expired e`. A class compiled before `Expired` existed still runs, but its switch throws `MatchException` if an `Expired` reaches it.
