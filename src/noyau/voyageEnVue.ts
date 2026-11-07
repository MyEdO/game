/**
 * LE VOYAGE EN VUE (#3534) — ce qu'un hôte montre d'un trajet en cours, terre, fleuve ou mer : d'où il part, où il va,
 * par quel moyen, les km faits sur les km du trajet, l'heure de jeu, la météo du jour (`activeDayWeather`) et le km de
 * chaque nuit déjà passée en route (`TravelPlan.log`). Lecteur PUR, lu par les hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import { placeById } from './worldMap';
import { activeDayWeather } from './combatFlow';
import { travelModeLabels } from '../engine/travel';
import { weatherCondition } from '../engine/travelStages';
import { garanti } from '../lib/garanti';

/** Le trajet en cours ; `heure` : l'heure de jeu (`gameTime`), `meteo` : `null` hors d'un jour qui l'a tirée, `nuits` :
 *  le km de chaque nuit passée en route, dans l'ordre. */
export interface VoyageEnVue { de: string; vers: string; moyen: string; km: number; fait: number; heure: number; meteo: string | null; nuits: number[] }

/** Le trajet du groupe ; `null` : aucun, ou interrompu (un combat, une scène). PUR. */
export function voyageEnVue(s: Jeu): VoyageEnVue | null {
  const plan = s.travelPlan;
  if (!plan || plan.interrupted || !s.worldMap) return null;
  const lieu = (id: string) => garanti(placeById(s.worldMap!, id), id, 'lieu du trajet').label;
  const meteo = activeDayWeather(() => s);
  return {
    de: lieu(plan.fromPlaceId), vers: lieu(plan.toPlaceId),
    moyen: garanti(travelModeLabels()[plan.mode], plan.mode, 'mode de voyage'),
    km: Math.round(plan.km), fait: Math.round(plan.kmDone), heure: s.gameTime,
    meteo: meteo ? weatherCondition(meteo).label : null,
    nuits: (plan.log ?? []).map((j) => Math.round(j.kmTo)),
  };
}
