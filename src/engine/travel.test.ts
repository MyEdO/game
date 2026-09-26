import { describe, it, expect } from 'vitest';
import { Characteristics, Combatant, ItemInstance } from './types';
import { makeRNG } from './dice';
import { stacks } from './conditions';
import {
  partyWalkSpeed, travelSpeed, travelPlanCalc, transportCost, forcedMarchTest, applyTravelFatigue,
  vehicleTravel, TRAVEL_DEFAULTS, distanceUnit, routeDistanceLabel,
} from './travel';
import { toBrass } from './money';

const chars = (E = 30): Characteristics => ({
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});

function hero(opts: { id?: string; movement?: number; enc?: number; endurance?: number; dead?: boolean } = {}): Combatant {
  const enc = opts.enc ?? 0;
  const items: ItemInstance[] = enc > 0 ? [{ uid: 'x', label: 'charge', kind: 'misc', qualities: [], enc, equipped: false }] : [];
  return {
    id: opts.id ?? 'c', label: opts.id ?? 'Test', kind: 'hero',
    characteristics: chars(opts.endurance),
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items, skills: [], talents: [], movement: opts.movement ?? 4, dead: opts.dead,
  };
}

describe('vitesse de voyage (LDB 51 l.193 : Déplacement = km/h, le plus lent du groupe)', () => {
  it('à pied : Mouvement effectif le plus lent du groupe', () => {
    expect(partyWalkSpeed([hero({ id: 'a', movement: 4 }), hero({ id: 'b', movement: 3 })])).toBe(3);
  });
  it('le Mouvement effectif tient compte de l’Encombrement (palier 1 : M4 → 3)', () => {
    expect(partyWalkSpeed([hero({ movement: 4, enc: 8 })])).toBe(3);
  });
  it('un mort ne ralentit pas le groupe', () => {
    expect(partyWalkSpeed([hero({ id: 'a', movement: 4 }), hero({ id: 'b', movement: 1, dead: true })])).toBe(4);
  });
  it('diligence M6 / barge M8 (l.210-215), override modèle rapide (M+1, l.208)', () => {
    expect(travelSpeed([hero()], [], 'diligence')).toBe(6);
    expect(travelSpeed([hero()], [], 'barge')).toBe(8);
    expect(travelSpeed([hero()], [], 'diligence', 7)).toBe(7);
  });
});

describe('travelPlanCalc (LDB 51 l.195 : 6 h/jour sans Test)', () => {
  it('24 km à 4 km/h, 6 h/j → 1 journée pleine', () => {
    const p = travelPlanCalc(24, 4, 6)!;
    expect(p.days).toBe(1);
    expect(p.hoursLastDay).toBe(6);
    expect(p.travelMinutes).toBe(360);
  });
  it('30 km à 4 km/h, 6 h/j → 2 jours, dernier jour 1 h 30', () => {
    const p = travelPlanCalc(30, 4, 6)!;
    expect(p.days).toBe(2);
    expect(p.hoursLastDay).toBeCloseTo(1.5);
  });
  it('marche forcée (10 h/j) : 30 km à 4 km/h → 1 jour de 7 h 30', () => {
    const p = travelPlanCalc(30, 4, 10)!;
    expect(p.days).toBe(1);
    expect(p.hoursLastDay).toBeCloseTo(7.5);
  });
  it('entrées invalides → null', () => {
    expect(travelPlanCalc(0, 4, 6)).toBeNull();
    expect(travelPlanCalc(10, 0, 6)).toBeNull();
  });
});

describe('transportCost (LDB 51 l.180-189 : prix par km par passager)', () => {
  it('diligence Intérieur 2 sous/km : 10 km × 4 passagers = 80 sous', () => {
    expect(toBrass(transportCost(10, 'diligence', 'interieur', 4)!)).toBe(80);
  });
  it('diligence Extérieur 1 sou/km ; barge Cabine 5 / Pont 2', () => {
    expect(toBrass(transportCost(10, 'diligence', 'exterieur', 1)!)).toBe(10);
    expect(toBrass(transportCost(10, 'barge', 'cabine', 1)!)).toBe(50);
    expect(toBrass(transportCost(10, 'barge', 'pont', 1)!)).toBe(20);
  });
  it('prix d’auteur (override par route) respecté', () => {
    expect(toBrass(transportCost(10, 'diligence', 'interieur', 1, 4)!)).toBe(40);
  });
  it('km fractionnaires arrondis au sou supérieur', () => {
    expect(toBrass(transportCost(2.5, 'diligence', 'exterieur', 1)!)).toBe(3);
  });
  it('mode « mer » (navire de campagne, pas un passage payant à la classe) → null, jamais de throw', () => {
    expect(transportCost(100, 'mer', '', 1)).toBeNull();
  });
});

describe('forcedMarchTest (LDB 51 l.195 : Test de Résistance ou Exténué, +1 si Encombré)', () => {
  it('échec non surchargé → +1 Exténué (résultat structuré : ligne + jet)', () => {
    const c = hero({ endurance: 1 }); // Résistance ≈ 1 ; jet 53 (seed 6) → échec hors bande auto 01-05
    const r = forcedMarchTest(c, makeRNG(6))!;
    expect(stacks(c, 'extenue')).toBe(1);
    expect(r.line).toContain('marche forcée');
    expect(r.gained).toBe(1);
    expect(r.d.success).toBe(false); // le jet est exposé pour la ligne de jet du recap
  });
  it('échec surchargé → +2 Exténué', () => {
    const c = hero({ endurance: 1, enc: 8 });
    forcedMarchTest(c, makeRNG(6)); // jet 53 → échec
    expect(stacks(c, 'extenue')).toBe(2);
  });
  it('réussite → aucun Exténué', () => {
    const c = hero({ endurance: 100 });
    forcedMarchTest(c, makeRNG(7));
    expect(stacks(c, 'extenue')).toBe(0);
  });
});

describe('applyTravelFatigue (LDB 61 l.35-48 : Exténué par journée de voyage selon la surcharge)', () => {
  it('non surchargé : rien', () => {
    const c = hero();
    expect(applyTravelFatigue(c)).toEqual([]);
    expect(stacks(c, 'extenue')).toBe(0);
  });
  it('palier 1 → +1 Exténué ; palier 2 → +2', () => {
    const c1 = hero({ enc: 8 });
    applyTravelFatigue(c1);
    expect(stacks(c1, 'extenue')).toBe(1);
    const c2 = hero({ enc: 14 });
    applyTravelFatigue(c2);
    expect(stacks(c2, 'extenue')).toBe(2);
  });
});

describe('défauts RAW', () => {
  it('6 h/jour, seuil de péripétie 8, diligence M6 2/1 sous, barge M8 5/2 sous', () => {
    expect(TRAVEL_DEFAULTS.hoursPerDay).toBe(6);
    expect(TRAVEL_DEFAULTS.perilDie).toBe(8);
    expect(vehicleTravel('diligence')!.movement).toBe(6);
    expect(vehicleTravel('barge')!.movement).toBe(8);
  });
});

describe('unité de distance (#231 : MapRoute.km porte des MILLES en route sea)', () => {
  it('terrestre → km ; maritime → milles', () => {
    expect(distanceUnit(false)).toBe('km');
    expect(distanceUnit(undefined)).toBe('km');
    expect(distanceUnit(true)).toBe('milles');
  });
  it('routeDistanceLabel arrondit et pose la bonne unité', () => {
    expect(routeDistanceLabel(18, false)).toBe('18 km');
    expect(routeDistanceLabel(480.4, true)).toBe('480 milles');
  });
});
