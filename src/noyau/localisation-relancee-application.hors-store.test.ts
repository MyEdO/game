import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { battleRng, seedBattleRng } from './battleRng';
import { applyAttackResult } from './combatFlow';
import { draineCascade } from './cascade.testkit';
import { createHero } from '../engine/character';
import { rederivePassiveAttack, hitLocationByShape } from '../engine/combat';
import { critLocationRoll, critTableRows, critTableKeyFor } from '../engine/critical';
import { makeRNG } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import { testScene } from '../scenes/test-fixture';
import { locationLabel, type Combatant, type HitLocation, type Weapon } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** T7 — le d100 de la Localisation relancée est consommé au JET, jamais à l'application. LDB 18 l.53, l.55 ; #1595 c.6226467544. */

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;

function arene() {
  banc.getState().seedRng(7);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
  banc.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
  banc.getState().startScene(structuredClone(testScene()));
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const cible = b.combatants.find((c) => c.kind === 'enemy')!;
  cible.wounds = { current: 20, max: 20 } as Combatant['wounds'];
  cible.important = true;
  return { H, cible };
}

const critiqueA = (loc: HitLocation) =>
  banc.getState().battle!.log.some((l) => l.text.startsWith('Blessure critique') && l.text.includes(`(${locationLabel(loc, 'humanoide')})`));

describe('T7 — le d100 de la Localisation est consommé au JET, pas à l’application', () => {

  it('la Blessure critique tombe à `critLocation` ; l’application ne tire que le d100 de la table', () => {
    let graine = 1;
    for (; graine < 500; graine++) {
      const r = makeRNG(graine);
      if (critLocationRoll(r, 'humanoide') !== critLocationRoll(r, 'humanoide')) break;
    }
    const temoin = makeRNG(graine);
    const naissance = critLocationRoll(temoin, 'humanoide');
    const deTable = temoin.int(1, 100);
    const autreLieu = hitLocationByShape(deTable, 'humanoide');
    expect(autreLieu, `graine ${graine} : le d100 suivant donnerait un autre lieu`).not.toBe(naissance);

    const { H, cible } = arene();
    seedBattleRng(graine);
    const res = rederivePassiveAttack(H, cible, epee, { roll: 44, target: 90, success: true, sl: 0, isDouble: true } as never, 'melee', { rng: battleRng() });
    expect(res.critLocation, 'le d100 tiré à la naissance').toBe(naissance);

    applyAttackResult(banc.getState, banc.setState, H, cible, epee, res);
    draineCascade(banc.getState);

    const apres = banc.getState().battle!.combatants.find((c) => c.id === cible.id)!;
    const rangee = findTableEntry(critTableRows('ldb', critTableKeyFor(naissance)), deTable).id;
    expect(apres.critEntriesSuffered, 'le d100 suivant est celui de la table').toEqual([rangee]);
    expect(critiqueA(naissance), 'le Critique au lieu de naissance').toBe(true);
    expect(critiqueA(autreLieu), 'aucun Critique au lieu d’un d100 tiré à l’application').toBe(false);
    expect(battleRng().int(1, 1_000_000), 'même graine, la Localisation puis la table, et rien d’autre').toBe(temoin.int(1, 1_000_000));
  });
});
