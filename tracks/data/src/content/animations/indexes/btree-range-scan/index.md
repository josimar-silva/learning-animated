---
id: btree-range-scan
section: indexes
order: 2
title: Scanning a range
description: Matchmaking asks for players rated 4120 to 4210. The scan goes down the index once to the leaf that holds 4120, reads to the right, follows a right-link to the next leaf, and stops at 4240, the first key past 4210.
objective: See why a range query goes down a B-tree only once, then follows right-links along the leaf pages until it passes the end of the range.
references:
  - label: 'PostgreSQL manual: B-Tree structure'
    url: https://www.postgresql.org/docs/current/btree.html#BTREE-STRUCTURE
  - label: 'PostgreSQL source: nbtree README'
    url: https://github.com/postgres/postgres/blob/master/src/backend/access/nbtree/README
steps:
  - at: 0
    text: 'The scan goes down the tree once, the way a lookup does: root page, internal page, then the leaf that holds 4120.'
  - at: 5
    text: 'A leaf keeps its keys sorted, so the scan reads to the right: 4150 and 4165 are in the range too.'
  - at: 8
    text: 'At the end of the leaf, the scan follows the right-link to the next leaf. It never goes back up to a parent page.'
  - at: 12
    text: '4240 is the first key past 4210, so the scan stops. It read four of the seven pages.'
---

Matchmaking looks for opponents with a rating close to the player's own. For a player rated 4165, the game asks for `rating BETWEEN 4120 AND 4210`, and the index on `players (rating)` answers in two moves. First the scan goes down the tree once, the way a lookup does. The root page and an internal page each compare 4120 with a separator key and send the scan toward the leaf page where 4120 belongs.

Then the scan walks sideways. A leaf page keeps its keys sorted, so the ratings in the range sit next to each other, and the scan reads them from left to right. Every page also links to the next page on its level. When the scan reaches the end of a leaf, it follows that right-link to the next leaf instead of climbing back to a parent and coming down again. Here the next leaf even hangs under a different internal page, and the scan never reads that page. Once the scan has found where the range starts, it reads only leaf pages.

The scan stops at the first key past the end of the range, 4240, and never reads the leaves further right. In all it read four pages: one per level on the way down, then one more leaf. The six rows include the player who asked, rated 4165, so the game offers the other five as opponents. The sixteen ratings here stand in for millions of players. Real pages hold hundreds of keys each, but with that many players a window of 90 rating points can still span many leaves, and the scan walks them the same way: one descent, then right-links.

Pages link to their left neighbor too, so a leaderboard, which wants `ORDER BY rating DESC`, walks the leaves from right to left, starting at the highest rating. In either direction the rows come out in rating order, which lets a query that sorts by rating skip the sort.
