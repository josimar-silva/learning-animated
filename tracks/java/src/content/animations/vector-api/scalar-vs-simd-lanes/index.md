---
id: scalar-vs-simd-lanes
section: vector-api
order: 5
title: Scalar vs SIMD lanes with fma()
description: One dot product of eight doubles, computed twice. A scalar loop does one multiply-add per step and takes eight steps. A Vector API loop runs fma() on four lanes per step, then reduceLanes adds the lanes up, so two steps and one reduction give the same 1.44.
objective: See why a scalar loop needs one step per element while DoubleVector.fma() does a multiply-add in each of four 64-bit lanes per step at 256 bits, and how reduceLanes turns the lanes into one double.
references:
  - label: 'JEP 537: Vector API (Twelfth Incubator)'
    url: https://openjdk.org/jeps/537
  - label: "Netflix Technology Blog: Optimizing recommendation systems with JDK's Vector API"
    url: https://netflixtechblog.com/optimizing-recommendation-systems-with-jdks-vector-api-30d2830401ec
steps:
  - at: 0
    text: 'Two loops compute the same dot product, q · v1 over 8 doubles: a scalar loop on the left, a Vector API loop on the right.'
  - at: 2
    text: 'Per step, the scalar loop does one multiply-add. fma() does four, one in each lane of a 256-bit DoubleVector.'
  - at: 5
    text: 'Two steps cover all 8 doubles. Then reduceLanes(ADD) adds the 4 lanes into one: 0.14 + 0.24 + 0.57 + 0.49 = 1.44.'
  - at: 7
    text: 'The vector loop is done. The scalar loop is only on step 4 of 8, adding one product at a time.'
  - at: 14
    text: 'Same result, 1.44. The scalar loop took 8 steps; the vector loop took 2 fma() steps and one reduceLanes().'
---

The scalar loop, `acc += q[k] * v1[k]`, multiplies one pair of doubles and adds the product to `acc` on each trip. A dot product of D doubles takes D trips, and each trip waits for the `acc` that the trip before it wrote.

A `DoubleVector` holds one double per lane, and its species sets the number of lanes: a 256-bit species holds four 64-bit doubles. `DoubleVector.fromArray(S, q, k)` loads `q[k]` to `q[k + 3]` in one go, and `a.fma(b, acc)` computes `a * b + acc` in all four lanes. Each lane keeps its own partial sum until the loop ends, when `acc.reduceLanes(VectorOperators.ADD)` adds them into the dot product. Eight doubles take two trips and one reduction.

`DoubleVector.SPECIES_PREFERRED` lets the JVM pick the lane count for the machine, often four doubles with AVX2 and eight with AVX-512, so one loop runs four or eight lanes per trip without recompiling. When D is not a multiple of the lane count, the vector loop stops at `S.loopBound(D)` and a scalar loop finishes the tail. The lanes add the products in a different order than the scalar loop, so the last bits of the result can differ: JEP 537 doesn't promise strict floating-point results for vectors. The API is still incubating and needs `--add-modules jdk.incubator.vector`. In the article, this kernel, along with batching and flat, reused buffers, cut the scoring feature's share of CPU from 7.5% to about 1%.
