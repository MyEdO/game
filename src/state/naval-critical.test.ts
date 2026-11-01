import { describe, it, expect, beforeEach } from 'vitest';
import { applyCriticalToTarget } from '../noyau/combatFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { stacks } from '../engine/conditions';
import { toucheAuJetPose } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';
import { makeRNG } from '../engine/dice';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * Branchement combat ↔ naval : `applyCriticalToTarget` route une COQUE (`bodyShape:'vehicule'`) vers les
 * tables de NAVIRE (MDG 13) au lieu des Traumatismes de PERSONNAGE (LDB 18). Preuve du seam unique :
 * un véhicule encaisse un Coup Critique « comme un Combattant », mais sans Trauma humain — l'effet est un
 * État NAVAL data-driven (Voie d'eau / En flammes) posé par `applyOps`, ou un coup à l'Équipage.
 */
const ship = () => vehicleCombatant(findVehicleById('cogue')!)!; // hull E45/B50, rig 'voile'
const setStub = (() => {}) as never;
/** Lecture d'état HORS bataille (aucun équipage à résoudre, aucune cascade à ouvrir). */
const getHorsBataille = (() => ({ battle: undefined, party: [] })) as never;
const sailor = (id: string): Combatant => (blessuresSurLeProfil({
  id, name: id, kind: 'npc', characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 31, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
  skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
  armour: { corps: 0 }, wounds: blessuresDeBase(13), advantage: 0,
})) as unknown as Combatant;
const hache = { label: 'Hache', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
const jet = { label: 'CC', base: 60, modifier: 0, target: 60, roll: 44, success: true, sl: 2 };

describe('applyCriticalToTarget — coque/navire (MDG 13) au lieu de Trauma humain', () => {
  beforeEach(() => seedBattleRng(1));

  it('un véhicule ne subit JAMAIS de Trauma humain ; le Critique compte et est journalisé', () => {
    const s = ship();
    const log: string[] = [];
    applyCriticalToTarget(s, 'corps', 0, log, setStub, { get: getHorsBataille });
    expect(s.traumas ?? []).toHaveLength(0); // aucune amputation/fracture humaine sur une coque
    expect(s.criticalWounds).toBe(1);
    expect(log.length).toBeGreaterThan(0);
    // Issue TOUJOURS navale : un Critique de navire (Coque/Gréement/Avirons…) ou un coup à l'Équipage —
    // jamais un Trauma de personnage. (Un coup au Gréement peut être purement narratif, sans État posé.)
    expect(log.join('\n')).toMatch(/Critique navire|Équipage/);
  });

  it('seed atteignant la Coque → pose un État NAVAL via la langue GameOp (pas de mécanique parallèle)', () => {
    // On balaie des seeds jusqu'à un coup de Coque qui pose Voie d'eau (déterministe, sans toucher au flux RNG d'autrui).
    let posed = false;
    for (let seed = 1; seed <= 40 && !posed; seed++) {
      seedBattleRng(seed);
      const s = ship();
      applyCriticalToTarget(s, 'corps', 0, [], setStub, { get: getHorsBataille });
      if (stacks(s, 'voie-d-eau') > 0 || stacks(s, 'en-flammes-navire') > 0) posed = true;
    }
    expect(posed).toBe(true);
  });

  it('renvoie false (la coque ne « meurt » pas d’un Critique — destruction par Blessures/Naufrage)', () => {
    const s: Combatant = ship();
    expect(applyCriticalToTarget(s, 'corps', 0, [], setStub, { get: getHorsBataille })).toBe(false);
  });
});

describe('applyCriticalToTarget — l’équipage lié (crewIds) encaisse via la bataille (MDG 14)', () => {
  it('crewIds résolus depuis battle.combatants → un marin est réellement touché (balayage de seeds)', () => {
    let crewTouched = false;
    for (let seed = 1; seed <= 60 && !crewTouched; seed++) {
      seedBattleRng(seed);
      const s = ship();
      const crew = Array.from({ length: 8 }, (_, i) => sailor(`m${i}`));
      s.crewIds = crew.map((c) => c.id);
      // La bataille PORTE la file de journal différée : depuis #1657 B3-1/B3-2, le Test de la rangée
      // du Critique encaissé par le marin part par la PORTE — sa voie inline y pousse ses lignes.
      const auteur = sailor('auteur');
      const get = (() => ({ battle: { combatants: [auteur, s, ...crew] }, party: [], pendingLogQueue: [] })) as never;
      const coup = { mode: 'melee' as const, weapon: hache, res: toucheAuJetPose(auteur, s, hache, jet, 2, { rng: makeRNG(1595) }) }; // le coup qui porte le Critique (MDG 13 l.584)
      applyCriticalToTarget(s, 'corps', 0, [], setStub, { get, ctx: { attackerId: auteur.id, attackerKind: 'npc', weapon: hache.label, coup } });
      crewTouched = crew.some((c) => c.wounds.current < 13 || (c.traumas?.length ?? 0) > 0 || c.conditions.length > 0);
    }
    expect(crewTouched).toBe(true);
  });

  it('hors bataille (aucun combattant à résoudre) → effets de coque seuls, aucun crash', () => {
    seedBattleRng(1);
    const s = ship();
    s.crewIds = ['m0'];
    expect(applyCriticalToTarget(s, 'corps', 0, [], setStub, { get: getHorsBataille })).toBe(false);
  });
});
