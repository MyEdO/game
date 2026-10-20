import { describe, it, expect } from 'vitest';
import { vehicleCombatant } from '../engine/vehicle';
import { shipHitLocation } from '../engine/combat';
import { rigDuNavire } from '../engine/shipBuild';
import { rollShipCritical } from '../engine/shipCritical';
import type { ShipCritKey } from '../data/shipCriticals';
import { applyOps } from '../engine/ops';
import { fireConditionEffects } from '../noyau/triggeredEffects';
import { stacks } from '../engine/conditions';
import { findVehicleById } from '../data';
import { makeRNG } from '../engine/dice';
import { desDuTest } from '../engine/dice.testkit';

// Stub `get` (hors combat), comme outOfCombatUpkeep — les États navals tickent par le pipeline data-driven.
const GET = (() => ({ battle: undefined })) as never;
const tick = (c: any) => fireConditionEffects(GET, c, 'onRoundEnd', { rng: makeRNG(1) });

/**
 * EXEMPLE bout-en-bout du modèle naval (sans `resolveAttack` — branché à la dalle combat) : un coup
 * sur un navire suit la MÊME chaîne qu'un Combattant, du gréement au naufrage.
 *   rig (donnée hull) → shipHitLocation (MDG 13) → rollShipCritical (data + GameOp) → applyOps
 *   → État data-driven (etats.json) → endOfRound (pipeline commun) → cumul → coule à l'Endurance.
 */
describe('Modèle naval — chaîne complète rig → localisation → Critique → État → naufrage', () => {
  it('Cogue (voile, E45/B50) percée à la Coque (Voie d’eau 4) coule en ~12 Rounds', () => {
    const cogue = findVehicleById('cogue')!; // hull E45/B50, rig 'voile'
    const ship = vehicleCombatant(cogue)!;

    // 1) Localisation du coup d'après le GRÉEMENT (`rigDuNavire`) — d100=50 sur un voilier → Coque.
    const loc = shipHitLocation(rigDuNavire(cogue.ship!)!, 50);
    expect(loc).toBe('coque');

    // 2) Critique de Coque, d10=10 → « Voie d'eau en dessous de la ligne de flottaison » : Voie d'eau 4.
    const crit = rollShipCritical(loc as ShipCritKey, makeRNG(1), 10); // loc vérifié === 'coque' ci-dessus (≠ 'equipage')
    expect(crit.id).toBe('voie-d-eau-en-dessous-de-la-ligne-de-flottaison');
    expect(crit.ops).toEqual([{ op: 'condition', id: 'voie-d-eau', value: 4 }]);

    // 3) L'appelant applique l'effet (langue unique) → l'État NAVAL data-driven se pose sur le navire.
    applyOps(ship, crit.ops, { rng: desDuTest });
    expect(stacks(ship, 'voie-d-eau')).toBe(4);

    // 4) Chaque Round (endOfRound commun), l'Indice grossit le cumul d'Inondation ; aux seuils relatifs à
    //    l'Endurance (45), le navire est alourdi (≥ 22,5) puis COULE (≥ 45).
    let alourdiAt = 0, naufrageAt = 0;
    for (let round = 1; round <= 12; round++) {
      tick(ship);
      if (!alourdiAt && stacks(ship, 'alourdi')) alourdiAt = round;
      if (!naufrageAt && stacks(ship, 'naufrage')) naufrageAt = round;
    }
    expect(stacks(ship, 'inondation')).toBe(48); // 4 / Round × 12
    expect(alourdiAt).toBe(6); // 24 ≥ 22,5 (moitié de l'Endurance)
    expect(naufrageAt).toBe(12); // 48 ≥ 45 (Endurance) → naufrage
  });

  it('Langskip (mixte) — un coup à d100=15 touche le Gréement, pas la Coque', () => {
    const langskip = findVehicleById('langskip')!; // rig 'mixte'
    expect(shipHitLocation(rigDuNavire(langskip.ship!)!, 15)).toBe('greement');
    // Critique de Gréement d10=2 « Voiles trouées » : narratif (−1 M Voile), aucun État posé.
    const crit = rollShipCritical('greement', makeRNG(1), 2);
    expect(crit.id).toBe('voiles-trouees');
    expect(crit.ops).toEqual([]);
  });
});
