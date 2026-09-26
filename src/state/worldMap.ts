/**
 * Carte du monde (#T2 Voyage) — graphe de LIEUX et de ROUTES au niveau PROJET, même philosophie
 * que le schéma de Scène : tout est de la DONNÉE, créée/éditée dans l'éditeur (onglet « Monde »),
 * rien n'est codé en dur. Le voyage RAW (vitesses, 6 h/jour, coûts, péripéties) est résolu par
 * `engine/travel.ts` + `state/travelFlow.ts` ; ce module ne porte que le schéma et ses helpers purs.
 *
 * Tous les réglages RAW sont PARAMÉTRABLES par l'auteur : km, modes autorisés, prix par mode
 * (sous/km — défauts RAW LDB 51 l.178-189), Déplacement du véhicule (modèles rapides/lents, M ±1, LDB 51 l.178),
 * seuil du d10 de péripétie (défaut 8, LDB 51 l.208 ; 0 = désactivé), péripéties d'auteur (probabilité
 * par jour + Effects), cible d'embuscade du « Attaqués ! », heures de voyage/jour et plafond de
 * marche forcée au niveau carte.
 */
import type { Effect, Fige, ReliefDefaults, Scene, SceneRoofDefaults } from './scene';
import { garanti } from './combatants';
import { normalizeScene } from './scene';
import type { TravelMode } from '../engine/travel';
import type { PortProfile } from '../engine/seaVoyage';
import type { LandMarketProfile } from '../engine/landCargo';
import type { RestPlaces } from './restFlow';
import { evalCondition, type Condition, type ConditionCtx } from '../engine/flowCore';
import { findNavalPortById, findLieuServiceById, coreAxisIds, creatureSemee, vehiculeSeme, navireSeme } from '../data';

/** Lieu posé sur la carte. Être dans `scene` = être à ce lieu ; y arriver → transition vers elle. */
export interface MapPlace {
  id: string;
  label: string;
  /** Position sur la carte en % du canvas (0-100). */
  pos: { x: number; y: number };
  /** Scène liée (id du registre de scènes du projet). */
  scene: string;
  /** Point d'arrivée nommé dans la scène (sinon heroStart). */
  entry?: string;
  /** Icône du médaillon (id du registre src/ui/icons), défaut `nav/entry-point`. */
  icon?: string;
  /** Profil COMMERCIAL de port (Index des ports, MDG 15 l.439-506) — présent = ce lieu est un port
   *  maritime (commerce, événements d'escale, chantier). `lighthouse` : un phare veille sur l'approche
   *  (Test de Perception d'équipage à l'atterrage, MDG 13 l.333-351). `ref` (#217) : id de
   *  `naval-ports.json` — les champs `PortProfile` ci-dessous sont alors des SURCHARGES locales
   *  par-dessus le catalogue (sparse en authoring JSON, résolues/complétées au chargement du projet
   *  par `resolvePortRef`, `parseProject`) ; le type reste NON-partiel car tout consommateur aval lit
   *  `place.port` APRÈS résolution (jamais la forme sparse brute). */
  port?: { ref?: string } & import('../engine/seaVoyage').PortProfile & { lighthouse?: boolean };
  /** Indices de COMMERCE TERRESTRE/FLUVIAL (Index géographique, MSRC 13 l.183-278) — présent = ce Lieu
   *  offre des opportunités de commerce de cargaison (achat/vente/rumeurs). Taille + Richesse + colonne
   *  Produits, éditables par l'auteur (aucun index codé en dur). */
  market?: import('../engine/landCargo').LandMarketProfile;
  /** SERVICES EXTENSIBLES du lieu au-delà du port et du marché (#343) — auberge/temple/forgeron/guilde…,
   *  `kind` = id du catalogue `lieux-services.json`. Port et marché NE sont PAS dupliqués ici : ils
   *  gardent leur propre champ riche (`port`/`market`) et `placeServices` les compose avec ceux-ci en
   *  une liste unique. Une auberge peut porter son offre de couchage PROPRE (`rest`) ou, à défaut,
   *  dériver de l'offre de repos de la scène liée. */
  services?: PlaceService[];
  /** POI (#345 phase 5, option A) : marqueurs cliquables du PLAN de ce lieu (onglet Plan du hub,
   *  `MapCanvas` en second consommateur — AUCUNE forme nouvelle, juste des marqueurs). Position en
   *  coordonnées PLAN-LOCALES 0-100 (indépendantes de `pos`, qui reste la position du lieu sur la
   *  carte du MONDE). Absent/vide ⇒ le lieu n'offre pas d'onglet Plan. */
  poi?: PlacePoi[];
  /** Bande d'ambiance du hub de ce lieu (id du registre `src/ui/backdrops`) — surcharge le défaut
   *  éventuel porté par le service (`lieux-services.json`, ex. auberge). Éditable dans `WorldMapEditor`. */
  backdrop?: string;
  /** Le lieu EXISTE-t-il sur la carte (algèbre `Condition`, cf. `evalCondition`) — axe NŒUD du gating
   *  narratif : une destination n'apparaît qu'une fois RÉVÉLÉE par le récit (`setFlag`). Absente =
   *  toujours visible. Lue par `visiblePlaces` (le rendu et le cadrage consomment la liste FILTRÉE). */
  when?: Condition;
}

/** Un POI de PLAN (#345 phase 5) : cible EXCLUSIVE `sceneId` (transition vers une scène du projet,
 *  `transitionTo`) OU `serviceKind` (`id` d'un service RÉSOLU du lieu — `placeServices`, dont le
 *  port/marché AUTOMATIQUES `'port'`/`'marche'` — le MÊME panneau de service que l'onglet Services),
 *  jamais les deux. `id` STABLE (référencé par l'éditeur et les tests, `validateScene`) ; `label` est
 *  le SEUL champ d'affichage (doctrine ids internes, CLAUDE.md). */
export interface PlacePoi {
  id: string;
  label: string;
  pos: { x: number; y: number };
  /** Icône du médaillon (id du registre `src/ui/icons`), défaut `nav/entry-point`. */
  icon?: string;
  sceneId?: string;
  serviceKind?: string;
}

/** Un service EXTENSIBLE attaché à un lieu (catalogue `lieux-services.json`) — hors port/marché, qui
 *  portent leur propre schéma riche. `kind` = id du catalogue ; `label` = surcharge d'affichage
 *  facultative d'auteur ; `rest` = offre de couchage/repas PROPRE à ce lieu-hébergement (auberge
 *  autonome), à défaut de quoi l'auberge dérive de l'offre de repos de la scène (`placeServices`). */
export interface PlaceService {
  kind: string;
  label?: string;
  rest?: RestPlaces;
}

/** Péripétie d'AUTEUR sur une route : tirée chaque jour de voyage à `chancePct` %. */
export interface RoutePeril {
  label: string;
  chancePct: number;
  effects: Effect[];
}

