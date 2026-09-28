/**
 * La résolution `RaceAppearanceData` → `RaceDef` est mémoïsée par IDENTITÉ DE RÉFÉRENCE, et elle
 * l'est par la primitive canonique `memoByRef` (`src/state/sceneMemo.ts`) — pas par une WeakMap
 * maison réinventée sur place (#1440). Deux moitiés : le COMPORTEMENT (même réf de donnée → même
 * `RaceDef`, sinon chaque frame reconstruit les overlays de features) et le CÂBLAGE (aucun cache
 * privé dans le module).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { raceById, RACES } from './index';
import { DEFAULT_RACE_ID } from '../../../data';

const SRC = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8');

describe('rig/races — mémoïsation par la primitive canonique (#1440)', () => {
  it('même race demandée deux fois → la MÊME `RaceDef` (aucune reconstruction)', () => {
    expect(raceById(DEFAULT_RACE_ID)).toBe(raceById(DEFAULT_RACE_ID));
    expect(RACES[DEFAULT_RACE_ID]).toBe(raceById(DEFAULT_RACE_ID));
  });

  it('le module compose `memoByRef` au lieu d\'un cache privé', () => {
    expect(SRC).toContain("import { memoByRef } from '../../../state/sceneMemo'");
    expect(SRC.includes('new WeakMap'), 'cache maison réinventé — composer `memoByRef` (src/state/sceneMemo.ts)').toBe(false);
  });
});
