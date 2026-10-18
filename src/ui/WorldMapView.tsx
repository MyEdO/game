import { useMemo, useState } from 'react';
import { nomDuNavire } from '../state/carriers';
import { useGame } from '../state/store';
import { DEFAULT_VOYAGE_ORDERS, type VoyageCadence } from '../state/voyageCadence';
import { t, deElide } from '../i18n';
import { placeOfScene, placeById, routesEtat, visiblePlaces, otherEnd, declutterPositions, MapRoute, MapPlace } from '../state/worldMap';
import { baseHoursPerDay, maxHoursPerDay, passagePayant } from '../state/travelFlow';
import { descenteJouee } from '../state/riverVoyageFlow';
import { forcePaceRefus } from '../state/seaVoyageFlow';
import {
  TravelMode, travelModeLabels, travelModeIcon, travelSpeed, travelPlanCalc, transportCost,
  routeDistanceLabel, vehicleTravel, classeRetenue, prixParPassager, placesPayees,
} from '../engine/travel';
import { offreDePassage } from '../state/billetFlow';
import {
  type Allure, allureLabel, availableAllures, partyFullyMounted, partyMounts,
} from '../engine/mountTravel';
import { rationCount, provisioningManifest } from '../engine/provisions';
import { cargoOverload, cargoTotalEnc } from '../engine/seaVoyage';
import { findVehicleById, skillInstanceLabel } from '../data';
import { formatMoney, canAfford, fromBrass } from '../engine/money';
import { partyMoneyTotal, condCtx } from '../state/bourseFlow';
import { Coins } from './Coins';
import { GatedAction, raisonSi } from './GatedAction';
import { mdToText } from './Prose';
import { useIdentites } from './useIdentites';
import { nommer } from '../state/identites';
import { rule } from '../engine/policy';
import { forcePaceDifficulty } from '../engine/seaNavigation';
import { vesselNavalTraits, navalTraitsDe } from '../engine/navalTraits';
import { propulsionDuNavire } from '../engine/shipBuild';
import { DIFFICULTY_LABELS, type NavalTraitRef } from '../engine/types';
import { TravelRolesPanel } from './TravelRolesPanel';
import { ShipRolesPanel } from './ShipRolesPanel';
import { ShipStationsPanel } from './ShipStationsPanel';
import { OptionChooser } from './OptionChooser';
import { Icon, IconG } from './Icon';
import { ScreenShell } from './ScreenShell';
import { formatImperial } from '../engine/clock';
import { VB_W, VB_H, fitViewport, type Viewport } from './worldMapViewport';
import { MapCanvas, type MapMarker, type MapPath } from './MapCanvas';
import { CompassRose } from './PlanChrome';
import { Row, Split } from './Layout';
import { garanti } from '../state/combatants';

/** Hash déterministe d'un id → sens de courbure stable d'une route (pas de Math.random). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
/** Chemin courbe (quadratique) entre deux points + son milieu (pour poser le label). Le sens de
 *  la courbure est fixé par l'id → la carte ne « bouge » pas d'un rendu à l'autre. */
