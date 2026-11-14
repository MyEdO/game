/**
 * LA CARTE DU MONDE EN VUE (#3328) — ce qu'un hôte montre de la carte qui tient la main : son plan, et sous chaque
 * lieu chaque trajet que la carte trace jusqu'à lui depuis le lieu du groupe (`routesCliquables`), sa longueur et chacun de ses modes
 * de voyage, écrit en verbe du noyau (`partirEnVoyage`) avec ce qui le ferme maintenant (`refusDeDepart`) et la durée que
 * son devis prévoit (`devisDeTrajet`) ; un voyage interrompu se reprend (`reprendreLeVoyage`). Lecteur PUR, lu par les hôtes
 * du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import { CADRE, lieuDuGroupe, otherEnd, placeById, positionsDeRendu, routesCliquables, visiblePlaces, type MapPlace, type WorldMap } from './worldMap';
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

/** Un trajet depuis le lieu du groupe : sa route, sa destination (`destination`, son id ; `vers`, son nom), sa
 *  longueur dite, et ses modes. */
export interface TrajetEnVue { route: string; destination: string; vers: string; distance: string; modes: ModeDuTrajet[] }

/** Un lieu sur le plan : son nom, sa position dans le cadre de la carte (0..1 sur chaque axe), s'il est celui où se
 *  tient le groupe, et chaque trajet qui y mène depuis lui. */
export interface LieuDuPlan { id: string; nom: string; x: number; y: number; ici: boolean; trajets: TrajetEnVue[] }

/** Une route sur le plan, de l'un de ses lieux à l'autre ; `depuisIci` : un trajet ouvert depuis le lieu du groupe. */
export interface RouteDuPlan { route: string; de: string; vers: string; depuisIci: boolean }

/** Le plan de la carte : chaque lieu qui existe (`visiblePlaces`) à sa position de rendu (`positionsDeRendu`), et
 *  chaque route qui en relie deux. */
export interface PlanDeLaCarte { lieux: LieuDuPlan[]; routes: RouteDuPlan[] }

/** La carte ouverte : son plan, et la reprise d'un voyage interrompu. */
export interface CarteEnVue { plan: PlanDeLaCarte; reprendre: GesteDuNoyau | null }

/** Les modes qu'un trajet offre : les siens, et en selle quand il se fait à pied et que tout le groupe est monté
 *  (EDOC 07 l.140). */
function modesDuTrajet(s: Jeu, modes: readonly TravelMode[]): TravelMode[] {
  const enSelle = !!rule('voyage-allures') && modes.includes('pied') && partyFullyMounted(s.party, s.possessions);
  return [...modes, ...(enSelle ? ['monture'] : [])];
}

/** Chaque trajet que la carte trace depuis le lieu `ici` (`routesCliquables`) et ses modes. PUR. */
export function trajetsDepuis(s: Jeu, map: WorldMap, ici: MapPlace): TrajetEnVue[] {
  const libelles = travelModeLabels();
  return routesCliquables(map, ici.id, condCtx(() => s)).map(({ route }): TrajetEnVue => ({
    route: route.id,
    destination: otherEnd(route, ici.id),
    vers: garanti(placeById(map, otherEnd(route, ici.id)), route.id, 'destination du trajet').label,
    distance: routeDistanceLabel(route.km, route.sea),
    modes: modesDuTrajet(s, route.modes).map((mode) => ({
      mode,
      libelle: garanti(libelles[mode], mode, 'mode de voyage'),
      geste: { verbe: 'partirEnVoyage', args: [route.id, mode] },
      refus: refusDeDepart(s, route.id, mode),
      jours: devisDeTrajet(s, route, ici.id, mode).plan?.days ?? null,
    })),
  }));
}

/** Le plan de la carte `map` vu du lieu `ici`, chacun de ses `trajets` (`trajetsDepuis`) sous sa destination. PUR. */
export function planDepuis(s: Jeu, map: WorldMap, ici: MapPlace, trajets: TrajetEnVue[]): PlanDeLaCarte {
  const ctx = condCtx(() => s);
  const lieux = visiblePlaces(map, ctx);
  const positions = positionsDeRendu(map, lieux);
  const existe = new Set(lieux.map((p) => p.id));
  const ouvertes = new Set(routesCliquables(map, ici.id, ctx).filter((e) => e.ouverte).map((e) => e.route.id));
  return {
    lieux: lieux.map((p) => {
      const pos = garanti(positions.get(p.id), p.id, 'position du lieu');
      return { id: p.id, nom: p.label, x: pos.x / CADRE.w, y: pos.y / CADRE.h, ici: p.id === ici.id, trajets: trajets.filter((tr) => tr.destination === p.id) };
    }),
    routes: map.routes.filter((r) => existe.has(r.a.id) && existe.has(r.b.id)).map((r) => ({ route: r.id, de: r.a.id, vers: r.b.id, depuisIci: ouvertes.has(r.id) })),
  };
}

/** La carte du monde qui tient la main (`fenetreDuJeu`) ; `null` : elle ne tient pas la main, ou le groupe n'est à
 *  aucun de ses lieux. PUR. */
export function carteEnVue(s: Jeu): CarteEnVue | null {
  const ici = fenetreDuJeu(s)?.cle === 'carteDuMonde' ? lieuDuGroupe(s) : undefined;
  if (!s.worldMap || !ici) return null;
  return { plan: planDepuis(s, s.worldMap, ici, trajetsDepuis(s, s.worldMap, ici)), reprendre: s.travelPlan?.interrupted ? { verbe: 'reprendreLeVoyage', args: [] } : null };
}
