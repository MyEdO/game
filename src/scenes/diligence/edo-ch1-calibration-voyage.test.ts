import { describe, it, expect } from 'vitest';
import { diligenceCampaign } from '../campaign';
import type { Characteristics, Combatant } from '../../engine/types';
import { travelSpeed, travelPlanCalc } from '../../engine/travel';
import { baseHoursPerDay } from '../../state/travelFlow';
import { visiblePlaces, routesFrom } from '../../state/worldMap';
import type { ConditionCtx } from '../../engine/flowCore';

/**
 * CALIBRATION DE DONNÉE du tronçon de chapitre 1 (#684 L4) : le paquet de campagne RÉEL est chargé,
 * et la durée du trajet La Diligence → Altdorf est calculée par le chemin du moteur que consomme
 * l'écran de carte (`travelSpeed` + `travelPlanCalc` + `baseHoursPerDay`, cf. `ui/WorldMapView.tsx`).
 *
 * Promesse tenue, `EDO 01 l.13` : « Deux jours de diligence, bien sûr. À pied, le trajet devrait durer
 * environ une semaine. » Emplacement du relais, `EDO 01 l.17` : « Son emplacement exact importe peu, du
 * moment qu'il se situe environ à deux jours de voyage d'Altdorf. » Les temps de trajet d'une aventure
 * publiée priment sur l'estimation générique, `LDB 51 l.208` : « si vous jouez à une aventure officielle
 * qui inclut un voyage, les péripéties suggérées et les temps de trajet seront inclus ».
 *
 * D'où vient le `km` : `EDO 01 l.340` — « Une borne sur le bas-côté indique : « Altdorf, 180 km ». »
 * Cette borne se lit AU CROISEMENT avec la route Middenheim-Altdorf, atteint APRÈS le départ du relais :
 * 180 km sous-estime donc légèrement le tronçon complet La Diligence → Altdorf ; c'est la seule
 * distance chiffrée que le chapitre donne.
 *
 * Où vit l'écart : à 6 h de route/jour (`LDB 51 l.195`), la marche du groupe est son Mouvement en km/h
 * (`LDB 51 l.193`) et ne porte AUCUNE surcharge de donnée ici ; c'est le transport payant qui porte son
 * Déplacement d'auteur sur cette route (`MapRoute.speed`, 15 km/h), seule graphie du dépôt pour un temps
 * de trajet d'aventure publiée. Valeur maison au sens de la règle 7 (éditable en donnée, jamais une
 * règle inventée), et le raisonnement complet qui la fonde :
 *  - le levier RAW de vitesse est `LDB 51 l.178` — « Augmentez ou diminuez le Mouvement de +/-1 pour des
 *    modèles plus rapides ou plus lents » : sur le Déplacement 6 de la DILIGENCE (même table), il ouvre
 *    5 à 7 km/h. 15 km/h est HORS de ce levier — l'écart est nommé, pas déguisé en règle ;
 *  - l'allure jouée du chapitre est encore plus basse, `EDO 01 l.309` : « lancent leurs chevaux à une
 *    allure très modérée : guère plus de 3 kilomètres à l'heure ! » (beat narratif du départ) ;
 *  - ce qui fait autorité ici, c'est l'aventure elle-même : `LDB 51 l.208` — « si vous jouez à une
 *    aventure officielle qui inclut un voyage, les péripéties suggérées et les temps de trajet seront
 *    inclus » — et sa promesse chiffrée `EDO 01 l.13`. À 6 h/jour, 180 km en deux jours EXIGENT 15 km/h ;
 *    le levier RAW (7 km/h au mieux) rendrait plus de quatre journées, et manquerait la promesse.
 *
 * Si un auteur retouche `km` ou `speed` au studio, ce test dit si la promesse tient encore.
 *
 * GATING DE LA CARTE — contrat du drapeau `edo-ch1-altdorf-revelee` (arbitrages 2026-08-31 sur #684) :
 * ce drapeau n'a à ce jour AUCUN producteur — Altdorf et sa scène restent inertes jusqu'au beat de fin
 * de chapitre de jeu 1 qui le posera (#685). Il porte les DEUX axes du même fait : le NŒUD
 * (`MapPlace.when` — le lieu n'est pas sur la carte) ET l'ARÊTE (`MapRoute.when` + `refus` — le VOYAGE
 * est verrouillé, `startTravel` réévaluant `when` au départ). Sans l'arête, le rendu seul cachait le
 * lieu pendant que tout appelant hors rendu (devtools, coop, reprise de sauvegarde) pouvait partir.
 */

