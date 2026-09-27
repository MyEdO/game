import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { fireTriggers } from '../triggeredEffects';
import '../combatFlow'; // effet de bord : installe le routeur de Test + l'applier triggeredTest + le hook onGainCondition
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { hasCondition } from '../../engine/conditions';
import { resolveOpposed } from '../../engine/tests';
import { testValue, skillBaseValue } from '../../engine/skills';

import { testScene } from '../../scenes/test-fixture';
import type { Weapon } from '../../engine/types';
import { resetCadence } from '../../engine/cadence';

/**
 * Assommante (LDB 62 l.235) en nœud Flow `test` OPPOSÉ (Lot 4c) : « Si vous touchez la Tête avec une
 * arme Assommante, tentez un Test opposé Force/Résistance contre la cible frappée. Si vous remportez le
 * Test, votre adversaire gagne Sonné. » L'attaquant (porteur de l'arme) oppose sa FORCE (FIGÉE) à la
 * RÉSISTANCE de la victime ; l'issue vient de `resolveOpposed` (PAS d'un test simple plié) — l'attaquant
 * doit REMPORTER (égalité = victime résiste, RAW). Trois cas :
 *  (a) victime HÉROS MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE portant l'attaquant figé ;
 *      l'issue (Sonné ou non) suit `resolveOpposed(jetDéfenseur, aT)`.
 *  (a-bis) ÉGALITÉ (même DR + même cible) → la victime RÉSISTE, PAS de Sonné (preuve de fidélité : un
 *      test simple plié aurait conclu « réussite » sur le jet de l'attaquant, ici l'égalité ne suffit pas).
 *  (b) victime ENNEMIE → jet INLINE + Sonné si l'attaquant l'emporte.
 */
const assommante = (): Weapon => ({ label: "Marteau de guerre", type: 'melee', damage: { plusBF: true, flat: 6 }, qualities: [{ id: 'assommante' }] });

