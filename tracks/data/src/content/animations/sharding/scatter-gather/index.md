---
id: scatter-gather
section: sharding
order: 5
title: Queries without the shard key
description: Players are sharded by player id across four database servers. Loading one player's profile goes to one server, while the global leaderboard asks all four and waits for the slowest to answer.
objective: See why a query that names the shard key reaches one server, while any other query asks every server and finishes only when the slowest one answers.
references:
  - label: 'PostgreSQL manual: Partition Pruning'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITION-PRUNING
  - label: 'PostgreSQL manual: postgres_fdw asynchronous execution options'
    url: https://www.postgresql.org/docs/current/postgres-fdw.html#POSTGRES-FDW-OPTIONS-ASYNCHRONOUS-EXECUTION
steps:
  - at: 0
    text: 'Players are sharded by player_id: hash(player_id) mod 4 places five of them on each server, db-0 to db-3.'
  - at: 4
    text: "Lemur's profile names player 8577, and hash(8577) mod 4 = 1, so the router asks db-1 alone. The other servers never see it."
  - at: 10
    text: 'The global top 3 by rating names no player, so the router asks all four servers at once, each for its own top 3.'
  - at: 13.8
    text: 'The router merges answers as they arrive. Busy db-2 answers last and holds the best rating, so the leaderboard waits for it.'
---

The game stores its players in `players(player_id, tag, rating)` and shards them by `player_id`: `hash(player_id) mod 4` puts each player on one of four database servers, db-0 to db-3, five to a server. The 20 players here stand in for millions, which is why the game needs more than one server at all. A router in front of the servers applies the same rule to any query that names a player.

When a query names the shard key, the router can send it to one server. Loading Lemur's profile asks for player 8577, and hash(8577) mod 4 is 1, so the router sends the query to db-1. The other three servers never see it and stay free for other work.

The global leaderboard names no player. It asks for the three best ratings, and any server could hold them, so the router sends the query to all four. This pattern is called scatter-gather: the router scatters the query, each server answers from its own players, and the router gathers the answers into one result. Each server returns its own top 3 rather than only its best player, because the global top 3 could all come from one server. The router merges the twelve rows and keeps the three best.

The result is complete only when every server has answered. Until db-2 answers, the merged list reads Newt, Lemur, and Raven, and that's wrong: db-2 holds Ferret, whose rating is the best of all. So the leaderboard waits for db-2, and a scatter-gather query is as slow as its slowest server. Here db-2 is busy with other work, but a slow disk or a long network path would hold up the result in the same way. The router asks all four servers at the same time. If it asked them one after another, the query would take the sum of their times instead of the longest one.

Partitions inside one server follow the same rule. The planner skips every partition whose bounds can't match the WHERE clause, so a query on the partition key reads one partition, and a query on any other column reads them all.

Choose the shard key so that the most frequent queries name it. A query that can't name it costs work on every server, and the more servers there are, the more likely it is that one of them is slow when the query arrives.