/** Route entre deux lieux (`a` ↔ `b`, bidirectionnelle par défaut). */
export interface MapRoute {
  id: string;
  a: string;
  b: string;
  /** Route À SENS UNIQUE d'INITIATION : présent = elle ne s'emprunte QUE depuis ce lieu (`a` ou `b`) — le
   *  trajet retour se fait par une AUTRE route. Absent = bidirectionnelle (historique). Sert à rendre
   *  DISCERNABLES deux routes reliant les mêmes ports (aller/retour, chacune avec son embuscade) : depuis
   *  un port, seule la route de ce sens est offerte au clic (`routesFrom`), l'embuscade est donc déterministe. */
  from?: string;
  /** Distance en kilomètres (LDB 51 l.178 : les coûts sont « par kilomètre parcouru »). */
  km: number;
  /** Modes de voyage offerts sur cette route. */
  modes: TravelMode[];
  /** Prix d'auteur (sous/PA par km par passager) pour un transport payant (`id` de `vehicles.json`)
   *  — défaut : classe RAW. */
  prices?: Partial<Record<Exclude<TravelMode, 'pied'>, number>>;
  /** Déplacement d'auteur par mode (modèle rapide/lent : M ±1, LDB 51 l.178). À pied : force la vitesse. */
  speed?: Partial<Record<TravelMode, number>>;
  /** Seuil du d10 quotidien de péripétie RAW (LDB 51 l.208 « sur un résultat de 8 ») ; 0 = désactivé.
   *  Absent = défaut de la carte (sinon TRAVEL_DEFAULTS.perilDie). */
  perilDie?: number;
  /** Péripéties d'auteur (en PLUS de la table d10 RAW). */
  perils?: RoutePeril[];
  /** Cible du « Attaqués ! » (péripétie 10) : scène d'embuscade + rencontre. Absent = narratif.
   *  `at` (fraction 0-1, défaut 0.5) : en MER, ancrage DÉTERMINISTE de l'embuscade authorée — elle se
   *  déclenche quand `kmDone` franchit `at × km`, une fois par traversée, indépendamment du RNG (#212). */
  ambush?: { scene: string; entry?: string; encounter: string; at?: number };
  /** Relais d'auberges en bord de route (section Voyage : « Les auberges en bord de route sont
   *  souvent placées à la convenance des relais de diligences ») : la halte de NUIT propose
   *  l'auberge (chambres/repas payants, modale de Repos) en plus du campement. Absent = belle
   *  étoile seulement. */
  inns?: boolean;
  /** Route MARITIME (MDG 13-15) : se voyage sur le NAVIRE DE CAMPAGNE (`state.vessel`) ; `km` est
   *  alors en MILLES (les tables RAW — 18 milles/jour par M, distances ch.15 l.40-47 — sont en milles). */
  sea?: boolean;
  /** Cap DOMINANT du trajet (aspect du vent, MDG 13 l.262-270) — défaut 'ouest'. */
  seaHeading?: import('../engine/seaWeather').WindDirection;
  /** Route FLUVIALE JOUÉE (MSRC 7 « Navigation fluviale ») : en mode `barge`, la descente se joue jour par
   *  jour (Test de Navigation, table des vents, périls, chavirage) au lieu d'un transport payant. Repli
   *  payant si aucun batelier/embarcation. Absent = barge en transport payant (comportement historique). */
  river?: boolean;
  /** Périls de rivière tirés chaque jour sur une route fluviale JOUÉE (MSRC 7 l.119-166, `river-perils.json`) :
   *  `perilId` (débris/rochers/eaux-peu-profondes/barrage) tiré à `chancePct` %. Data-driven, éditable. */
  riverPerils?: { perilId: string; chancePct: number }[];
  /** Exposition HYDRIQUE de la descente (MSRC 16 « Maladies transmises par l'eau », l.5-13) : à chaque
   *  étape à flot, un tirage à `chancePct` % déclenche l'Effet EXISTANT `waterExposure` (Test de Résistance
   *  modifié → maladie contractée). `source` = id du tableau 1 « Source d'eau » (choix d'auteur de la
   *  portion de fleuve : `grande-ville-marais`, `aval-grande-ville-8km`…), `mode` = `ingestion` (boire l'eau
   *  du fleuve non bouillie, l.5) / `immersion` (chute\nage, blessures ouvertes, l.7-9). Data-driven, éditable. */
  riverExposure?: { source?: string; mode: import('../data').WaterExposureMode; chancePct: number };
  /** Le trajet est-il PRATICABLE (algèbre `Condition`, cf. `evalCondition`) — axe ARÊTE du gating
   *  narratif, indépendant de `MapPlace.when` : un tronçon se ferme sans que le lieu déjà visité
   *  cesse d'exister sur la carte. Absente = toujours praticable. Lue par `routesFrom`. */
  when?: Condition;
  /** Raison JOUEUR de l'indisponibilité du trajet, portée par `GatedAction` (infobulle `refus` —
   *  arbitrage 2026-08-24, jamais inline par défaut). Sans objet en l'absence de `when`. */
  refus?: string;
}

export interface WorldMapParams {
  /** Heures de voyage par jour sans Test (RAW LDB 51 l.195, défaut 6). */
  hoursPerDay?: number;
  /** Plafond de marche forcée (heures/jour) — LDB 51 l.195 : silence, valeur maison (défaut 10). */
  forcedMaxHours?: number;
  /** Seuil d10 de péripétie par défaut des routes (défaut 8, LDB 51 l.208 ; 0 = désactivé). */
  perilDie?: number;
}

export interface WorldMap {
  id: string;
  label: string;
  params?: WorldMapParams;
  /** Image de fond (URL, chemin d'asset public, ou data URI) : une VRAIE carte derrière les lieux.
   *  Présente ⇒ les lieux sont rendus à leurs `pos` EXACTS (pas de déchevauchement — la carte a sa
   *  propre échelle et des points dispersés). Absente ⇒ fond au parchemin + déchevauchement (schématique).
   *  `km` reste authoré par route (la position sur la carte est purement visuelle). */
  background?: string;
  places: MapPlace[];
  routes: MapRoute[];
}

export function emptyWorldMap(): WorldMap {
  return { id: `carte-${Date.now()}`, label: 'Carte du monde', places: [], routes: [] };
}

/**
 * Résout un `MapPlace.port` par RÉFÉRENCE (#217) : `ref` absent → inchangé. `ref` présent → les champs
 * du catalogue `naval-ports.json` servent de DÉFAUTS, tout champ déjà présent sur `port` (surcharge
 * locale d'auteur, authoring SPARSE toléré en entrée — `Partial<PortProfile>`) l'emporte. `ref` inconnu
 * → erreur EXPLICITE (fail-fast, jamais un port silencieusement vide). Appelée par `parseProject`
 * (chargement de projet, entrée déjà résolue/concrète ou sparse à plat) et par l'éditeur au moment où
 * l'auteur choisit une réf au picker (`WorldMapEditor` — entrée sparse `{ ref, lighthouse }` : choisir
 * une réf REMPLACE le profil par celui du catalogue, seul `lighthouse` — hors catalogue — est préservé).
 */
export function resolvePortRef(
  port: ({ ref?: string } & Partial<PortProfile> & { lighthouse?: boolean }) | undefined,
): MapPlace['port'] {
  if (!port?.ref) return port as MapPlace['port'];
  const def = findNavalPortById(port.ref);
  if (!def) {
    throw new Error(`Lieu-port : réf de port inconnue "${port.ref}" (absente de naval-ports.json).`);
  }
  return {
    ref: port.ref,
    taille: port.taille ?? def.taille,
    richesse: port.richesse ?? def.richesse,
    production: port.production ?? def.production ?? [],
    surplus: port.surplus ?? def.surplus,
    demande: port.demande ?? def.demande,
    cosmopolite: port.cosmopolite ?? def.cosmopolite,
    lighthouse: port.lighthouse,
  };
}

/** Lieu correspondant à une scène (être dans la scène = être à ce lieu). */
export function placeOfScene(map: WorldMap | null | undefined, sceneId: string | undefined): MapPlace | undefined {
  if (!map || !sceneId) return undefined;
  return map.places.find((p) => p.scene === sceneId);
}

export function placeById(map: WorldMap, id: string): MapPlace | undefined {
  return map.places.find((p) => p.id === id);
}

/** Le groupe est-il À UN LIEU de la carte (hub de ville ouvrable, #343) : en exploration, hors voyage
 *  en cours, sur une scène qui EST un lieu. Retourne ce lieu (sinon `undefined` — route, camp sauvage,
 *  combat…). SOURCE UNIQUE de la porte du hub, partagée par `CampaignView` et son test. */
export function atLocationPlace(args: {
  mode: string;
  travelPlan: unknown;
  worldMap: WorldMap | null | undefined;
  sceneId: string | undefined;
}): MapPlace | undefined {
  if (args.mode !== 'exploration' || args.travelPlan || !args.worldMap) return undefined;
  return placeOfScene(args.worldMap, args.sceneId);
}

/** Catégorie d'un service résolu — routage du hub de lieu (#343). `port`/`marche`/`auberge` ont un
 *  panneau dédié ; `autre` = service de catalogue générique (temple/forgeron/guilde…). */
export type PlaceServiceCategory = 'port' | 'marche' | 'auberge' | 'autre';

/** Un service RÉSOLU d'un lieu (sortie de `placeServices`) — vocabulaire UNIQUE consommé par le hub de
 *  lieu (#343) et l'auberge. Les payloads métier sont RÉFÉRENCÉS, jamais copiés : `port`/`market`
 *  pointent la donnée existante du nœud, `rest` pointe l'offre propre au service ou celle de la scène. */
export interface ResolvedPlaceService {
  /** id de routage : `'port'` | `'marche'` | `kind` du catalogue (dont `'auberge'`). */
  id: string;
  category: PlaceServiceCategory;
  label: string;
  icon?: string;
  desc?: string;
  port?: NonNullable<MapPlace['port']>;
  market?: LandMarketProfile;
  /** Offre de couchage/repas effective d'une auberge (propre au service, sinon dérivée de la scène). */
  rest?: RestPlaces;
  /** Réplique de boniment (catalogue `lieux-services.json`) du bandeau d'interlocuteur statique. */
  hostLine?: string;
  /** Bande d'ambiance par défaut (catalogue `lieux-services.json`, id du registre `src/ui/backdrops`). */
  backdrop?: string;
  /** Archétype marchand (catalogue `lieux-services.json`, ex. `armurier` pour le forgeron) — porte vers
   *  le système marchand EXISTANT (`openPlaceMerchant`, #369), aucun système neuf. */
  merchantArchetype?: string;
  /** Écran plein-champ EXISTANT vers lequel le service porte (catalogue `lieux-services.json`) :
   *  `port` = l'écran de port (onglet Chantier par défaut), sous garde de navire de campagne. */
  opensScreen?: 'port';
  /** Libellé du bouton d'entrée du service qui porte un `opensScreen` (catalogue). */
  enterLabel?: string;
}

