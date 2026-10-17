---
id: btree-page-split
section: indexes
order: 3
title: Splitting a full leaf
description: A new player finishes placement at rating 4135, and its entry in the index belongs on a leaf that is already full. The leaf splits in two, a new right sibling takes the higher keys, and the root gains one separator and a downlink to the new page.
objective: See how a page split makes room on a full leaf, and why every leaf is still at the same depth afterward.
references:
  - label: 'PostgreSQL documentation: B-Tree structure'
    url: https://www.postgresql.org/docs/current/btree.html#BTREE-STRUCTURE
  - label: 'PostgreSQL source: the nbtree README'
    url: https://github.com/postgres/postgres/blob/master/src/backend/access/nbtree/README
steps:
  - at: 0
    text: 'A new player finishes placement at rating 4135. That is at least 4102 and below 4190, so the root sends it to the second leaf, which is full.'
  - at: 6
    text: 'The leaf splits: 4150, 4171, and the high key 4190 move to a new right sibling, 4135 goes in on the left, and the links are rewired.'
  - at: 11
    text: 'The left page gets a new high key: 4150, the first key on the new page. It now separates the two pages.'
  - at: 15
    text: 'The parent, here the root, gets a downlink to the new page under 4150. Every leaf is still one level below the root.'
---

The index on `players(rating)` keeps ratings in key order across its leaf pages, and each page has room for only so many entries. The game has millions of players, and the real index has many more leaves, each holding far more entries. Here a leaf holds three, so the whole tree fits on screen.

A new player has just finished their placement matches with a rating of 4135, which adds an entry to the index. A new rating can fall anywhere among the existing ones, so the entry can land on any leaf: here, a full one in the middle of the index. In an index on `player_id`, a new player's entry would always go on the rightmost leaf, because player ids grow as players sign up.

When an entry belongs on a leaf that is already full, the database first tries to make room on that leaf. It removes entries for dead rows if there are any, and if that doesn't free enough space, it merges entries that share a rating into one entry that stores the rating once. Here none of the rows is dead and no two ratings match, so the leaf splits. A new page takes a portion of the keys, the higher ones, and the incoming key goes in on whichever side it belongs. The new page becomes the right sibling of the old one. Each level of the tree is a list of pages linked in both directions, so the old page now links to the new page, and the new page links to the old page's former right neighbor.

Every page except the rightmost one on its level has a high key, an upper bound on the keys allowed on that page. The animation draws it as the dark cell at the right end of a leaf. The new page takes over the old high key, 4190, and the left page gets a new one: 4150, the first key on the new page. The same key goes up to the parent as the separator for the new page's downlink, so a search for a rating from 4150 up to, but not including, 4190 now goes from the root straight to the new page. The root's first downlink has no separator. The animation writes it as -∞, because it covers every rating below 4102.

Until the parent has the new downlink, searches can still reach the new page. A search for 4171 still follows the root's downlink under 4102 to the left page, sees that 4171 is above that page's high key, 4150, and follows the right-link.

The parent gains one entry, and no leaf moves up or down. If the parent is full too, it splits the same way and sends a separator up to its own parent, so splits can cascade upward until a page has room. When the root has no room for a new downlink, the root splits, and a new root is created one level above the two halves. That is the only way the tree grows taller, and it adds a level above all the leaves at once. Every leaf stays at the same depth, so a search for any rating goes down the same number of levels.
