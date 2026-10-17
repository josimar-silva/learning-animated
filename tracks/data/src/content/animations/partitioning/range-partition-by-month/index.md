---
id: range-partition-by-month
section: partitioning
order: 1
title: Routing a match to its month
description: The matches table is split into one partition per month. Matches played on 14 February and 1 March land in February and March, and a match played on 9 April is rejected until April's partition exists.
objective: See how a range-partitioned table routes each row by its partition key, why a date on a shared bound belongs to the later range, and why next month's partition has to exist before its first match arrives.
references:
  - label: 'PostgreSQL manual: Table Partitioning, range partitioning'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-OVERVIEW-RANGE
  - label: 'PostgreSQL manual: CREATE TABLE, PARTITION OF and DEFAULT'
    url: https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-PARTITION
steps:
  - at: 0
    text: 'The matches table is split into one partition per month. The parent stores no rows of its own; it only routes them.'
  - at: 4
    text: "A match played on 14 February falls inside February's range, so it goes to matches_2026_02."
  - at: 9
    text: 'A match played on 1 March goes to March, because a range includes its lower bound (FROM) and excludes its upper bound (TO).'
  - at: 16
    text: 'No partition covers 9 April and there is no DEFAULT partition to take the row, so the insert fails.'
  - at: 23
    text: "So create next month's partition ahead of time. With matches_2026_04 in place, the same match lands in April."
---

The game records every finished match in `matches`. Matches pile up month after month, so the table is partitioned by range on `played_on`, one partition per month. The partitioned table has no storage of its own. Its rows live in partitions, ordinary tables that each cover one range of `played_on`, and every row inserted into `matches` goes to the partition whose range covers its date:

```sql
CREATE TABLE matches (
  match_id  bigint,
  winner_id integer,
  map_id    integer,
  played_on date NOT NULL
) PARTITION BY RANGE (played_on);

CREATE TABLE matches_2026_01 PARTITION OF matches
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE matches_2026_02 PARTITION OF matches
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE matches_2026_03 PARTITION OF matches
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

Only `played_on` decides where a row goes. The insert for match 51190 also carries a winner and a map, but PostgreSQL routes the row by its date, 14 February, to the one partition whose range covers it.

A range includes its lower bound and excludes its upper bound. February's range ends at `'2026-03-01'` and March's starts there, so the two months share a bound value without overlapping, and a match played on 1 March goes to March.

An insert whose date fits no partition fails with `no partition of relation "matches" found for row`. A default partition, created with `CREATE TABLE matches_default PARTITION OF matches DEFAULT`, takes every row that no range covers, so the April match would land there instead. April would still have no partition of its own, though. Each time a partition is added, the default partition is scanned for rows that belong in the new one, and April's partition can't be added while April matches sit in the default.

So create each month's partition before the month starts. March was created that way here: its partition sat empty until the first March match arrived. A scheduled script can write next month's `CREATE TABLE ... PARTITION OF` statement.
