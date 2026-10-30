/**
 * Talents d'attaque DÉCLENCHÉE en DONNÉE (`TalentData.effects` → op `grantFreeAttack{immediate}`, résolu
 * par `resolveFreeAttacks`). Assaut féroce (LDB 10) : « une fois par Round, si vous touchez en mêlée
 * → attaque supplémentaire (coût Avantage ou Mouvement) ». Preuve que créer un talent qui DONNE une attaque
 * fonctionne de bout en bout depuis la donnée.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resolveFreeAttacks } from './combatFlow';
import { avanceEtapeCascade } from './cascade.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

import type { AttackResult } from '../engine/combat';
import { setCadence } from '../engine/cadence';
import { setRule } from '../engine/policy';
import { applySummon } from './summonFlow';
import { campGain } from './combat/advantagePool';
import { desDuTest } from '../engine/dice.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const HIT: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
};

describe('Talents d’attaque déclenchée (grantFreeAttack en donnée)', () => {
  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent → l'attaque supplémentaire est à portée
    return { H, E };
  }

  it('Assaut féroce (onHit) : une touche du héros déclenche UNE attaque supplémentaire (1/Round)', () => {
    banc.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'assaut-feroce', times: 1 }];
    H.advantage = 3; // de quoi payer l'attaque supplémentaire (coût Avantage)
    banc.setState({ battle: { ...banc.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    banc.getState().attackConfirm();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['assaut-feroce']).toBe(1); // le talent a tiré son attaque supplémentaire, 1× ce Round
  });

  // Mode « Avantage de groupe » (AA 11 l.11-13, l.30-38) : une invocation alliée naît projetée sur la
  // réserve de son camp, et sa porte lit le solde que `campSpend` débite.
  it('Assaut féroce (mode groupe) : une invocation alliée paie sur la réserve du camp', () => {
    setRule('combat-aa-avantage-groupe', true);
    banc.getState().seedRng(2);
    const { H, E } = setup();
    campGain(banc.getState, H, 2);
    applySummon(banc.getState, banc.setState, H, { ref: 'loup' } as never, { rng: desDuTest });
    const loup = () => banc.getState().battle!.combatants.find((c) => c.summon)!;
    expect(loup().kind).toBe('hero');
    expect(loup().advantage).toBe(2);
    loup().talents = [...(loup().talents ?? []), { talentId: 'assaut-feroce', times: 1 }];
    loup().pos = { x: 11, y: 11 };
    resolveFreeAttacks(banc.getState, banc.setState, loup(), 'onHit', E);
    expect(loup().freeAttacksThisTurn?.['assaut-feroce']).toBe(1);
  });

  it('sans le talent : une touche ne déclenche AUCUNE attaque supplémentaire', () => {
    banc.getState().seedRng(2);
    const { H, E } = setup();
    H.advantage = 3;
    banc.setState({ battle: { ...banc.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    banc.getState().attackConfirm();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['assaut-feroce']).toBeUndefined();
  });

  // Frappe réactive (LDB 10 l.496-500) = CHOIX opt-in (« vous POUVEZ ») + Test d'Initiative. Pour un HÉROS
  // en cadence MANUELLE, ces deux jets sont CADENCE-AWARE : ils s'ouvrent en étapes de cascade influençables
  // (modale de choix puis Test d'Init), pas en silence — c'est le principe « aucun jet de héros muet ».
  function driveChoice(key: string) {
    avanceEtapeCascade(banc.getState, undefined, () => key);
  }
  function driveTest() {
    avanceEtapeCascade(banc.getState);
  }

  it('Frappe réactive (onCharged) : héros MANUEL → modale de CHOIX puis Test d’Init INFLUENÇABLE ; succès → riposte', () => {
    banc.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    H.characteristics.initiative = 99; // Test d'Initiative Intermédiaire quasi-garanti

    resolveFreeAttacks(banc.getState, banc.setState, H, 'onCharged', E);
    // 1) Étape de CHOIX opt-in `triggeredChoice` (aucune frappe en silence).
    const choice = banc.getState().pendingCascade!;
    expect(choice.participants[choice.cursor].kind).toBe('triggeredChoice');
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBeUndefined();
    driveChoice('yes');
    // 2) Test d'Init INFLUENÇABLE (étape `triggeredTest`).
    const test = banc.getState().pendingCascade!;
    expect(test.participants[test.cursor].kind).toBe('triggeredTest');
    driveTest();
    // 3) Succès → la frappe gratuite s'est résolue (imputée 1× contre ce chargeur).
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBe(1);
  });

  it('Frappe réactive : « Renoncer » → aucune riposte (décision opt-in respectée)', () => {
    banc.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    resolveFreeAttacks(banc.getState, banc.setState, H, 'onCharged', E);
    driveChoice('no');
    expect(banc.getState().pendingCascade).toBeNull(); // pas de Test d'Init
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBeUndefined();
  });

  it('Frappe réactive (auto) : un héros en cadence AUTO riposte INLINE si le Test d’Init réussit, 1× par chargeur', () => {
    setCadence('auto');
    banc.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    H.characteristics.initiative = 99; // Test d'Initiative quasi-garanti
    resolveFreeAttacks(banc.getState, banc.setState, H, 'onCharged', E);
    // Cadence auto : choix + Test d'Init inline. Graine 2 : la riposte rate sur un double (88) → sa
    // Maladresse est un dé du HÉROS (`jetSurfaced`), que le pilote mène par `JET_AUTO.fumble`.
    const pc = banc.getState().pendingCascade!;
    expect(pc.participants[pc.cursor]).toMatchObject({ jet: 'fumble', actorId: H.id });
    banc.getState().fumbleRoll();
    banc.getState().fumbleConfirm();
    expect(banc.getState().pendingCascade).toBeNull();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['frappe-reactive']).toBe(1); // a riposté 1× contre ce chargeur
    // 2ᵉ tentative contre le MÊME chargeur ce Round : refusée (1× par chargeur).
    resolveFreeAttacks(banc.getState, banc.setState, H, 'onCharged', E);
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBe(1);
  });
});