function routeCurve(ax: number, ay: number, bx: number, by: number, id: string) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const bend = (hashStr(id) % 2 ? 1 : -1) * Math.min(7, len * 0.14);
  const cx = mx + (-dy / len) * bend, cy = my + (dx / len) * bend;
  // milieu de la Bézier quadratique (t=0,5)
  const lx = 0.25 * ax + 0.5 * cx + 0.25 * bx;
  const ly = 0.25 * ay + 0.5 * cy + 0.25 * by;
  return { d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`, lx, ly };
}

// ── Cadre logique de la carte (unités du viewBox) ────────────────────────────────────────────
/** Écart mini visé entre deux médaillons (unités viewBox) — un médaillon fait r≈2.9 + cartouche,
 *  ~8 les sépare confortablement sans les coller. */
const DECLUTTER_MIN = 8;

/**
 * Carte du monde (#T2 Voyage) — overlay plein écran en exploration : carte au PARCHEMIN dessinée
 * (texture vieillie, cadre orné, routes en chemins, lieux en médaillons, rose des vents), lieux et
 * routes (donnée `WorldMap` du projet, éditable dans l'onglet « Monde » de l'éditeur), départ de
 * voyage depuis le lieu courant (mode, classe, allure — RAW section « Voyage » du LDB) et reprise
 * d'un voyage interrompu par une péripétie. Mobile-first : panneau en bas, carte au-dessus.
 */
/** `hereSceneId`/`initialRouteId` : seams de test (rendu statique : le store SSR sert l'état initial). */
export function WorldMapView({ initialRouteId, hereSceneId }: { initialRouteId?: string; hereSceneId?: string } = {}) {
  const map = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const party = useGame((s) => s.party);
  const possessions = useGame((s) => s.possessions);
  // Bourse de groupe = somme des bourses personnelles (T-bourse #531) ; recalculée quand le groupe change.
  const money = useMemo(() => partyMoneyTotal(useGame.getState), [party]);
  const gameTime = useGame((s) => s.gameTime);
  const travelPlan = useGame((s) => s.travelPlan);
  const close = useGame((s) => s.closeWorldMap);
  const startTravel = useGame((s) => s.startTravel);
  const startBilletBargain = useGame((s) => s.startBilletBargain);
  const billetEnMain = useGame((s) => s.billetEnMain);
  const marchandagesDeBillet = useGame((s) => s.marchandagesDeBillet);
  const resumeTravel = useGame((s) => s.resumeTravel);
  // Porte d'heure de départ (maison, #340) : départ terrestre/fluvial de nuit → attendre l'aube / annuler.
  const pendingDeparture = useGame((s) => s.pendingDeparture);
  const departWaitDawn = useGame((s) => s.departWaitDawn);
  const departCancel = useGame((s) => s.departCancel);
  // Coop : l'invité consulte la carte mais l'HÔTE décide des départs (le voyage déplace tout le
  // groupe et résout des journées entières — audit Lot 4, arbitrage V1 « exploration = miroir »).
  const isGuest = useGame((s) => s.net.mode) === 'guest';
  const identites = useIdentites();
  const [selId, setSelId] = useState<string | null>(initialRouteId ?? null);
  const [mode, setMode] = useState<TravelMode>('pied');
  const [classeId, setClasseId] = useState('');
  const [forced, setForced] = useState(false);
  /** Allure en selle (EDOC 07 l.140) — règle optionnelle `travel-allures`. */
  const [allure, setAllure] = useState<Allure>('pas');
  /** Attelage forcé au pas de course (EDOC 07 l.229). */
  const [forceGallop, setForceGallop] = useState(false);
  /** Forcer le rythme en mer (MDG 13 l.95-107) : bonus de M demandé (0 = rythme de conception). */
  const [seaPace, setSeaPace] = useState(0);
  /** Traversée RAPIDE (MDG 15 l.21-37) : tout le trajet en UN Test de Rude épreuve, sinon jour par jour. */
  const [seaFast, setSeaFast] = useState(false);
  /** CADENCE de la traversée détaillée, en mer comme au fleuve (couche `voyageCadence`). Ignoré en
   *  traversée rapide. */
  const [cadence, setCadence] = useState<VoyageCadence>(DEFAULT_VOYAGE_ORDERS.cadence);
  /** Lieu cliqué SANS route directe depuis ici → on l'explique au lieu de rester muet. */
  const [farId, setFarId] = useState<string | null>(null);
  /** Lieu survolé — révèle son nom sur une carte dense (les non-pertinents n'ont pas de cartouche fixe). */
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const here = placeOfScene(map, hereSceneId ?? scene?.id);
  // Gating narratif (#684) : le `ConditionCtx` se fabrique CHEZ L'APPELANT (patron `condCtx`,
  // `bourseFlow.ts`) — `worldMap.ts` reste un lecteur pur, sans accès au store.
  const flags = useGame((s) => s.flags);
  const ctxCond = useMemo(() => condCtx(useGame.getState), [flags, gameTime, party]);
  /** Lieux EXISTANTS : un lieu non révélé n'entre NI dans le rendu, NI dans le cadrage (le zoom le
   *  trahirait autrement en cadrant un vide). Source unique de la liste de lieux de cet écran. */
  const places = useMemo(() => (map ? visiblePlaces(map, ctxCond) : []), [map, ctxCond]);
  const placeVisible = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  /** Routes du lieu courant AVEC leur état — la vue rend aussi les trajets fermés (affordance refusée). */
  const etats = useMemo(() => (map && here ? routesEtat(map, here.id, ctxCond) : []), [map, here, ctxCond]);
  /** Routes PRATICABLES : la logique de voyage (sélection, départ, cadrage cliquable) n'en connaît pas d'autres. */
  const routes = useMemo(() => etats.filter((e) => e.ouverte).map((e) => e.route), [etats]);
  const routesFermees = useMemo(() => etats.filter((e) => !e.ouverte).map((e) => e.route), [etats]);
  /** Routes DESSINÉES depuis ici : praticables ET menant à un lieu EXISTANT — ce que le joueur peut
   *  réellement cliquer. Un tronçon vers un lieu non révélé n'est ni tracé ni médaillé : l'aide de la
   *  colonne se dit sur CETTE liste, jamais sur les routes brutes (elle promettrait un cercle absent). */
  const routesDessinees = useMemo(
    () => (here ? routes.filter((r) => placeVisible.has(otherEnd(r, here.id))) : []),
    [routes, placeVisible, here],
  );

  // Anti-chevauchement : positions de RENDU décluttérées (les `pos` d'authoring restent intacts).
  // Le repère de rendu est celui du viewBox (y aplati par 0.64) → l'écartement travaille dessus.
  const layout = useMemo(() => {
    // Vraie carte de fond ⇒ les lieux restent à leurs `pos` EXACTS (l'auteur les a posés sur la carte) :
    // pas de déchevauchement, qui les décalerait de leur vraie position géographique.
    if (!map || map.background) return new Map<string, { x: number; y: number }>();
    const pts = places.map((p) => ({ id: p.id, x: p.pos.x, y: p.pos.y * 0.64 }));
    return declutterPositions(pts, DECLUTTER_MIN, 80, { w: VB_W, h: VB_H });
  }, [map, places]);
  /** Position de rendu décluttérée d'un lieu (repli sur `pos` brut si absent). */
  const posOf = (p: MapPlace) => layout.get(p.id) ?? { x: p.pos.x, y: p.pos.y * 0.64 };

  // Caméra : à l'ouverture, on part du lieu courant (le voyage démarre d'ici) à un zoom modéré —
  // MAIS cadré pour englober les routes+badges directs (#234 : sinon un badge proche du bord tombe
  // sous la bordure décorative, invisible bien que présent au DOM).
  const hereRender = here ? posOf(here) : { x: VB_W / 2, y: VB_H / 2 };
  /** Lieux/étiquettes de route à garantir visibles au cadrage (ICI + chaque destination directe + le
   *  milieu de sa courbe, où vit le badge de distance). */
  const fitPoints = (): { x: number; y: number }[] => {
    if (!map || !here) return [];
    const pts: { x: number; y: number }[] = [hereRender];
    for (const { route: r } of etats) {
      // Lieu non révélé ⇒ hors cadrage : le zoom ne doit pas trahir ce que la carte ne montre pas.
      const other = placeVisible.get(otherEnd(r, here.id));
      if (!other) continue;
      const po = posOf(other);
      const c = routeCurve(hereRender.x, hereRender.y, po.x, po.y, r.id);
      pts.push(po, { x: c.lx, y: c.ly });
    }
    return pts;
  };
  /** Cadrage initial + cible du bouton « recentrer » de `MapCanvas` (recalculé à chaque clic). */
  const computeFit = (): Viewport => fitViewport(fitPoints(), { ...hereRender, z: 2 });

  if (!map) return null;
  const selRoute: MapRoute | null = routes.find((r) => r.id === selId) ?? null;
  /** Trajet FERMÉ sélectionné : il se consulte (itinéraire, distance) mais son départ est REFUSÉ. */
  const selFerme: MapRoute | null = routesFermees.find((r) => r.id === selId) ?? null;
  const dest: MapPlace | undefined = selRoute && here ? placeVisible.get(otherEnd(selRoute, here.id)) : undefined;
  const destFermee: MapPlace | undefined = selFerme && here ? placeVisible.get(otherEnd(selFerme, here.id)) : undefined;
  const farPlace: MapPlace | undefined = farId ? placeVisible.get(farId) : undefined;

  const selectRoute = (r: MapRoute) => {
    setSelId(r.id);
    setFarId(null);
    const m = r.modes[0] ?? 'pied';
    setMode(m);
    setClasseId('');
    setForced(false);
    setAllure('pas');
    setForceGallop(false);
    setSeaPace(0);
  };
  const pickMode = (m: TravelMode) => {
    setMode(m);
    setClasseId('');
    setAllure('pas');
    setForceGallop(false);
    setSeaPace(0);
  };

  // « En selle » (EDOC 7, règle `travel-allures`) : mode IMPLICITE des routes praticables à pied,
  // quand chaque héros vivant a une monture utilisable.
  const alluresOn = !!rule('travel-allures');
  const mounted = alluresOn && partyFullyMounted(party, possessions);
  const allures = mounted ? availableAllures(partyMounts(party, possessions)) : [];
  const modeChoices: TravelMode[] = selRoute
    ? [...selRoute.modes, ...(mounted && selRoute.modes.includes('pied') ? ['monture'] : [])]
    : [];

  // Traversée MARITIME (routes `sea`, MDG 13/15) : sur le navire de campagne — estimation en milles/jour.
  const vessel = useGame((s) => s.vessel);
  const vesselData = vessel ? findVehicleById(vessel.vehicleId) : undefined;
  const vesselLabel = vessel ? nomDuNavire(vessel) : '';
  // COQUE qui portera l'équipage — la seule chose dont l'épinglage des STATIONS a besoin (ses RÉFS
  // navales gatent `cale`/`nid-de-pie`). Deux porteurs, deux adaptateurs, un seul gate : le navire de
  // campagne en mer, le bateau du trajet sur une route FLUVIALE jouée (même condition qu'au départ,
  // `travelFlow.startTravel`). Pas de coque = pas de panneau : il n'y a nulle part où se tenir.
  const fluvialJoue = !!selRoute && descenteJouee(useGame.getState, selRoute, mode);
  const stationsTraits: NavalTraitRef[] | null = mode === 'mer'
    ? (vessel ? vesselNavalTraits(vessel) : null)
    : (fluvialJoue ? navalTraitsDe(mode, undefined) : null);
  const seaPropulsion = vessel ? garanti(propulsionDuNavire(vessel.vehicleId, vessel.upgrades, 'maritime'), vessel.vehicleId, 'propulsion du navire') : null;
  const seaM = seaPropulsion ? seaPropulsion.m : 0; // MDG 13 l.656, l.674
  // Forcer le rythme : MDG 13 l.95-107, MDG 12 l.311.
  const seaRig = seaPropulsion && seaPropulsion.mode !== 'vapeur' ? { mode: seaPropulsion.mode, competence: seaPropulsion.competence } : null;
  /** Traversée RAPIDE TRANSMISE au départ (MDG 15 l.21-37) : source unique de l'`aria-pressed` du
   *  sélecteur de cadence et des ordres passés à `startTravel`. */
  const fastJoue = mode === 'mer' && seaFast;
  const seaPaceChoices = seaRig ? [0, 1, 2].filter((b) => b === 0 || forcePaceDifficulty(b, seaRig.mode) != null) : [0];
  const seaPaceRefus = seaRig ? forcePaceRefus(party, seaRig.competence) : null;
  // Surcharge de la cale (MDG 12 l.70-75) : >150 % = « Impossible de prendre la mer » → appareillage bloqué.
  const seaOverload = vessel && vesselData?.ship ? cargoOverload(cargoTotalEnc(vessel.cargo ?? []), vesselData.ship.capacity) : null;
  // Population embarquée pour le manifeste d'avitaillement (#245) : héros + effectif PNJ nominal présent.
  const seaCrewCount = vessel ? Math.max(0, (vesselData?.ship?.crew ?? 0) - (vessel.crewLost ?? 0)) : 0;

  // Estimations du trajet sélectionné (mêmes formules que le flux — RAW l.207-224).
  const base = baseHoursPerDay(map);
  const maxH = maxHoursPerDay(map);
  const passengers = party.filter((h) => !h.dead && !h.outOfRencontre).length;
  const effAllure: Allure | undefined = mode === 'monture' ? allure : forceGallop ? 'galop' : undefined;
  const kmh = selRoute ? travelSpeed(party, possessions, mode, selRoute.speed?.[mode], effAllure) : 0;
  const hours = mode === 'pied' && forced ? maxH : mode === 'monture' && forced ? 12 : base;
  const plan = selRoute && kmh > 0 ? travelPlanCalc(selRoute.km, kmh, hours) : null;
  // Le passage payant : MÊME offre et MÊME prix qu'au débit (`travelFlow.startTravel`).
  const offre = selRoute && here && passagePayant(useGame.getState, selRoute, mode)
    ? offreDePassage(map, selRoute, mode, here.id, billetEnMain, marchandagesDeBillet)
    : null;
  const achat = offre && !offre.couvert ? offre : null;
  const classe = achat ? classeRetenue(achat.tarif, classeId) : '';
  const cost = achat ? transportCost(achat.tarif, classe, passengers, achat.issue) : null;
  const affordable = !cost || canAfford(money, cost);
  const rationsOwned = party.reduce((s, h) => s + (h.dead ? 0 : rationCount(h)), 0);
  const rationsNeeded = plan ? Math.max(0, (plan.days - 1) * passengers) : 0; // les nuits en route mangent

  // Avitaillement au départ EN MER (#241) : le groupe qui appareille sans vivres/eau le SAIT.
  const seaDaysEstimated = mode === 'mer' && selRoute && seaM > 0 ? Math.max(1, Math.ceil(selRoute.km / (18 * seaM))) : 0;
  const provisions = mode === 'mer' && seaDaysEstimated > 0 ? provisioningManifest(party, vessel?.waterLitres, seaDaysEstimated, { count: seaCrewCount, provisions: vessel?.provisions }) : null;

  const libelleDepart = t(mode === 'mer' && provisions && !provisions.suffisant ? 'wm.appareillerQuandMeme' : achat ? 'wm.payerEtPartir' : 'wm.partir');
  const fmtDuration = (p: NonNullable<typeof plan>) =>
    p.days <= 1 ? t('wm.dureeHeures', { h: Math.max(1, Math.round(p.travelMinutes / 60)) }) : t('wm.dureeJours', { jours: p.days, h: hours });

  // Reprise d'un voyage interrompu.
  const resumeDest = travelPlan?.interrupted ? placeById(map, travelPlan.toPlaceId) : undefined;
  const resumeRoute = travelPlan ? map.routes.find((r) => r.id === travelPlan.routeId) : undefined;

  // ── Habillage + contenu data-driven de la carte (`MapCanvas`) ────────────────────────────────
  // Chrome FIXE plein-cadre (parchemin, cadre orné, `<defs>`) — jamais zoomé/cliquable.
  const chrome = (
    <>
      <defs>
        <radialGradient id="wm-parch" cx="50%" cy="40%" r="78%">
          <stop offset="0%" stopColor="#efe1bb" />
          <stop offset="70%" stopColor="#dcc78f" />
          <stop offset="100%" stopColor="#c2a466" />
        </radialGradient>
        {/* Vignettage : bords ombrés (vieillissement) */}
        <radialGradient id="wm-vignette" cx="50%" cy="48%" r="62%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#3a2a12" stopOpacity="0.42" />
        </radialGradient>
        {/* Grain papier */}
        <filter id="wm-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
        {/* Ombre douce des médaillons */}
        <filter id="wm-drop" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0.5" stdDeviation="0.5" floodColor="#000" floodOpacity="0.35" />
        </filter>
        <radialGradient id="wm-medal" cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#f4e8c6" />
          <stop offset="100%" stopColor="#d2b87e" />
        </radialGradient>
        {/* Coins arrondis pour la carte de fond (mêmes rayon/cadre que le parchemin). */}
        <clipPath id="wm-frame-clip"><rect x="0" y="0" width="100" height="64" rx="2.5" /></clipPath>
      </defs>
      {/* Parchemin + grain + vignette */}
      <rect x="0" y="0" width="100" height="64" rx="2.5" fill="url(#wm-parch)" />
      <rect x="0" y="0" width="100" height="64" rx="2.5" filter="url(#wm-grain)" opacity="0.06" />
      {/* Taches d'âge (déterministes) */}
      <ellipse cx="22" cy="14" rx="6" ry="3.4" fill="var(--wm-age-spot)" opacity="0.06" />
      <ellipse cx="80" cy="50" rx="7" ry="4" fill="var(--wm-age-spot)" opacity="0.05" />
      <ellipse cx="60" cy="9" rx="4" ry="2.6" fill="var(--wm-age-spot)" opacity="0.05" />
      <rect x="0" y="0" width="100" height="64" rx="2.5" fill="url(#wm-vignette)" />
      {/* Cadre orné : filet brun épais + filet or fin + fleurons aux angles */}
      <rect x="1.4" y="1.4" width="97.2" height="61.2" rx="2" fill="none" stroke="var(--wm-frame-dark)" strokeWidth="1.3" />
      <rect x="3.1" y="3.1" width="93.8" height="57.8" rx="1.4" fill="none" stroke="var(--wm-frame-gold)" strokeWidth="0.4" />
      {[[5, 6.6], [95, 6.6], [5, 60], [95, 60]].map(([fx, fy], i) => (
        <text key={i} x={fx} y={fy} textAnchor="middle" fontSize="4" fill="var(--wm-fleuron)" opacity="0.8">⚜</text>
      ))}
    </>
  );

  // Routes (chemins courbes) — CLIQUABLES depuis le lieu courant (large zone invisible via MapCanvas).
  const mapPaths: MapPath[] = map.routes.flatMap((r) => {
    // Extrémités prises dans les lieux EXISTANTS : un tronçon vers un lieu non révélé le trahirait.
    const a = placeVisible.get(r.a);
    const b = placeVisible.get(r.b);
    if (!a || !b) return [];
    const pa = posOf(a), pb = posOf(b);
    const c = routeCurve(pa.x, pa.y, pb.x, pb.y, r.id);
    const sel = r.id === selId;
    const etat = etats.find((e) => e.route.id === r.id);
    const fromHere = !!etat && etat.ouverte;
    // Trajet fermé partant d'ici : VISIBLE et cliquable (il se consulte), mais le départ est refusé.
    const fermee = !!etat && !etat.ouverte;
    const water = r.modes.includes('barge') && !r.modes.includes('pied');
    return [{
      id: r.id,
      d: c.d,
      onClick: fromHere || fermee ? () => selectRoute(r) : undefined,
      cursor: fermee ? 'help' : undefined,
      children: (view: Viewport) => (
        <>
          <path
            d={c.d}
            fill="none"
            stroke={sel ? 'var(--accent)' : fromHere ? '#6d4f24' : '#9b8255'}
            strokeWidth={sel ? 1.4 : 0.9}
            strokeLinecap="round"
            strokeDasharray={water ? '0.6 2.4' : '2.4 1.7'}
            opacity={fermee ? 0.45 : sel || fromHere ? 1 : 0.7}
            pointerEvents="none"
            vectorEffect="non-scaling-stroke"
          />
          {/* Étiquette de distance — taille écran CONSTANTE (scale 1/z), et seulement pour les routes
              partant d'ICI (celles qu'on peut prendre) : les autres restent des traits propres. */}
          {fromHere && (
            <g transform={`translate(${c.lx} ${c.ly}) scale(${1 / view.z})`}>
              <rect x="-5" y="-2" width="10" height="3" rx="1.5" fill="var(--wm-badge-bg)" opacity="0.88" />
              <text y="0.15" textAnchor="middle" fontSize="2.1" fill="var(--wm-ink)">
                {routeDistanceLabel(r.km, r.sea)}
              </text>
              {/* Badge de mode : barque (voie d'eau) / compas (route carrossable). */}
              {r.modes.some((mm) => mm !== 'pied') && (
                <g style={{ color: 'var(--wm-ink)' }}>
                  <IconG id={water ? 'scenario/naval' : 'scenario/travel'} x={5.4} y={-1.35} size={2.5} />
                </g>
              )}
            </g>
          )}
        </>
      ),
    }];
  });

  // Lieux (médaillons). Affordance : destination RELIÉE = anneau accent pointillé + curseur ; lieu hors
  // d'atteinte = estompé, le clic EXPLIQUE (panneau bas). Taille écran constante (MapCanvas `scale(1/z)`).
  const mapMarkers: MapMarker[] = places.map((p) => {
    const isHere = here?.id === p.id;
    const isDest = dest?.id === p.id;
    const route = here ? routes.find((r) => otherEnd(r, here.id) === p.id) : undefined;
    // Destination que SEUL un trajet fermé dessert : le lieu reste à l'écran, son clic dit pourquoi.
    const routeFermee = here && !route ? routesFermees.find((r) => otherEnd(r, here.id) === p.id) : undefined;
    const clickable = !!route;
    const pr = posOf(p);
    return {
      id: p.id,
      x: pr.x,
      y: pr.y,
      selected: isHere || isDest,
      onClick: clickable
        ? () => selectRoute(route!)
        : routeFermee
          ? () => selectRoute(routeFermee)
          : !isHere ? () => { setSelId(null); setFarId(p.id); } : undefined,
      label: p.label,
      onHover: (h: boolean) => setHoveredId((cur) => (h ? p.id : cur === p.id ? null : cur)),
      cursor: clickable ? 'pointer' : !isHere ? 'help' : undefined,
      opacity: clickable || isHere ? 1 : 0.55,
      children: (
        <>
          {/* cible de clic/survol généreuse (taille écran constante) */}
          <circle r="3.4" fill="transparent" />
          {isHere && <text y="-2.6" textAnchor="middle" fontSize="1.5" fontWeight={700} fill="var(--ok)">{t('wm.vousEtesIci')}</text>}
          {/* Sélection = anneau OR (charte-ui : `--gold` réservé aux bordures/focus, jamais `--accent`,
              action primaire) — langage UNIQUE partagé avec le plan du hub (`CityHubScreen`, #362). */}
          {(isHere || isDest) && (
            <circle r="2.1" fill="none" stroke={isHere ? 'var(--ok)' : 'var(--gold)'} strokeWidth="0.4" opacity="0.95" />
          )}
          {clickable && !isDest && (
            <circle r="2.1" fill="none" stroke="var(--accent)" strokeWidth="0.3" strokeDasharray="0.7 0.55" opacity="0.9" />
          )}
          <circle r="1.5" fill="url(#wm-medal)" stroke="var(--wm-age-spot)" strokeWidth="0.22" filter="url(#wm-drop)" />
          {/* `p.icon` = id d'icône (registre src/ui/icons) ; sans icône, drapeau de lieu. */}
          <g style={{ color: 'var(--wm-marker-icon)' }}>
            <IconG id={p.icon ?? 'nav/entry-point'} x={-1.05} y={-1.05} size={2.1} />
          </g>
        </>
      ),
    };
  });

  // Cartouches de nom — peints APRÈS les médaillons (donc AU-DESSUS de tous). Sur une carte dense,
  // seuls les lieux PERTINENTS sont nommés en permanence (position courante + destinations reliées) ;
  // les autres révèlent leur nom au SURVOL. `pointer-events:none` : ne vole pas le survol du médaillon.
  const mapOverlay = (view: Viewport) => (
    <>
      {places.map((p) => {
        const isHere = here?.id === p.id;
        // Un trajet FERMÉ nomme quand même sa destination : le joueur doit savoir OÙ il ne peut plus aller.
        const clickable = here
          ? etats.some((e) => otherEnd(e.route, here.id) === p.id)
          : false;
        const hovered = hoveredId === p.id;
        if (!isHere && !clickable && !hovered) return null;
        const w = Math.max(8, p.label.length * 1.15 + 3);
        const pr = posOf(p);
        return (
          <g key={`lbl-${p.id}`} transform={`translate(${pr.x} ${pr.y}) scale(${1 / view.z})`} style={{ pointerEvents: 'none' }}>
            <g transform="translate(0 3.6)">
              <rect x={-w / 2} y="-1.9" width={w} height="3" rx="1.5" fill="var(--wm-cartouche-bg)" opacity={0.9} stroke={hovered && !isHere && !clickable ? 'var(--gold2)' : 'none'} strokeWidth="0.2" />
              <text y="0.25" textAnchor="middle" fontSize="2.1" fontWeight={isHere ? 700 : 500} fill="var(--wm-cartouche-fg)">{p.label}</text>
            </g>
          </g>
        );
      })}
      <CompassRose x={13} y={52} />
    </>
  );

  return (
    <ScreenShell title={<><Icon id="nav/campaign" size="sm" /> {map.label}</>} onClose={close} meta={{ time: gameTime, money }}>
      <Split side="end" align="stretch" stackBelow={900} gap="xl" pad="xl" className="screen-scroll worldmap-layout">
      <div className="worldmap-canvas">
        <MapCanvas
          className="wm-map"
          ariaLabel={map.label}
          computeFit={computeFit}
          background={map.background}
          chrome={chrome}
          paths={mapPaths}
          markers={mapMarkers}
          overlay={mapOverlay}
          refitAt={places.length}
        />
      </div>

      <aside className="worldmap-side">
      {/* Voyage interrompu : reprise */}
      {travelPlan?.interrupted && resumeDest && (
        <div className="worldmap-panel">
          <p>
            {t('wm.voyageVers')} <b>{resumeDest.label}</b>{' '}
            {t('wm.interrompu', {
              suite: Math.round(travelPlan.km - travelPlan.kmDone) > 0
                ? t('wm.restants', { distance: routeDistanceLabel(travelPlan.km - travelPlan.kmDone, resumeRoute?.sea) })
                : t('wm.auxPortes', { lieu: resumeDest.label }),
            })}
          </p>
          <Row justify="end">
            <GatedAction
              id="worldmap-resume"
              label={`▶ ${t('wm.reprendre')}`}
              ariaLabel={t('wm.reprendre')}
              enabled={!isGuest}
              reason={t('wm.hoteDecide')}
              onClick={resumeTravel}
            />
          </Row>
        </div>
      )}

      {/* Panneau de départ */}
      {!travelPlan?.interrupted && selRoute && dest && here && (
        <div className="worldmap-panel">
          <div className="wm-trip">
            <span className="wm-trip-route"><b>{here.label}</b> <span className="wm-arrow">→</span> <b>{dest.label}</b> · {routeDistanceLabel(selRoute.km, selRoute.sea)}</span>
            {/* Choix du MODE de voyage = un état, pas une action — segmented control (#362 : « En mer »
                stylé `.btn-primary` concurrençait visuellement « Partir »). */}
            <OptionChooser
              layout="seg"
              options={modeChoices.map((m) => ({
                key: m,
                label: travelModeLabels()[m],
                selected: mode === m,
                content: <><Icon id={travelModeIcon(m)} /> {travelModeLabels()[m]}</>,
                onSelect: () => pickMode(m),
              }))}
            />
          </div>
          {mode === 'pied' && (
            <label className="wm-opt" title={t('wm.marcheForceeTitre', { max: maxH, base })}>
              <input type="checkbox" checked={forced} onChange={(e) => setForced(e.target.checked)} />
              <span>{t('step.marcheForcee')} <span className="wm-opt-hint">{t('wm.heuresParJour', { h: maxH })}</span></span>
            </label>
          )}
          {mode === 'monture' && (
            <>
              {/* Allure (EDOC 07 l.140-144) : vitesse ET endurance des bêtes en dépendent. */}
              <div className="wm-modes">
                {allures.map((a) => (
                  <button key={a} type="button" className="btn small" aria-pressed={allure === a} onClick={() => setAllure(a)}>
                    {allureLabel(a)}
                  </button>
                ))}
              </div>
              <label className="wm-opt" title={t('wm.longueJourneeTitre')}>
                <input type="checkbox" checked={forced} onChange={(e) => setForced(e.target.checked)} />
                <span>{t('wm.longueJournee')} <span className="wm-opt-hint">{t('wm.heuresParJour', { h: 12 })}</span></span>
              </label>
            </>
          )}
          {offre?.couvert && (
            <p className="wm-est">{t('wm.billetPaye', {
              lieu: placeById(map, offre.arriveeId)?.label ?? offre.arriveeId,
              classe: vehicleTravel(mode)?.classes.find((c) => c.id === offre.classeId)?.label ?? offre.classeId,
            })}</p>
          )}
          {achat && (
            <>
              <p className="wm-est">{t('wm.billetJusqua', { lieu: placeById(map, achat.arriveeId)?.label ?? achat.arriveeId, km: achat.km })}</p>
              <OptionChooser
                layout="seg"
                groupLabel={t('wm.prixParPlace')}
                options={(vehicleTravel(mode)?.classes ?? [])
                  .filter((c) => achat.tarif.prix[c.id] != null)
                  .sort((x, y) => achat.tarif.prix[x.id]! - achat.tarif.prix[y.id]!)
                  .map((c) => {
                    const prix = fromBrass(prixParPassager(achat.tarif, c.id, achat.issue));
                    return {
                      key: c.id,
                      label: c.label,
                      ariaLabel: t('wm.classePrix', { label: c.label, prix: formatMoney(prix) }),
                      selected: classe === c.id,
                      content: <>{c.label} <Coins money={prix} /></>,
                      onSelect: () => setClasseId(c.id),
                    };
                  })}
              />
              {achat.vendeurPresetId && (
                <Row justify="start">
                  <GatedAction
                    id="worldmap-marchander-billet"
                    label={t('wm.marchander')}
                    enabled={!isGuest && !achat.issue}
                    reason={isGuest ? t('wm.hoteDecide') : t('wm.marchandageFait')}
                    onClick={() => startBilletBargain(selRoute.id, mode)}
                    primary={false}
                    btnClassName="small"
                  />
                </Row>
              )}
            </>
          )}
          {((mode === 'mer' && vessel && seaM > 0) || fluvialJoue) && (
            <div className="wm-modes">
              <button
                type="button"
                className="btn small"
                aria-pressed={!fastJoue && cadence === 'commande'}
                onClick={() => { setSeaFast(false); setCadence('commande'); }}
                title={t(fluvialJoue ? 'wm.cadenceCommandeFleuve' : 'wm.cadenceCommandeMer')}
              >
                {t(fluvialJoue ? 'wm.descenteCommandee' : 'wm.traverseeCommandee')}
              </button>
              <button
                type="button"
                className="btn small"
                aria-pressed={!fastJoue && cadence === 'jour-par-jour'}
                onClick={() => { setSeaFast(false); setCadence('jour-par-jour'); }}
                title={t(fluvialJoue ? 'wm.cadenceJourParJourFleuve' : 'wm.cadenceJourParJourMer')}
              >
                {t('wm.jourParJour')}
              </button>
              {mode === 'mer' && (
                <button
                  type="button"
                  className="btn small"
                  aria-pressed={fastJoue}
                  onClick={() => { setSeaFast(true); setSeaPace(0); }}
                  title={t('wm.traverseeRapide')}
                >
                  {t('wm.traverseeRapideAction')}
                </button>
              )}
            </div>
          )}
          {mode === 'mer' && vessel && seaRig && seaM > 0 && !fastJoue && seaPaceChoices.length > 1 && (
            <div className="wm-modes">
              {seaPaceChoices.map((b) => {
                const diff = b ? forcePaceDifficulty(b, seaRig.mode) : null;
                const refus = b ? seaPaceRefus : null;
                return (
                  <GatedAction
                    key={b}
                    id={`wm-sea-pace-${b}`}
                    label={b === 0 ? t('wm.rythmeNormal') : t('wm.forcerRythme', { bonus: b })}
                    ariaPressed={seaPace === b}
                    enabled={!refus}
                    {...raisonSi(refus)}
                    descOfferte={b && diff
                      ? t('wm.rythmeForceTitre', { de: deElide(skillInstanceLabel(seaRig.competence)), difficulte: DIFFICULTY_LABELS[diff], bonus: b })
                      : t('wm.rythmeConception')}
                    onClick={() => setSeaPace(b)}
                    primary={false}
                    btnClassName="small"
                  />
                );
              })}
            </div>
          )}
          {alluresOn && vehicleTravel(mode)?.draft && (
            <label className="wm-opt" title={t('wm.forcerAllureTitre')}>
              <input type="checkbox" checked={forceGallop} onChange={(e) => setForceGallop(e.target.checked)} />
              <span>{t('wm.forcerAllure')} <span className="wm-opt-hint">{t('wm.pasDeCourse')}</span></span>
            </label>
          )}
          <p className="wm-est">
            {mode === 'mer' ? (
              vessel && seaM > 0 ? (
                // 18 milles/jour par point de M (MDG 15 l.57-70) — le vent et les Tests d'équipage
                // de Progression (±10 %/DR) modulent chaque journée.
                <><Icon id="scenario/port" size="sm" /> {t('wm.estimationMer', { navire: vesselLabel, milles: 18 * seaM, m: seaM, tenu: seaPace ? t('wm.siRythmeTenu', { milles: 18 * (seaM + seaPace) }) : '', jours: Math.max(1, Math.ceil(selRoute.km / (18 * seaM))) })}</>
              ) : (
                <>{t('wm.aucunNavire')}</>
              )
            ) : kmh > 0 ? (
              <>
                {t('wm.allureDuree', { kmh, duree: plan ? fmtDuration(plan) : '—' })}
                {cost && <>{t('wm.total', { places: placesPayees(passengers), s: placesPayees(passengers) > 1 ? 's' : '' })}<Coins money={cost} />{!affordable && t('wm.bourseInsuffisante')}</>}
                {mode === 'pied' && plan && plan.days > 1 && (
                  <>{t('wm.rations', { besoin: rationsNeeded, porte: rationsOwned })}</>
                )}
              </>
            ) : (
              <>{t('wm.surcharge')}</>
            )}
          </p>
          {mode === 'mer' && provisions && (
            <div className="wm-provision">
              <span className={`wm-provision-item ${provisions.rationsDispo < provisions.rationsRequises ? 'short' : ''}`}>
                <Icon id="scenario/port" size="sm" /> {t('wm.vivres', { dispo: provisions.rationsDispo, requis: provisions.rationsRequises })}
              </span>
              <span className={`wm-provision-item ${provisions.eauDispoLitres != null && provisions.eauDispoLitres < provisions.eauRequiseLitres ? 'short' : ''}`}>
                {t('wm.eau', { dispo: provisions.eauDispoLitres != null ? t('wm.litres', { litres: provisions.eauDispoLitres }) : '—', requis: provisions.eauRequiseLitres })}
              </span>
              {!provisions.suffisant && <span className="wm-provision-item short">{t('wm.avitaillementInsuffisant', { jours: provisions.joursEstimes, ames: provisions.souls })}</span>}
              {seaOverload?.palierId && <span className="wm-provision-item short">{t('wm.caleSurchargee', { pct: seaOverload.ratioPct, palier: seaOverload.label, suite: seaOverload.canSail ? t('wm.caleEffets', { m: seaOverload.mMod, dr: seaOverload.manoeuvreDR }) : t('wm.caleImpossible') })}</span>}
            </div>
          )}
          {mode === 'mer' && vessel ? <ShipRolesPanel /> : rule('travel-etapes') && <TravelRolesPanel />}
          {/* STATIONS à bord, EMPILÉES sous les postes (maquette validée 2026-09-04) : partout où un
              bateau porte l'équipage — le navire de campagne en mer, et le bateau du trajet FLUVIAL
              (même gate qu'au départ, `travelFlow.startTravel`). Le fleuve n'a PAS de roster de
              postes d'équipage (MSRC 7 ne connaît ni rôles MDG ni Moral) : les stations y sont
              seules, et c'est ce que le livre demande. */}
          {stationsTraits && <ShipStationsPanel traits={stationsTraits} />}
          <Row justify="end">
            <button type="button" className="btn" onClick={() => setSelId(null)}>{t('wm.annuler')}</button>
            {/* Les provisions insuffisantes n'entrent PAS dans le refus : le départ reste PERMIS, et
                c'est le LIBELLÉ qui porte l'alerte (« Appareiller quand même »). `GatedAction` ne rend
                sa raison que sur une action FERMÉE (#1689 T2). */}
            <GatedAction
              id="worldmap-depart"
              label={<><Icon id="scenario/travel" size="sm" /> {libelleDepart}</>}
              ariaLabel={libelleDepart}
              enabled={!isGuest && (mode === 'mer'
                ? !!vessel && seaM > 0 && !(seaOverload != null && !seaOverload.canSail)
                : kmh > 0 && affordable)}
              reason={isGuest ? t('wm.hoteDecide')
                : mode === 'mer' && (!vessel || seaM <= 0) ? t('wm.aucunNavire')
                : mode === 'mer' ? t('wm.refusCale', { pct: seaOverload?.ratioPct ?? 0 })
                : kmh <= 0 ? t('wm.refusSurcharge')
                : t('wm.refusBourse', { prix: cost ? formatMoney(cost) : '' })}
              onClick={() => startTravel(selRoute.id, mode, {
                classeId: classe || undefined,
                hoursPerDay: forced ? (mode === 'pied' ? maxH : mode === 'monture' ? 12 : undefined) : undefined,
                allure: effAllure,
                seaPace: mode === 'mer' && !fastJoue && seaPace > 0 ? seaPace : undefined,
                fast: fastJoue ? true : undefined,
                cadence: (mode === 'mer' && !fastJoue) || fluvialJoue ? cadence : undefined,
              })}
            />
          </Row>
        </div>
      )}

      {/* Trajet FERMÉ (gating narratif #684) : l'itinéraire reste lisible, le départ porte son REFUS —
          `GatedAction` pose la raison au survol/focus/tap et en copie hors écran (`aria-describedby`). */}
      {!travelPlan?.interrupted && selFerme && destFermee && here && (
        <div className="worldmap-panel">
          <div className="wm-trip">
            <span className="wm-trip-route"><b>{here.label}</b> <span className="wm-arrow">→</span> <b>{destFermee.label}</b> · {routeDistanceLabel(selFerme.km, selFerme.sea)}</span>
          </div>
          <Row justify="end">
            <button type="button" className="btn" onClick={() => setSelId(null)}>{t('wm.annuler')}</button>
            <GatedAction
              id={`wm-route-fermee-${selFerme.id}`}
              label={<><Icon id="scenario/travel" size="sm" /> {t('wm.partir')}</>}
              ariaLabel={t('wm.partirVers', { lieu: destFermee.label })}
              enabled={false}
              reason={mdToText(nommer(garanti(selFerme.refus, selFerme.id, 'raison du trajet fermé (`mapRouteSchema`)').texte, identites))}
              onClick={() => {}}
            />
          </Row>
        </div>
      )}

      {!travelPlan?.interrupted && !selRoute && !selFerme && (
        <div className="worldmap-panel muted-panel">
          <p>
            {farPlace && here
              ? t('wm.aucuneRouteDirecte', { lieu: farPlace.label, ici: here.label })
              : here
                ? routesDessinees.length
                  ? t('wm.cliquezDestination')
                  : t('wm.aucuneRoute')
                : t('wm.horsCarte')}
          </p>
        </div>
      )}

      {pendingDeparture && !isGuest && (
        <div className="worldmap-panel" role="alertdialog" aria-label={t('wm.departDeNuit')}>
          <p>
            {t('wm.nuitTombee', {
              mode: t(pendingDeparture.mode === 'monture' ? 'wm.nuitEnSelle' : pendingDeparture.mode === 'pied' ? 'wm.nuitAPied' : 'wm.nuitFleuve'),
              aube: formatImperial(pendingDeparture.dawnAt),
            })}
          </p>
          <div className="bar">
            <button className="btn btn-primary" onClick={departWaitDawn}>{t('wm.attendreAube')}</button>
            <button className="btn" onClick={departCancel}>{t('wm.annuler')}</button>
          </div>
        </div>
      )}
      </aside>
      </Split>
    </ScreenShell>
  );
}
