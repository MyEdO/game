import { describe, it, expect, afterEach } from 'vitest';
import { effectiveMaxWounds } from './characteristics';
import { extraWounds, fortuneMax, resolveMax } from './talentEffects';
import type { OpPassive } from './ops';
import type { Combatant } from './types';
import { datasetArray, resetData, setDataset } from '../data/overrides';

/**
 * `attrMod` PASSIF lu sur TOUT porteur du collecteur `passiveMods` (#3060). Inventaire des porteurs et de
 * leur branche de collecte : `trauma.ts › passiveMods`. Un talent compte dans `wounds.base`
 * (`extraWounds`) ; tout autre porteur compte au delta d'`effectiveMaxWounds`.
 */

/** F 38 (BF 3), E 35 (BE 3), FM 31 (BFM 3) : B = 12. */
const heros = (): Combatant => ({
  id: 'h', label: 'Héros', kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 38, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 31, sociabilite: 30 },
  movement: 4, wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [],
  skills: [], talents: [], weapons: [], traits: [], items: [], mutations: [], traumas: [], activeEffects: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

const ID = 'porteur-de-test';

/** Ajoute au dataset `cle` une entrée fabriquée qui porte `passive`, par le seam `setDataset`. */
const ajouter = (cle: 'traits' | 'etats' | 'psychologies' | 'symptoms' | 'talents', entree: Record<string, unknown>) =>
  setDataset(cle, [...datasetArray(cle), { id: ID, label: 'Porteur de test', ...entree }] as never);

/** Chaque porteur du collecteur hors talents : il pose `passive` sur le combattant. */
const PORTEURS: [string, (c: Combatant, passive: OpPassive[]) => void][] = [
  ['mutation', (c, passive) => { c.mutations = [{ id: ID, label: 'Mutation de test', passive } as never]; }],
  ['objet porté', (c, passive) => { c.items = [{ uid: 'o1', trappingId: ID, label: 'Objet de test', equipped: true, passive } as never]; }],
  ['séquelle', (c, passive) => { c.traumas = [{ label: 'Séquelle de test', location: 'corps', ops: passive } as never]; }],
  ['effet actif', (c, passive) => { c.activeEffects = [{ label: 'Effet de test', bonus: 0, duration: { scale: 'permanent' }, passive }]; }],
  ['Trait appliqué', (c, passive) => { ajouter('traits', { passive }); c.liveTraits = [{ id: ID } as never]; }],
  ['État', (c, passive) => { ajouter('etats', { passive }); c.conditions = [{ id: ID, value: 1 } as never]; }],
  ['État psychologique', (c, passive) => { ajouter('psychologies', { passive }); c.psychState = [{ type: ID } as never]; }],
  ['symptôme', (c, passive) => { ajouter('symptoms', { passive }); c.diseases = [{ id: 'maladie-de-test', phase: 'active', symptoms: [{ symptomId: ID }] } as never]; }],
];

afterEach(() => resetData());

describe('attrMod de Blessures passif — tout porteur hors talent compte au delta des Blessures max', () => {
  it.each(PORTEURS)('%s : +3 Blessures, puis +BE (formule) ; sans le porteur, 12', (_, poser) => {
    const c = heros();
    expect(effectiveMaxWounds(c)).toBe(12);
    poser(c, [{ op: 'attrMod', attr: 'wounds', mod: 3 }]);
    expect(effectiveMaxWounds(c)).toBe(15);
    const d = heros();
    poser(d, [{ op: 'attrMod', attr: 'wounds', mod: { bonusOf: 'endurance' } }]);
    expect(effectiveMaxWounds(d)).toBe(15);
  });

  it('talent : ses Blessures sont dans `wounds.base` (`extraWounds`), jamais recomptées au delta', () => {
    const c = heros();
    ajouter('talents', { passive: [{ op: 'attrMod', attr: 'wounds', mod: 3 }] });
    c.talents = [{ talentId: ID, times: 2 }];
    expect(extraWounds(c)).toBe(6);
    expect(effectiveMaxWounds(c)).toBe(12);
  });
});

describe('attrMod de Chance et de Détermination passif — tout porteur, talents compris', () => {
  it.each([...PORTEURS, ['talent', (c: Combatant, passive: OpPassive[]) => { ajouter('talents', { passive }); c.talents = [{ talentId: ID, times: 1 }]; }] as const])(
    '%s : +1 Chance, +2 Détermination',
    (_, poser) => {
      const c = { ...heros(), fate: 2, resilience: 1 } as Combatant;
      poser(c, [{ op: 'attrMod', attr: 'fortune', mod: 1 }, { op: 'attrMod', attr: 'resolve', mod: 2 }]);
      expect(fortuneMax(c)).toBe(3);
      expect(resolveMax(c)).toBe(3);
    },
  );
});
