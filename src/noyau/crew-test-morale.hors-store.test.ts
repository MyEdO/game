import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { resolveCrewTestByRoles, rudeEpreuveMoraleDelta } from '../engine/crewMorale';
import { makeRNG } from '../engine/dice';
import { shipSaboteurDR } from './shipCrew';
import { maneuverCrewTotal } from './shipManeuver';
import type { Combatant, SkillInstance } from '../engine/types';
import { propulsionDuNavire } from '../engine/shipBuild';
import { offresDeLActif } from './actionRegistry';
import { buildVoyageCrewStep } from './seaVoyageFlow';
import { emptyScene } from './monde/scene';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Compétence de Navigation d'une Cogue (`propulsionDuNavire`, MDG 13 l.18-19). */
const NAVIGATION = propulsionDuNavire('cogue', undefined, 'maritime')!.competence;

/**
 * #26/#65 — TESTS D'ÉQUIPAGE (MDG 14) :
 *  - « Rude épreuve » : Test d'équipage de voyage (MDG 14 l.108-112, MDG 15 l.27), jamais une action de combat ;
 *    son Moral est celui du voyage (MDG 14 l.110).
 *  - SABOTAGE (MDG 14 l.45-47) : `Combatant.saboteurDR` (clampé), appliqué au total de TOUT Test d'équipage.
 */
const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const cook = (): Combatant =>
  combattantDeTest({ id: 'cook', label: 'Coq', kind: 'heros',
    characteristics: { ...chars, dexterite: 45 },
    wounds: blessuresDeBase(10), advantage: 0, conditions: [], fortune: 2, resilience: 1,
    skills: [{ id: 'metier', spec: 'cuisinier', characteristic: 'dexterite', advances: 20 } as SkillInstance], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } });
const vesselShip = (over: Partial<Combatant> = {}): Combatant =>
  combattantDeTest({ id: 'ship', label: 'Cogue', kind: 'pnj', bodyShape: 'vehicule', creatureId: 'coracle', crewIds: ['cook'],
    pos: { x: 5, y: 5 }, conditions: [], weapons: [], ...over });

describe('Rude épreuve : un Test d’équipage de VOYAGE, jamais une action de combat (MDG 14 l.108-112, MDG 15 l.27)', () => {
  it('au tour du navire en combat, aucune offre ne joue la Rude épreuve', () => {
    const navire = vesselShip({ kind: 'heros' });
    banc.setState({
      battle: { combatants: [navire, cook()], order: ['ship'], turn: 0, round: 1, acted: false, log: [], over: null, reachable: new Map(), movementUsed: 0 } as never,
      party: [cook()], facing: { ship: 'N' },
    });
    const s = banc.getState();
    const offres = offresDeLActif({ scene: s.scene, active: s.battle!.combatants[0], battle: s.battle!, netMode: s.net.mode, gameTime: s.gameTime, state: s });
    expect(offres.length, 'le navire n’a aucune offre').toBeGreaterThan(0);
    expect(offres.filter((o) => o.def.rule?.id === 'test-equipage-rude-epreuve').map((o) => o.actionId)).toEqual([]);
  });

  it('la traversée rapide la joue : l’étape de voyage du Test de Rude épreuve (Cuisinier ★)', () => {
    banc.setState({ party: [cook()], travelPlan: { vehicle: vesselShip(), sea: { weather: {} } } as never });
    const etape = buildVoyageCrewStep(banc.getState, 'rude-epreuve', 'equipage-voyage-rapide');
    expect(etape?.kind).toBe('equipage-voyage-rapide');
    expect(JSON.stringify(etape)).toContain('cuisinier');
  });

  it('rudeEpreuveMoraleDelta : négatif passe, positif/nul → 0 (MDG 14 l.110)', () => {
    expect(rudeEpreuveMoraleDelta(-4)).toBe(-4);
    expect(rudeEpreuveMoraleDelta(0)).toBe(0);
    expect(rudeEpreuveMoraleDelta(3)).toBe(0);
  });
});

describe('Sabotage des Tests d’équipage (MDG 14 l.45-47 : −1..−5 DR)', () => {
  beforeEach(() => banc.setState({ vessel: null }));

  it('shipSaboteurDR clampe à la fourchette RAW [-5, 0]', () => {
    expect(shipSaboteurDR(vesselShip())).toBe(0);
    expect(shipSaboteurDR(vesselShip({ saboteurDR: -3 }))).toBe(-3);
    expect(shipSaboteurDR(vesselShip({ saboteurDR: -9 }))).toBe(-5);
    expect(shipSaboteurDR(vesselShip({ saboteurDR: 2 }))).toBe(0); // un « saboteur » ne BONIFIE pas
  });

  it('le pending d’un Test d’équipage de combat (manœuvre) porte extraDR et le total du Test le subit (maneuverCrewTotal)', () => {
    seedBattleRng(7);
    const timonier = { ...cook(), skills: [{ ...NAVIGATION, advances: 20 } as SkillInstance] };
    banc.setState({
      battle: { combatants: [vesselShip({ kind: 'heros', saboteurDR: -3 }), timonier], order: ['ship'], turn: 0, round: 1, acted: false, log: [], over: null, reachable: new Map(), movementUsed: 0 } as never,
      party: [timonier], facing: { ship: 'N' }, pendingShipManeuver: null, scene: emptyScene('scene-test', 12, 12),
    });
    banc.getState().manoeuvrerLeNavire('ship');
    const p = banc.getState().pendingShipManeuver!;
    expect(p.extraDR).toBe(-3);
    const sansSabotage = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, 0);
    expect(maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR)).toBe(sansSabotage - 3);
  });

  it('resolveCrewTestByRoles (résolveur PUR tout-PNJ) applique aussi extraDR', () => {
    const marin = { ...cook(), id: 'npc-cook', kind: 'pnj' } as Combatant;
    const base = resolveCrewTestByRoles([{ crew: marin, roleId: 'cuisinier' }], 'rude-epreuve', 'intermediaire', 75, NAVIGATION, makeRNG(3));
    const sabote = resolveCrewTestByRoles([{ crew: marin, roleId: 'cuisinier' }], 'rude-epreuve', 'intermediaire', 75, NAVIGATION, makeRNG(3), { extraDR: -2 });
    expect(sabote.total).toBe(base.total - 2);
    expect(sabote.lines.some((l) => l.includes('-2 DR'))).toBe(true);
  });
});
