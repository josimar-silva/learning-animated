import { renderView } from './consistent-hashing.story.ts';

export function render(): string {
  return renderView({
    note: "One point per server. The first server point clockwise from a player stores the player's profile.",
    desc:
      'An animation in four steps. Database servers db-0, db-1, db-2, and db-3 each hash to one point on a ring, and the points land unevenly. ' +
      "Twenty players hash onto the same ring by player id, and each walks clockwise to the first server point it meets. Egret walks to db-2's point, and db-2 ends up storing 11 of the 20 profiles while db-1 stores 1. " +
      "A fifth server, db-4, lands inside db-2's arc and takes the 4 players between db-1's point and its own: Egret, Stoat, Heron, and Otter, all from db-2. The other 16 players stay where they were. " +
      'The player counts then show the loads before and after: db-2 drops from 11 to 7, db-3 keeps 6, db-0 2, and db-1 1, and db-4 stores 4.',
    points: [
      { server: 'db-0', label: 'db-0', position: 97 },
      { server: 'db-1', label: 'db-1', position: 11 },
      { server: 'db-2', label: 'db-2', position: 54 },
      { server: 'db-3', label: 'db-3', position: 85 },
    ],
    joined: [{ server: 'db-4', label: 'db-4', position: 27 }],
    captions: [
      "One point per server. The points land unevenly, and db-2's arc covers almost half the ring.",
      "Egret walks clockwise to db-2's point. Every player does the same, so db-2 stores 11 of the 20.",
      "Server db-4 lands inside db-2's arc. Egret, Stoat, Heron, and Otter now meet db-4's point first.",
      'All 4 moved players came from db-2, which still stores 7 while db-1 stores 1, so the loads stay uneven.',
    ],
  });
}
