---
id: embeddings-and-cosine
section: vector-api
order: 1
title: Embeddings and cosine similarity
description: Two embeddings of eight doubles each become one score. Multiply them element by element, add up the products, and divide by both lengths. The result is the cosine of the angle between them, so a smaller angle scores higher.
objective: See how cosine similarity turns two embeddings into one score, their dot product over the product of their lengths, and why a smaller angle between them gives a higher score.
references:
  - label: 'JEP 537: Vector API (Twelfth Incubator)'
    url: https://openjdk.org/jeps/537
  - label: "Netflix Technology Blog: Optimizing recommendation systems with JDK's Vector API"
    url: https://netflixtechblog.com/optimizing-recommendation-systems-with-jdks-vector-api-30d2830401ec
steps:
  - at: 0
    text: 'An embedding is an array of D doubles, here D = 8. Drawn as arrows from one origin, q and v1 meet at an angle θ.'
  - at: 4
    text: 'The dot product q · v1 multiplies the two arrays element by element, then adds up the 8 products: 1.44.'
  - at: 9
    text: 'Divide the dot product by both lengths: 1.44 / (1.5 × 1.2) = 0.80, the cosine of θ, so θ is about 37°.'
  - at: 14
    text: 'A smaller angle gives a higher score: v2 at 20° scores 0.94, v1 at 37° scores 0.80, and v3 at 70° scores 0.34.'
---

An embedding is a fixed-length array of D numbers that a model computes for an item. Items the model treats as alike get arrays that point in similar directions. The embeddings in this lesson are `double[]` arrays of length 8, short enough to show every number.

Cosine similarity compares two embeddings by direction. Their dot product, `q · v`, multiplies the two arrays element by element and adds up the D products. Divide it by both lengths, where the length `|q|` is the square root of `q · q`, and you get the cosine of the angle between the two vectors: 1 when they point the same way, 0 when they are perpendicular, and -1 when they point in opposite directions. The division cancels the lengths, so only the angle sets the score.

Scoring one query against N stored vectors takes N dot products, each D multiply-adds long. If you scale every vector to length 1 ahead of time, the division goes away and the dot product alone is the cosine. The Vector API speeds up those multiply-adds by running one CPU instruction over several array elements at a time.
