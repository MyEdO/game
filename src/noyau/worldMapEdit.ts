/**
 * ÉCRIVAINS de la carte du monde (WorldMap → WorldMap) — ceux de l'éditeur, dont la carte vit hors du
 * store. Les lectures de jeu (routes offertes, lieux visibles, services) vivent dans `./worldMap`.
 * Chaque écrivain rend une NOUVELLE carte ; un refus rend la carte reçue, inchangée. L'id d'un lieu ou
 * d'une route neuve vient de l'hôte (#2817).
 */
import { semencesDeScene } from '../data';
import type { TravelMode } from '../engine/travel';
import type { LandMarketProfile } from '../engine/landCargo';
import type { MapPlace, MapRoute, MapRouteTrace, PlacePoi, Praticabilite, RoutePeril, WorldMap } from './worldMap';

type Pos = MapPlace['pos'];

/** Bornes d'une position de lieu, en % du canvas de la carte. */
export const BORNES_DE_CARTE = { x: { min: 2, max: 98 }, y: { min: 4, max: 96 } } as const;

/** Route d'une liaison neuve. */
const ROUTE_PAR_DEFAUT: Pick<MapRouteTrace, 'km' | 'modes'> = { km: 10, modes: ['pied'] };

/** Péripétie d'auteur neuve d'une route. */
export const peripetieNeuve = (): RoutePeril => ({ label: 'Péripétie', chancePct: 10, effects: [] });

/** Port maritime neuf d'un lieu : petit port de production côtière. */
export const portNeuf = (): NonNullable<MapPlace['port']> => ({ taille: 2, richesse: 2, production: [] });

/** Marché terrestre neuf d'un lieu. */
export const marcheNeuf = (): LandMarketProfile => ({ taille: 2, richesse: 2, produits: [] });

/** Écart sous lequel deux lieux se chevauchent, et pas du décalage d'un ajout au même point. */
const CHEVAUCHEMENT = 4;
const DECALAGE = 8;

const borne = (v: number, b: { min: number; max: number }) => Math.round(Math.max(b.min, Math.min(b.max, v)));

/** Position plafonnée aux bornes de la carte, arrondie au point entier. */
function dansLesBornes(pos: Pos): Pos {
  return { x: borne(pos.x, BORNES_DE_CARTE.x), y: borne(pos.y, BORNES_DE_CARTE.y) };
}

export type PatchDeCarte = Partial<Pick<WorldMap, 'label' | 'background' | 'params'>>;
export type PatchDeLieu = Partial<Omit<MapPlace, 'id'>>;
export type PatchDeRoute = Partial<Omit<MapRouteTrace, 'id' | 'a' | 'b'>> | Praticabilite;

export function majCarte(map: WorldMap, patch: PatchDeCarte): WorldMap {
  return { ...map, ...patch };
}

/** Patch d'un lieu ; une position posée est plafonnée aux bornes de la carte. */
export function majLieu(map: WorldMap, id: string, patch: PatchDeLieu): WorldMap {
  const p = patch.pos ? { ...patch, pos: dansLesBornes(patch.pos) } : patch;
  return { ...map, places: map.places.map((x) => (x.id === id ? { ...x, ...p } : x)) };
}

/** Patch d'une route ; des modes vidés retombent sur ceux d'une liaison neuve. Refusé s'il retire un mode
 *  qui porte un billet : la route n'offrirait plus le véhicule de son billet (`fautesDuBillet`,
 *  `data/schemas/defs-scenes/worldmap.ts`). */
export function majRoute(map: WorldMap, id: string, patch: PatchDeRoute): WorldMap {
  const p = 'modes' in patch && patch.modes?.length === 0 ? { ...patch, modes: [...ROUTE_PAR_DEFAUT.modes] } : patch;
  const route = map.routes.find((r) => r.id === id);
  const modes = 'modes' in p ? p.modes : undefined;
  if (route && modes && Object.keys(route.billets ?? {}).some((mode) => !modes.includes(mode as TravelMode))) return map;
  return { ...map, routes: map.routes.map((r) => (r.id === id ? ({ ...r, ...p } as MapRoute) : r)) };
}

