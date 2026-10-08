---
id: byte-anatomy
section: memory
order: 1
title: Anatomy of a byte
description: Eight bits light up with their place values, 1 to 128. In a Java byte, bit 7 counts as -128, so 1000_0000 reads as -128 and the range runs from -128 to 127.
objective: See how eight bits add up to a value, and why Java's two's-complement byte reads 1000_0000 as -128 and holds -128 to 127.
references:
  - label: 'JLS (Java SE 25), 4.2.1: integral types and values'
    url: https://docs.oracle.com/javase/specs/jls/se25/html/jls-4.html#jls-4.2.1
  - label: 'Java SE 25 API: Byte'
    url: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Byte.html
steps:
  - at: 0
    text: "A byte is eight bits. Each bit's place value doubles, from 1 for bit 0 up to 128 for bit 7."
  - at: 6
    text: "A Java byte is signed two's complement, so bit 7 counts as -128 instead of 128, and 1000_0000 reads as -128."
  - at: 10
    text: 'With bit 7 clear, the other seven bits add up to at most 64 + 32 + 16 + 8 + 4 + 2 + 1 = 127.'
  - at: 14
    text: 'So a byte holds 256 values, from -128 to 127. Java names the two ends Byte.MIN_VALUE and Byte.MAX_VALUE.'
---

A byte is eight bits, numbered 0 to 7 from the right. Bit n is worth 2 to the power n, so the place values double from 1 to 128, and a pattern's value is the sum of the places that hold a 1. Read that way, eight bits count from 0 to 255. The patterns on this page are written bit 7 first, with an underscore in the middle to make them easier to read.

Java's `byte` reads the same eight bits as a signed two's-complement integer. Bits 0 to 6 keep their place values, but bit 7 counts as -128. So `1000_0000` is -128, `0111_1111` is 127, and `1111_1111` is -128 + 127 = -1. A pattern with bit 7 set is always negative, because the other seven bits add up to 127 at most.

That gives the range the Java Language Specification states for `byte`: -128 to 127, inclusive. `Byte.MIN_VALUE` and `Byte.MAX_VALUE` hold the two ends. When you need the unsigned reading, `Byte.toUnsignedInt(b)` returns it as an `int` from 0 to 255.
