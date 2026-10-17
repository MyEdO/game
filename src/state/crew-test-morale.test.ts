import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { resolveCrewTestByRoles, rudeEpreuveMoraleDelta } from '../engine/crewMorale';
import { makeRNG } from '../engine/dice';
import { shipSaboteurDR } from './shipCrew';
import { maneuverCrewTotal } from './shipManeuver';
import type { Combatant, SkillInstance } from '../engine/types';
import { propulsionDuNavire } from '../engine/shipBuild';

/** Compétence de Navigation d'une Cogue (`propulsionDuNavire`, MDG 13 l.18-19). */
const NAVIGATION = propulsionDuNavire('cogue', undefined, 'maritime')!.competence;

/**
 * #26/#65 — MORAL D'ÉQUIPAGE EN COMBAT (MDG 14) :
 *  - « Rude épreuve » (l.106-114) : Test d'équipage ; « Si le total de ce Test donne un ou plusieurs DR
 *    négatifs, réduisez le Moral d'un nombre égal au nombre de ces DR » (l.110) — persisté sur
 *    `CampaignVessel.morale` quand la coque EST le navire de campagne.
 *  - SABOTAGE (l.45-47) : « le MJ pourra imposer de -1 à -5 DR sur le Test d'équipage » — champ
 *    `Combatant.saboteurDR` (clampé RAW), appliqué au total de TOUT Test d'équipage.
 */
const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const cook = (): Combatant =>
  ({ id: 'cook', name: 'Coq', kind: 'hero',
    characteristics: { ...chars, dexterite: 45 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], fortune: 2, resilience: 1,
    skills: [{ id: 'metier', spec: 'cuisinier', characteristic: 'dexterite', advances: 20 } as SkillInstance], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
const vesselShip = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'ship', name: 'Cogue', kind: 'npc', bodyShape: 'vehicule', creatureId: 'coracle', crewIds: ['cook'],
    pos: { x: 5, y: 5 }, conditions: [], weapons: [], ...over }) as unknown as Combatant;

function openRudeEpreuve(shipOver: Partial<Combatant> = {}) {
  seedBattleRng(7);
  useGame.setState({
    battle: { combatants: [vesselShip(shipOver), cook()], order: ['cook'], turn: 0, round: 1, acted: false, log: [] } as never,
    party: [cook()], facing: { ship: 'N' }, pendingCrewTest: null, scene: null as never,
    vessel: { vehicleId: 'coracle', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
  });
  useGame.getState().battleCrewTest('ship', 'rude-epreuve');
}

/** Force le résultat d'un participant (déterminisme du confirm — le FLUX de jet est déjà testé ailleurs). */
function forceResult(pid: string, sl: number) {
  const p = useGame.getState().pendingCrewTest!;
  useGame.setState({
    pendingCrewTest: {
      ...p,
      participants: p.participants.map((x) => (x.id === pid ? { ...x, result: { roll: 90, target: 50, sl } } : x)),
    },
  });
}

describe('Rude épreuve en combat (MDG 14 l.106-114) — delta de Moral persisté', () => {
  beforeEach(() => useGame.setState({ pendingCrewTest: null, vessel: null }));

  it('battleCrewTest ouvre le Test (Cuisinier ★ inféré) ; total NÉGATIF → Moral réduit d’autant sur le vessel (l.110)', () => {
    openRudeEpreuve();
    const p = useGame.getState().pendingCrewTest!;
    expect(p.testTypeId).toBe('rude-epreuve');
    expect(p.essentialRoleId).toBe('cuisinier');
    const part = p.participants.find((x) => x.id === 'cook')!;
    expect(part.roleId).toBe('cuisinier'); // rôle inféré des avances (Métier (Cuisinier))
    expect(part.essential).toBe(true);
    forceResult('cook', -2); // essentiel ×2 → total −4
    useGame.getState().crewTestConfirm();
    const st = useGame.getState();
    expect(st.pendingCrewTest).toBeNull();
    expect(st.vessel!.morale.score).toBe(75 - 4); // « réduisez le Moral d'un nombre égal au nombre de ces DR »
    expect(st.battle!.acted).toBe(true); // un jet = une Action
    expect(st.battle!.crewActed?.ship).toContain('cook'); // marin engagé ce Round (cumul l.53)
  });

  it('total POSITIF → aucun gain de Moral (l.110 ne joue qu’en négatif)', () => {
    openRudeEpreuve();
    forceResult('cook', 3);
    useGame.getState().crewTestConfirm();
    expect(useGame.getState().vessel!.morale.score).toBe(75);
  });

  it('coque qui n’est PAS le navire de campagne → aucun Moral suivi (pas de mutation fantôme)', () => {
    openRudeEpreuve({ creatureId: 'knarr' }); // vessel.vehicleId = 'cogue' ≠ knarr
    forceResult('cook', -3);
    useGame.getState().crewTestConfirm();
    expect(useGame.getState().vessel!.morale.score).toBe(75);
  });

  it('rudeEpreuveMoraleDelta : négatif passe, positif/nul → 0', () => {
    expect(rudeEpreuveMoraleDelta(-4)).toBe(-4);
    expect(rudeEpreuveMoraleDelta(0)).toBe(0);
    expect(rudeEpreuveMoraleDelta(3)).toBe(0);
  });
});

describe('Sabotage des Tests d’équipage (MDG 14 l.45-47 : −1..−5 DR)', () => {
  beforeEach(() => useGame.setState({ pendingCrewTest: null, vessel: null }));

  it('shipSaboteurDR clampe à la fourchette RAW [-5, 0]', () => {
    expect(shipSaboteurDR(vesselShip())).toBe(0);
    expect(shipSaboteurDR(vesselShip({ saboteurDR: -3 }))).toBe(-3);
    expect(shipSaboteurDR(vesselShip({ saboteurDR: -9 }))).toBe(-5);
    expect(shipSaboteurDR(vesselShip({ saboteurDR: 2 }))).toBe(0); // un « saboteur » ne BONIFIE pas
  });

  it('le pending porte extraDR et le total du Test le subit (maneuverCrewTotal)', () => {
    openRudeEpreuve({ saboteurDR: -3 });
    const p = useGame.getState().pendingCrewTest!;
    expect(p.extraDR).toBe(-3);
    forceResult('cook', 1); // essentiel ×2 → +2 ; sabotage −3 → total −1
    const p2 = useGame.getState().pendingCrewTest!;
    expect(maneuverCrewTotal(p2.participants, p2.essentialRoleId, p2.moraleScore, p2.undercrew, p2.extraDR)).toBe(-1);
    useGame.getState().crewTestConfirm();
    expect(useGame.getState().vessel!.morale.score).toBe(74); // Rude épreuve : −1 Moral
  });

  it('resolveCrewTestByRoles (résolveur PUR tout-PNJ) applique aussi extraDR', () => {
    const marin = { ...cook(), id: 'npc-cook', kind: 'npc' } as Combatant;
    const base = resolveCrewTestByRoles([{ crew: marin, roleId: 'cuisinier' }], 'rude-epreuve', 'intermediaire', 75, NAVIGATION, makeRNG(3));
    const sabote = resolveCrewTestByRoles([{ crew: marin, roleId: 'cuisinier' }], 'rude-epreuve', 'intermediaire', 75, NAVIGATION, makeRNG(3), { extraDR: -2 });
    expect(sabote.total).toBe(base.total - 2);
    expect(sabote.lines.some((l) => l.includes('-2 DR'))).toBe(true);
  });
});
