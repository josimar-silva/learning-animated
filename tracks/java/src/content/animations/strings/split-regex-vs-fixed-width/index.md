---
id: split-regex-vs-fixed-width
section: strings
order: 1
title: String.split vs fixed-width fields
description: A boarding-pass decoder cuts the same two records into fields two ways. split("\\s+") compiles a regex and scans every character on each call, while substring cuts each field at the offset the layout gives, with no regex.
objective: See why split("\\s+") compiles a new Pattern and scans the whole record on every call, while a decoder that knows the layout cuts each field with substring and never builds a regex.
references:
  - label: 'Java SE 25 API: String.split(String, int)'
    url: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/String.html#split(java.lang.String,int)
  - label: 'JDK 25 source: String.split, the fast path and Pattern.compile'
    url: https://github.com/openjdk/jdk/blob/jdk-25-ga/src/java.base/share/classes/java/lang/String.java#L3396-L3425
views:
  - { id: split, label: String.split }
  - { id: fixed-width, label: Fixed width }
---

The decoder reads boarding-pass records with a fixed layout: the passenger name fills columns 0 to 11, padded with spaces, then the two airports, the flight, and the seat follow at fixed offsets, one blank column apart. Every record is 32 characters long, whatever the name.

`record.split("\\s+")` returns the five fields in one line. But `String.split` has a fast path only for a one-character delimiter that isn't a regex metacharacter, such as `","`, or for a backslash followed by anything but a letter or a digit, such as `"\\|"`. Any other regex, `"\\s+"` included, goes to `Pattern.compile` on every call, because `split` keeps nothing between calls. The new pattern's matcher then tests the record one character at a time to find the runs of spaces, and the tokens pass through an `ArrayList` before they become the `String[]`.

The fixed-width decoder skips all of that. The layout already says where each field starts and ends, so it cuts each one with `substring`, and only the name needs `strip()` to drop its padding. It compiles no pattern and never scans the record to find where a field ends. The offsets also survive a name like `VAN DAM/EVA`: its space would give `split` six tokens and shift every field after the name.