/** Icône (id du registre `src/ui/icons`) d'un service résolu : le catalogue (`lieux-services.json`) fournit
 *  la sienne via `placeServices`, sinon un défaut générique. PUR (id → id), source unique partagée par le
 *  hub, le plan et l'aperçu d'éditeur. */
export function serviceIcon(s: ResolvedPlaceService): string {
  return s.icon ?? 'nav/entry-point';
}

/** Résolution GÉNÉRALE de l'icône d'un marqueur de plan (#371) : l'`icon` authoré du POI PRIME (surcharge
 *  d'auteur) ; sinon l'icône se DÉRIVE de la cible — `serviceKind` → icône du service résolu (`serviceIcon`),
 *  `sceneId` → porte. Défaut ultime `nav/entry-point`. Aucun backfill de donnée : la résolution couvre tout
 *  lieu présent et futur. PUR, source unique des marqueurs du hub, du panneau de détail et de l'éditeur. */
export function poiIcon(poi: PlacePoi, services: ResolvedPlaceService[]): string {
  if (poi.icon) return poi.icon;
  if (poi.serviceKind) {
    const svc = services.find((s) => s.id === poi.serviceKind);
    if (svc) return serviceIcon(svc);
  }
  if (poi.sceneId) return 'map-tool/door';
  return 'nav/entry-point';
}

/** id STABLE du marchand VIRTUEL d'un service de lieu (#369) : le service de catalogue (forgeron…) n'a
 *  aucune `SceneEntity` de scène — l'écran marchand s'ouvre quand même, keyé sur cet id pour son propre
 *  stock persistant (`merchantStocks`). PUR/testable, source unique du format. */
export function placeServiceMerchantId(placeId: string, serviceId: string): string {
  return `lieu:${placeId}:${serviceId}`;
}

/** Offre de couchage en AUBERGE portée par une scène (`rest.auberge`, ou une `restZone` qui l'offre) —
 *  la scène reste la SOURCE de vérité, référencée jamais copiée sur le nœud. */
function sceneAubergeOffer(scene?: Scene): RestPlaces | undefined {
  if (!scene) return undefined;
  if (scene.rest?.auberge) return { auberge: true, maison: scene.rest.maison, camp: scene.rest.camp };
  const zone = (scene.restZones ?? []).find((z) => z.places.auberge);
  return zone ? { auberge: true, maison: zone.places.maison, camp: zone.places.camp } : undefined;
}

/** Les services de lieu que le CODE cite par id (`placeServices`) — leur présence au catalogue
 *  `lieux-services.json` est prouvée par `data/refs-migrated.test.ts`. */
export const SERVICE_CITE = { port: 'port', marche: 'marche', auberge: 'auberge' } as const;

/**
 * API UNIQUE des SERVICES d'un lieu (#343) : compose en UNE liste le port (`place.port`), le marché
 * (`place.market`) et les services extensibles du catalogue (`place.services`, `lieux-services.json`),
 * plus l'auberge — déclarée en service propre OU dérivée de l'offre de repos de la scène liée. Zéro
 * duplication de vérité : chaque payload RÉFÉRENCE sa donnée d'origine (port/marché/offre de repos),
 * il n'en est jamais recopié une seconde source. Consommée par le hub de lieu et l'auberge (phase 2) ;
 * les consommateurs actuels (PortView/LandMarketView/restPlacesHere) restent inchangés en phase 1.
 */
export function placeServices(place: MapPlace, scene?: Scene): ResolvedPlaceService[] {
  const out: ResolvedPlaceService[] = [];
  if (place.port) {
    const def = garanti(findLieuServiceById(SERVICE_CITE.port), SERVICE_CITE.port, 'service de lieu');
    out.push({ id: 'port', category: 'port', label: def.label, icon: def.icon, desc: def.desc, port: place.port, hostLine: def.hostLine, backdrop: def.backdrop });
  }
  if (place.market) {
    const def = garanti(findLieuServiceById(SERVICE_CITE.marche), SERVICE_CITE.marche, 'service de lieu');
    out.push({ id: 'marche', category: 'marche', label: def.label, icon: def.icon, desc: def.desc, market: place.market, hostLine: def.hostLine, backdrop: def.backdrop });
  }
  const declared = new Set<string>();
  for (const s of place.services ?? []) {
    const def = findLieuServiceById(s.kind);
    const auberge = s.kind === 'auberge';
    out.push({
      id: s.kind,
      category: auberge ? 'auberge' : 'autre',
      label: s.label ?? def?.label ?? s.kind,
      icon: def?.icon,
      desc: def?.desc,
      rest: auberge ? (s.rest ?? sceneAubergeOffer(scene)) : undefined,
      hostLine: def?.hostLine,
      backdrop: def?.backdrop,
      merchantArchetype: def?.merchantArchetype,
      opensScreen: def?.opensScreen,
      enterLabel: def?.enterLabel,
    });
    declared.add(s.kind);
  }
  // Auberge DÉRIVÉE de la scène si le lieu ne la déclare pas en service propre mais que la scène offre
  // le couchage en auberge — source unique = la scène.
  if (!declared.has('auberge')) {
    const rest = sceneAubergeOffer(scene);
    if (rest) {
      const def = garanti(findLieuServiceById(SERVICE_CITE.auberge), SERVICE_CITE.auberge, 'service de lieu');
      out.push({ id: 'auberge', category: 'auberge', label: def.label, icon: def.icon, desc: def.desc, rest, hostLine: def.hostLine, backdrop: def.backdrop });
    }
  }
  return out;
}

/** Routes EMPRUNTABLES depuis un lieu : reliées à `placeId`, — si à sens unique (`from`) — initiables
 *  depuis lui, et PRATICABLES (`MapRoute.when`). Une route `from` reliant les deux mêmes ports que sa
 *  jumelle n'est offerte QUE dans son sens. `ctx` (fabriqué chez l'appelant — `condCtx`, `bourseFlow.ts`)
 *  absent : aucune évaluation, toutes les routes reliées sont rendues.
 *
 *  Lecteur du VOYAGE : le moteur ne propose jamais un trajet fermé, et n'en démarre jamais un —
 *  `startTravel` (`travelFlow.ts`) réévalue `when` au départ, au même niveau que le sens unique `from`.
 *  La VUE lit `routesEtat`, qui rend aussi les trajets fermés — le joueur doit VOIR qu'il ne peut plus
 *  y aller (et pourquoi). */
export function routesFrom(map: WorldMap, placeId: string, ctx?: ConditionCtx): MapRoute[] {
  return map.routes.filter(
    (r) =>
      (r.a === placeId || r.b === placeId) &&
      (r.from == null || r.from === placeId) &&
      (r.when == null || ctx == null || evalCondition(r.when, ctx)),
  );
}

/** ÉTAT des routes d'un lieu pour la VUE : les MÊMES routes reliées/initiables que `routesFrom`, mais
 *  TOUTES rendues, chacune avec son verdict de praticabilité (`ouverte`). Un trajet fermé reste à
 *  l'écran en affordance refusée (`MapRoute.refus`, `GatedAction`) ; c'est le seul lecteur qui expose
 *  les routes fermées — le VOYAGE consomme `routesFrom`. `ctx` absent : tout est ouvert. */
export function routesEtat(
  map: WorldMap,
  placeId: string,
  ctx?: ConditionCtx,
): { route: MapRoute; ouverte: boolean }[] {
  return map.routes
    .filter((r) => (r.a === placeId || r.b === placeId) && (r.from == null || r.from === placeId))
    .map((r) => ({ route: r, ouverte: r.when == null || ctx == null || evalCondition(r.when, ctx) }));
}

/** Lieux EXISTANTS de la carte (`MapPlace.when`) — frère NŒUD de `routesFrom` : source unique de la
 *  liste de lieux offerte au joueur (rendu, cadrage, déchevauchement). `ctx` absent : aucune
 *  évaluation, tous les lieux sont rendus. */
export function visiblePlaces(map: WorldMap, ctx?: ConditionCtx): MapPlace[] {
  return map.places.filter((p) => p.when == null || ctx == null || evalCondition(p.when, ctx));
}

/** L'autre extrémité d'une route. */
export function otherEnd(route: MapRoute, placeId: string): string {
  return route.a === placeId ? route.b : route.a;
}

// ── Anti-chevauchement des médaillons (rendu seulement — n'affecte JAMAIS `pos`) ─────────────
/** Point de rendu d'un lieu : id + position en unités du viewBox de la carte (x 0..100, y 0..64). */
export interface RenderPoint { id: string; x: number; y: number }

/** Hash déterministe d'un id → angle de séparation stable (aucun Math.random : la carte ne « bouge »
 *  pas d'un rendu à l'autre, même contrainte que `routeCurve` côté vue). */
function hashAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 360) * (Math.PI / 180);
}

