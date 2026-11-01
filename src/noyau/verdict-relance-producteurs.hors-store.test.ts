import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { battleRng } from './battleRng';
import { createHero } from '../engine/character';
import { compteDuCoup, resolveStrayRangedHit, toucheAuJetPose, toucheDuTestDeDefense, type AttackResult } from '../engine/combat';
import { setRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Chaque producteur fait naître le verdict de relance sur la cible que le compte lit, d'après son état à la
 *  naissance. AA 07 l.25 ; LDB 18 l.53, l.55 ; LDB 14 l.136 ; LDB 10 l.1037 ; MDG 14 l.128. */

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
const arc = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, qualities: [], range: 50 } as unknown as Weapon;
/** Un jet réussi, sans double. */
const jet = { label: 'Test', roll: 37, target: 90, success: true, sl: 5, isDouble: false } as never;

function combat(current: number): { H: Combatant; cible: Combatant } {
  banc.getState().seedRng(5);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
  banc.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
  banc.getState().startScene(structuredClone(testScene()));
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const cible = b.combatants.find((c) => c.kind === 'enemy')!;
  cible.wounds = blessuresDeBase(20, current, cible);
  cible.important = true;
  return { H, cible };
}

const producteurs: readonly (readonly [string, (H: Combatant, cible: Combatant) => AttackResult, Weapon])[] = [
  ['tir dévié (resolveStrayRangedHit)', (H, cible) => resolveStrayRangedHit(H, cible, arc, 37, 90, { rng: battleRng() }), arc],
  ['Riposte (toucheDuTestDeDefense)', (H, cible) => toucheDuTestDeDefense(H, cible, epee, jet, 1, { rng: battleRng() }), epee],
  ['jet posé, bordée et marin (toucheAuJetPose)', (H, cible) => toucheAuJetPose(H, cible, epee, jet, 1, { rng: battleRng() }), epee],
];

describe('le verdict de relance naît sur la cible au compte, pour chaque producteur', () => {
  beforeEach(() => { setRule('combat-aa-blessures', 'aa'); setRule('combat-sudden-death', 'off'); });

  for (const [nom, produire, arme] of producteurs) for (const current of [0, 3]) it(`${nom}, coup non critique, cible à ${current} Blessure`, () => {
    const { H, cible } = combat(current);
    const res = produire(H, cible);
    expect(res.hit).toBe(true);
    expect(res.critical).toBeFalsy();
    expect(res.critLocation !== undefined, 'AA 07 l.25').toBe(current === 0);
    expect(compteDuCoup(res, arme, H, cible, 0).compte.relance).toBe(current === 0);
  });
});
