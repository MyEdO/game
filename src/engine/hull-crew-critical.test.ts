import { describe, it, expect } from 'vitest';
import { applyHullCritical, exposedCrew } from './shipCritical';
import { vehicleCombatant } from './vehicle';
import { findVehicleById } from '../data';
import { makeRNG } from './dice';
import { usesSuddenDeath, isOutOfAction, applyZeroWounds, tickDeath, hasCondition, addCondition, COND } from './conditions';
import type { Combatant } from './types';

/** Marin minimal (Combattant de personnage) — assez pour `resolveCritique`/`applyOps`. */
const sailor = (id: string, over: Partial<Combatant> = {}): Combatant => ({
  id, name: id, kind: 'npc', characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 31, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
  skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
  armour: { corps: 0 }, wounds: { current: 13, max: 13, base: 13 }, advantage: 0, ...over,
}) as unknown as Combatant;

const hull = () => vehicleCombatant(findVehicleById('cogue')!)!; // rig 'voile'

/**
 * Liaison ÉQUIPAGE↔COQUE (MDG 13-14) : un Critique encaissé par un navire RÉPERCUTE sur de VRAIS marins —
 * coup à l'Équipage = Critique de PERSONNAGE sur un marin exposé ; Éclats = 9 Dégâts à autant de marins.
 */
describe('applyHullCritical — l’équipage encaisse réellement (pas qu’un journal)', () => {
  it("Localisation Équipage (d100≤9) → un marin EXPOSÉ subit un Critique de personnage (resolveCritique)", () => {
    const ship = hull();
    const crew = [sailor('marin-1'), sailor('marin-2')];
    const before = crew[0].wounds.current;
    const r = applyHullCritical(ship, crew, 'voile', makeRNG(2), 5); // loc 5 → Équipage
    expect(r.location).toBe('equipage');
    expect(r.crewCrit?.crewId).toBe('marin-1'); // le 1er marin exposé encaisse
    expect(r.crewCrit?.crit.label).toBeTruthy();
    // Un Critique de personnage retire des PB (ops) et/ou pose un Trauma/État → le marin est touché.
    const touched = crew[0].wounds.current < before || (crew[0].traumas?.length ?? 0) > 0 || crew[0].conditions.length > 0;
    expect(touched).toBe(true);
  });

  it('Coque (d100=50, d10=8) → Voie d’eau sur la coque + Éclats 6 : 6 marins encaissent l’effet (9 Dégâts − BE)', () => {
    const ship = hull();
    const crew = Array.from({ length: 8 }, (_, i) => sailor(`marin-${i}`));
    const r = applyHullCritical(ship, crew, 'voile', makeRNG(1), 50, 8); // loc 50 → Coque ; d10 8 → Voie d'eau (Éclats 6)
    expect(r.location).toBe('coque');
    expect(r.hullOps).toEqual([{ op: 'condition', id: 'voie-d-eau', value: 1 }]);
    expect(r.shrapnel.map((s) => s.crewId)).toEqual(['marin-0', 'marin-1', 'marin-2', 'marin-3', 'marin-4', 'marin-5']);
    // COMPORTEMENT (pas la représentation) : chaque marin touché perd 9 − BE(3) − PA(0) = 6 PB (13 → 7) ;
    // les 2 marins au-delà de l'Indice 6 restent intacts. La valeur 9 vit dans la donnée (`shrapnelHit`).
    for (let i = 0; i < 6; i++) expect(crew[i].wounds.current).toBe(7);
    expect(crew[6].wounds.current).toBe(13);
    expect(crew[7].wounds.current).toBe(13);
  });

  it('Éclats plafonnés au nombre de marins exposés (moins de marins que d’Indice)', () => {
    const ship = hull();
    const crew = [sailor('seul')]; // 1 seul marin pour Éclats 6
    const r = applyHullCritical(ship, crew, 'voile', makeRNG(1), 50, 8);
    expect(r.shrapnel).toHaveLength(1);
  });

  it("coup à l'Équipage sans marin exposé → aucun crash, issue vide journalisée", () => {
    const ship = hull();
    const dead = [sailor('mort', { dead: true })];
    expect(exposedCrew(dead)).toHaveLength(0);
    const r = applyHullCritical(ship, dead, 'voile', makeRNG(2), 5);
    expect(r.crewCrit).toBeUndefined();
    expect(r.lines.join(' ')).toMatch(/aucun marin exposé/);
  });
});

/** Coque à 0 Blessure : MDG 13 l.656, l.674 ; MSRC 07 l.74. */
describe('Coque — à 0 PB reste en jeu, ne sort que coulée (ni figurant, ni Inconscient)', () => {
  it("une coque n'utilise jamais la Mort Subite (figurant)", () => {
    expect(usesSuddenDeath(hull())).toBe(false);
  });
  it('à 0 PB → toujours en jeu, sans État À Terre ni Inconscient ni horloge de LDB 18 l.15', () => {
    const s = hull();
    s.wounds.current = 0;
    applyZeroWounds(s);
    expect(hasCondition(s, COND.aTerre)).toBe(false);
    expect(isOutOfAction(s)).toBe(false);
    tickDeath(s);
    expect(hasCondition(s, COND.inconscient)).toBe(false);
    expect(s.roundsAtZero ?? 0).toBe(0);
  });
  it('coulée (État naufrage, MDG 13 l.674) → hors de combat', () => {
    const s = hull();
    s.wounds.current = 0;
    addCondition(s, 'naufrage');
    expect(isOutOfAction(s)).toBe(true);
  });
  it('coque intacte (PB > 0) → toujours en combat', () => {
    expect(isOutOfAction(hull())).toBe(false);
  });
});