/**
 * Écarte les médaillons trop proches, de façon PURE et DÉTERMINISTE, pour rendre lisibles les
 * grandes cartes où 27+ lieux se chevauchent au centre (ex. le Reik). Répulsion itérative des
 * PAIRES dont la distance est < `minDist` : chaque paire est repoussée le long de son axe de la
 * moitié du déficit de chaque côté (les deux bougent symétriquement) ; deux points EXACTEMENT
 * confondus sont séparés selon un angle dérivé de la somme de leurs id (déterministe, pas de RNG).
 * Le résultat est borné dans le cadre `[0..w] × [0..h]`. N'affecte QUE les positions de rendu —
 * les `pos` d'authoring restent intacts (la donnée n'est pas mutée).
 *
 * @param points   positions de rendu `{id, x, y}` (l'ordre d'entrée fixe l'ordre de résolution des paires)
 * @param minDist  distance minimale visée entre deux médaillons (unités viewBox)
 * @param iterations passes de relaxation (chaque passe rapproche du minimum sans jamais « exploser »)
 * @param frame    cadre de bornage (défaut : le viewBox de la carte, 100 × 64)
 * @returns une `Map<id, {x, y}>` des positions écartées, dans le MÊME repère que l'entrée.
 */
export function declutterPositions(
  points: RenderPoint[],
  minDist: number,
  iterations = 60,
  frame: { w: number; h: number } = { w: 100, h: 64 },
): Map<string, { x: number; y: number }> {
  // Copie de travail (on ne mute pas l'entrée) ; l'ordre est celui de `points` → déterministe.
  const pts = points.map((p) => ({ id: p.id, x: p.x, y: p.y }));
  const clamp = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);

  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 1e-6) {
          // Points confondus : séparer selon un angle dérivé des id (stable, sans RNG).
          const ang = hashAngle(a.id + '|' + b.id);
          dx = Math.cos(ang); dy = Math.sin(ang); dist = 1;
        }
        // Décalage : chaque point s'éloigne de la moitié du déficit le long de l'axe de la paire.
        const push = (minDist - dist) / 2;
        const ux = dx / dist, uy = dy / dist;
        a.x = clamp(a.x - ux * push, frame.w); a.y = clamp(a.y - uy * push, frame.h);
        b.x = clamp(b.x + ux * push, frame.w); b.y = clamp(b.y + uy * push, frame.h);
        moved = true;
      }
    }
    if (!moved) break; // convergé : toutes les paires respectent déjà `minDist`.
  }

  const out = new Map<string, { x: number; y: number }>();
  for (const p of pts) out.set(p.id, { x: p.x, y: p.y });
  return out;
}

// ── Format de PROJET (export/import éditeur) ────────────────────────────────────────────────
// Format courant : `{ type: 'projet', schema: 8, id, label, versionContenu, scenes, worldMap?, narratif }`
// (paquet de campagne auto-suffisant, #765 ; enveloppe PLATE depuis #1467 L1b, posée par la
// fabrique `document()` depuis #1552). Chaîné par la primitive générique `migrateDoc` (même mécanique
// que les saves, `saves.ts`) — `schema` joue le rôle de `version` ; la migration 2→3 injecte un
// `narratif` vide, la 4→5 aplatit la poche `meta`, la 5→6 donne au libellé de scène et de carte sa
// graphie `label` et fait s'annoncer les statblocs embarqués, la 6→7 fait s'annoncer le document
// LUI-MÊME et ses scènes et pose la provenance, la 7→8 pose les matières de relief de chaque scène.
import { migrateDoc, type MigrationMap, type RaisonDeRefus } from './migrateDoc';
import { findPropById, findSpeciesById } from '../data';
import { typeNonNomme } from '../data/schemas/defs-scenes/scene';
import { ACTION_FOUILLER } from './usable';
import { type NarratifBlock, emptyNarratif } from './campaignNarratif';
import { validateDocument, rapportDeFautes, type Faute } from '../data/schemas/validate';
import { projetSchema, SCHEMA_PROJET } from '../data/schemas/defs-scenes/projet';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';

/** Identité de campagne pour la bibliothèque (#766) — PLATE à la racine du document depuis #1467
 *  L1b, posée par l'enveloppe de `document()` depuis #1552. Le trio `id`/`label`/`versionContenu`
 *  est REQUIS (arbitrage utilisateur 2026-08-31 : « Un projet se NOMME avant d'être enregistré
 *  (Recommandé) ») ; la PROVENANCE l'est aussi, sous la forme `source` OU `maison`. */
export interface ProjectIdentite {
  /** Type du document — l'enveloppe l'écrit dans le JSON et le schéma le vérifie au parse. */
  type: 'projet';
  id: string;
  label: string;
  icon?: string;
  /** Numéro de CONTENU de l'auteur — la version de FORME du document est `schema`. */
  versionContenu: number;
  desc?: string;
  auteur?: string;
  /** Folio du livre dont la campagne est tirée — exclusif de `maison`, jamais des deux absents. */
  source?: SourceRef;
  /** Raison, en clair, d'une campagne qu'aucun livre ne publie. */
  maison?: string;
}

export interface ProjectDoc extends ProjectIdentite {
  schema: typeof SCHEMA_PROJET;
  scenes: Scene[];
  worldMap?: WorldMap;
  /** Axes de forces/faiblesses ACTIFS de la campagne (#409, ids de `src/data/axes.json`) — un
   *  scénario marchand active `negoce`, un siège `ingenierie`. Absent = socle de base (`coreAxisIds`,
   *  cf. `resolveActiveAxes`). Placement en jeu (rail de composition, mini-radar) hors périmètre de
   *  ce lot (#417). */
  activeAxes?: string[];
  /** Bloc NARRATIF embarqué (#765) : affaires, indices, presets de PNJ, objets de la campagne —
   *  référence la règle globale PAR ID, jamais réinjecté dans `src/data` (`campaignNarratif.ts`). */
  narratif: NarratifBlock;
}

/** Axes RÉELLEMENT actifs d'un projet — `activeAxes` déclaré (validé) sinon le socle de base. SOURCE
 *  UNIQUE de ce défaut (jamais un `?? []` dispersé côté consommateur, cf. #417). */
export function resolveActiveAxes(doc: { activeAxes?: string[] }): string[] {
  return doc.activeAxes && doc.activeAxes.length > 0 ? doc.activeAxes : coreAxisIds();
}

/** Version de FORME courante — DÉCLARÉE au document (`defs-scenes/projet.ts`), jamais re-tapée ici :
 *  le littéral `schema` du schéma et cette borne de migration ne peuvent pas diverger. */
export const CURRENT_PROJECT_SCHEMA = SCHEMA_PROJET;

/**
 * LE constructeur du document de projet — l'unique enveloppe que l'application ÉCRIT, quelle que
 * soit la sortie : « Enregistrer » et « Exporter JSON » de l'éditeur, import d'un fichier à la
 * bibliothèque, export d'une entrée. Il vit ICI, avec `ProjectDoc`, `CURRENT_PROJECT_SCHEMA` et la
 * porte `parseProject` : ce qu'on écrit et ce qu'on relit ont un seul propriétaire.
 *
 * Les générateurs de campagne y DÉLÈGUENT aussi (`projectDoc`, `scripts/campagne/lib.mjs`) : une
 * seule fabrique de la forme (credo.md:3-4).
 *
 * ORDRE D'ÉCRITURE : `id`, `type`, `label`, `schema`, le reste de l'identité, `narratif`, `scenes`,
 * puis `worldMap` et `activeAxes` — l'ordre des paquets GÉNÉRÉS, figé à l'octet par
 * `src/scenes/generateurs-byte-stables.test.ts`. Les clés optionnelles ne s'écrivent que FOURNIES :
 * un `worldMap: undefined` posé se lirait « carte effacée » au diff du document, là où son absence
 * dit « aucune carte ».
 */
export function documentDeProjet(
  identite: ProjectIdentite,
  scenes: Scene[],
  { worldMap, activeAxes, narratif }: { worldMap?: WorldMap | null; activeAxes?: string[]; narratif: NarratifBlock },
): ProjectDoc {
  const { id, type, label, ...resteDeLIdentite } = identite;
  return {
    id,
    type,
    label,
    schema: CURRENT_PROJECT_SCHEMA,
    ...resteDeLIdentite,
    narratif,
    scenes,
    ...(worldMap ? { worldMap } : {}),
    ...(activeAxes ? { activeAxes } : {}),
  };
}

/** Renomme UNE clé d'un objet EN PLACE (position préservée), sans la créer si elle est absente. */
function renommeCle(o: Record<string, unknown>, de: string, vers: string): Record<string, unknown> {
  if (!(de in o)) return o;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k === de ? vers : k, v]));
}

/** Pose `type: 'statblock'` (1ʳᵉ clé) sur le profil embarqué d'une entité de scène, s'il en porte un
 *  et qu'il ne l'annonce pas encore. Une entité SANS `statblock` traverse intacte. */
function typeDeStatbloc(e: unknown): unknown {
  if (!e || typeof e !== 'object') return e;
  const ent = e as Record<string, unknown>;
  const sb = ent.statblock;
  if (!sb || typeof sb !== 'object' || 'type' in (sb as object)) return ent;
  return { ...ent, statblock: { type: 'statblock', ...(sb as Record<string, unknown>) } };
}

