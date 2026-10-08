---
id: batching-into-matmul
section: vector-api
order: 3
title: Batching into a matrix multiply
description: A nested loop scores 3 queries against 4 stored vectors with 12 separate cosine calls. Pack them into two matrices, scale every row to length 1, and one matrix multiply, C = A × Bᵀ, returns the same 12 scores.
objective: See how batching turns M × N separate dot products into one matrix multiply, C = A × Bᵀ, and why that multiply returns the same M × N score table as the nested loop.
references:
  - label: 'JEP 537: Vector API (Twelfth Incubator)'
    url: https://openjdk.org/jeps/537
  - label: "Netflix Technology Blog: Optimizing recommendation systems with JDK's Vector API"
    url: https://netflixtechblog.com/optimizing-recommendation-systems-with-jdks-vector-api-30d2830401ec
steps:
  - at: 0
    text: 'Without batching, a nested loop makes one cosine call per pair: 3 queries × 4 stored vectors = 12 calls, one at a time.'
  - at: 6
    text: 'Batching packs the queries into A (3 × 8) and the stored vectors into B (4 × 8), then divides each row by its length, once.'
  - at: 11
    text: 'One matrix multiply, C = A × Bᵀ, computes all 12 dot products in a single call, and C holds the same 12 scores as the loop.'
  - at: 16
    text: "Each row of C scores one query against every stored vector, so the row's maximum names that query's closest stored vector."
---

A nested loop that scores M queries against N stored vectors makes M × N cosine calls, one per pair. Each call takes the dot product of two embeddings and divides it by both of their lengths. With 3 queries and 4 stored vectors, that is 12 calls. The first query, q1, is the `q` of the first lesson in this section, and its scores against v1, v2, and v3 are that lesson's 0.80, 0.94, and 0.34.

Batching changes the shape of the work. Copy the queries into the rows of a matrix A (M × D) and the stored vectors into the rows of B (N × D), then divide every row by its length, once. The dot product of two rows of length 1 is their cosine, so one matrix product, `C = A × Bᵀ`, holds every score. Bᵀ is B transposed, with B's rows as its columns, so C is M × N and `C[i][j] = A[i] · B[j]`: the score of query i against stored vector j.

The multiply still computes one dot product per pair, M × N × D multiply-adds in all, but it does them in one call over two whole matrices, a shape that optimized kernels are built for. That alone did not speed up the article's code: its first batched version ran about 5% slower until the memory layout and the multiply kernel changed. Batching also helps only requests that score many items at once. In the article's service, about 2% of requests were batches, yet they carried about half of all items scored.
