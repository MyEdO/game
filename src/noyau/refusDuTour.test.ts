/**
 * Les refus élémentaires du tour lus en DONNÉE (`gating.movement`, `etats.json`) : `crawl` (À Terre, LDB 16 l.35) est
 * la même moitié de Mouvement que `half` (Sonné, LDB 16 l.125), et ferme en plus la Course et la Charge ; `none`
 * (Empêtré) ôte tout Mouvement. Chaque État se pose par la couture du jeu (`addCondition`).
 */
import { describe, it, expect } from 'vitest';
import { addCondition, conditionGating } from '../engine/conditions';
import { effectiveMovement } from '../engine/encumbrance';
import { refusDeCharge, refusDeCourse, refusRampe } from './refusDuTour';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { BattleState } from './etat';

function porteur(movement: number, etats: string[]): { c: Combatant; battle: BattleState } {
  const c = {
    id: 'h1', label: 'Doc', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement, engagedWith: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0, pos: { x: 1, y: 1 },
  } as unknown as Combatant;
  for (const e of etats) addCondition(c, e);
  const battle = { combatants: [c], order: ['h1'], turn: 0, round: 1, acted: false, movementUsed: 0, reachable: new Map(), log: [] } as unknown as BattleState;
  return { c, battle };
}

describe('`gating.movement` : `crawl` divise le Mouvement comme `half`, et ne laisse ni courir ni charger', () => {
  const prone = t('agate.prone');
  const horsDAgir = t('agate.unableToAct');
  const immobile = t('agate.cannotMove');
  for (const M of [4, 5]) {
    const moitie = Math.floor(M / 2);
    const attendus: [string, string[], { gate: string; eff: number; rampe: string | null; course: string | null; charge: string | null }][] = [
      ['aucun', [], { gate: 'normal', eff: M, rampe: null, course: null, charge: null }],
      ['Sonné', ['sonne'], { gate: 'half', eff: moitie, rampe: null, course: horsDAgir, charge: horsDAgir }],
      ['À Terre', ['a-terre'], { gate: 'crawl', eff: moitie, rampe: prone, course: prone, charge: prone }],
      ['Sonné + À Terre', ['sonne', 'a-terre'], { gate: 'crawl', eff: moitie, rampe: prone, course: horsDAgir, charge: prone }],
      ['Empêtré', ['empetre'], { gate: 'none', eff: 0, rampe: null, course: immobile, charge: immobile }],
      ['À Terre + Empêtré', ['a-terre', 'empetre'], { gate: 'none', eff: 0, rampe: null, course: immobile, charge: immobile }],
    ];
    for (const [nom, etats, attendu] of attendus) {
      it(`M${M}, ${nom}`, () => {
        const { c, battle } = porteur(M, etats);
        expect({
          gate: conditionGating(c).movement, eff: effectiveMovement(c), rampe: refusRampe(c),
          course: refusDeCourse(battle, c), charge: refusDeCharge(battle, c),
        }).toEqual(attendu);
      });
    }
  }
});

describe('Mouvement entamé : la Charge se ferme, la Course non (LDB 15 l.35-41)', () => {
  it('refusDeCharge dit le Mouvement entamé, refusDeCourse reste ouvert', () => {
    const { c, battle } = porteur(4, []);
    battle.movementUsed = 1;
    expect([refusDeCharge(battle, c), refusDeCourse(battle, c)]).toEqual([t('agate.movementStarted'), null]);
  });
});