/** Un effet narratif porte sa prose sous `text` en schema 3 (`journal`, `document`, `setObjective`). */
const EFFETS_A_PROSE = new Set(['journal', 'document', 'setObjective']);

/**
 * Descente RECONNAISSANTE d'un document schema 3 : un porteur est reconnu à sa FORME (un nœud de
 * dialogue porte `choices`, un effet narratif porte un `type` de `EFFETS_A_PROSE`), jamais par
 * exclusion — le `text` d'une op `narrative` ou d'un `TrappingRef` traverse intact.
 */
function migreProse(v: unknown, dansNodes: boolean): unknown {
  if (Array.isArray(v)) return v.map((x) => migreProse(x, dansNodes));
  if (!v || typeof v !== 'object') return v;
  const src = v as Record<string, unknown>;
  let o: Record<string, unknown> = Object.fromEntries(
    Object.entries(src).map(([k, x]) => [k, migreProse(x, k === 'nodes' ? true : k === 'choices' ? false : dansNodes)]),
  );
  const estNoeud = dansNodes && Array.isArray(o.choices);
  const estEffetNarratif = typeof o.type === 'string' && EFFETS_A_PROSE.has(o.type);
  if (estNoeud || estEffetNarratif) o = renommeCle(o, 'text', 'desc');
  // Prose ABSENTE = clé absente (les snapshots d'`ItemInstance` embarqués portaient `desc: null`).
  if (o.desc === null) { const { desc: _nul, ...reste } = o; o = reste; }
  return o;
}

/** Les CHOIX d'un dialogue : `text` y était un LIBELLÉ, pas de la prose. */
function migreChoix(scenes: unknown): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    const sc = s as Record<string, unknown>;
    if (!Array.isArray(sc.dialogues)) return sc;
    return {
      ...sc,
      dialogues: sc.dialogues.map((d) => {
        const dl = d as Record<string, unknown>;
        if (!Array.isArray(dl.nodes)) return dl;
        return {
          ...dl,
          nodes: dl.nodes.map((n) => {
            const nd = n as Record<string, unknown>;
            if (!Array.isArray(nd.choices)) return nd;
            return { ...nd, choices: nd.choices.map((c) => renommeCle(c as Record<string, unknown>, 'text', 'label')) };
          }),
        };
      }),
    };
  });
}

/**
 * SEMENCES GELÉES des migrations 7 → 8 et 8 → 9 — les valeurs que le code posait EN DUR au moment de
 * chaque lot (#1691 relief, #1715 toiture), figées ici avec leur migration.
 *
 * Elles ne lisent PAS la semence du jour (`semences-de-scene.json`, #1716) et ne doivent jamais le
 * faire : une migration reconstitue ce qu'un projet de bibliothèque utilisateur AVAIT, pas ce qu'une
 * scène neuve recevrait aujourd'hui — si l'auteur ré-édite sa semence, ses vieux projets doivent
 * continuer à se rendre à l'identique. C'est aussi ce que mesurent la parité avec les scripts de
 * dépôt (`scripts/migrations/2026-09-07-1691-…mjs`, `2026-09-09-1715-…mjs`), eux aussi gelés.
 * La forme `as const satisfies Fige<…Defaults>` est le SIGNAL que `matieres-en-donnee.test.ts` lit
 * comme une semence d'authoring plutôt qu'une émission de matière.
 */
const SEMENCE_RELIEF_1691 = {
  cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier',
} as const satisfies Fige<ReliefDefaults>;
const SEMENCE_TOITURE_1715 = {
  material: 'toit-ardoise', pitchDeg: 45, riseMaxStoreys: 1,
} as const satisfies Fige<SceneRoofDefaults>;

/**
 * Pose une clé de SCÈNE sur chaque scène d'un document, à la POSITION que `emptyScene` lui donne —
 * geste PARTAGÉ par les migrations qui EXIGENT un nouveau champ de scène (#1691 `reliefDefaults`,
 * #1715 `roofDefaults`) : c'est le même mouvement, pas deux.
 *
 * Trois invariants, tenus ici une seule fois : une scène qui porte DÉJÀ la clé traverse INTACTE (un
 * document hybride n'est pas réécrit — c'est le schéma qui juge sa forme) ; l'ANCRE absente met la
 * clé en queue plutôt que de deviner un rang ; ce qui n'est pas une liste de scènes traverse tel
 * quel (`parseProject` le refuse ensuite, en le nommant).
 *
 * La valeur est une FABRIQUE : chaque scène reçoit SA copie, jamais un objet partagé entre scènes.
 */
function poseSurChaqueScene(
  scenes: unknown,
  cle: string,
  valeur: () => unknown,
  ancre: { avant: string } | { apres: string },
): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    if (!s || typeof s !== 'object' || cle in s) return s;
    const sc = s as Record<string, unknown>;
    const cles = Object.keys(sc);
    const pose: [string, unknown] = [cle, valeur()];
    const repere = 'avant' in ancre ? ancre.avant : ancre.apres;
    const rang = cles.indexOf(repere);
    const coupe = rang < 0 ? cles.length : 'avant' in ancre ? rang : rang + 1;
    const entree = (k: string): [string, unknown] => [k, sc[k]];
    return Object.fromEntries([...cles.slice(0, coupe).map(entree), pose, ...cles.slice(coupe).map(entree)]);
  });
}

/**
 * Pose la clé `cle` en QUEUE de chaque ENTITÉ de chaque scène que `retient` désigne — sœur de
 * `poseSurChaqueScene`, d'un cran plus bas dans le document.
 *
 * MÊMES trois invariants : une entité qui porte DÉJÀ la clé traverse INTACTE, ce qui n'est pas une
 * liste traverse tel quel (`parseProject` le refuse ensuite en le nommant), la valeur est une
 * FABRIQUE (chaque entité reçoit SA copie). La clé et la valeur peuvent se lire sur l'entité retenue
 * (#1882 : `ref` ou `statblock` selon l'espèce).
 *
 * QUEUE, sans ancre : c'est la place que l'ÉDITEUR donne à un champ posé sur une entité existante
 * (`editEntity` étale l'entité puis le patch, `state/sceneEdit.ts`) — la migration écrit donc ce que
 * l'auteur aurait écrit à la main.
 */
function poseSurChaqueEntite(
  scenes: unknown,
  cle: string | ((ent: Record<string, unknown>) => string),
  valeur: (ent: Record<string, unknown>) => unknown,
  retient: (ent: Record<string, unknown>) => boolean,
): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    if (!s || typeof s !== 'object' || !Array.isArray((s as Record<string, unknown>).entities)) return s;
    const sc = s as Record<string, unknown>;
    const entities = (sc.entities as unknown[]).map((e) => {
      if (!e || typeof e !== 'object') return e;
      const ent = e as Record<string, unknown>;
      if (!retient(ent)) return ent;
      const k = typeof cle === 'string' ? cle : cle(ent);
      return k in ent ? ent : { ...ent, [k]: valeur(ent) };
    });
    return { ...sc, entities };
  });
}

/** Une entité dont le TYPE de décor porte des places assises — la seule capacité qui vive sur le
 *  TYPE, donc la seule population que l'activation d'instance (#1687) concerne.
 *
 *  Le catalogue est lu à l'INSTANT de la migration : un type qui gagnerait des `seatSlots` plus tard
 *  n'active rétroactivement aucune instance — l'activation reste un opt-in d'AUTEUR, à la case de
 *  l'inspecteur. */
const porteDesPlaces = (ent: Record<string, unknown>): boolean =>
  ent.kind === 'prop' && (findPropById(typeof ent.ref === 'string' ? ent.ref : undefined)?.seatSlots?.length ?? 0) > 0;

/** Un décor qui ne NOMME aucun type — la population que le bump 11 → 12 nomme explicitement. */
const decorSansType = (ent: Record<string, unknown>): boolean => ent.kind === 'prop' && ent.ref === undefined;

/** Le type que le rendu DONNAIT à un décor sans `ref` avant #877. Ce littéral ne vit QUE dans la
 *  migration 11 → 12 : une migration FIGE un passé, elle ne pose pas un défaut. */
const REF_DU_RENDU_AVANT_877 = 'tonneau';

/** Un personnage qui ne NOMME aucune fiche (`typeNonNomme`) — la population que le bump 12 → 13 nomme. */
const personnageSansFiche = (ent: Record<string, unknown>): boolean =>
  ent.kind === 'personnage' && typeNonNomme({ id: String(ent.id), kind: 'personnage', ref: ent.ref, statblock: ent.statblock, presetId: ent.presetId }) !== undefined;

/** Le profil standard (`LDB 77 l.7`) de l'espèce AUTHORÉE de l'entité — lu au catalogue à l'INSTANT de
 *  la migration ; `undefined` pour une espèce absente, un id de rig ou une espèce sans profil. */
const profilDeLEspece = (ent: Record<string, unknown>): string | undefined => {
  const species = (ent.appearance as { species?: unknown } | undefined)?.species;
  return typeof species === 'string' ? findSpeciesById(species)?.profilStandard?.id : undefined;
};

