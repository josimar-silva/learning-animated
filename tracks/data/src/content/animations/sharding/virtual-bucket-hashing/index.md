---
id: virtual-bucket-hashing
section: sharding
order: 4
title: Moving buckets, not keys
description: Twenty players hash into 16 buckets, and a map gives each of four database servers four buckets. When a fifth server joins, it takes one bucket from each, and only the 5 players inside those buckets move.
objective: See why hashing into a fixed number of buckets, plus a map from bucket to server, lets a new server take over whole buckets, so no player is rehashed and only the players in the moved buckets change server.
references:
  - label: 'Redis Cluster specification: key distribution model'
    url: https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/#key-distribution-model
steps:
  - at: 0
    text: "Players hash into 16 buckets with hash(player_id) mod 16. There are always 16 buckets, so a player's bucket never changes."
  - at: 6
    text: 'A map assigns buckets to servers. Each of the four servers gets four buckets.'
  - at: 11
    text: 'Server db-4 joins and takes one bucket from each server. The players inside move with their bucket.'
  - at: 17
    text: 'Lookups read the new map. Only the players in buckets 3, 7, 11, and 15 moved: 5 of 20.'
---

The game keeps player profiles in `players(player_id, tag, rating)`, sharded by player id across database servers. The 20 players here, shown by tag, stand in for millions, which is why the game shards its players at all. Hashing the id straight to a server with `hash(player_id) mod 4` ties every player to the number of servers. Add db-4 and the formula becomes `mod 5`, which moves 16 of these 20 players.

Virtual buckets add a fixed step in between. Each player hashes into one of a fixed number of buckets, here `hash(player_id) mod 16`, and a map with one entry per bucket says which server holds that bucket. The bucket count never changes, so a player's bucket never changes either. Only the map does.

The map gives each server a run of four buckets. To add db-4, the game edits the map: db-4 takes the last bucket of each run, 3, 7, 11, and 15, and the rows in those buckets move with them. Those buckets hold Coyote, Newt, Gibbon, Quail, and Adder, so 5 of the 20 players move and the other 15 stay where they are. Bucket 7 holds no one, so moving it costs nothing. A lookup still computes the bucket first and then reads the current map: Adder's player id still hashes to 47, which lands in bucket 15 as before, and the map now sends bucket 15 to db-4.

Every router needs the current map. A router holding an old copy sends lookups for bucket 15 to db-3, which has to redirect them to db-4. Sixteen buckets keep the picture readable, but real systems use many more buckets than servers, so each server holds many of them and one move shifts a small share of the data. The specification in the references uses 16384, which it calls hash slots. The bucket count also caps the number of servers: 16 buckets can never spread over more than 16 servers.
