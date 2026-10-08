---
id: dot-product-hotspot
section: vector-api
order: 2
title: The M × N dot-product hotspot
description: A nested loop scores four queries against six stored vectors, one dot product per pair. The score table fills one cell at a time, and the multiply-adds inside the dot products climb eight times as fast.
objective: See why scoring M queries against N stored vectors takes M × N dot products, and why the M × N × D multiply-adds inside them take most of the time.
references:
  - label: 'JEP 537: Vector API (Twelfth Incubator)'
    url: https://openjdk.org/jeps/537
  - label: "Netflix Technology Blog: Optimizing recommendation systems with JDK's Vector API"
    url: https://netflixtechblog.com/optimizing-recommendation-systems-with-jdks-vector-api-30d2830401ec
steps:
  - at: 0
    text: 'Score M = 4 queries against N = 6 stored vectors of D = 8 doubles. All have length 1, so a dot product is their cosine.'
  - at: 2
    text: 'One pair is one dot product: the k loop does D = 8 multiply-adds, and q1 · v1 comes out at 0.80.'
  - at: 4
    text: 'The nested loop repeats that for every pair, one at a time and row by row, until all 4 × 6 = 24 cells hold a score.'
  - at: 16
    text: 'The 24 dot products cost 24 × 8 = 192 multiply-adds, M × N × D. They take most of the time, so the k loop is the hotspot.'
---

Scoring one query against N stored vectors takes N dot products. A ranking request can score many items at once, so the work becomes M queries against the same N stored vectors. The plain way to write that is two nested loops with a call to `dot()` inside: one dot product per pair, M × N in all, each D multiply-adds long.

The code outside `dot()` runs about once per pair, but the multiply-add `sum += a[k] * b[k]` runs D times for every pair, M × N × D times in total. The dot products take most of the time, and their share grows with the length of the embeddings. The article this series follows found the same in production: one scoring feature built on such a loop used about 7.5% of the CPU on every node of a large service, and a flame graph showed its dot products as one of the top hotspots.

Every vector in this lesson has length 1, so each dot product is already the cosine score. The first query and the first stored vector, q1 and v1, are the two embeddings from the cosine lesson scaled to length 1, and they still score 0.80. The next lessons keep these scores and change how they are computed: one matrix multiply instead of M × N separate calls, a flat memory layout, and SIMD lanes through the Vector API.
