import { describe, it, expect } from 'vitest';
import { scenario } from './embuscade';
import { layerTiles } from '../../state/scene';
import { findTrappingById } from '../../data/index';
import { weaponFromTrait } from '../../engine/creatureEquip';
const scenarioConstruit = scenario.construire();

/**
 * Verrouille la Scene PRODUITE par `buildScene` dans `embuscade.ts` : dimensions, terrain case-à-case
 * (route/bois recalculés indépendamment comme l'ancienne construction impérative), props de carnage,
 * dialogue à 2 nœuds, trigger d'approche, et la rencontre des 5 mutants (visibles, ids/positions/statblocs).
 */

const W = 20, H = 14;

/** Recalcule le terrain attendu par une référence indépendante (légende R/B → grille), pour vérifier `buildScene`. */
function expectedTiles(): string[] {
  const t: string[] = new Array(W * H).fill('herbe');
  const set = (x: number, y: number, v: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v;
  };
  for (let x = 0; x < W; x++) {
    set(x, 6, 'route');
    set(x, 7, 'route');
  }
  for (let x = 0; x < W; x++) {
    set(x, 0, 'bois');
    set(x, 1, 'bois');
    set(x, 13, 'bois');
    set(x, 12, 'bois');
    if (x % 2 === 0) set(x, 2, 'bois');
    if (x % 3 === 0) set(x, 11, 'bois');
  }
  for (const [x, y] of [[4, 3], [9, 3], [14, 3], [18, 2], [3, 10], [8, 10], [13, 9], [18, 10]] as const) set(x, y, 'bois');
  return t;
}