describe('Assommante — nœud Flow test OPPOSÉ (Force figée vs Résistance, resolveOpposed)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetCadence();
    useGame.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const wielder = enemies[0]; // le porteur de l'arme Assommante (attaquant)
    const prey = enemies[1];    // une victime ENNEMIE (cas b)
    enemies.slice(2).forEach((e) => (e.dead = true));
    H.wounds.max = 200; H.wounds.current = 200;
    prey.wounds.max = 200; prey.wounds.current = 200;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, wielder, prey };
  }

  it('(a) victime HÉROS MANUEL : étape triggeredTest OPPOSÉE influençable (Force attaquant figée dans meta.opposed)', () => {
    seedBattleRng(7);
    const { H, wielder } = setup();
    wielder.characteristics.force = 55;

    // onHit à la TÊTE → l'Atout Assommante teste Force(attaquant) vs Résistance(victime).
    fireTriggers(useGame.getState, wielder, 'onHit', { victim: H, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });

    const casc = useGame.getState().pendingCascade!;
    expect(casc).toBeTruthy();
    expect(casc.purpose).toBe('combat');
    const step = casc.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();        // pas encore lancé → Chance/Pacte/Résilience possibles
    expect(step.rollLabel).toBe('Résistance'); // le DÉFENSEUR jette la Résistance
    // L'attaquant est PRÉ-JETÉ et FIGÉ dans le meta (sérialisable, coop) → la cascade re-oppose à chaque influence.
    expect(step.meta?.opposed).toBeTruthy();
    expect(typeof step.meta?.opposed?.aT.roll).toBe('number');
    // Le côté attaquant voyage en STRUCTURE (le rendu en écrit le libellé) : la donnée de l'Atout ne
    // porte plus de libellé pré-composé, elle nomme la Caractéristique jetée.
    expect(step.meta?.opposed?.test).toEqual({ char: 'force' });
    expect(step.meta?.opposed?.attackerLabel, 'aucun libellé authoré : « Force » se dérive').toBeUndefined();
  });

  it('(a) HÉROS : cascadeRoll+cascadeNext → l’issue (Sonné ou non) SUIT resolveOpposed(jetDéfenseur, Force figée)', () => {
    seedBattleRng(3);
    const { H, wielder } = setup();
    wielder.characteristics.force = 60;
    H.characteristics.endurance = 30; // Résistance basse → l’attaquant l’emporte probablement

    fireTriggers(useGame.getState, wielder, 'onHit', { victim: H, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT; // attaquant figé

    useGame.getState().cascadeRoll(step.id);
    // Le jet du défenseur (Résistance) est posé sur l’étape ; l’issue doit être COHÉRENTE avec resolveOpposed
    // (ATTAQUANT figé en 1ʳᵉ position, comme la production) : la victime résiste si l’attaquant ne l’emporte pas.
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    const expectedResist = resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false }).winner !== 'attacker';
    useGame.getState().cascadeNext();

    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    // Sonné posé SSI l’attaquant l’emporte (la victime ne résiste PAS) — preuve que l’applier branche via resolveOpposed.
    expect(hasCondition(h, 'sonne')).toBe(!expectedResist);
  });

  it('(a-bis) ÉGALITÉ (même DR + mêmes NUES) : STATU QUO — la victime RÉSISTE, PAS de Sonné', () => {
    // Deux étages d'égalité, tous deux nécessaires : même CIBLE effective → même DR sur un dé identique ;
    // mêmes valeurs NUES (`skillBaseValue`) → le départage à DR égal (LDB 12 l.160) ne tranche pas non
    // plus. `resolveOpposed` conclut 'tie' → STATU QUO (l.160, arbitrage `opposedBranchSuccess`) : ici
    // « vous » (LDB 62 l.235 : « Si vous remportez le Test, votre adversaire gagne un État *Sonné*. »)
    // est l'ATTAQUANT, pas le jeteur — rien ne se passe se lit donc « la victime RÉSISTE ».
    const { H, wielder } = setup();
    wielder.characteristics.force = 50;
    const fNue = skillBaseValue(wielder, undefined, undefined, 'force'); // Force NUE de l'attaquant
    // Aligne la Résistance NUE du héros sur elle (compense les avances de compétence : Résistance = E + avances).
    H.characteristics.endurance += fNue - skillBaseValue(H, 'resistance');
    expect(skillBaseValue(H, 'resistance')).toBe(fNue);
    // Les valeurs TESTÉES suivent ici les nues (aucun État, aucun passif en jeu) — c'est ce qui rend les
    // CIBLES égales, donc les DR comparables sur un dé identique.
    expect(testValue(H, 'resistance')).toBe(testValue(wielder, undefined, 'force'));

    // seed POSÉ ICI (après le spawn qui consomme le RNG d’initiative) : la 1ʳᵉ consommation est le jet de
    // l’ATTAQUANT, la 2ᵉ celui du défenseur (cascadeRoll). seed 113 → deux d100 IDENTIQUES → ÉGALITÉ stricte.
    seedBattleRng(113);
    fireTriggers(useGame.getState, wielder, 'onHit', { victim: H, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;
    // L'étape et le jet figé portent chacun LEUR nue — c'est par elles que passe le départage.
    expect(aT.base, 'le pré-jet de l’attaquant porte sa Force NUE').toBe(fNue);
    expect(step.base, 'l’étape du défenseur porte sa Résistance NUE').toBe(fNue);

    useGame.getState().cascadeRoll(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    // Le cœur de la preuve : jet défenseur == jet attaquant (même roll/cible/DR) → ÉGALITÉ stricte.
    expect(rolled.roll).toBe(aT.roll);
    expect(rolled.target).toBe(aT.target);
    expect(rolled.sl).toBe(aT.sl);
    // Ré-opposition à l'identique de la production : les DEUX camps avec leur nue (jamais un mixte).
    expect(resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false, base: step.base }).winner).toBe('tie');
    // L’étape conclut « résiste » (success) — un test simple plié sur le jet de l’ATTAQUANT aurait conclu autrement.
    expect(rolled.success).toBe(true);
    useGame.getState().cascadeNext();

    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(hasCondition(h, 'sonne')).toBe(false); // ÉGALITÉ → PAS de Sonné (l’attaquant ne remporte pas)
  });

  it('(b) victime ENNEMIE : jet INLINE + Sonné si l’attaquant l’emporte (pas de cascade)', () => {
    seedBattleRng(5);
    const { wielder, prey } = setup();
    wielder.characteristics.force = 90; // Force élevée
    prey.characteristics.endurance = 1;     // Résistance minimale → l’attaquant l’emporte

    fireTriggers(useGame.getState, wielder, 'onHit', { victim: prey, weapon: assommante(), location: 'tete', rng: makeRNG(1), set: useGame.setState });

    expect(useGame.getState().pendingCascade).toBeNull(); // ennemi → jamais d’étape influençable
    const live = useGame.getState().battle!.combatants.find((c) => c.id === prey.id)!;
    expect(hasCondition(live, 'sonne')).toBe(true); // l’attaquant l’emporte → Sonné posé inline
    // La ligne d’opposition (Force vs Résistance) part dans la file différée — DÉRIVÉE au patron unique
    // (`traceLineOf`, forme OPPOSÉE #1294) : les deux porteurs, les deux dés, les deux DR SIGNÉS, l’issue.
    const opposee = useGame.getState().pendingLogQueue.map((q) => q.line).find((l) => / vs /.test(l));
    expect(opposee, `file différée :\n${useGame.getState().pendingLogQueue.map((q) => q.line).join('\n')}`)
      .toMatch(/^.+ \(Force\) \d+\/\d+ \(DR [+-]\d+\) vs .+ \(Résistance\) \d+\/\d+ \(DR [+-]\d+\) — (résiste|l’emporte)\.$/);
  });

  it('(c) touche AILLEURS qu’à la Tête : aucun Test (la Condition `location:tete` ne passe pas)', () => {
    seedBattleRng(5);
    const { wielder, prey } = setup();
    wielder.characteristics.force = 90;
    prey.characteristics.endurance = 1;

    fireTriggers(useGame.getState, wielder, 'onHit', { victim: prey, weapon: assommante(), location: 'corps', rng: makeRNG(1), set: useGame.setState });

    expect(useGame.getState().pendingCascade).toBeNull();
    const live = useGame.getState().battle!.combatants.find((c) => c.id === prey.id)!;
    expect(hasCondition(live, 'sonne')).toBe(false); // pas à la Tête → pas de Test opposé, pas de Sonné
  });
});
