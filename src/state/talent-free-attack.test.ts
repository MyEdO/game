/**
 * Talents d'attaque DÉCLENCHÉE en DONNÉE (`TalentData.effects` → op `grantFreeAttack{immediate}`, résolu
 * par `resolveFreeAttacks`). Assaut féroce (LDB 10) : « une fois par Round, si vous touchez en mêlée
 * → attaque supplémentaire (coût Avantage ou Mouvement) ». Preuve que créer un talent qui DONNE une attaque
 * fonctionne de bout en bout depuis la donnée.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolveFreeAttacks } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

import type { AttackResult } from '../engine/combat';
import { resetCadence, setCadence } from '../engine/cadence';

const HIT: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
};

describe('Talents d’attaque déclenchée (grantFreeAttack en donnée)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingAttack: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent → l'attaque supplémentaire est à portée
    return { H, E };
  }

  it('Assaut féroce (onHit) : une touche du héros déclenche UNE attaque supplémentaire (1/Round)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'assaut-feroce', times: 1 }];
    H.advantage = 3; // de quoi payer l'attaque supplémentaire (coût Avantage)
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['assaut-feroce']).toBe(1); // le talent a tiré son attaque supplémentaire, 1× ce Round
  });

  it('sans le talent : une touche ne déclenche AUCUNE attaque supplémentaire', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.advantage = 3;
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['assaut-feroce']).toBeUndefined();
  });

  // Frappe réactive (LDB 10 l.496-500) = CHOIX opt-in (« vous POUVEZ ») + Test d'Initiative. Pour un HÉROS
  // en cadence MANUELLE, ces deux jets sont CADENCE-AWARE : ils s'ouvrent en étapes de cascade influençables
  // (modale de choix puis Test d'Init), pas en silence — c'est le principe « aucun jet de héros muet ».
  function driveChoice(key: string) {
    const pc = useGame.getState().pendingCascade!;
    const cur = pc.participants[pc.cursor];
    useGame.getState().cascadeChoose(cur.id, key);
    useGame.getState().cascadeNext();
  }
  function driveTest() {
    const pc = useGame.getState().pendingCascade!;
    const cur = pc.participants[pc.cursor];
    useGame.getState().cascadeRoll(cur.id); // jet d'Initiative
    useGame.getState().cascadeNext(); // applique la branche (success → frappe via le hook)
  }

  it('Frappe réactive (onCharged) : héros MANUEL → modale de CHOIX puis Test d’Init INFLUENÇABLE ; succès → riposte', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    H.characteristics.initiative = 99; // Test d'Initiative Intermédiaire quasi-garanti

    resolveFreeAttacks(useGame.getState, useGame.setState, H, 'onCharged', E);
    // 1) Étape de CHOIX opt-in `triggeredChoice` (aucune frappe en silence).
    const choice = useGame.getState().pendingCascade!;
    expect(choice.participants[choice.cursor].kind).toBe('triggeredChoice');
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBeUndefined();
    driveChoice('yes');
    // 2) Test d'Init INFLUENÇABLE (étape `triggeredTest`).
    const test = useGame.getState().pendingCascade!;
    expect(test.participants[test.cursor].kind).toBe('triggeredTest');
    driveTest();
    // 3) Succès → la frappe gratuite s'est résolue (imputée 1× contre ce chargeur).
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBe(1);
  });

  it('Frappe réactive : « Renoncer » → aucune riposte (décision opt-in respectée)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    resolveFreeAttacks(useGame.getState, useGame.setState, H, 'onCharged', E);
    driveChoice('no');
    expect(useGame.getState().pendingCascade).toBeNull(); // pas de Test d'Init
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBeUndefined();
  });

  it('Frappe réactive (auto) : un héros en cadence AUTO riposte INLINE si le Test d’Init réussit, 1× par chargeur', () => {
    setCadence('auto');
    try {
      useGame.getState().seedRng(2);
      const { H, E } = setup();
      H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
      H.characteristics.initiative = 99; // Test d'Initiative quasi-garanti
      resolveFreeAttacks(useGame.getState, useGame.setState, H, 'onCharged', E);
      // Cadence auto : choix + Test d'Init inline. Graine 2 : la riposte rate sur un double (88) → sa
      // Maladresse est un dé du HÉROS (`jetSurfaced`), que le pilote mène par `JET_AUTO.fumble`.
      const pc = useGame.getState().pendingCascade!;
      expect(pc.participants[pc.cursor]).toMatchObject({ jet: 'fumble', actorId: H.id });
      useGame.getState().fumbleRoll();
      useGame.getState().fumbleConfirm();
      expect(useGame.getState().pendingCascade).toBeNull();
      const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
      expect(h.freeAttacksThisTurn?.['frappe-reactive']).toBe(1); // a riposté 1× contre ce chargeur
      // 2ᵉ tentative contre le MÊME chargeur ce Round : refusée (1× par chargeur).
      resolveFreeAttacks(useGame.getState, useGame.setState, H, 'onCharged', E);
      expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBe(1);
    } finally {
      resetCadence();
    }
  });
});
