---
id: range-sharding
section: sharding
order: 1
title: Splitting players by id range
description: Four database servers each own one continuous range of player ids. A lookup compares the id with the range boundaries, a scan over the newest players reads one server, and db-3, which gets every new sign-up, runs hot.
objective: See how range sharding sends a lookup to one server by comparing the player id with the range boundaries, why neighbouring ids stay together, and why ids that grow with every sign-up overload the server that owns the open top range.
references:
  - label: 'PostgreSQL manual: Table Partitioning, range partitioning'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-OVERVIEW-RANGE
  - label: 'PostgreSQL manual: Declarative Partitioning, partitions as foreign tables'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE
  - label: 'PostgreSQL manual: CREATE TABLE, PARTITION OF and MAXVALUE'
    url: https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-PARTITION
steps:
  - at: 0
    text: 'Four servers split the players by id: db-0 owns [0, 2500), db-1 [2500, 5000), db-2 [5000, 7500), and db-3 [7500, ∞).'
  - at: 4
    text: 'A lookup compares the id with the boundaries: 5000 ≤ 6120 < 7500, so player 6120, Petrel, is on db-2.'
  - at: 11
    text: 'The four newest players, ids 9612 to 9980, all live on db-3, so a scan over those ids reads one server, not four.'
  - at: 16
    text: 'Ids grow as players sign up, and the game keeps growing: db-3 holds 11 of the 20 players and takes every new sign-up.'
  - at: 20
    text: 'Each player sends one request: db-3 answers 11 of the 20 and runs hot, while the other servers sit mostly idle.'
---

Range sharding splits a table across database servers by ranges of one column, the shard key. Here, an online game shards its `players` table by `player_id`, and each server owns one continuous range of ids: db-0 owns [0, 2500), db-1 [2500, 5000), db-2 [5000, 7500), and db-3 [7500, ∞). A range includes its lower bound and stops just before the next one, so player 7500 would live on db-3, not db-2. The 20 players here stand in for millions, which is why the game shards its players at all.

To load a profile, the game compares the player id with the boundaries 2500, 5000, and 7500. Player 6120, Petrel, is at least 5000 and below 7500, so the request goes straight to db-2, and the other servers do no work for it.

Neighbouring ids stay together. The four newest players, Ferret, Gibbon, Heron, and Iguana, have ids from 9612 to 9980, and all four live on db-3, so a query over that id range reads one server. Listing every player in id order reads the servers one after another.

Ids grow as players sign up, and db-3's range is open at the top, like a partition whose upper bound is MAXVALUE, so every new id lands on db-3. The game keeps growing, and recent players outnumber early ones: 11 of the 20 have ids from 7500 up. With one request per player, db-3 answers 11 of the 20 and runs hot, while the other three servers sit mostly idle.

Two fixes are common. Splitting the hot range, for example by moving the ids from 8750 up to a new server, db-4, spreads the players db-3 already holds, but every new sign-up still lands on whichever server owns the open top range. Hashing the player id spreads new players over every server, but neighbouring ids no longer stay together, so a scan over an id range has to ask every server. The next lesson shows how hashing works.

A partitioned table follows the same rule inside one database server: each range partition includes its lower bound and excludes its upper bound. A partition can also be a foreign table, which is one way to keep each range on a different server.
