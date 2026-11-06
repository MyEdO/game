/**
 * LA CARTE DU MONDE EN VUE (#3328) — ce qu'un hôte montre de la carte qui tient la main : le lieu du groupe, et
 * chaque trajet que la carte trace depuis lui (`routesCliquables`), sa destination, sa longueur et chacun de ses modes
 * de voyage, écrit en verbe du noyau (`startTravel`) avec ce qui le ferme maintenant (`refusDeDepart`) et la durée que
 * son devis prévoit (`devisDeTrajet`) ; un voyage interrompu se reprend (`resumeTravel`). Lecteur PUR, lu par les hôtes
 * du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import { otherEnd, placeById, placeOfScene, routesCliquables } from './worldMap';
import { devisDeTrajet, refusDeDepart } from './travelFlow';
import { condCtx } from './bourseFlow';
import { partyFullyMounted } from '../engine/mountTravel';
import { routeDistanceLabel, travelModeLabels, type TravelMode } from '../engine/travel';
import { rule } from '../engine/policy';
import { fenetreDuJeu } from './combatAuto';
import { garanti } from '../lib/garanti';

/** Un mode de voyage d'un trajet : son nom, le verbe qui part (`geste`), pourquoi il ne part pas maintenant (`refus`,
 *  `null` s'il part) et les jours de route que son devis prévoit (`null` : aucun plan, en mer). */
export interface ModeDuTrajet { mode: TravelMode; libelle: string; geste: GesteDuNoyau; refus: string | null; jours: number | null }

/** Un trajet depuis le lieu du groupe : sa route, sa destination, sa longueur dite, et ses modes. */
export interface TrajetEnVue { route: string; vers: string; distance: string; modes: ModeDuTrajet[] }

/** La carte ouverte : le lieu du groupe, ses trajets, et la reprise d'un voyage interrompu. */
export interface CarteEnVue { ici: string; trajets: TrajetEnVue[]; reprendre: GesteDuNoyau | null }

/** Les modes qu'un trajet offre : les siens, et en selle quand il se fait à pied et que tout le groupe est monté
 *  (EDOC 07 l.140). */
function modesDuTrajet(s: Jeu, modes: readonly TravelMode[]): TravelMode[] {
  const enSelle = !!rule('travel-allures') && modes.includes('pied') && partyFullyMounted(s.party, s.possessions);
  return [...modes, ...(enSelle ? ['monture'] : [])];
}

/** La carte du monde qui tient la main (`fenetreDuJeu`) ; `null` : elle ne tient pas la main, ou le groupe n'est à
 *  aucun de ses lieux. PUR. */
export function carteEnVue(s: Jeu): CarteEnVue | null {
  const map = s.worldMap;
  const ici = fenetreDuJeu(s)?.cle === 'carteDuMonde' ? placeOfScene(map, s.scene?.id) : undefined;
  if (!map || !ici) return null;
  const libelles = travelModeLabels();
  const trajets = routesCliquables(map, ici.id, condCtx(() => s)).map(({ route }): TrajetEnVue => ({
    route: route.id,
    vers: garanti(placeById(map, otherEnd(route, ici.id)), route.id, 'destination du trajet').label,
    distance: routeDistanceLabel(route.km, route.sea),
    modes: modesDuTrajet(s, route.modes).map((mode) => ({
      mode,
      libelle: garanti(libelles[mode], mode, 'mode de voyage'),
      geste: { verbe: 'startTravel', args: [route.id, mode] },
      refus: refusDeDepart(s, route.id, mode),
      jours: devisDeTrajet(s, route, ici.id, mode).plan?.days ?? null,
    })),
  }));
  return { ici: ici.label, trajets, reprendre: s.travelPlan?.interrupted ? { verbe: 'resumeTravel', args: [] } : null };
}
