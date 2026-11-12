/**
 * Câblage RÉEL de l'axe Dégâts de la Surincantation révisée (`VDM 02 l.198`, option
 * `magie-vdm-incantation`) jusqu'au CHEMIN DE PROD : Carreau (Projectile magique) lancé via le
 * noyau, DR alloués à l'axe Dégâts par le VRAI réglage de modale (`incantation.surincantationDegats`), appliqué
 * par la VRAIE `jetValider('incantation')` (→ `applyCast`) — aucun budget/damage recalculé à la main pour
 * l'occasion. Le jet est FIGÉ AVANT l'allocation (`evaluateMissile` à 0 pas, exactement ce que fait
 * `resolveMagicMissile`/`jetLancer('incantation')` — l'allocation intervient après le jet) ; seule
 * l'ALLOCATION et l'APPLICATION passent par les actions réelles du noyau. Si le fil
 * `pc.overcast.damage` → `applyCast` se débranche, ce test rougit (les deux volets rendraient le
 * MÊME delta de Blessures).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import { evaluateMissile, type CastResult } from '../engine/magic';
import { findSpellById } from '../data';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const RULE = 'magie-vdm-incantation';

function setup() {
  const w = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
  w.spells = ['carreau'];
  banc.setState({ party: [w] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  banc.getState().ensemencerLeTirage(7);
  const b = banc.getState().battle!;
  const heroC = b.combatants.find((c) => c.label === 'W')!;
  const enemy = b.combatants.find((c) => c.kind === 'ennemi')!;
  // Positions/mitigation FIXÉES : même PA/BE des deux côtés du test — seul l'axe Dégâts varie.
  heroC.pos = { x: 10, y: 10 };
  enemy.pos = { x: 12, y: 10 };
  enemy.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
  enemy.characteristics.endurance = 20;
  enemy.wounds = blessuresDeBase(40, 40, enemy);
  banc.setState({ battle: { ...b, turn: b.order.indexOf(heroC.id), action: 'incantation', selectedSpellId: 'carreau', acted: false } });
  cliquerSurLeCombattant(banc.getState, enemy.id);
  // Jet FIGÉ (DR 10 pour NI 4 → surplus 6, budget VDM = 6 pas) — exactement ce que produit
  // `resolveMagicMissile` au ROLL, AVANT que l'allocation de Surincantation n'existe (0 pas).
  const frozen: CastResult = { cast: true, roll: 20, target: 90, sl: 10, isCritical: false, isFumble: false, log: 'jet' };
  const res = evaluateMissile(heroC, enemy, findSpellById('carreau')!, frozen);
  banc.setState((s) => ({ pendingCast: { ...s.pendingCast!, result: res } }));
  return { heroC, enemy };
}

describe('Câblage — axe Dégâts de la Surincantation VDM, Carreau, chemin de prod (store)', () => {
  beforeEach(() => { setRule(RULE, true); });

  it('0 DR alloué à l’axe Dégâts (nerf sec) vs 3 DR alloués (palier 3, réglage `incantation.surincantationDegats` + `jetValider(\'incantation\')` réels) : +3 Blessures', () => {
    const { enemy } = setup();
    const before = enemy.wounds.current;
    banc.getState().jetValider('incantation');
    const after = banc.getState().battle!.combatants.find((c) => c.id === enemy.id)!.wounds.current;
    const baseline = before - after;
    expect(baseline).toBeGreaterThan(0);

    const { enemy: enemy2 } = setup();
    const before2 = enemy2.wounds.current;
    banc.getState().jetRegler('incantation', 'surincantationDegats', 3);
    expect(banc.getState().pendingCast!.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 0, damage: 3 });
    banc.getState().jetValider('incantation');
    const after2 = banc.getState().battle!.combatants.find((c) => c.id === enemy2.id)!.wounds.current;
    // missileOvercastDamageBonus('arcane', 3) === 3 (palier 3 du Tableau, VDM 02 l.207-215).
    expect(before2 - after2).toBe(baseline + 3);
  });

  it('sort NON-missile : l’axe Dégâts est refusé par le réglage `incantation.surincantationDegats` (aucun axe hors Projectile)', () => {
    const w = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
    w.spells = ['armure-aethyrique'];
    banc.setState({ party: [w] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const heroC = b.combatants.find((c) => c.label === 'W')!;
    banc.setState({ battle: { ...b, turn: b.order.indexOf(heroC.id), action: 'incantation', selectedSpellId: 'armure-aethyrique', acted: false } });
    cliquerSurLeCombattant(banc.getState, heroC.id);
    banc.setState((s) => ({
      pendingCast: { ...s.pendingCast!, result: { cast: true, roll: 20, target: 90, sl: 10, isCritical: false, isFumble: false, log: 'jet' } },
    }));
    banc.getState().jetRegler('incantation', 'surincantationDegats', 1);
    expect(banc.getState().pendingCast!.overcast).toBeUndefined();
  });

  it('option OFF : Carreau ne propose pas d’axe Dégâts (le réglage `incantation.surincantationDegats` refuse le pas)', () => {
    resetRule(RULE); // option OFF pour ce cas
    const { enemy } = setup();
    banc.getState().jetRegler('incantation', 'surincantationDegats', 1);
    expect(banc.getState().pendingCast!.overcast).toBeUndefined();
    // Nettoyage : le jet reste applicable normalement (parité LDB).
    const before = enemy.wounds.current;
    banc.getState().jetValider('incantation');
    const after = banc.getState().battle!.combatants.find((c) => c.id === enemy.id)!.wounds.current;
    expect(before - after).toBeGreaterThan(0);
  });
});
