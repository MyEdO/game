/**
 * `attrMod` de Blessures d'un Trait du statbloc (`statblockToCombatant`) : un B explicite est réputé final,
 * Traits compris (LDB 77 l.91-95 ; #1463) ; sans B, la formule reçoit l'`attrMod` dès le spawn.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { statblockToCombatant } from './spawn';
import { datasetArray, resetData, setDataset } from '../../data/overrides';

const TRAIT = 'trait-de-test';

afterEach(() => resetData());

/** Pose au catalogue un Trait fabriqué qui porte « +3 Blessures », par le seam `setDataset`. */
const poserLeTrait = () =>
  setDataset('traits', [...datasetArray('traits'), { id: TRAIT, label: 'Trait de test', passive: [{ op: 'attrMod', attr: 'wounds', mod: 3 }] }] as never);

const statbloc = (B?: number, avecTrait = true) => ({
  type: 'statblock' as const,
  label: 'Fixture',
  char: { force: 30, endurance: 30, 'force-mentale': 30, ...(B != null ? { B } : {}) },
  traits: avecTrait ? [{ id: TRAIT }] : [],
});

describe('statbloc : `attrMod` de Blessures d’un Trait', () => {
  it('B explicite : le maximum et le courant valent B, le Trait n’y ajoute rien', () => {
    poserLeTrait();
    expect(statblockToCombatant(statbloc(20), 'f', { x: 0, y: 0 }).wounds).toMatchObject({ max: 20, current: 20 });
  });

  it('sans B : la formule, plus l’`attrMod` du Trait, au maximum comme au courant', () => {
    poserLeTrait();
    const nu = statblockToCombatant(statbloc(undefined, false), 'f', { x: 0, y: 0 }).wounds.max;
    expect(statblockToCombatant(statbloc(), 'f', { x: 0, y: 0 }).wounds).toMatchObject({ max: nu + 3, current: nu + 3 });
  });
});
