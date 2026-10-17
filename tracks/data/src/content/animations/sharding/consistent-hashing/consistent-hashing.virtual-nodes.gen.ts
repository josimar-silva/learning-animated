import { renderView } from './consistent-hashing.story.ts';

export function render(): string {
  return renderView({
    note: "Three points per server, its virtual nodes. The first point clockwise from a player stores the player's profile.",
    desc:
      'An animation in four steps. Database servers db-0, db-1, db-2, and db-3 each hash to three points on a ring, called virtual nodes, which cut it into 12 shorter arcs. ' +
      "Twenty players hash onto the same ring by player id, and each walks clockwise to the first point it meets. Egret walks to db-2#3, one of db-2's points, and the servers end up storing between 4 and 6 profiles each. " +
      'A fifth server, db-4, hashes to three points that split arcs of db-3, db-2, and db-1, and takes 4 players: Heron and Otter from db-3, Petrel from db-2, and Newt from db-1. ' +
      'The other 16 players stay where they were, and the player counts show the loads ending between 3 and 5.',
    points: [
      { server: 'db-0', label: 'db-0#1', position: 97 },
      { server: 'db-0', label: 'db-0#2', position: 50 },
      { server: 'db-0', label: 'db-0#3', position: 68 },
      { server: 'db-1', label: 'db-1#1', position: 11 },
      { server: 'db-1', label: 'db-1#2', position: 39 },
      { server: 'db-1', label: 'db-1#3', position: 61 },
      { server: 'db-2', label: 'db-2#1', position: 54 },
      { server: 'db-2', label: 'db-2#2', position: 79 },
      { server: 'db-2', label: 'db-2#3', position: 17 },
      { server: 'db-3', label: 'db-3#1', position: 85 },
      { server: 'db-3', label: 'db-3#2', position: 32 },
      { server: 'db-3', label: 'db-3#3', position: 45 },
    ],
    joined: [
      { server: 'db-4', label: 'db-4#1', position: 27 },
      { server: 'db-4', label: 'db-4#2', position: 74 },
      { server: 'db-4', label: 'db-4#3', position: 4 },
    ],
    captions: [
      'Three points per server, called virtual nodes. The 12 points cut the ring into 12 shorter arcs.',
      "Egret walks clockwise to db-2#3, one of db-2's three points. Every player does the same, and the loads run from 4 to 6.",
      "Server db-4's three points split arcs of db-3, db-2, and db-1. Each takes only the players between the previous point and itself.",
      'The 4 moved players came from db-3, db-2, and db-1. The loads now run from 3 to 5, around the even share of 4.',
    ],
  });
}
