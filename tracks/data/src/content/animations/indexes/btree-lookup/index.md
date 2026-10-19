---
id: btree-lookup
section: indexes
order: 1
title: Finding one key
description: Player 4127 signs in, and the index on players(player_id) reads the root page, one internal page, and one leaf page, then follows the leaf's pointer to Tapir's row.
objective: See why a lookup reads one page per level, so its cost grows with the height of the tree, and the height grows with the logarithm of the number of keys.
references:
  - label: 'PostgreSQL manual: B-Tree structure'
    url: https://www.postgresql.org/docs/current/btree.html#BTREE-STRUCTURE
  - label: 'PostgreSQL source: the nbtree README'
    url: https://github.com/postgres/postgres/blob/master/src/backend/access/nbtree/README
steps:
  - at: 0
    text: "Player 4127 signs in. The root's separators send 4127 to one child: it falls between 3608 and 6302, so the search takes the middle downlink."
  - at: 4
    text: 'An internal page narrows it down again: 4127 is below 4581, so the search takes the leftmost downlink to a leaf.'
  - at: 8
    text: "The leaf holds 4127 and a pointer to its row in the players table, and Tapir's profile loads."
  - at: 12
    text: 'That took three page reads, one per level. One more level would multiply the keys within reach by the fanout, 3 here.'
---

The index on `players(player_id)` keeps player ids in sorted order, spread over a tree of pages. The bottom level holds the leaf pages, where each entry is a player id and a pointer to that player's row in the `players` table. The levels above hold internal pages, and the top level is a single root page. An internal page holds separator keys and downlinks to pages one level down: one downlink before the first separator, one between each pair, and one after the last.

When player 4127 signs in, the game loads the profile with `SELECT * FROM players WHERE player_id = 4127`. The lookup starts at the root and compares 4127 with its separators. It falls between 3608 and 6302, so the search follows the downlink between them and drops one level. The internal page there narrows the range again, and its downlink leads to a leaf. The leaf either holds the key or shows that no player has that id. This one holds 4127, and its pointer leads to Tapir's row. Fetching that row costs one more read, in the table instead of the index.

So a lookup reads one page per level, and its cost is the height of the tree. Each level multiplies the keys within reach by the fanout, the number of downlinks on an internal page. The pages in the animation are tiny, with three downlinks on an internal page and two keys on a leaf, so three levels reach 3 × 3 × 2 = 18 keys and a fourth level would reach 54. Those 18 player ids stand in for the millions a real game has. A real 8 kB page holds a few hundred small keys, and at 300 per page, three levels reach 27 million keys and four levels reach 8.1 billion. A game with 10 million players still finds a profile in three index page reads, because the height grows with the logarithm of the key count. Typically, over 99% of an index's pages are leaf pages, and a lookup reads just one of them.
