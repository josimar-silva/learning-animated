---
id: partitioned-index
section: partitioning
order: 4
title: One B-tree per partition
description: CREATE INDEX on a matches table partitioned by month builds one B-tree per month. A lookup by match id searches all three trees, UNIQUE (match_id) is refused, and UNIQUE (match_id, played_on) still lets match 51042 into two months.
objective: See why an index on a partitioned table is one B-tree per partition, and why a unique constraint on it has to include the partition key.
references:
  - label: 'PostgreSQL manual: Table Partitioning, Limitations'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE-LIMITATIONS
  - label: 'PostgreSQL manual: Declarative Partitioning, Example'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE-EXAMPLE
steps:
  - at: 0
    text: "CREATE INDEX on matches builds one B-tree in each month's partition, and none for matches itself."
  - at: 5
    text: "A lookup by match_id names no month, so all three trees are searched, even after January's tree finds 51042."
  - at: 11
    text: 'UNIQUE (match_id) is refused. Each tree checks only its own month, so a second 51042 in February would go unseen.'
  - at: 17
    text: 'UNIQUE (match_id, played_on) includes the partition key, so it is accepted. It builds one more tree per month.'
  - at: 21
    text: "A repeated pair has the same date as its twin, so it lands in January, and January's tree refuses it."
  - at: 25
    text: 'But only duplicate pairs are ruled out. (51042, 2026-02-01) is a new pair, so match 51042 is now in two months.'
---

A partitioned table holds no rows itself, and an index on it holds no entries itself. `CREATE INDEX ON matches (match_id)` builds a matching index on every partition, so with one partition per month, the index is really one B-tree per month. Each tree covers only its own partition's matches, and a partition added later gets a tree too. The four matches drawn in each month stand in for the millions a busy game records, which is why the table is split by month at all.

A lookup by `match_id` alone has to search every one of those trees. The query names no `played_on`, so no partition can be skipped, and the search goes on through February and March even after January's tree has found match 51042.

The split also limits what a unique constraint can promise. A unique index can only refuse a key that is already in the same tree. A second match 51042 dated in February would go into February's tree, which can't see January's, so `UNIQUE (match_id)` is refused. A unique or primary key constraint on a partitioned table has to include every partition key column. A duplicate then carries the same `played_on` as the row it repeats, lands in the same partition, and meets that row in one tree.

`UNIQUE (match_id, played_on)` is accepted, but it promises less than it seems to. Say match 51042 starts late on 31 January, runs past midnight, and the game reports its result twice. A retry that repeats (51042, 2026-01-31) is refused. A retry dated by the clock when it was sent, (51042, 2026-02-01), is a new pair, so it goes in, and the match now counts in both months. If match ids have to be unique across all months, the ids must come from somewhere that never repeats them, such as a sequence.
