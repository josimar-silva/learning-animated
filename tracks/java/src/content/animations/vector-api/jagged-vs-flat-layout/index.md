---
id: jagged-vs-flat-layout
section: vector-api
order: 4
title: Jagged vs flat memory layout
description: The same three rows of eight doubles, stored two ways. A double[][] keeps a reference to each row, and the rows sit apart on the heap. A flat double[] keeps them back to back, so one sweep reads them all.
objective: See why reading a double[][] means following a reference to each row, and why a flat double[] in row-major order reads in one sequential sweep.
references:
  - label: 'JEP 537: Vector API (Twelfth Incubator)'
    url: https://openjdk.org/jeps/537
  - label: "Netflix Technology Blog: Optimizing recommendation systems with JDK's Vector API"
    url: https://netflixtechblog.com/optimizing-recommendation-systems-with-jdks-vector-api-30d2830401ec
steps:
  - at: 0
    text: 'A double[][] is an array of references. Each row, v1 to v3, is its own array of 8 doubles, somewhere on the heap.'
  - at: 3
    text: 'Reading the rows chases pointers: load stored[j], jump to its row, read 8 doubles, then jump back for the next one.'
  - at: 10
    text: 'A flat double[] keeps v1, v2, and v3 back to back in one array, so row j starts at index j × 8.'
  - at: 13
    text: 'Reading it is one sweep from index 0 to 23: every read is at the next address, so the CPU can fetch ahead.'
---

In Java, a `double[][]` is an array of references. Each row is a separate `double[]` object with its own place on the heap, so rows that sit side by side in the outer array can be far apart in memory. To read row `j`, the code loads the reference `stored[j]`, then jumps to the row it points to. Every row adds one more load and one more jump.

A flat `double[]` stores the rows back to back in row-major order: row `j` starts at index `j * D`, and its element `k` is at `j * D + k`. Here D = 8, so `v2` starts at index 8 and `v3` at 16. A loop over the flat array reads each element at the address right after the previous one, so the CPU can predict the next address and load it before the loop asks for it. A Vector API loop loads its lanes from the flat array the same way: `DoubleVector.fromArray(species, flat, j * D + k)` reads several consecutive doubles at once.

In the article this series follows, the first batched version ran about 5% slower in a canary than the loop it replaced. It built fresh `double[][]` matrices for every batch, so it paid for pointer chasing and for the garbage those short-lived matrices left behind, and its matrix multiply was still scalar. Flat row-major buffers that each thread keeps and reuses cut both the allocations and the scattered reads.
