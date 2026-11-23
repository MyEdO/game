/**
 * LE VOYAGE EN VUE (#3534) — ce qu'un hôte montre d'un trajet en cours, terre, fleuve ou mer : d'où il part, où il va,
 * par quel moyen, sur quelle voie, la distance faite sur la distance du trajet dans son unité (`distanceDeRoute`),
 * la météo du jour (`activeDayWeather`), les événements racontés du jour en cours (`TravelPlan.evenements`), chaque
 * journée déjà close en route (`TravelPlan.log`), le plan de la carte vu du départ (`planDepuis`) et la cadence
 * qu'il joue (`traverseeCommandee`), avec le geste de chaque cadence là où elle a un effet (`cadenceAUnEffet`). Lecteur PUR, lu par la projection des hôtes (`hote/projection.ts`).
 */
import type { Jeu } from './etat';
import { placeById } from './worldMap';
import { planDepuis, type PlanDeLaCarte } from './carteEnVue';
import { activeDayWeather } from './combatFlow';
import { distanceDeRoute, vehicleTravel, type Distance } from '../engine/travel';
import { weatherCondition, type Weather } from '../engine/travelStages';
import type { DeDeTable } from '../engine/tables';
import { garanti } from '../lib/garanti';
import { tableSpec } from './cascade';
import { modeEnVue, type ModeEnVue } from './carteEnVue';
import type { RecapEvent, RecapLine } from './recapLine';
import type { NightEntry } from './restFlow';
import type { SeaRecapChrome } from './seaVoyageFlow';
import type { TravelRecapDay } from './travelFlow';
import type { GesteDuNoyau } from './actionsDuNoyau';
import { CADENCES_AU_CHOIX, cadenceAUnEffet, traverseeCommandee, type VoyageCadence } from './voyageCadence';

/** La voie d'un trajet, dite dans les milieux d'un passage payé (`VehicleData.travel.medium`) : la mer d'une traversée
 *  (`TravelPlan.sea`), le fleuve d'une descente (`TravelPlan.river`), sinon le milieu de son véhicule, la route sans lui. */
type VoieDuVoyage = NonNullable<NonNullable<ReturnType<typeof vehicleTravel>>['medium']>;

/** Un événement raconté et le dé de sa table (`tableSpec`). */
export type EvenementEnVue = RecapEvent & { de: DeDeTable };

/** L'événement raconté `e` et le dé de la table d'où il sort. PUR. */
export function evenementEnVue(e: RecapEvent): EvenementEnVue {
  return { ...e, de: tableSpec({ tableId: e.source.table }) };
}

/** Une journée close en route : `depuis` et `jusqua`, ses bornes exactes dans l'unité du trajet ; `heures`, sa durée de
 *  route ; `meteo`, sa météo d'Étape par son id et son nom, `null` sans elle ; ses lignes, ses événements racontés, ses
 *  jets (`entrees`) ; `mer`, l'instantané d'un jour de mer, `null` hors d'elle. */
export interface JourneeEnVue {
  depuis: number; jusqua: number; heures: number;
  meteo: { id: Weather; nom: string } | null;
  lignes: RecapLine[]; evenements: EvenementEnVue[]; entrees: NightEntry[];
  mer: SeaRecapChrome | null;
}

/** La journée close `d` en vue. PUR. */
export function journeeEnVue(d: TravelRecapDay): JourneeEnVue {
  return {
    depuis: d.kmFrom, jusqua: d.kmTo, heures: d.hours,
    meteo: d.weather ? { id: d.weather.id, nom: weatherCondition(d.weather.id).label } : null,
    lignes: d.lines, evenements: (d.events ?? []).map(evenementEnVue), entrees: d.entries ?? [],
    mer: d.sea ?? null,
  };
}

/** Le trajet en cours ; `mode` : le moyen par son id et son nom ; `km` et `fait` : des distances exactes dans l'unité
 *  `unite` ; `meteo` : la météo du jour par son id et son nom, `null` hors d'un jour qui l'a tirée ; `evenements` : les
 *  événements racontés du jour en cours, vide sans eux ; `journees` : chaque journée close en route, dans l'ordre ;
 *  `carte` : le plan de la carte, où `depart` et `arrivee` nomment les deux lieux du trajet et `route` sa route, par
 *  leur id ; `cadence` : celle que le trajet joue ; `cadences` : chaque cadence et le geste qui la fixe, celle de
 *  `DEFAULT_VOYAGE_ORDERS` en premier, vide là où elle n'a aucun effet. */
export interface VoyageEnVue {
  de: string; vers: string; depart: string; arrivee: string; route: string; carte: PlanDeLaCarte; mode: ModeEnVue; voie: VoieDuVoyage; unite: Distance['unite']; km: number; fait: number;
  meteo: { id: Weather; nom: string } | null; evenements: EvenementEnVue[]; journees: JourneeEnVue[];
  cadence: VoyageCadence; cadences: { cadence: VoyageCadence; geste: GesteDuNoyau }[];
}

/** Le trajet du groupe ; `null` : aucun, ou interrompu (un combat, une scène). PUR. */
export function voyageEnVue(s: Jeu): VoyageEnVue | null {
  const plan = s.travelPlan;
  if (!plan || plan.interrupted || !s.worldMap) return null;
  const map = s.worldMap;
  const lieu = (id: string) => garanti(placeById(map, id), id, 'lieu du trajet');
  const meteo = activeDayWeather(() => s);
  const milieu = vehicleTravel(plan.mode)?.medium;
  return {
    de: lieu(plan.fromPlaceId).label, vers: lieu(plan.toPlaceId).label,
    depart: plan.fromPlaceId, arrivee: plan.toPlaceId, route: plan.routeId, carte: planDepuis(s, map, lieu(plan.fromPlaceId), []),
    mode: modeEnVue(plan.mode),
    voie: plan.sea ? 'maritime' : plan.river ? 'fluvial' : milieu ?? 'terrestre',
    unite: distanceDeRoute(plan.km, !!plan.sea).unite, km: plan.km, fait: plan.kmDone,
    meteo: meteo ? { id: meteo, nom: weatherCondition(meteo).label } : null,
    evenements: (plan.evenements ?? []).map(evenementEnVue),
    journees: (plan.log ?? []).map(journeeEnVue),
    cadence: traverseeCommandee(s) ? 'commande' : 'jourParJour',
    cadences: cadenceAUnEffet(s) ? CADENCES_AU_CHOIX.map((cadence) => ({ cadence, geste: { verbe: 'fixerLaCadence', args: [cadence] } })) : [],
  };
}
