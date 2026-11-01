import { describe, it, expect } from 'vitest';
import { diligenceCampaign, paquetDuJeu } from '../campaign';
import type { Characteristics, Combatant } from '../../engine/types';
import { travelSpeed, travelPlanCalc } from '../../engine/travel';
import { baseHoursPerDay } from '../../noyau/travelFlow';
import { parseProject, ProjetRefuse, type ProjectDoc } from '../../noyau/worldMap';
import { blessuresDeBase, blessuresSurLeProfil } from '../../engine/combattantDeTest.testkit';

/**
 * CALIBRATION DE DONNÉE de la route du chapitre 1 de jeu : le paquet de campagne RÉEL est chargé, et la
 * durée de la CHAÎNE La Diligence → La route principale → Auberge des Sept Rayons → Altdorf est calculée
 * tronçon par tronçon par le chemin du moteur que consomme l'écran de carte (`travelSpeed` +
 * `travelPlanCalc` + `baseHoursPerDay`, cf. `ui/WorldMapView.tsx`).
 *
 * Promesse : `EDO 01 l.13`, `EDO 01 l.17`. Primauté des temps de trajet d'une aventure publiée :
 * `LDB 51 l.208`.
 *
 * La provenance du kilométrage, de la vitesse et du dé de péril de chaque tronçon vit dans la donnée
 * (`MapRoute.provenances`), éditable au studio. La marche du groupe (`LDB 51 l.193`) ne porte AUCUNE
 * surcharge de donnée.
 *
 * Si un auteur retouche `km` ou `speed` au studio, ce test dit si la promesse tient encore.
 */

const chars = (): Characteristics => ({
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});

/** Héros HUMAIN nu (Mouvement 4, aucun Encombrement) : `LDB 51 l.193`. */
function hero(id: string): Combatant {
  return blessuresSurLeProfil({
    id, label: id, kind: 'hero', characteristics: chars(),
    wounds: blessuresDeBase(12), advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  });
}

const party = ['a', 'b', 'c', 'd'].map(hero);
const map = paquetDuJeu(diligenceCampaign).worldMap!;
const CHAINE = [
  'route-la-diligence-route-principale',
  'route-route-principale-sept-rayons',
  'route-sept-rayons-altdorf',
];
const troncons = CHAINE.map((id) => {
  const r = map.routes.find((x) => x.id === id);
  if (!r) throw new Error(`tronçon « ${id} » absent du paquet`);
  return r;
});
const heures = baseHoursPerDay(map);

/** Journées de route (fractionnaires) rendues par le moteur pour la chaîne, tronçon par tronçon. */
function jours(mode: string): number {
  const minutes = troncons.reduce((n, r) => {
    const kmh = travelSpeed(party, [], mode, r.speed?.[mode]);
    return n + travelPlanCalc(r.km, kmh, heures)!.travelMinutes;
  }, 0);
  return minutes / 60 / heures;
}

describe('Chapitre 1 de jeu (EDO) — la chaîne La Diligence → Altdorf tient la promesse de durée du RAW', () => {
  it('la chaîne est continue, praticable à pied ET en diligence, et totalise 190 km', () => {
    expect(troncons.map((r) => [r.a, r.b])).toEqual([
      ['la-diligence', 'route-principale'],
      ['route-principale', 'auberge-des-sept-rayons'],
      ['auberge-des-sept-rayons', 'altdorf'],
    ]);
    for (const r of troncons) expect(r.modes, r.id).toEqual(['pied', 'diligence']);
    expect(troncons.map((r) => r.km)).toEqual([40, 35, 115]);
    expect(troncons.reduce((n, r) => n + r.km, 0)).toBe(190);
  });

  it('en diligence : 2,11 journées, dans la fourchette 1,5 à 2,5 (EDO 01 l.13)', () => {
    for (const r of troncons) expect(r.speed?.diligence, r.id).toBe(15);
    expect(jours('diligence')).toBeCloseTo(2.11, 2);
    expect(jours('diligence')).toBeGreaterThanOrEqual(1.5);
    expect(jours('diligence')).toBeLessThanOrEqual(2.5);
  });

  // `LDB 51 l.208` (#2533).
  it('les trois tronçons ont le d10 de péripétie éteint (`perilDie: 0`), chacun cité au passage d’EDO qui le dit', () => {
    expect(troncons.map((r) => r.perilDie)).toEqual([0, 0, 0]);
    expect(troncons.map((r) => r.provenances?.perilDie?.source?.note)).toEqual(['EDO 02 l.13', 'EDO 02 l.180', 'EDO 02 l.189']);
    for (const r of troncons) expect(r.provenances?.speed?.maison, r.id).toBeTruthy();
  });

  it('à pied (Mouvement 4) : 7,92 journées, dans la fourchette 6 à 8 (EDO 01 l.13) — vitesse NON surchargée', () => {
    for (const r of troncons) expect(r.speed?.pied, r.id).toBeUndefined();
    expect(jours('pied')).toBeCloseTo(7.92, 2);
    expect(jours('pied')).toBeGreaterThanOrEqual(6);
    expect(jours('pied')).toBeLessThanOrEqual(8);
  });
});

describe('provenance des valeurs de route, à la porte du chargement (#2533)', () => {
  const doc = (): ProjectDoc => structuredClone(diligenceCampaign.paquet) as unknown as ProjectDoc;
  const refus = (d: ProjectDoc): string => {
    try { parseProject(d); return ''; } catch (e) { if (e instanceof ProjetRefuse) return e.message; throw e; }
  };

  it('le paquet committé passe la porte', () => {
    expect(refus(doc())).toBe('');
  });
  it('un dé de péril posé sans provenance est refusé', () => {
    const d = doc();
    delete d.worldMap!.routes[0].provenances!.perilDie;
    expect(refus(d)).toMatch(/provenance manquante.*du dé de péril/);
  });
  it('une vitesse posée sans provenance est refusée', () => {
    const d = doc();
    delete d.worldMap!.routes[1].provenances!.speed;
    expect(refus(d)).toMatch(/provenance manquante.*de la vitesse/);
  });
  it('une provenance vide est refusée', () => {
    const d = doc();
    d.worldMap!.routes[2].provenances!.km = {};
    expect(refus(d)).toMatch(/provenance manquante.*de la valeur/);
  });
});
