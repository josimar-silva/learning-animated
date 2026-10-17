---
id: detach-partition
section: partitioning
order: 3
title: Retiring a month in one step
description: The game keeps three months of match history, one partition per month. When April begins, DETACH PARTITION takes matches_2026_01 out of matches without reading or writing a row. The detached table keeps January's matches until they are archived and dropped, and VACUUM has no dead rows to clean up.
objective: See why a table partitioned by month retires old data by removing a whole partition instead of deleting rows, and why that leaves VACUUM nothing to clean up.
references:
  - label: 'PostgreSQL documentation: Partition Maintenance'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE-MAINTENANCE
  - label: 'PostgreSQL documentation: ALTER TABLE ... DETACH PARTITION'
    url: https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-DETACH-PARTITION
  - label: 'PostgreSQL documentation: Recovering Disk Space'
    url: https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY
steps:
  - at: 0
    text: 'The game keeps the last three months of matches. When April begins, the window moves on, and January falls out of it.'
  - at: 5
    text: 'DETACH PARTITION takes matches_2026_01 out of matches in one step. Only the catalog changes, so no row is read or written.'
  - at: 10
    text: "Queries on matches now count 9 rows instead of 12. matches_2026_01 is a table of its own, and it still holds January's 3 matches."
  - at: 15
    text: "Archive the detached table if January's matches are still needed, then drop it. DROP TABLE removes the whole month at once."
  - at: 19
    text: 'No row was deleted, so VACUUM has no dead rows to clean up. A bulk DELETE would have left all 3 January matches behind as dead rows.'
---

The game keeps three months of match history in `matches`, with one partition per month of `played_on`. Each row in the animation shows a match id and the day the match was played, and the three matches in each month stand in for the millions a busy game records. When April begins, January falls out of the window. Every January match sits in one partition, `matches_2026_01`, so removing that partition retires the whole month without deleting its rows one at a time.

`ALTER TABLE matches DETACH PARTITION matches_2026_01` changes the system catalog, not the data. `matches_2026_01` stops being a partition of `matches` and becomes a standalone table, and no row is read or written. Queries on `matches` stop seeing January as soon as the command commits. The detached table still holds every January match, so you can query it, copy it to an archive with `COPY`, or roll it up into monthly statistics before you drop it with `DROP TABLE`. When nothing needs to be kept, `DROP TABLE matches_2026_01` removes the partition without the detach step.

Both commands take an `ACCESS EXCLUSIVE` lock on `matches`: they wait for running queries to finish and block new ones until they are done. `DETACH PARTITION ... CONCURRENTLY` takes a weaker lock, and queries on `matches` keep running while it works. It runs as two transactions, which means it can't run inside a transaction block, and it isn't allowed when `matches` has a default partition.

A bulk `DELETE FROM matches WHERE played_on < '2026-02-01'` has to find and mark every January row. A deleted row doesn't disappear at once: it stays in the table as a dead row until `VACUUM` removes it, and `VACUUM` keeps most of the freed space inside the table for reuse. Detaching or dropping the partition avoids that work entirely, because no row is deleted.
