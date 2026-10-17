---
id: index-only-scan
section: indexes
order: 4
title: Answering from the index alone
description: A lookup of player 4127 reads table page 3 to get the tag, Tapir. Once the index stores the tag too and the visibility map marks page 3 all-visible, the lookup skips the table. A match that changes another player's rating on page 3 clears that mark, and the lookup visits the table again.
objective: "See the two conditions an index-only scan needs: the leaf holds every column the query reads, and the visibility map marks the row's table page all-visible."
references:
  - label: 'PostgreSQL manual: Index-Only Scans and Covering Indexes'
    url: https://www.postgresql.org/docs/current/indexes-index-only-scans.html
  - label: 'PostgreSQL manual: Visibility Map'
    url: https://www.postgresql.org/docs/current/storage-vm.html
steps:
  - at: 0
    text: 'An index scan finds 4127 in a leaf page, then follows its pointer to table page 3 to read the tag.'
  - at: 7
    text: 'Rebuilt with INCLUDE (tag), every leaf entry stores the tag too, so the leaf already has the answer.'
  - at: 12
    text: 'The visibility map marks page 3 all-visible, so row 4127 is visible to every transaction and the scan skips the table.'
  - at: 17
    text: "After a match, an UPDATE to player 4130's rating clears page 3's bit, so the scan must visit page 3 to check that row 4127 is visible."
---

An entry in a B-tree leaf holds a key and a pointer to its row in the table. With an index on `players (player_id)`, a lookup finds player 4127, but `SELECT tag FROM players WHERE player_id = 4127` also needs the gamer tag. So an index scan follows the pointer and reads table page 3 to return Tapir. The table has one more thing the scan needs: whether the row is visible to the query. Index entries don't record that.

`CREATE INDEX ON players (player_id) INCLUDE (tag)` makes the index cover the query. Each leaf entry stores the tag as payload: it isn't part of the search key, only leaf pages keep it, and it makes the index bigger. With every column the query reads in the leaf, the planner can switch from an Index Scan to an Index Only Scan.

The visibility map takes care of the second reason. It keeps a bit for each table page, set when every row on the page is visible to all transactions. For each entry it finds, an index-only scan checks the bit for the row's page. If the bit is set, the scan returns the tag from the leaf and never reads the table. If it is clear, the scan visits the page to check the row, and the lookup costs as much as a plain index scan.

Any change to a page clears its bit, and only vacuum sets it again. Ratings change after every match, so busy pages seldom stay all-visible: one rating update for player 4130 costs every lookup on page 3 a table visit until the next vacuum. Index-only scans pay off on tables whose rows rarely change. In `EXPLAIN ANALYZE` output these visits show up as Heap Fetches, because the table's storage is called the heap.
