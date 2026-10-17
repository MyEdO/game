import { describe, it, expect } from 'vitest';
import { Characteristics, Combatant, ItemInstance } from './types';
import { makeRNG } from './dice';
import { stacks } from './conditions';
import {
  partyWalkSpeed, travelSpeed, travelPlanCalc, forcedMarchTest, applyTravelFatigue,
  billetImplicite, prixDuBillet, prixParPassager, parcoursDuBillet, type TarifDeBillet,
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

describe('billet implicite (LDB 51 l.180-189 : prix par km par passager)', () => {
  const total = (km: number, mode: string, classe: string, n: number) => toBrass(prixDuBillet(billetImplicite(km, mode)!, classe, n)!);
  it('diligence Intérieur 2 sous/km : 10 km × 4 passagers = 80 sous', () => {
    expect(total(10, 'diligence', 'interieur', 4)).toBe(80);
  });
  it('diligence Extérieur 1 sou/km ; barge Cabine 5 / Pont 2', () => {
    expect(total(10, 'diligence', 'exterieur', 1)).toBe(10);
    expect(total(10, 'barge', 'cabine', 1)).toBe(50);
    expect(total(10, 'barge', 'pont', 1)).toBe(20);
  });
  it('km fractionnaires arrondis au sou supérieur', () => {
    expect(total(2.5, 'diligence', 'exterieur', 1)).toBe(3);
  });
  it('mode « mer » (navire de campagne, pas un passage payant à la classe) → null, jamais de throw', () => {
    expect(billetImplicite(100, 'mer')).toBeNull();
  });
});

/** EDO 01 l.142 : « 4/ par personne pour faire le chemin sur le toit, mais descendront à 3/- sur un Test
 *  Opposé de Marchandage réussi, et avec au moins 6 DR, ils se contenteront de 2/-. Le prix est doublé
 *  pour des places en intérieur. » — `exterieur` = le toit (`vehicles.json`, LDB : bagages « arrimés au toit »). */
describe('billet d’auteur à paliers (EDO 01 l.142)', () => {
  const gunnarEtHultz: TarifDeBillet = {
    prix: { exterieur: 48, interieur: 96 },
    paliers: [{ drMin: 0, prix: { exterieur: 36, interieur: 72 } }, { drMin: 6, prix: { exterieur: 24, interieur: 48 } }],
  };
  const issue = (won: boolean, drNet: number, negotiator = false) => ({ won, drNet, negotiator });
  it('Marchandage perdu ou absent : 4/- sur le toit', () => {
    expect(prixParPassager(gunnarEtHultz, 'exterieur')).toBe(48);
    expect(prixParPassager(gunnarEtHultz, 'exterieur', issue(false, 3))).toBe(48);
  });
  it('Marchandage gagné : 3/- sur le toit', () => {
    expect(prixParPassager(gunnarEtHultz, 'exterieur', issue(true, 2))).toBe(36);
  });
  it('gagné avec au moins 6 DR : 2/- sur le toit', () => {
    expect(prixParPassager(gunnarEtHultz, 'exterieur', issue(true, 6))).toBe(24);
    expect(prixParPassager(gunnarEtHultz, 'exterieur', issue(true, 9))).toBe(24);
  });
  it('intérieur : le double à chaque palier', () => {
    expect([undefined, issue(true, 1), issue(true, 6)].map((i) => prixParPassager(gunnarEtHultz, 'interieur', i))).toEqual([96, 72, 48]);
  });
  it('Négociateur (LDB 10 l.818) : 10 % de plus sur le palier gagné, au sou supérieur', () => {
    expect(prixParPassager(gunnarEtHultz, 'exterieur', issue(true, 2, true))).toBe(33); // 36 × 0,9 = 32,4
    expect(prixParPassager(gunnarEtHultz, 'exterieur', issue(false, 0, true))).toBe(48); // perdu : rien
  });
  it('sans paliers : remise de Marchandage `bargainBuyFactor` (LDB 59 l.43)', () => {
    expect(prixParPassager({ prix: { exterieur: 48 } }, 'exterieur', issue(true, 2))).toBe(44); // 43,2 → 44
  });
  it('total = prix par passager × passagers ; classe non offerte → null', () => {
    expect(toBrass(prixDuBillet(gunnarEtHultz, 'exterieur', 4, issue(true, 2))!)).toBe(144);
    expect(prixDuBillet({ prix: { exterieur: 48 } }, 'interieur', 4)).toBeNull();
  });
});

describe('parcoursDuBillet : suite contiguë et départ', () => {
  const r = (id: string, a: string, b: string, km: number, from?: string, modes = ['pied', 'diligence']) => ({ id, a, b, km, from, modes });
  const routes = [r('r1', 'A', 'B', 40, 'A'), r('r2', 'B', 'C', 35, 'B'), r('r3', 'D', 'E', 10), r('r4', 'C', 'D', 5, undefined, ['pied'])];
  it('suite contiguë : arrivée au bout de la dernière route, km cumulés', () => {
    expect(parcoursDuBillet(routes, routes[0], 'A', ['r2'], 'diligence')).toMatchObject({ ok: true, arrivee: 'C', km: 75 });
  });
  it('route qui ne part pas du lieu d’arrivée de la précédente : refusée à son rang', () => {
    expect(parcoursDuBillet(routes, routes[0], 'A', ['r3'], 'diligence')).toMatchObject({ ok: false, rang: 0 });
  });
  it('route qui n’offre pas le mode du billet : refusée', () => {
    expect(parcoursDuBillet(routes, routes[0], 'A', ['r2', 'r4'], 'diligence')).toMatchObject({ ok: false, rang: 1 });
  });
  it('route à double sens sans « depuis » : refusée ; avec, acceptée', () => {
    expect(parcoursDuBillet(routes, routes[2], undefined, [], 'diligence')).toMatchObject({ ok: false, rang: -1 });
    expect(parcoursDuBillet(routes, routes[2], 'E', [], 'diligence')).toMatchObject({ ok: true, arrivee: 'D' });
  });
  it('« depuis » contraire au sens unique de la route : refusé', () => {
    expect(parcoursDuBillet(routes, routes[0], 'B', [], 'diligence')).toMatchObject({ ok: false, rang: -1 });
  });
  it('route déjà parcourue par le billet (aller-retour) : refusée à son rang', () => {
    expect(parcoursDuBillet(routes, routes[2], 'E', ['r3'], 'diligence')).toMatchObject({ ok: false, rang: 0 });
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
    expect(routeDistanceLabel(18, false)).toBe('18 km'); // insécable : le nombre ne quitte pas son unité
    expect(routeDistanceLabel(480.4, true)).toBe('480 milles');
  });
});
