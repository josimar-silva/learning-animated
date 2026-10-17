---
id: hash-sharding
section: sharding
order: 2
title: Hash mod N, until N changes
description: Twenty players go to server hash(player_id) mod 4, five to each, and the four newest land on four different servers. When db-4 is added and the rule becomes mod 5, 16 of the 20 players move.
objective: See why hash mod N spreads players evenly but scatters id ranges, and why changing N moves most players to a new server.
references:
  - label: 'PostgreSQL manual: Table Partitioning, hash partitioning'
    url: https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-OVERVIEW-HASH
  - label: 'Karger et al., "Consistent Hashing and Random Trees", STOC 1997'
    url: https://doi.org/10.1145/258533.258660
steps:
  - at: 0
    text: 'Each player goes to server hash(player_id) mod 4, and each server ends up with five. Adder hashes to 47, and 47 mod 4 = 3.'
  - at: 9
    text: 'The four newest players sit on four different servers: no sign-up hot spot, but a scan over their ids asks every server.'
  - at: 15
    text: 'Server db-4 is added, and the rule becomes hash(player_id) mod 5.'
  - at: 18
    text: '16 of the 20 players move: only those whose hash mod 20 is below 4 stay where they were.'
---

An online game with millions of players can't keep every profile on one database server, so it shards the `players` table with `player_id` as the shard key. Here 20 players stand in for those millions. Hash sharding puts each player on server `hash(player_id) mod N`, where N is the number of servers. A good hash scatters ids evenly, so every server gets about the same number of players. Loading a profile needs no lookup table either: the router hashes the id and asks one server. The hashes in the animation are made up and cut to two digits, so you can check each remainder yourself.

Hashing also scatters order. Player ids grow as people sign up, so when each server owns a range of ids, every new player lands on the last server and that server runs hot. Hashed, the four newest players land on four different servers, and sign-ups spread out. The cost is that a scan over a range of ids, such as the newest players, has to ask every server and merge the answers.

Adding a server costs the most. A player stays where they are only when their hash leaves the same remainder for the old N and the new one. From 4 servers to 5, that happens only when the hash mod 20 is 0, 1, 2, or 3, which is 4 players in every 20. The other 16 move, although the new server needs only 4 of them. In general, going from N servers to N + 1 moves N of every N + 1 players.

A hash-partitioned table applies the same rule inside one database: each partition has a modulus and a remainder, and it holds the rows whose key hashes to that remainder. Consistent hashing and virtual buckets, the next two lessons, keep the even spread but move far fewer players when a server is added.