/** Le statbloc que la branche `!ref` de `spawnEnemy` posait avant #1882 (`state/spawn.ts`) : même
 *  libellé, même profil. Porté par l'entité, il passe par la branche `statblock`, qui reçoit
 *  l'`appearance` : la forme du corps suit alors l'espèce authorée (`bodyShapeForSpecies`). Ce littéral ne
 *  vit QUE dans la migration 12 → 13. */
const FICHE_DU_SPAWN_AVANT_1882 = (): Record<string, unknown> => ({ type: 'statblock', label: 'Ennemi', char: { B: 10 } });

/** Un porteur VIDE (`ref: ''`, `presetId: ''`) n'est pas un porteur (`typeNonNomme`) : le bump 12 → 13 le
 *  retire avant de nommer la fiche, même politique que l'absence. */
function sansPorteurVide(scenes: unknown): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    if (!s || typeof s !== 'object' || !Array.isArray((s as Record<string, unknown>).entities)) return s;
    const sc = s as Record<string, unknown>;
    const entities = (sc.entities as unknown[]).map((e) => {
      if (!e || typeof e !== 'object' || !personnageSansFiche(e as Record<string, unknown>)) return e;
      return Object.fromEntries(Object.entries(e).filter(([k, v]) => !((k === 'ref' || k === 'presetId') && v === '')));
    });
    return { ...sc, entities };
  });
}

/**
 * La fouille d'un décor devient une ACTION AUTHORÉE, et l'enveloppe `usable` vide se NOMME (#1687).
 *
 * L'enveloppe prend la PLACE qu'occupait `interact` (patron `renommeCle`) : le document migré est
 * celui que l'auteur aurait écrit. L'ancien `consume` (le décor disparaît) traverse tel quel ; son
 * absence devient `unique` — la fouille sans butin restait en place, marquée jouée. Une entité sans
 * `interact` ni `usable` traverse INTACTE, et ce qui n'est pas une liste traverse tel quel
 * (`parseProject` le refuse ensuite, en le nommant).
 */
function migreActionsAuthorees(scenes: unknown): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    if (!s || typeof s !== 'object' || !Array.isArray((s as Record<string, unknown>).entities)) return s;
    const sc = s as Record<string, unknown>;
    const entities = (sc.entities as unknown[]).map((e) => {
      if (!e || typeof e !== 'object') return e;
      const ent = e as Record<string, unknown>;
      const it = ent.interact as { flow?: unknown; consume?: boolean } | undefined;
      const avant = ent.usable as Record<string, unknown> | undefined;
      if (it === undefined && avant === undefined) return ent;
      const base: Record<string, unknown> = avant && Object.keys(avant).length === 0 ? { assise: true } : { ...avant };
      const usable = it?.flow === undefined
        ? base
        : {
          ...base,
          actions: [
            ...(Array.isArray(base.actions) ? base.actions : []),
            { id: ACTION_FOUILLER, flow: it.flow, ...(it.consume ? { consume: true } : { unique: true }) },
          ],
        };
      return Object.fromEntries(
        Object.entries(ent)
          .filter(([k]) => !(k === 'usable' && ent.interact !== undefined))
          .map(([k, v]) => (k === 'interact' || k === 'usable' ? ['usable', usable] : [k, v])),
      );
    });
    return { ...sc, entities };
  });
}

/** Migrations SÉQUENTIELLES de ProjectDoc : la clé N met à niveau un schema N → N+1. `2` injecte le
 *  bloc `narratif` vide (#765 — un projet schema 2 est un paquet SANS narratif). `3` porte les
 *  RÔLES DE PROSE du lot #1467 L1b V-P2 : c'est la MÊME transformation que les migrations de dépôt
 *  (`scripts/migrations/2026-08-27-l1b-3{a,b,g,h}-*.mjs`), appliquée au CHARGEMENT — sans elle, un
 *  projet exporté avant ce lot (bibliothèque utilisateur, `.json` portable) mourrait sur le schéma.
 *  Ajouter ici la migration N→N+1 pour tout futur bump (cf. `MIGRATIONS` de `saves.ts`), plutôt que
 *  de refuser en silence des projets antérieurs valides. */
