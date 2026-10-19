---
id: memory-units-ladder
section: memory
order: 2
title: The 1024 ladder of memory units
description: Each binary memory unit holds 1024 of the one below it, from KiB up to TiB. The decimal unit beside it holds 1000, so the binary unit pulls ahead at every rung, from 2.4% at kilo to about 10% at tera.
objective: See why binary memory units climb by 1024 and decimal ones by 1000, and how the gap between them grows at every rung.
references:
  - label: 'NIST: prefixes for binary multiples'
    url: https://physics.nist.gov/cuu/Units/binary.html
  - label: 'JDK 25 tool specifications: the java command, extra options (-Xmx)'
    url: https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html#extra-options-for-java
steps:
  - at: 0
    text: 'Binary units climb by 1024, the power of two closest to 1000: 1 KiB is 1024 bytes, and 1 MiB is 1024 KiB.'
  - at: 6
    text: 'The decimal units beside them climb by 1000: 1 kB is 1000 bytes, and 1 MB is 1000 kB.'
  - at: 11
    text: '1024 is only 2.4% more than 1000, but the gap compounds at every rung, to about 10% at tera.'
  - at: 16
    text: 'So a disk sold as 1 TB holds a trillion bytes, which is about 0.91 TiB.'
---

Each address bit doubles the number of bytes a memory can reach, so memory sizes are counted in powers of two. Ten bits reach 1024 bytes, the power of two closest to 1000, which is why 1024 bytes came to be called a kilobyte. In 1998 the IEC gave the binary multiples names of their own: a kibibyte (KiB) is 1024 bytes, a mebibyte (MiB) is 1024 KiB, and the gibibyte (GiB) and tebibyte (TiB) continue the ladder.

The SI prefixes keep their decimal meaning. A kilobyte (kB) is 1000 bytes and a megabyte (MB) is 1000 kB, so each decimal rung holds 1000 of the rung below. Both ladders start at one byte, and at kilo they differ by only 2.4%, but the difference compounds: 4.9% at mega, 7.4% at giga, and about 10% at tera. Storage makers usually count in decimal, so a 1 TB disk holds a trillion bytes, which is about 0.91 TiB, or 931 GiB.

The `java` launcher reads memory sizes in binary, though its documentation calls them kilobytes, megabytes, and gigabytes. Its own example sets the maximum heap to 80 MB three ways, `-Xmx83886080`, `-Xmx81920k`, and `-Xmx80m`, and all three mean 80 × 1024 × 1024 bytes, which is 80 MiB.
