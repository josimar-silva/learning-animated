---
id: consistent-hashing
section: sharding
order: 3
title: Consistent hashing on a ring
description: Four database servers and 20 players hash onto one ring, and the first server point clockwise from a player stores the player's profile. When a fifth server joins, only the players whose walk now ends at one of its points move to it.
objective: See why adding a server to a consistent-hashing ring moves only the players on the new server's arcs, and how giving each server several points evens out the load.
references:
  - label: 'Karger et al., "Consistent Hashing and Random Trees", STOC 1997'
    url: https://doi.org/10.1145/258533.258660
  - label: 'Stoica et al., "Chord: A Scalable Peer-to-peer Lookup Service for Internet Applications", SIGCOMM 2001'
    url: https://doi.org/10.1145/383059.383071
views:
  - { id: one-point, label: One point per server }
  - { id: virtual-nodes, label: Three points per server }
steps:
  - at: 0
    text: 'Servers db-0, db-1, db-2, and db-3 hash to points on a ring: one point each, or three each with virtual nodes.'
  - at: 5
    text: "Each player id hashes onto the same ring. The player walks clockwise to the first server point, and that server stores the player's profile."
  - at: 13
    text: 'A fifth server, db-4, joins and hashes onto the ring the same way. Only the players whose walk now ends at a db-4 point move to it: 4 of the 20.'
  - at: 19
    text: "Each server's player count shows its load before and after db-4 joined. The other 16 players never moved."
---

The game keeps one profile per player and shards the profiles across database servers by player id. The 20 players here stand in for millions, which is why the game needs to shard at all. Sharding by `hash(player_id) mod 4` works until the number of servers changes. When db-4 joins, the divisor becomes 5, and 16 of the 20 players land on a different server, so their profiles have to move. Consistent hashing keeps most players where they are. It hashes servers and players into the same range of values and bends that range into a ring, so the largest value wraps around to 0.

Each server hashes to a point on the ring. A player id hashes to a point too, and the player walks clockwise from there to the first server point. That server stores the player's profile, so each server owns the arc that ends at its point. When db-4 joins, its point splits one arc in two. The players between the previous point and db-4's now reach db-4 first, and every other player still reaches the same server as before. Only those players move: with five servers, about a fifth of them on average.

With one point per server, the arcs come out uneven. In the first view, db-2's arc covers almost half the ring, so db-2 stores 11 of the 20 profiles while db-1 stores 1, and db-4 relieves only the server whose arc it lands in. The fix is to give each server several points, called virtual nodes. They cut the ring into many short arcs that alternate between servers, so each server's share comes out close to even, and a new server takes a small slice from several servers instead of a large one from a single neighbour. In the second view, three points per server keep the loads between 4 and 6, and db-4's three points take players from db-3, db-2, and db-1.

The ring here has 100 positions, so each player's hash from the hash-sharding lesson is also its spot on the ring: Egret sits at 13. Real systems hash into a far larger range, and the published designs give each server on the order of log n points, where n is the number of servers, not the three that fit on screen here. Removing a server works the same way in reverse: its players walk on to the next point clockwise, so with virtual nodes they spread over several servers instead of all landing on one.