export const PROJECT_MIGRATIONS: MigrationMap = {
  2: (doc) => ({ ...doc, version: 3, schema: 3, narratif: emptyNarratif() }),
  3: (doc) => {
    // Un document SANS `scenes` valide traverse INTACT : c'est `parseProject` qui le refuse, avec son
    // message actionnable — une migration ne doit jamais transformer une donnée absente en exception.
    if (!Array.isArray(doc.scenes)) return { ...doc, version: 4, schema: 4 };
    const scenesProse = migreProse(doc.scenes, false) as unknown[];
    const scenes = (migreChoix(scenesProse) as Record<string, unknown>[]).map((s) => {
      const avecDesc = renommeCle(s, 'description', 'desc');
      // Prose ABSENTE = clé absente : ni `null`, ni chaîne vide (le schéma pose `.min(1).optional()`).
      if (avecDesc.desc === '' || avecDesc.desc === null) { const { desc: _sans, ...reste } = avecDesc; return reste; }
      return avecDesc;
    });
    const meta = doc.meta && typeof doc.meta === 'object'
      ? renommeCle(doc.meta as Record<string, unknown>, 'description', 'desc')
      : doc.meta;
    return { ...doc, version: 4, schema: 4, scenes, ...(doc.meta !== undefined ? { meta } : {}) };
  },
  /**
   * `4` APLATIT l'enveloppe (#1467 L1b V-formeProjet) : les champs de la poche `meta` remontent à la
   * RACINE et `version` y devient `versionContenu`. Le renommage n'est pas cosmétique, et le risque
   * MESURÉ n'est pas un refus : `parseProject` pose `version: obj.schema` EN DERNIER dans le spread,
   * donc un `version` de CONTENU à la racine serait ÉCRASÉ par le numéro de forme, puis PURGÉ avec la
   * clé de travail avant le retour. Gardé sous le nom `version`, le numéro de l'auteur ne survivrait
   * donc JAMAIS à un chargement — perte SILENCIEUSE (aucune erreur), et `importDecision` comparerait
   * 0 à 0 pour l'éternité. Le nom distinct est ce qui met le numéro hors de portée de l'écrasement.
   */
  4: (doc) => {
    const { meta, ...reste } = doc;
    if (!meta || typeof meta !== 'object') return { ...reste, version: 5, schema: 5 };
    const { version: versionContenu, ...identite } = meta as Record<string, unknown>;
    return {
      ...reste,
      ...identite,
      ...(versionContenu !== undefined ? { versionContenu } : {}),
      version: 5,
      schema: 5,
    };
  },
  /**
   * `5` donne au LIBELLÉ sa graphie canonique (#1467 L1b V-P7) : la clé `nom` d'une scène et de la
   * carte du monde devient `label`, à sa POSITION exacte. Les deux portaient un libellé d'affichage
   * pur — l'identité est `id`, présente sur les deux depuis toujours. Le même passage pose le `type`
   * des statblocs EMBARQUÉS (`scenes[].entities[].statblock`) : un document embarqué s'annonce dans
   * la donnée, et le schéma l'EXIGE désormais (`defs-scenes/communs.ts`) — sans ce passage, tout
   * projet antérieur (bibliothèque utilisateur, `.json` portable) mourrait au parse.
   */
  5: (doc) => {
    const scenes = Array.isArray(doc.scenes)
      ? doc.scenes.map((s) => {
        const sc = renommeCle(s as Record<string, unknown>, 'nom', 'label');
        if (!Array.isArray(sc.entities)) return sc;
        return { ...sc, entities: sc.entities.map(typeDeStatbloc) };
      })
      : doc.scenes;
    const worldMap = doc.worldMap && typeof doc.worldMap === 'object'
      ? renommeCle(doc.worldMap as Record<string, unknown>, 'nom', 'label')
      : doc.worldMap;
    return {
      ...doc,
      ...(doc.scenes !== undefined ? { scenes } : {}),
      ...(doc.worldMap !== undefined ? { worldMap } : {}),
      version: 6,
      schema: 6,
    };
  },
  /**
   * `6` fait S'ANNONCER le document et ses scènes (#1552) : `type: 'projet'` à la racine,
   * `type: 'scene'` sur chaque scène embarquée — même geste que le `type: 'statblock'` de la 5→6, et
   * même raison : un document embarqué s'annonce dans la donnée, et le schéma l'EXIGE désormais.
   * Le même passage pose la PROVENANCE quand le document n'en porte aucune : `maison`, la seule
   * que la migration puisse DIRE sans inventer (un folio ne se devine pas ; le document en porte
   * un, ou il dit qu'il n'en a pas). L'IDENTITÉ, elle, ne se fabrique pas : un projet antérieur
   * sans `id`/`label`/`versionContenu` ressort tel quel de la migration et se fait REFUSER par le
   * schéma, qui NOMME les champs manquants (arbitrage 2026-08-31 : un projet se nomme).
   */
  6: (doc) => {
    const scenes = Array.isArray(doc.scenes)
      ? doc.scenes.map((s) => (s && typeof s === 'object' && !('type' in s) ? { type: 'scene', ...(s as object) } : s))
      : doc.scenes;
    const provenance = doc.source === undefined && doc.maison === undefined
      ? { maison: MAISON_PROJET_AUTHORE }
      : {};
    return {
      type: 'projet',
      ...doc,
      ...(doc.scenes !== undefined ? { scenes } : {}),
      ...provenance,
      version: 7,
      schema: 7,
    };
  },
  /**
   * `7` pose les MATIÈRES DE RELIEF de chaque scène (#1691) : `reliefDefaults`, EXIGÉ par
   * `sceneSchema` depuis que `gameIso/builders/floors.ts` ne choisit plus aucune matière. Les valeurs
   * posées sont `SEMENCE_RELIEF_1691` — exactement ce que le builder choisissait en dur avant le
   * lot, donc un projet de bibliothèque utilisateur se rend à l'identique après migration. La clé va
   * à la POSITION que la création lui donne (`emptyScene`) : juste avant `layers`. Une scène qui en
   * porte déjà un traverse INTACTE (un document hybride n'est pas réécrit par cette migration ; c'est
   * le schéma qui juge sa forme).
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-07-1691-relief-defaults-scenes.mjs`
   * (parité mesurée par `projet-migration-7-vers-8.test.ts`).
   */
  7: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueScene(doc.scenes, 'reliefDefaults', () => ({ ...SEMENCE_RELIEF_1691 }), { avant: 'layers' }) }
      : {}),
    version: 8,
    schema: 8,
  }),
  /**
   * `8` pose la TOITURE PAR DÉFAUT de chaque scène (#1715) : `roofDefaults`, EXIGÉ par `sceneSchema`
   * depuis que la dérivation des masses ne choisit plus ni couverture, ni pente de référence, ni
   * borne de comble (`toitureEffective`, `state/sceneEdit.ts`). Les valeurs posées sont
   * `SEMENCE_TOITURE_1715` — exactement ce que la dérivation appliquait en dur avant le lot, donc un
   * projet de bibliothèque utilisateur se rend à l'identique après migration. La clé va à la POSITION
   * que la création lui donne (`emptyScene`) : juste après `reliefDefaults`. Une scène qui en porte
   * déjà une traverse INTACTE.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-09-1715-roof-defaults-scenes.mjs`
   * (parité mesurée par `projet-migration-8-vers-9.test.ts`).
   */
  8: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueScene(doc.scenes, 'roofDefaults', () => ({ ...SEMENCE_TOITURE_1715 }), { apres: 'reliefDefaults' }) }
      : {}),
    version: 9,
    schema: 9,
  }),
  /**
   * `9` ACTIVE les décors qui étaient assis-ables AVANT le lot #1687 : `usable: {}` sur chaque entité
   * dont le TYPE porte des `seatSlots`. Depuis ce lot, l'assise d'un siège autonome est une propriété
   * de l'INSTANCE, activée par l'auteur (verbatim utilisateur 2026-09-09 : « on doit pouvoir
   * s'assoire sur une chaise si dans l'éditeur on l'active ») : sans ce passage, les meubles à places
   * d'un projet de bibliothèque utilisateur deviendraient MUETS. Une entité qui porte déjà `usable`
   * traverse INTACTE.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-10-1687-usable-sieges.mjs`
   * (parité mesurée par `projet-migration-9-vers-10.test.ts`).
   */
  9: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueEntite(doc.scenes, 'usable', () => ({}), porteDesPlaces) }
      : {}),
    version: 10,
    schema: 10,
  }),
  /**
   * `10` donne à l'enveloppe `usable` ses deux faits NOMMÉS (#1687) : la fouille quitte le champ
   * `interact`, que le schéma ne connaît plus, pour devenir une ACTION AUTHORÉE du vocabulaire ouvert
   * (`usable.actions`), et l'enveloppe VIDE posée par la 9→10 — qui disait « assise activée » par sa
   * seule PRÉSENCE — dit désormais `assise: true`. Sans ce passage, un projet de bibliothèque
   * utilisateur serait REFUSÉ au parse sur sa première clé `interact` (`strictObject`) et ses meubles
   * à places redeviendraient muets.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-11-1687-actions-authorees.mjs`
   * (parité mesurée par `projet-migration-10-vers-11.test.ts`).
   */
  10: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined ? { scenes: migreActionsAuthorees(doc.scenes) } : {}),
    version: 11,
    schema: 11,
  }),
  /**
   * `11` NOMME le type de tout décor qui n'en nommait aucun (#877) : `ref` devient REQUISE sur une
   * entité `kind:'prop'` et résolue au registre `props.json` (`defs-scenes/scene.ts`). Avant ce lot,
   * le MONDE remplaçait la ref absente par un littéral en dur ; la migration ÉCRIT ce que le monde
   * DESSINAIT, donc le décor de scène d'un projet de bibliothèque utilisateur ressort inchangé. Le
   * backend SPRITE, qui ne dessinait RIEN d'une ref absente, s'ALIGNE dessus — c'est la divergence
   * qui meurt, pas le dessin. Sans ce passage, le projet serait REFUSÉ au parse sur son premier
   * décor sans type.
   * Une entité qui porte déjà `ref` traverse INTACTE, et un décor à ref MORTE n'est pas de ce ressort :
   * il se fait NOMMER par le schéma, jamais remplacer.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-21-877-ref-de-decor-nommee.mjs`
   * (parité mesurée par `projet-migration-11-vers-12.test.ts`).
   */
  11: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueEntite(doc.scenes, 'ref', () => REF_DU_RENDU_AVANT_877, decorSansType) }
      : {}),
    version: 12,
    schema: 12,
  }),
  /**
   * `12` NOMME la fiche de tout personnage qui n'en nommait aucune (#1882) : un porteur (`ref`,
   * `statblock` ou `presetId`) devient REQUIS sur une entité `kind:'personnage'`
   * (`PORTEURS_DU_TYPE`, `defs-scenes/scene.ts`). L'espèce authorée porte un profil standard
   * (`LDB 77 l.7`, `species.json`) → `ref` = ce profil ; sinon (espèce absente, id de rig, espèce
   * sans profil) → le statbloc de la branche `!ref` d'avant #1882, écrit en `statblock` explicite
   * (`FICHE_DU_SPAWN_AVANT_1882` : libellé et profil identiques, forme du corps de l'espèce). Sans ce passage, le
   * projet serait REFUSÉ au parse sur son premier personnage sans fiche.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-23-1882-fiche-de-personnage-nommee.mjs`
   * (parité mesurée par `projet-migration-12-vers-13.test.ts`).
   */
  12: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? {
        scenes: poseSurChaqueEntite(
          sansPorteurVide(doc.scenes),
          (ent) => (profilDeLEspece(ent) ? 'ref' : 'statblock'),
          (ent) => profilDeLEspece(ent) ?? FICHE_DU_SPAWN_AVANT_1882(),
          personnageSansFiche,
        ),
      }
      : {}),
    version: 13,
    schema: 13,
  }),
  /** 13 → 14 (#1882) : `livingRefSchema.creatureId`, `givePossession.ref.vehicleId` et `setVessel.vehicleId` exigent un id RÉSOLU
   *  (`idDe`). Avant, l'effet neuf (`make`, éditeur) semait `''` : ce vide reçoit ce que l'outil sème
   *  aujourd'hui (`creatureSemee`, `vehiculeSeme`, `navireSeme`). Pendant applicatif du script de dépôt
   *  `scripts/migrations/2026-09-24-1882-refs-vivantes-semees.mjs` (parité : `projet-migration-13-vers-14.test.ts`). */
  13: (doc) => ({
    ...(semeLesRefsVides(doc) as typeof doc),
    version: 14,
    schema: 14,
  }),
};

/** Toute réf. VIDE d'un `startPursuit` (`foes[].ref.creatureId`), d'un `givePossession` (`ref.creatureId`,
 *  `ref.vehicleId`) ou d'un `setVessel` (`vehicleId`), où que l'effet soit niché dans le DOCUMENT (Scène,
 *  péril de route de `worldMap`, …), reçoit la réf. que l'outil sème (`PROJECT_MIGRATIONS[13]`). Le reste
 *  traverse à l'identique. */
export function semeLesRefsVides(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(semeLesRefsVides);
  if (!v || typeof v !== 'object') return v;
  const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, semeLesRefsVides(x)])) as Record<string, unknown>;
  const seme = (ref: unknown): unknown => {
    if (!ref || typeof ref !== 'object') return ref;
    const r = ref as Record<string, unknown>;
    if (r.creatureId === '') return { ...r, creatureId: creatureSemee() };
    if (r.vehicleId === '') return { ...r, vehicleId: vehiculeSeme() };
    return r;
  };
  if (o.type === 'setVessel' && o.vehicleId === '') return { ...o, vehicleId: navireSeme() };
  if (o.type === 'givePossession') return { ...o, ref: seme(o.ref) };
  if (o.type === 'startPursuit' && Array.isArray(o.foes))
    return { ...o, foes: o.foes.map((f) => (f && typeof f === 'object' ? { ...(f as object), ref: seme((f as { ref?: unknown }).ref) } : f)) };
  return o;
}

