import { describe, it, expect } from 'vitest';
import { scenario } from './entrainement';
import { layerTiles } from '../../state/scene';
const scenarioConstruit = scenario.construire();

/**
 * Verrouille la Scene PRODUITE par `buildScene` dans `entrainement.ts` : dimensions, terrain 'sol' plein
 * avec le muret de couvert (colonne x=11, rangées 3-6 en 'mur'), braséros, trigger de lice, et la rencontre
 * (3 mannequins statblock + 2 gobelins + 1 cheval monture alliée).
 */

const W = 24, H = 14;

describe('entrainement — Scene produite par buildScene', () => {
  const s = scenarioConstruit.scene;

  it('dimensions, une couche, nuit', () => {
    expect(s.dimensions).toEqual({ w: W, h: H });
    expect(s.layers.map((l) => l.z)).toEqual([0]);
    expect(s.ambientLight).toBe('nuit');
    expect(s.id).toBe('terrain-entrainement');
  });

  it("terrain 'sol' plein sauf le muret de couvert (x=11, y=3..6 = 'mur')", () => {
    const tiles = layerTiles(s, 0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const expected = x === 11 && y >= 3 && y <= 6 ? 'mur' : 'sol';
        expect(tiles[y * W + x]).toBe(expected);
      }
    }
  });

  it('départ héros à (3,8)', () => {
    const hero = s.entities.find((e) => e.kind === 'heroStart');
    expect(hero?.pos).toEqual({ x: 3, y: 8 });
  });

  it('braséros posés (halos de lumière)', () => {
    const lice = s.entities.find((e) => e.id === 'brasero-lice');
    const couloir = s.entities.find((e) => e.id === 'brasero-couloir');
    expect(lice).toMatchObject({ kind: 'prop', ref: 'brasero', pos: { x: 14, y: 8 } });
    expect(couloir).toMatchObject({ kind: 'prop', ref: 'brasero', pos: { x: 8, y: 11 } });
  });

  it('trigger de lice (bande x=7 → journal + startCombat)', () => {
    expect(s.triggers).toHaveLength(1);
    expect(s.triggers[0]).toMatchObject({ id: 'entrer-en-lice', rect: { x: 7, y: 1, w: 1, h: 12 }, once: true });
  });

  it('rencontre : 3 mannequins + 2 gobelins + 1 cheval monture alliée', () => {
    expect(s.encounters).toHaveLength(1);
    const enc = s.encounters[0];
    expect(enc.id).toBe('enc-entrainement');
    expect(enc.members!.map((m) => m.entityId)).toEqual([
      'enemy-enc-entrainement-0',
      'enemy-enc-entrainement-1',
      'enemy-enc-entrainement-2',
      'enemy-enc-entrainement-3',
      'enemy-enc-entrainement-4',
      'enemy-enc-entrainement-5',
    ]);

    const ent = (i: number) => s.entities.find((e) => e.id === `enemy-enc-entrainement-${i}`);
    // 3 mannequins (statblock custom, M 0)
    expect(ent(0)?.statblock?.label).toBe("Mannequin d'entraînement");
    expect(ent(0)?.pos).toEqual({ x: 13, y: 10 });
    expect(ent(1)?.pos).toEqual({ x: 13, y: 5 });
    expect(ent(2)?.pos).toEqual({ x: 21, y: 2 });
    expect(ent(0)?.statblock?.char.M).toBe(0);
    // 2 gobelins
    expect(ent(3)).toMatchObject({ ref: 'gobelin', pos: { x: 15, y: 7 } });
    expect(ent(4)).toMatchObject({ ref: 'gobelin', pos: { x: 16, y: 9 } });
    // cheval : monture alliée
    expect(ent(5)).toMatchObject({ ref: 'cheval', pos: { x: 5, y: 10 } });
    const chevalMember = enc.members!.find((m) => m.entityId === 'enemy-enc-entrainement-5');
    expect(chevalMember?.mount).toBe(true);
    expect(chevalMember?.side).toBe('ally');
  });
});