const chars = (): Characteristics => ({
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});

/** Héros HUMAIN nu (Mouvement 4, aucun Encombrement) : `LDB 51 l.193` — le Déplacement EST la vitesse en km/h. */
function hero(id: string): Combatant {
  return {
    id, label: id, kind: 'hero', characteristics: chars(),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  };
}

const party = ['a', 'b', 'c', 'd'].map(hero);
const map = diligenceCampaign.worldMap!;
const route = map.routes.find((r) => r.id === 'route-la-diligence-altdorf')!;
const heures = baseHoursPerDay(map);
const ctx = (flags: Record<string, boolean> = {}): ConditionCtx => ({ flags, gameTime: 0 });

/** Journées de route (fractionnaires) rendues par le moteur pour un mode donné. */
function jours(mode: string): number {
  const kmh = travelSpeed(party, [], mode, route.speed?.[mode]);
  const plan = travelPlanCalc(route.km, kmh, heures)!;
  return plan.travelMinutes / 60 / heures;
}

describe('Chapitre 1 de jeu (EDO) — le tronçon La Diligence → Altdorf tient la promesse de durée du RAW', () => {
  it('la route existe, praticable à pied ET en diligence', () => {
    expect(route.a).toBe('la-diligence');
    expect(route.b).toBe('altdorf');
    expect(route.modes).toEqual(['pied', 'diligence']);
    expect(routesFrom(map, 'la-diligence').map((r) => r.id)).toContain(route.id);
  });

  it('en diligence : ≈ 2 journées de route (EDO 01 l.13)', () => {
    expect(jours('diligence')).toBeGreaterThanOrEqual(1.5);
    expect(jours('diligence')).toBeLessThanOrEqual(2.5);
  });

  it('à pied : ≈ 7 journées de route (EDO 01 l.13) — vitesse du groupe NON surchargée par la donnée', () => {
    expect(route.speed?.pied).toBeUndefined();
    expect(jours('pied')).toBeGreaterThanOrEqual(6);
    expect(jours('pied')).toBeLessThanOrEqual(8);
  });

  it('Altdorf n’existe qu’une fois le drapeau de révélation posé (anti-spoiler)', () => {
    expect(visiblePlaces(map, ctx()).map((p) => p.id)).toEqual(['la-diligence']);
    expect(visiblePlaces(map, ctx({ 'edo-ch1-altdorf-revelee': true })).map((p) => p.id))
      .toEqual(['la-diligence', 'altdorf']);
  });

  it('le VOYAGE lui-même est fermé tant qu’Altdorf n’est pas révélée : `routesFrom` n’offre AUCUN trajet', () => {
    // Lecteur du VOYAGE (`routesFrom`, réévalué par `startTravel`) — pas le rendu : un appelant hors
    // écran (devtools, coop, reprise de sauvegarde) bute sur la MÊME porte que le joueur.
    expect(routesFrom(map, 'la-diligence', ctx()).map((r) => r.id)).toEqual([]);
    expect(routesFrom(map, 'la-diligence', ctx({ 'edo-ch1-altdorf-revelee': true })).map((r) => r.id))
      .toEqual(['route-la-diligence-altdorf']);
    // Verrou par CONSTRUCTION : le trajet fermable porte sa raison JOUEUR (superRefine du schéma).
    expect(route.when).toEqual({ kind: 'flag', expr: 'edo-ch1-altdorf-revelee' });
    expect(route.refus).toBeTruthy();
  });
});