/** Provenance d'une campagne AUTHORÉE À L'ÉDITEUR : aucun livre ne la publie, et un folio ne se
 *  devine pas. SOURCE UNIQUE — posée par la migration 6→7 sur un projet qui n'en portait aucune,
 *  et par l'éditeur sur un projet qu'il nomme pour la première fois (`src/ui/editor/Editor.tsx`). */
export const MAISON_PROJET_AUTHORE =
  'campagne authorée à l’éditeur de scènes — aucun livre ne la publie, le document ne cite aucun folio à sa racine';

/** Vue TS du document PROUVÉ par `projetSchema`. La fabrique `document()` scelle ses nœuds — `z.infer`
 *  y vaut `unknown` (cf. `grammaire/document.ts`) —, la vue se pose donc ici, une fois. */
type ProjetProuve = { [K in keyof ProjectDoc]: ProjectDoc[K] };

/** Étape de la porte qui a refusé : document mal formé (illisible comme projet, ou que la migration
 *  n'a pas pu traverser), version sans migration, schéma, ou entrée de bibliothèque
 *  (`campagneDeLEntree`, #1627). */
export type CauseDeRefus = 'mal-forme' | 'version' | 'schema' | 'entree';

/** Refus de la porte `parseProject`, MESURÉ : la cause et les fautes (chemin + message), à charge de
 *  l'appelant de les dire à sa surface. Le `message` reste le rapport TECHNIQUE de la porte. Patron :
 *  `EntreeEnSceneNonAtteinte` (`entreeEnScene.ts`). */
export class ProjetRefuse extends Error {
  readonly cause: CauseDeRefus;
  readonly fautes: readonly Faute[];

  constructor(cause: CauseDeRefus, fautes: readonly Faute[], message: string) {
    super(message);
    this.name = 'ProjetRefuse';
    this.cause = cause;
    this.fautes = fautes;
  }
}

/** Toute erreur qui n'est pas un refus de la porte remonte telle quelle : SOURCE UNIQUE des
 *  traducteurs de `ProjetRefuse` (`refusJoueur`, `refusDeLaPorteDuProjet`). */
export function exigerUnRefus(err: unknown): asserts err is ProjetRefuse {
  if (!(err instanceof ProjetRefuse)) throw err;
}

/** Refus hors schéma : une seule faute, rapportée `Projet invalide : <faute>.` */
export function refusDeForme(cause: CauseDeRefus, chemin: readonly (string | number)[], faute: string): ProjetRefuse {
  return new ProjetRefuse(cause, [{ chemin, message: faute, code: cause }], `Projet invalide : ${faute}.`);
}

/** Ce que la porte dit d'un refus de MIGRATION, par la raison que `migrateDoc` NOMME : un numéro
 *  absent ou illisible et un document que les migrations ne savent pas lire sont des documents mal
 *  formés ; une version future ou sans chemin de migration est une affaire de version. */
const REFUS_DE_MIGRATION: Record<RaisonDeRefus, { cause: CauseDeRefus; chemin: readonly string[]; faute: (schema: string, detail?: string) => string }> = {
  'non-objet': { cause: 'mal-forme', chemin: [], faute: () => 'document absent ou mal formé' },
  'version-absente': { cause: 'mal-forme', chemin: ['schema'], faute: (s) => `« schema » absent ou non numérique (schema=${s})` },
  'version-future': {
    cause: 'version',
    chemin: ['schema'],
    faute: (s) => `version future (schema=${s}) : cette version du jeu lit jusqu'au schema ${CURRENT_PROJECT_SCHEMA}`,
  },
  'migrateur-manquant': {
    cause: 'version',
    chemin: ['schema'],
    faute: (s) => `version non supportée (schema=${s}) : aucune migration depuis ce schema vers le schema ${CURRENT_PROJECT_SCHEMA}`,
  },
  'migrateur-immobile': {
    cause: 'version',
    chemin: ['schema'],
    faute: (s) => `version non supportée (schema=${s}) : sa migration ne fait pas progresser le schema`,
  },
  'migrateur-en-echec': { cause: 'mal-forme', chemin: [], faute: (_s, detail) => `document mal formé (${detail})` },
};

function refusDeMigration(raison: RaisonDeRefus, schema: unknown, detail?: string): ProjetRefuse {
  const { cause, chemin, faute } = REFUS_DE_MIGRATION[raison];
  return refusDeForme(cause, chemin, faute(JSON.stringify(schema), detail));
}

/** UNE scène d'un document au `schema` donné, portée au schéma courant par la chaîne CANONIQUE
 *  (`migrateDoc` + `PROJECT_MIGRATIONS`, celle de `parseProject`) puis normalisée (`normalizeScene`).
 *  Refus nommé (`ProjetRefuse`, `REFUS_DE_MIGRATION`) si la chaîne ne sait pas la lire. */
export function sceneAuSchemaCourant(scene: unknown, schema: unknown): Scene {
  const issue = migrateDoc({ version: schema, schema, scenes: [scene] }, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS);
  if (!issue.ok) throw refusDeMigration(issue.raison, issue.version, issue.detail);
  return normalizeScene((issue.doc.scenes as Scene[])[0]);
}

/** Parse un document de projet, migrant au besoin via `migrateDoc`. Refus EXPLICITE (`ProjetRefuse`,
 *  jamais un throw sec sans espoir de migration), dont la cause se LIT : la raison d'un refus de
 *  migration est celle que `migrateDoc` nomme (`REFUS_DE_MIGRATION`) ; puis forme finale invalide
 *  (`scenes` absent/non-tableau) ou schéma enfreint. Les anciens formats (tableau de scènes nu,
 *  scène unique) restent refusés : ils n'ont jamais porté de `schema`. Chaque scène ressort passée
 *  par `normalizeScene` (`scene.ts`) : les collections requises absentes d'un document ancien (même
 *  schema 2) sont complétées ici, au SEUL point d'entrée, jamais par un `?? []` dispersé côté
 *  consommateur. La porte n'altère JAMAIS ce qu'on lui passe. Ce qui suit le schéma travaille sur
 *  un document PROUVÉ : une exception y est une faute du jeu, pas de l'auteur, et se propage. */
export function parseProject(data: unknown): Omit<ProjectDoc, 'schema'> {
  // `version` est la clé de travail de `migrateDoc` : le `schema` du document y est recopié. Seul
  // `null`/`undefined` n'a pas de champ à lire ; tout le reste, `migrateDoc` le juge.
  const obj = data as Record<string, unknown> | null | undefined;
  const issue = migrateDoc(obj == null ? obj : { ...obj, version: obj.schema }, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS);
  if (!issue.ok) throw refusDeMigration(issue.raison, issue.version, issue.detail);
  const migrated = issue.doc;
  if (!Array.isArray(migrated.scenes)) {
    throw refusDeForme('mal-forme', ['scenes'], '« scenes » absent ou non-tableau');
  }
  // Porte UNIQUE du document (#1466) : `projetSchema` porte la FORME et les sémantiques du seam —
  // FK `activeAxes` → `axes.json`, FK `worldMap.places[].port.ref` → `naval-ports.json`, invariants
  // du bloc narratif, FK intra-document `entity.presetId` → `narratif.presetsPnj`, invariant
  // d'identité. Validé AVANT `resolvePortRef` et `normalizeScene` : le schéma voit le document tel
  // qu'il est authoré. `version` est la clé de travail de `migrateDoc`, pas un champ du document :
  // elle ne lui est pas soumise.
  const { version: _version, ...doc } = migrated;
  const fautes = validateDocument(projetSchema, doc);
  if (fautes) throw new ProjetRefuse('schema', fautes, rapportDeFautes('Projet', fautes));

  // Carte et lieux NEUFS : les ports se résolvent sur la copie, jamais sur le document reçu.
  const carteRecue = migrated.worldMap as WorldMap | undefined;
  const worldMap = carteRecue && {
    ...carteRecue,
    places: carteRecue.places.map((p) => (p.port ? { ...p, port: resolvePortRef(p.port) } : p)),
  };
  const activeAxes = (migrated.activeAxes as string[] | undefined) ?? undefined;
  const narratif = migrated.narratif as NarratifBlock;
  // Le schéma VIENT de prouver la forme : le document se relit donc sous sa VUE TS, en une conversion
  // (`ProjetProuve`, ci-dessus) plutôt que par un aller-retour `unknown`. Les champs d'identité sortent
  // du RESTE, typés : rien de ce que le document porte en plus ne peut s'y glisser muet.
  const { schema: _schema, scenes: _scenes, worldMap: _wm, activeAxes: _aa, narratif: _na, ...identite } = doc as ProjetProuve;
  return { ...identite, scenes: (migrated.scenes as Scene[]).map(normalizeScene), worldMap, activeAxes, narratif };
}
