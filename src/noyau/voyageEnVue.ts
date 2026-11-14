/**
 * LE VOYAGE EN VUE (#3534) — ce qu'un hôte montre d'un trajet en cours, terre, fleuve ou mer : d'où il part, où il va,
 * par quel moyen, sur quelle voie, les km faits sur les km du trajet, le moment du jour (`dayPhase`),
 * la météo du jour (`activeDayWeather`), les événements racontés du jour en cours (`TravelPlan.evenements`), le km de
 * chaque nuit déjà passée en route (`TravelPlan.log`) et le plan de la carte vu du départ (`planDepuis`). Lecteur PUR, lu par les hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import { placeById } from './worldMap';
import { planDepuis, type PlanDeLaCarte } from './carteEnVue';
import { activeDayWeather } from './combatFlow';
import { dayPhase, type DayPhaseId } from '../engine/clock';
import { travelModeLabels, vehicleTravel, type TravelMode } from '../engine/travel';
import { weatherCondition, type Weather } from '../engine/travelStages';
import { garanti } from '../lib/garanti';
import type { RecapEvent } from './recapLine';

/** La voie d'un trajet, dite dans les milieux d'un passage payé (`VehicleData.travel.medium`) : la mer d'une traversée
 *  (`TravelPlan.sea`), le fleuve d'une descente (`TravelPlan.river`), sinon le milieu de son véhicule, la route sans lui. */
type VoieDuVoyage = NonNullable<NonNullable<ReturnType<typeof vehicleTravel>>['medium']>;

/** Le trajet en cours ; `mode` : le moyen par son id, `moyen` : son nom ;
 *  `moment` : son moment du jour ; `meteo` : la météo du jour par son id et son nom, `null` hors d'un jour qui l'a
 *  tirée ; `evenements` : les événements racontés du jour en cours, vide sans eux ; `nuits` : le km de chaque nuit passée en route, dans l'ordre ; `carte` : le plan de la carte, où `depart` et
 *  `arrivee` nomment les deux lieux du trajet et `route` sa route, par leur id. */
export interface VoyageEnVue {
  de: string; vers: string; depart: string; arrivee: string; route: string; carte: PlanDeLaCarte; mode: TravelMode; moyen: string; voie: VoieDuVoyage; km: number; fait: number;
  moment: { id: DayPhaseId; nom: string }; meteo: { id: Weather; nom: string } | null; evenements: RecapEvent[]; nuits: number[];
}

/** Le trajet du groupe ; `null` : aucun, ou interrompu (un combat, une scène). PUR. */
export function voyageEnVue(s: Jeu): VoyageEnVue | null {
  const plan = s.travelPlan;
  if (!plan || plan.interrupted || !s.worldMap) return null;
  const map = s.worldMap;
  const lieu = (id: string) => garanti(placeById(map, id), id, 'lieu du trajet');
  const meteo = activeDayWeather(() => s);
  const moment = dayPhase(s.gameTime);
  const milieu = vehicleTravel(plan.mode)?.medium;
  return {
    de: lieu(plan.fromPlaceId).label, vers: lieu(plan.toPlaceId).label,
    depart: plan.fromPlaceId, arrivee: plan.toPlaceId, route: plan.routeId, carte: planDepuis(s, map, lieu(plan.fromPlaceId), []),
    mode: plan.mode, moyen: garanti(travelModeLabels()[plan.mode], plan.mode, 'mode de voyage'),
    voie: plan.sea ? 'maritime' : plan.river ? 'fluvial' : milieu ?? 'terrestre',
    km: Math.round(plan.km), fait: Math.round(plan.kmDone),
    moment: { id: moment.id, nom: moment.label },
    meteo: meteo ? { id: meteo, nom: weatherCondition(meteo).label } : null,
    evenements: plan.evenements ?? [],
    nuits: (plan.log ?? []).map((j) => Math.round(j.kmTo)),
  };
}