describe('embuscade — Scene produite par buildScene', () => {
  const s = scenarioConstruit.scene;

  it('dimensions et une seule couche z0', () => {
    expect(s.dimensions).toEqual({ w: W, h: H });
    expect(s.layers.map((l) => l.z)).toEqual([0]);
    expect(s.ambiance).toBe('exterieur');
    expect(s.id).toBe('ambush-test');
  });

  it('terrain case-à-case identique à la construction impérative de référence', () => {
    expect(layerTiles(s, 0)).toEqual(expectedTiles());
  });

  it('départ héros à (2,7)', () => {
    const hero = s.entities.find((e) => e.kind === 'heroStart');
    expect(hero?.pos).toEqual({ x: 2, y: 7 });
  });

  it('props de carnage (épave, attelage, corps, sang) posés', () => {
    const prop = (id: string) => s.entities.find((e) => e.id === id);
    expect(prop('epave')).toMatchObject({ kind: 'prop', ref: 'epave-carrosse', pos: { x: 15, y: 6 } });
    expect(prop('cheval')).toMatchObject({ kind: 'prop', ref: 'cheval-mort', pos: { x: 12, y: 6 } });
    expect(prop('corps1')).toMatchObject({ ref: 'cadavre', pos: { x: 11, y: 7 } });
    expect(prop('corps2')?.pos).toEqual({ x: 14, y: 8 });
    expect(prop('corps3')?.pos).toEqual({ x: 17, y: 8 });
    expect(prop('sang1')).toMatchObject({ ref: 'mare-sang', pos: { x: 13, y: 7 } });
    expect(prop('sang2')?.pos).toEqual({ x: 15, y: 7 });
    expect(prop('sang3')?.pos).toEqual({ x: 16, y: 8 });
    expect(prop('sang4')?.pos).toEqual({ x: 12, y: 8 });
  });

  it('dialogue à 2 nœuds, flow inchangé', () => {
    expect(s.dialogues).toHaveLength(1);
    const dlg = s.dialogues[0];
    expect(dlg.id).toBe('dlg-ambush');
    expect(dlg.start).toBe('a1');
    expect(dlg.nodes.map((n) => n.id)).toEqual(['a1', 'a2']);
    expect(dlg.nodes[0].choices).toHaveLength(2);
    expect(dlg.nodes[0].choices[1].next).toBe('a2');
    expect(dlg.nodes[1].choices).toHaveLength(1);
  });

  it('trigger d’approche (rect → dialogue)', () => {
    expect(s.triggers).toHaveLength(1);
    expect(s.triggers[0]).toMatchObject({ id: 'approche', rect: { x: 8, y: 6, w: 3, h: 2 }, once: true });
  });

  it('rencontre des 5 mutants — visibles, ids/positions/statblocs', () => {
    expect(s.encounters).toHaveLength(1);
    const enc = s.encounters[0];
    expect(enc.id).toBe('enc-mutants');
    expect(enc.members).toEqual([
      { entityId: 'enemy-enc-mutants-0' },
      { entityId: 'enemy-enc-mutants-1' },
      { entityId: 'enemy-enc-mutants-2' },
      { entityId: 'enemy-enc-mutants-3' },
      { entityId: 'enemy-enc-mutants-4' },
    ]);
    expect(enc.onVictory).toBeDefined();

    const chef = s.entities.find((e) => e.id === 'enemy-enc-mutants-0');
    expect(chef).toMatchObject({ ref: 'mutant', anim: 'standing', pos: { x: 18, y: 6 } });
    expect(chef?.statblock?.label).toBe('Knud Cratinx');
    expect(chef?.statblock?.char['capacite-de-tir']).toBe(43);
    // Arme de rendu DÉRIVÉE du Trait (À distance (arbalète)) — plus de `weapon:` d'authoring redondant
    // avec le Trait de combat (dédoublonnage #145, cf. `renderWeaponsFromTraits`).
    expect(chef?.statblock?.traits).toContainEqual({ id: 'a-distance', value: 9, arg: 'arbalete', range: 60 });
    expect(chef?.weapon).toBeUndefined();
    expect(chef?.appearance).toEqual({ species: 'humains-reiklander', monster: { tete: 'lezard' } });
    // VISIBLE : hidden par défaut → pas de hiddenUntilCombat sur les mutants qu'on voit se repaître.
    expect(chef?.combat?.hiddenUntilCombat).toBeUndefined();

    const positions = ['enemy-enc-mutants-0', 'enemy-enc-mutants-1', 'enemy-enc-mutants-2', 'enemy-enc-mutants-3', 'enemy-enc-mutants-4'].map(
      (id) => s.entities.find((e) => e.id === id)?.pos,
    );
    // Les mutants encerclent l'épave SANS naître dedans : elle occupe 3×2 depuis (15,6), le corps d'une
    // diligence à sa taille réelle (`props.json` `epave-carrosse`, #1343 lot D1) — cf. le balayage
    // `src/scenes/prop-footprint-occupancy.test.ts`.
    expect(positions).toEqual([
      { x: 18, y: 6 },
      { x: 18, y: 7 },
      { x: 14, y: 8 },
      { x: 14, y: 7 },
      { x: 12, y: 7 },
    ]);
    const terenz = s.entities.find((e) => e.id === 'enemy-enc-mutants-4');
    // Idem : Grande hache DÉRIVÉE du Trait (plus de `weapon:` d'authoring redondant, #145).
    expect(terenz?.weapon).toBeUndefined();
    expect(terenz?.statblock?.traits).toContainEqual({ id: 'arme', value: 7, arg: 'grande-hache' });
    expect(terenz?.statblock?.label).toBe('Terenz');
  });

  it('chaque mutant porte une arme IDENTIFIÉE au catalogue — le libellé rendu est celui de la Possession', () => {
    const enc = s.encounters[0];
    const attendus: Record<string, string> = {
      'enemy-enc-mutants-0': 'Arme simple',
      'enemy-enc-mutants-1': 'Massue',
      'enemy-enc-mutants-2': 'Couteau',
      'enemy-enc-mutants-3': 'Dague',
      'enemy-enc-mutants-4': 'Grande hache',
    };
    expect(enc.members?.length).toBe(5);
    for (const m of enc.members ?? []) {
      const e = s.entities.find((x) => x.id === m.entityId);
      const traits = (e?.statblock?.traits ?? []).filter((t) => t.id === 'arme' || t.id === 'a-distance');
      expect(traits.length).toBeGreaterThan(0);
      for (const t of traits) {
        const trapping = t.arg ? findTrappingById(t.arg) : undefined;
        expect(trapping?.categorie).toBe(t.id === 'a-distance' ? 'ranged' : 'melee');
      }
      const melee = traits.find((t) => t.id === 'arme');
      expect(weaponFromTrait(melee!)?.label).toBe(attendus[m.entityId]);
    }
  });
});