/** Bornes d'une position de point d'intérêt (`PlacePoi.pos`), en % du plan de son lieu. */
export const BORNES_DU_PLAN_DE_LIEU = { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } } as const;

/** Les points d'intérêt du lieu `lieu` de la carte `map` devenus `f(poi)`, une liste vidée retirée ; refusé pour un lieu
 *  inconnu. */
function surLesPoints(map: WorldMap, lieu: string, f: (poi: readonly PlacePoi[]) => PlacePoi[]): WorldMap {
  const place = map.places.find((p) => p.id === lieu);
  if (!place) return map;
  const poi = f(place.poi ?? []);
  return majLieu(map, lieu, { poi: poi.length ? poi : undefined });
}

/** Pose le point d'intérêt `poi` au plan du lieu `lieu`, sa position plafonnée aux bornes du plan
 *  (`BORNES_DU_PLAN_DE_LIEU`). Refusé pour un id qu'un point de la carte porte déjà. */
export function ajouterPoi(map: WorldMap, lieu: string, poi: PlacePoi): WorldMap {
  if (map.places.some((p) => p.poi?.some((x) => x.id === poi.id))) return map;
  return surLesPoints(map, lieu, (liste) => [...liste, { ...poi, pos: { x: borne(poi.pos.x, BORNES_DU_PLAN_DE_LIEU.x), y: borne(poi.pos.y, BORNES_DU_PLAN_DE_LIEU.y) } }]);
}

/** Pose le point d'intérêt `id` du lieu `lieu` à `pos`, plafonnée aux bornes du plan (`BORNES_DU_PLAN_DE_LIEU`). */
export function deplacerPoi(map: WorldMap, lieu: string, id: string, pos: Pos): WorldMap {
  const ici = { x: borne(pos.x, BORNES_DU_PLAN_DE_LIEU.x), y: borne(pos.y, BORNES_DU_PLAN_DE_LIEU.y) };
  return surLesPoints(map, lieu, (liste) => liste.map((x) => (x.id === id ? { ...x, pos: ici } : x)));
}

/** Retire le point d'intérêt `id` du lieu `lieu`. */
export function retirerPoi(map: WorldMap, lieu: string, id: string): WorldMap {
  return surLesPoints(map, lieu, (liste) => liste.filter((x) => x.id !== id));
}

/** Coche ou décoche `mode` sur la route `id`. */
export function basculerMode(map: WorldMap, id: string, mode: TravelMode): WorldMap {
  const r = map.routes.find((x) => x.id === id);
  if (!r) return map;
  return majRoute(map, id, { modes: r.modes.includes(mode) ? r.modes.filter((x) => x !== mode) : [...r.modes, mode] });
}

/** Pose le lieu `id` à `pos`, décalé vers la droite tant qu'il chevauche un lieu, jusqu'à la borne de la
 *  carte ; il reçoit le libellé de la semence et la première scène du projet. Refusé pour un id déjà porté. */
export function ajouterLieu(map: WorldMap, id: string, pos: Pos, scenes: readonly { id: string }[]): WorldMap {
  if (map.places.some((p) => p.id === id)) return map;
  let ici = dansLesBornes(pos);
  const chevauche = (q: Pos) => map.places.some((p) => Math.abs(p.pos.x - q.x) < CHEVAUCHEMENT && Math.abs(p.pos.y - q.y) < CHEVAUCHEMENT);
  while (chevauche(ici) && ici.x < BORNES_DE_CARTE.x.max) ici = dansLesBornes({ x: ici.x + DECALAGE, y: ici.y });
  const lieu: MapPlace = { id, label: semencesDeScene.lieu, pos: ici, scene: { id: scenes[0]?.id ?? '' } };
  return { ...map, places: [...map.places, lieu] };
}

