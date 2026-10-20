import { describe, it, expect } from 'vitest';
import { bestAdjacentReachable } from '../noyau/combatFlow';

// Bug signalé : « les grandes créatures prennent plusieurs cases mais une seule est attaquable ». Cause = la
// recherche de case d'arrivée pour rejoindre la cible ne testait l'adjacence qu'à l'ANCRE (`chebyshev === 1`),
// pas à l'EMPREINTE entière. Un grand (créature OU navire, footprint N×N) doit pouvoir être rejoint/frappé
// depuis n'importe quel côté de son bloc.
describe('Ciblage multi-cases — rejoindre un grand depuis N\'IMPORTE quel côté de son empreinte', () => {
  it('bestAdjacentReachable : une case adjacente au bord OPPOSÉ du bloc N×N est valide (plus seulement l\'ancre)', () => {
    // Cible 2×2 ancrée en (5,5) → occupe 5,5 / 6,5 / 5,6 / 6,6.
    const reach = new Map<string, number>([
      ['4,5', 2], // adjacent au bord OUEST (ancre) — déjà accepté avant
      ['7,6', 3], // adjacent au bord EST (6,6) — l'ancre (5,5) est à chebyshev 2 → ÉTAIT refusé (le bug)
      ['8,8', 5], // à 2 cases du bloc → hors d'atteinte
    ]);
    expect(bestAdjacentReachable(reach, { x: 5, y: 5 }, 2)).toEqual({ x: 4, y: 5 }); // la moins chère des cases adjacentes
    // la case du bord OPPOSÉ est désormais RECONNUE adjacente (le cœur du correctif)
    expect(bestAdjacentReachable(new Map([['7,6', 3]]), { x: 5, y: 5 }, 2)).toEqual({ x: 7, y: 6 });
    // une case à 2 du bloc n'est jamais adjacente
    expect(bestAdjacentReachable(new Map([['8,8', 5]]), { x: 5, y: 5 }, 2)).toBeNull();
  });

  it('rétro-compat 1×1 : identique à l\'ancienne adjacence chebyshev===1', () => {
    expect(bestAdjacentReachable(new Map([['3,2', 1], ['5,5', 2]]), { x: 2, y: 2 })).toEqual({ x: 3, y: 2 });
    expect(bestAdjacentReachable(new Map([['5,5', 2]]), { x: 2, y: 2 })).toBeNull(); // trop loin
  });
});
