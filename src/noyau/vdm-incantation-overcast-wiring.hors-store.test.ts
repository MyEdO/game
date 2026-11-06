/**
 * Câblage RÉEL de « Puissance totale » révisée (`VDM 02 l.55`, option `magic-vdm-incantation`)
 * jusqu'au budget de Surincantation : le DR de l'Incantation Critique augmente du chiffre des
 * DIZAINES du lancer, et cette DR sert à allouer les pas. Passe par la VRAIE action de modale
 * (réglages `cast.effetCritique` et `cast.surincantationDuree`) — aucun budget recalculé à la main dans le test.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { setRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import type { CastResult } from '../engine/magic';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const RULE = 'magic-vdm-incantation';

/** Incantation CRITIQUE (double 44 réussi) à DR 8 = le NI d'Allure démoniaque, figé au jet (`niRequired`).
 *  `LDB 47 l.17` ; `VDM 02 l.55`, `l.196`. */
const critRes: CastResult = { cast: true, roll: 44, target: 90, sl: 8, isCritical: true, isFumble: false, niRequired: 8, log: 'critique' };

function openCast() {
  const W = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
  W.talents = [...(W.talents ?? []), { talentId: 'magie-du-chaos', spec: 'nurgle', times: 1 }];
  W.spells = ['allure-demoniaque'];
  W.characteristics.sociabilite = 40;
  banc.setState({ party: [W] });
  banc.getState().startScene(testScene());
  banc.getState().startCombat('enc-mutants');
  banc.getState().fenetreValider('roundStart');
  banc.abandonner();
  banc.getState().seedRng(7);
  const b = banc.getState().battle!;
  const heroC = b.combatants.find((c) => c.label === 'W')!;
  banc.setState({ battle: { ...b, turn: b.order.indexOf(heroC.id), action: 'cast', selectedSpellId: 'allure-demoniaque', acted: false } });
  banc.getState().battleClickEntity(heroC.id);
  banc.setState((s) => ({ pendingCast: { ...s.pendingCast!, result: critRes } }));
  banc.getState().jetRegler('cast', 'effetCritique', 'puissance');
}

describe('Câblage — « Puissance totale » VDM : +dizaines au DR, donc des pas de Surincantation', () => {
  it('option OFF (LDB 46 l.31) : DR 8 = NI 8 → aucun pas allouable', () => {
    openCast();
    banc.getState().jetRegler('cast', 'surincantationDuree', 1);
    expect(banc.getState().pendingCast!.overcast ?? { duration: 0 }).toMatchObject({ duration: 0 });
  });

  it('option ON : le lancer 44 porte le DR à 12 → 4 DR dépensables sur la Durée (`VDM 02 l.196`)', () => {
    setRule(RULE, true);
    openCast();
    banc.getState().jetRegler('cast', 'surincantationDuree', 5); // refusé : surplus épuisé
    expect(banc.getState().pendingCast!.overcast).toBeUndefined();
    banc.getState().jetRegler('cast', 'surincantationDuree', 4);
    expect(banc.getState().pendingCast!.overcast).toEqual({ range: 0, zone: 0, duration: 4, targets: 0, damage: 0 });
  });

  it('option ON, effet Critique AUTRE que « Puissance totale » : DR 8 = NI 8, aucun pas', () => {
    setRule(RULE, true);
    openCast();
    banc.getState().jetRegler('cast', 'effetCritique', 'ineluctable');
    banc.getState().jetRegler('cast', 'surincantationDuree', 1);
    expect(banc.getState().pendingCast!.overcast ?? { duration: 0 }).toMatchObject({ duration: 0 });
  });
});