/** Sens d'initiation que les routes de la paire a↔b offrent déjà (`MapRouteTrace.from`), hors de la route `sauf`. */
function sensOfferts(map: WorldMap, a: string, b: string, sauf?: string): Set<string> {
  const sens = new Set<string>();
  for (const r of map.routes) {
    if (r.id === sauf || !((r.a.id === a && r.b.id === b) || (r.a.id === b && r.b.id === a))) continue;
    if (r.from == null) { sens.add(a); sens.add(b); } else sens.add(r.from.id);
  }
  return sens;
}

/** Relie `a` à `b` par la route `id`. Une paire déjà reliée dans un seul sens reçoit la route de l'autre
 *  sens ; refusé pour un lieu inconnu, une boucle, un id déjà porté ou une paire reliée dans les deux sens. */
export function lierLieux(map: WorldMap, id: string, a: string, b: string): WorldMap {
  const connu = (x: string) => map.places.some((p) => p.id === x);
  if (a === b || !connu(a) || !connu(b) || map.routes.some((r) => r.id === id)) return map;
  const sens = sensOfferts(map, a, b);
  if (sens.has(a) && sens.has(b)) return map;
  const from = sens.size === 0 ? undefined : sens.has(a) ? b : a;
  const route: MapRoute = { id, a: { id: a }, b: { id: b }, ...(from ? { from: { id: from } } : {}), ...ROUTE_PAR_DEFAUT, modes: [...ROUTE_PAR_DEFAUT.modes] };
  return { ...map, routes: [...map.routes, route] };
}

/** Oriente la route `id` depuis son extrémité `depuis`, ou dans les deux sens (`null`). Refusé pour une route
 *  inconnue, déjà dans ce sens, un lieu qui n'en est pas une extrémité, ou un sens qu'une autre route de la paire offre déjà
 *  (`sensOfferts`, comme `lierLieux`). */
export function orienterRoute(map: WorldMap, id: string, depuis: string | null): WorldMap {
  const route = map.routes.find((r) => r.id === id);
  if (!route || (route.from?.id ?? null) === depuis || (depuis !== null && depuis !== route.a.id && depuis !== route.b.id)) return map;
  const autres = sensOfferts(map, route.a.id, route.b.id, id);
  if ((depuis === null ? [route.a.id, route.b.id] : [depuis]).some((x) => autres.has(x))) return map;
  const { from: _from, ...sans } = route;
  return { ...map, routes: map.routes.map((r) => (r.id === id ? (depuis === null ? sans : { ...sans, from: { id: depuis } }) : r)) };
}

/** Retire les routes `ids` ; la `suite` d'un billet s'arrête avant la première route retirée. */
function sansRoutes(map: WorldMap, ids: ReadonlySet<string>): WorldMap {
  const routes = map.routes.filter((r) => !ids.has(r.id)).map((r) => {
    if (!r.billets) return r;
    const billets = Object.fromEntries(Object.entries(r.billets).map(([mode, billet]) => {
      const coupe = billet?.suite?.findIndex((x) => ids.has(x)) ?? -1;
      if (!billet || coupe < 0) return [mode, billet];
      const { suite, ...reste } = billet;
      return [mode, coupe === 0 ? reste : { ...reste, suite: suite!.slice(0, coupe) }];
    }));
    return { ...r, billets };
  });
  return { ...map, routes };
}

export function supprimerRoute(map: WorldMap, id: string): WorldMap {
  return sansRoutes(map, new Set([id]));
}

/** Retire le lieu `id` et, en cascade, ses routes. */
export function supprimerLieu(map: WorldMap, id: string): WorldMap {
  const routes = new Set(map.routes.filter((r) => r.a.id === id || r.b.id === id).map((r) => r.id));
  return { ...sansRoutes(map, routes), places: map.places.filter((p) => p.id !== id) };
}
