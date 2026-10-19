import { describe, it, expect } from 'vitest';
import { combatantAtTile } from '../noyau/monde/combatGeometry';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';
import type { Pt } from '../noyau/monde/path';

/**
 * `combatantAtTile` — source UNIQUE z-aware de « qui est sous cette tuile » pour l'interaction
 * (survol/clic/curseur). Garantit qu'une structure/un combattant ancré à z0 n'est PAS l'occupant de la
 * case de rempart z1 de mêmes (x,y) — c'est le « hors de portée » fantôme du rempart que la refacto corrige.
 */
const C = (id: string, pos: Pt, over: Partial<Combatant> = {}): Combatant =>
  ({ id, pos, conditions: [], dead: false, wounds: { current: 10, max: 10 }, ...over }) as unknown as Combatant;

const big = (id: string, pos: Pt, size: SizeCategory): Combatant => C(id, pos, { size });

describe('combatantAtTile — lookup z-aware « qui est sous cette tuile »', () => {
  it('deux combattants à mêmes (x,y) mais étages différents → l’étage interrogé départage', () => {
    const ground = C('sol', { x: 4, y: 4 });            // z absent = z0
    const rampart = C('rempart', { x: 4, y: 4, z: 1 }); // au-dessus, sur le chemin de ronde
    const all = [ground, rampart];
    expect(combatantAtTile(all, 4, 4, 0)?.id).toBe('sol');     // z0 → l’occupant du sol
    expect(combatantAtTile(all, 4, 4, 1)?.id).toBe('rempart'); // z1 → l’occupant du rempart
    expect(combatantAtTile(all, 4, 4)?.id).toBe('sol');        // z par défaut = 0
  });

  it('une STRUCTURE ancrée à z0 n’occupe PAS la case de rempart z1 de mêmes (x,y)', () => {
    // Reproduit le bug : un mur (z0) sous une case de chemin de ronde (z1). Survoler le dessus du rempart
    // ne doit PAS matcher la muraille en contrebas (sinon « hors de portée » fantôme + déplacement bloqué).
    const wall = C('mur', { x: 2, y: 2 }, { bodyShape: 'structure' });
    expect(combatantAtTile([wall], 2, 2, 0)?.id).toBe('mur'); // sa propre case d’ancrage
    expect(combatantAtTile([wall], 2, 2, 1)).toBeUndefined();  // le rempart z1 est libre → climb/déplacement
  });

  it('une empreinte 2×2 couvre ses tuiles UNIQUEMENT à son propre étage', () => {
    const ogre = big('ogre', { x: 5, y: 5 }, 'grande'); // 2×2 → (5,5)(6,5)(5,6)(6,6) à z0
    expect(combatantAtTile([ogre], 6, 6, 0)?.id).toBe('ogre'); // coin SE du bloc
    expect(combatantAtTile([ogre], 5, 5, 0)?.id).toBe('ogre'); // coin NO (ancre)
    expect(combatantAtTile([ogre], 7, 5, 0)).toBeUndefined();  // hors du 2×2
    expect(combatantAtTile([ogre], 6, 6, 1)).toBeUndefined();  // même bloc, mais à l’étage du dessus → rien
  });

  it('un combattant hors d’action (mort) est exclu', () => {
    const corpse = C('mort', { x: 1, y: 1 }, { dead: true });
    const alive = C('vif', { x: 1, y: 1, z: 2 });
    expect(combatantAtTile([corpse], 1, 1, 0)).toBeUndefined(); // mort → jamais l’occupant
    expect(combatantAtTile([corpse, alive], 1, 1, 2)?.id).toBe('vif');
  });
});
