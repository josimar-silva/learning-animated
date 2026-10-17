---
id: partition-pruning
section: partitioning
order: 2
title: Skipping the months a query can't match
description: The matches table has one partition per month. For a query on March's matches, the planner checks each partition's bounds and scans only March. A query for one player's wins can't skip a month, so it reads all four.
objective: See how the planner compares a WHERE clause with each partition's bounds and scans only the partitions that could hold the rows the query wants, and why a filter on another column can't skip any.
references:
  - label: 'PostgreSQL documentation: Partition Pruning'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITION-PRUNING
steps:
  - at: 0
    text: 'A query asks for the matches played in March: played_on from 2026-03-01 up to, but not including, 2026-04-01.'
  - at: 4
    text: "The planner compares that range with each partition's bounds. Only March can hold rows in that range, so it prunes the other three months."
  - at: 10
    text: 'Only matches_2026_03 is scanned, and all 3 of its rows are returned. The pruned months stay dark, and none of their rows is read.'
  - at: 16
    text: 'A query for the matches Koala (player 1042) won filters on winner_id, not played_on, so no month can be pruned. All 12 rows are read to return 2.'
---

The game records every match in `matches`, a table partitioned by `played_on` with one partition per month. A partition's bounds say which dates it holds: `matches_2026_03` holds the matches played from 2026-03-01 up to, but not including, 2026-04-01. The 12 matches here stand in for the millions a busy game records each month.

Before a query runs, the planner compares its `WHERE` clause with each partition's bounds. When it can prove that a partition holds no row that meets the clause, it prunes that partition: the plan leaves it out, and none of its rows is read. The query for March's matches reads one month of the four.

Pruning needs a condition on the partition key. To list the matches that Koala, player 1042, has won, the query filters on `winner_id`, which says nothing about `played_on`, so any month could hold one of Koala's wins. Nothing is pruned, and the scan reads all 12 rows to return 2. An index on `winner_id` makes each partition faster to search, but the query still searches all four, because pruning looks only at the bounds.

Pruning can also happen while the query runs. Some values are known only then, such as a parameter of a prepared statement or the result of a subquery, and the executor skips the partitions those values rule out. The `enable_partition_pruning` setting turns both kinds of pruning on or off. It is on by default.
