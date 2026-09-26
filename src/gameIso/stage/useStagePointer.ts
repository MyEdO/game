/**
 * Pointeur du stage iso :
 *  - `pickVerdict` : écran → VERDICT (case d'ancrage + nature + identité, `pickResolve.ts`). Ce hook
 *    n'y apporte que les COORDONNÉES du `PointerEvent` React
 *    (`ev.clientX/clientY`) et interroge la voie de rendu (`targetUnderPointer` : `elementFromPoint`
 *    en affine, lancer de rayon en volumique). L'inversion du pixel (`pointStageSousPixel`) comme la
 *    CHAÎNE de résolution — rayon, meuble dessiné, pas inter-étages, case marchable, sol cross-couche
 *    — sont `stage/pickResolve.ts`, que la sonde de recette (`stage/pickProbe.ts`) appelle aussi :
 *    une seule règle, deux porteurs, aucun étage propre à l'un des deux ; l'ENTITÉ que ce verdict fait
 *    traiter (et celle que l'affordance annonce) est `stage/geste.ts`, que la sonde appelle aussi ;
 *  - glisser-caméra (seuil PAN_THRESHOLD, l'action de clic est DIFFÉRÉE au relâchement) — bouton
 *    principal : panoramique posé HORS de React (`state/stagePan`, un battement de frame par
 *    mouvement) et commis au store en UN `set` au relâchement ; bouton MILIEU : lacet libre de la vue ;
 *  - TACTILE à DEUX DOIGTS : pincer = zoom (`setZoom`, borné par le store), translation du milieu des
 *    doigts = panoramique. Un seul pointeur garde strictement le comportement ci-dessus ;
 *  - `performClick` : sélection / cible / déplacement (combat et exploration) ;
 *  - `moveAlong` : marche pas-à-pas du groupe (sauts par-dessus les gouffres compris) ;
 *  - clic droit : attaque la plus PERTINENTE sur l'ennemi survolé (scoreur partagé avec l'IA) ;
 *  - suivi du SURVOL borné aux changements de tuile (curseur main sur l'interactif).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useGame } from '../../state/store';
import { toggleDoorIn } from '../../state/scene';
import { entityBlockedAt } from '../../state/sceneRules';
import { ficheDEntite } from '../../state/sceneNpc';
import { chebyshev, walkNeighbors, type Pt } from '../../state/path';
import { aPorteeDe, exploreMovePlan, exploreSeatPlan, mouvementDuGroupe, optionsDeCheminDuGroupe, type ExploreMovePlan, type PathOpts } from '../../state/exploreNav';
import { placesJouables, RANG_MENEUR, seatPoseOf } from '../../state/seating';
import { meneurDuMonde } from '../../state/combatants';
// `t` est déjà le nom local de la TUILE survolée dans ce module : la traduction s'y importe sous son
// rôle, sans rebaptiser trente sites de pointeur.
import { t as message } from '../../i18n';
import { planJump } from '../../state/jumpMove';
import { runFlow, jouerFlowEntier } from '../../state/combatEffects';
import { Combatant } from '../../engine/types';
import { bus, EVT } from '../../state/bus';
import { combatantAtTile } from '../../state/combatGeometry';
import { controlsActive } from '../../state/netOwnership';
import { SENSIBILITE_DRAG_DEG_PX, getStageYaw, poserYaw } from '../../state/stageYaw';
import { accordsPan, getStagePan, poserPan } from '../../state/stagePan';
import { battreStageFrames } from './stageFrames';
import { combatantClickActs } from '../../state/combatOrParty';
import { hoverClickCommits } from '../../ui/pointerCaps';
import { bestAttack } from '../../state/attackRelevance';
import { type Dims } from '../../geometry/iso';
import { STEP_MS } from '../../geometry/walk';
import { poseFromDims } from './projection';
import { targetUnderPointer } from './spritePicker';
import { pointStageSousPixel, pointViewBoxSousPixel, resoudrePixel, tireLeRayon, type Verdict } from './pickResolve';
import { armeParSurvol, entiteDuGeste, jouerArete, type VerbesArete } from './geste';
import { actionsDe, estUtilisable } from '../../state/usable';
import { porteDOffre } from '../../state/offresUtilisables';
import type { RoomPortal } from '../../state/roomPortals';
import type { AreteUtilisable } from '../../state/aretes';
import type { AreteProjetee } from './aretesProjetees';

const PAN_THRESHOLD = 6; // px de glissement avant de passer en panoramique (sinon = clic)

export interface StagePointer {
  /** Tuile survolée (tooltip + réticule de visée ; suivie dans tous les modes de ciblage). */
  hover: Pt | null;
  /** L'ENTITÉ UTILISABLE sous le curseur (#1687), `null` sinon : celle que le clic traiterait
   *  (`entiteDuGeste` + `estUtilisable`), source unique du halo renforcé et de sa plaque de nom. */
  entiteSurvolee: string | null;
  /** L'arête SURVOLÉE, quel qu'en soit le canal (pixel ou focus clavier) : source unique de l'accent
   *  du peintre et de l'armement du geste. */
  areteSurvolee: AreteUtilisable | null;
  /** LE geste d'une arête — celui que le verdict de pixel déclenche ET celui que le clavier du peintre
   *  appelle (`stage/AreteOverlay.tsx`), la MÊME fonction, jamais deux chemins d'activation. Le clic
   *  qui l'atteint est CONSOMMÉ (`stage/geste.ts`). */
  activerArete: (arete: AreteUtilisable) => void;
  /** SURVOL d'une arête par le clavier (focus du peintre), `null` au blur. Il pose le MÊME état que le
   *  survol au pointeur (`areteSurvolee`) : sans lui, une arête atteinte au Tab n'a aucun rendu, et sur
   *  un appareil sans survol il faudrait deux Entrée. */
  survolerArete: (arete: AreteUtilisable | null) => void;
  handlers: {
    onPointerDown: (ev: React.PointerEvent) => void;
    onPointerMove: (ev: React.PointerEvent) => void;
    onPointerUp: (ev: React.PointerEvent) => void;
    onPointerCancel: (ev: React.PointerEvent) => void;
    onPointerLeave: () => void;
    onContextMenu: (ev: React.MouseEvent) => void;
  };
}

export function useStagePointer({
  svgRef,
  dims,
  zoom,
  camRef,
  hoverTracking,
  partyLeader,
  activeZ = 0,
  aretes,
}: {
  svgRef: RefObject<SVGSVGElement>;
  dims: Dims;
  zoom: number;
  /** Caméra du RENDU COURANT (réf mise à jour par l'hôte du monde après le calcul du focal — les handlers
   *  lisent la valeur au moment de l'événement, comme la closure historique). */
  camRef: RefObject<{ x: number; y: number }>;
  hoverTracking: boolean;
  partyLeader: Combatant | undefined;
  activeZ?: number;
  /** ARÊTES utilisables projetées que l'hôte a filtrées et posées à l'écran
   *  (`stage/aretesProjetees.ts`) — l'entrée de l'étage `arete` de la chaîne, comme `vise` est celle
   *  du rayon. */
  aretes: readonly AreteProjetee[];
}): StagePointer {
  const setCamPan = useGame((s) => s.setCamPan);
  const [hover, setHover] = useState<Pt | null>(null);
  const [areteSurvolee, setAreteSurvolee] = useState<AreteUtilisable | null>(null);
  // ENTITÉ SOUS LE CURSEUR (#1687) : celle que le clic traiterait (`entiteDuGeste`), publiée telle quelle
  // — le halo et la plaque de nom du survolé n'ont ainsi pas de second résolveur à tenir. État à part
  // de `hover` : une même tuile peut changer d'entité (décor épuisé), et l'id ne bouge pas à chaque pixel.
  const [entiteSurvolee, setEntiteSurvolee] = useState<string | null>(null);
  const movingRef = useRef(false);
  // Glisser-caméra : on diffère l'action de clic au relâchement ; un glissement > seuil = panoramique.
  // La BASE du panoramique (`pan0` + le point de viewBox `vbX/vbY` + le zoom + le n° d'accord du
  // décalage vivant) se re-pose dès qu'une de ses hypothèses bouge sous le geste : un recentrage
  // (`resetCamPan`) ou un cran de molette. Sans elle, le delta CUMULÉ serait ré-échelonné par le
  // nouveau zoom, et le relâchement contredirait le recentrage.
  const dragRef = useRef<{ sx: number; sy: number; vbX: number; vbY: number; panned: boolean; button: number; verdict: Verdict | null; yaw0: number; pan0: { x: number; y: number }; zoom0: number; accord0: number } | null>(null);
  // Pointeurs ACTIFS sur le stage, par `pointerId` — c'est leur NOMBRE qui distingue les deux régimes
  // du tactile : un doigt = le glisser historique (`dragRef`), deux = le PINCER (zoom + panoramique).
  // `pinchRef` porte l'état du geste à deux doigts (écart et milieu du dernier échantillon).
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number; accord0: number } | null>(null);

  /** L'UTILISABLE que ce verdict désigne, ou `null` : le résolveur du CLIC (`entiteDuGeste`) suivi du
   *  dériveur UNIQUE de l'offre (`estUtilisable`). Le survol ne peut pas annoncer autre chose que ce
   *  que le clic ferait — c'est la même question, posée une image plus tôt. */
  const utilisableSous = (v: Verdict, t: Pt | null): string | null => {
    const st = useGame.getState();
    const sc = st.scene;
    const e = sc && t ? entiteDuGeste(sc, v, t) : undefined;
    return sc && e && estUtilisable(sc, e, st.flags) ? e.id : null;
  };

  // Recette (DEV) : pilotage PROGRAMMATIQUE du survol — __wfrp.hover('id') passe par ce hook,
  // le tooltip/réticule se rendent sans souris réelle (pas de chasse aux pixels). Sans pixel, pas de
  // rayon : la question devient celle de la CASE, et c'est la branche que `entiteDuGeste` tranche déjà.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __wfrpSetHover?: (t: Pt | null) => void };
    w.__wfrpSetHover = (t) => {
      setHover(t);
      setEntiteSurvolee(utilisableSous({ tile: t ? { x: t.x, y: t.y, z: t.z ?? 0 } : null, cid: null, via: 'aucune', nature: 'case' }, t));
    };
    return () => { delete w.__wfrpSetHover; };
  }, []);

  // POSE de projection du rendu courant : les trois chemins d'inversion ci-dessous lisent la MÊME
  // géométrie que le peintre, quelle que soit la voie.
  const pose = poseFromDims(dims);

  /** Point de PROJECTION du stage sous le pixel de l'événement — l'inversion partagée
   *  (`pickResolve.ts:pointStageSousPixel`), à la caméra et au zoom du RENDU COURANT. */
  const stagePointOf = (ev: React.PointerEvent): { x: number; y: number } | null =>
    pointStageSousPixel(svgRef.current, ev.clientX, ev.clientY, camRef.current!, zoom);

  // Picking SPRITE-aware : si un TOKEN (ou un décor volumique) est réellement dessiné sous le curseur,
  // on cible SA tuile — pas la tuile « derrière » le sprite (ancré au-dessus de sa case en iso, d'où
  // l'ancienne « chasse aux pieds »). Le hit-test lui-même appartient à la VOIE DE RENDU
  // (`targetUnderPointer` : `elementFromPoint` en affine, lancer de rayon en volumique) — l'empilement
  // s'y tranche, de la seule façon que la voie sait trancher.
  //
  // La CHAÎNE ELLE-MÊME (condition de tir, nature nommée, inversion du pixel, meuble dessiné, pas
  // inter-étages, case marchable, sol cross-couche) vit en UN lieu : `stage/pickResolve.ts`, que la
  // sonde de recette (`stage/pickProbe.ts`) appelle aussi. Ce hook n'y apporte que les coordonnées de
  // l'événement et la caméra du rendu que son hôte lui tend.
  const pickVerdict = (ev: React.PointerEvent): Verdict => {
    const st = useGame.getState();
    const visé = tireLeRayon(st) ? targetUnderPointer(ev.clientX, ev.clientY) : null;
    // Le point de stage est passé en THUNK : il n'est inversé que si un étage en a besoin, et jamais
    // deux fois (cf. `resoudrePixel`). Quand des arêtes sont offertes, l'étage d'arête l'appelle, donc
    // un `getBoundingClientRect()` par `pointermove` : la parité de geste avec le hit-target SVG se
    // paie d'une mesure de layout par mouvement.
    return resoudrePixel(st, visé, () => stagePointOf(ev), { pose, dims, activeZ, aretes });
  };

  /** La case d'ANCRAGE du verdict, dans la forme que le reste du hook manipule (z omis à l'étage 0). */
  const tuileDe = (v: Verdict): Pt | null =>
    v.tile ? (v.tile.z ? { x: v.tile.x, y: v.tile.y, z: v.tile.z } : { x: v.tile.x, y: v.tile.y }) : null;

  // Écran → coordonnées de VIEWBOX — base du panoramique (delta de glissement), premier étage de
  // l'inversion partagée (`pickResolve.ts:pointViewBoxSousPixel`) : la caméra du groupe reste en
  // place, c'est elle qu'on déplace. Deux entrées : un point CLIENT nu (milieu de deux doigts) et
  // l'événement de pointeur.
  const clientPtToSvg = (cx: number, cy: number): { x: number; y: number } | null =>
    pointViewBoxSousPixel(svgRef.current, cx, cy);
  const clientToSvg = (ev: React.PointerEvent): { x: number; y: number } | null => clientPtToSvg(ev.clientX, ev.clientY);

  const pathOpts = (): PathOpts => optionsDeCheminDuGroupe(useGame.getState().party);

  const moveAlong = (sceneId: string, plan: ExploreMovePlan) => {
    if (movingRef.current || plan.path.length < 2) return;
    const path = plan.path;
    movingRef.current = true;
    let i = 1;
    const step = () => {
      const st = useGame.getState();
      const currentScene = st.scene;
      if (st.mode !== 'exploration' || st.dialogue || !currentScene || currentScene.id !== sceneId || i >= path.length) {
        movingRef.current = false;
        return;
      }
      const prev = st.partyPos;
      const expectedPrev = path[i - 1];
      if (prev.x !== expectedPrev.x || prev.y !== expectedPrev.y || (prev.z ?? 0) !== (expectedPrev.z ?? 0)) {
        movingRef.current = false;
        return;
      }
      const cur = path[i];
      const dist = chebyshev(cur, prev);
      if (dist > 1) {
        // SAUT par-dessus un gouffre. Élan = pas contigus en ligne droite menant au décollage.
        const jdx = Math.sign(cur.x - prev.x), jdy = Math.sign(cur.y - prev.y);
        let runUp = 0;
        for (let k = i - 1; k > 0; k--) {
          const a = path[k], b = path[k - 1];
          if (Math.sign(a.x - b.x) === jdx && Math.sign(a.y - b.y) === jdy && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) runUp++;
          else break;
        }
        const jumpPlan = planJump(currentScene, prev, cur, mouvementDuGroupe(st.party), runUp);
        if (partyLeader) bus.emit(EVT.ANIM_MOVE, { id: partyLeader.id, path: [prev, cur] });
        st.moveParty(cur);
        if (jumpPlan.kind === 'test') {
          jouerFlowEntier(runFlow(useGame.getState, useGame.setState, jumpPlan.flow));
          movingRef.current = false; // on s'arrête au saut : le joueur reclique pour continuer
          return;
        }
        i++;
        setTimeout(step, STEP_MS);
        return;
      }
      const stillConnected = walkNeighbors(currentScene, prev).some((neighbor) =>
        neighbor.x === cur.x
        && neighbor.y === cur.y
        && (neighbor.z ?? 0) === (cur.z ?? 0));
      if (!stillConnected) {
        movingRef.current = false;
        return;
      }
      if (partyLeader) bus.emit(EVT.ANIM_MOVE, { id: partyLeader.id, path: [prev, cur] });
      st.moveParty(cur);
      i++;
      setTimeout(step, STEP_MS);
    };
    step();
  };

  const activatePortal = (portal: RoomPortal) => {
    const st = useGame.getState();
    if (st.dialogue || !st.scene) return;
    if (st.mode === 'battle') {
      if (portal.kind === 'passage') return;
      useGame.setState({
        scene: toggleDoorIn(st.scene, portal.edge.x, portal.edge.y, portal.edge.side, portal.z),
      });
      bus.emit(EVT.SCENE_DIRTY);
      setAreteSurvolee(null);
      return;
    }
    if (st.mode !== 'exploration') return;
    const currentScene = st.scene;
    if (portal.kind === 'door-closed') {
      const openedScene = toggleDoorIn(currentScene, portal.edge.x, portal.edge.y, portal.edge.side, portal.z);
      useGame.setState({ scene: openedScene });
      bus.emit(EVT.SCENE_DIRTY);
      setAreteSurvolee(null);
      return;
    }
    const plan = exploreMovePlan(currentScene, st.partyPos, portal.to, pathOpts());
    if (!plan) return;
    setHover(null);
    setAreteSurvolee(null);
    st.setPendingInteract(null);
    moveAlong(currentScene.id, plan);
  };

  /** Les VERBES que la table des gestes appelle (`stage/geste.ts`) : le franchissement vit ici, parce
   *  qu'il tient le survol et la marche pas à pas ; grimper et sauter sont des verbes du store, suivis
   *  du battement de scène que les peintres d'arête émettaient. */
  const verbes: VerbesArete = {
    franchir: activatePortal,
    grimper: (de, vers) => { useGame.getState().climbAcross(de, vers); bus.emit(EVT.SCENE_DIRTY); },
    sauter: (de, vers) => { useGame.getState().fallAcross(de, vers); bus.emit(EVT.SCENE_DIRTY); },
    // FRAPPER une structure : le MUR est un Combattant (`state/combatSlice.ts`, `cid`), son geste est
    // donc EXACTEMENT celui d'un jeton ennemi sous le rayon (`performClick` ci-dessous) — MÊME porte
    // partagée (`state/combatOrParty.ts:combatantClickActs`, source unique des 3 surfaces) et même
    // retombée : quand la porte refuse (Inspection ON), la structure s'INSPECTE comme un jeton.
    // L'aperçu et le commit sont ceux du flux de combat (`state/targetingModes.ts`, `samePreview`),
    // celui que lit déjà le réticule de visée.
    frapper: (cid) => {
      const st = useGame.getState();
      if (combatantClickActs(useGame.getState, { id: cid })) st.battleClickEntity(cid, { confirm: hoverClickCommits() });
      else if (st.inspectEnabled) st.setInspectId(cid);
    },
  };

  /** LE geste d'une arête. Un seul chemin, deux déclencheurs : le VERDICT de pixel (`performClick`) et
   *  la touche Entrée/Espace du peintre (`stage/AreteOverlay.tsx`) ; la capacité est servie par LA
   *  table (`stage/geste.ts:jouerArete`), jamais par un `if` recopié ici, et le RÉGIME d'armement est
   *  une colonne de cette même table (`armeParSurvol`) : porte, escalade et chute suivent le régime du
   *  stage (`hoverClickCommits` — là où l'on survole un clic COMMET ; sans survol le 1er tap ARME
   *  l'arête, qui prend l'accent, et le 2e la joue) ; la structure n'arme rien ici, elle passe la main
   *  au flux de combat, qui porte le même régime pour tout jeton. */
  const activerArete = (arete: AreteUtilisable): void => {
    if (armeParSurvol(arete.capacite) && !hoverClickCommits() && areteSurvolee?.cle !== arete.cle) {
      setAreteSurvolee(arete);
      return;
    }
    jouerArete(arete, verbes);
  };

  /** LE survol d'une arête, quel qu'en soit le canal : le pixel (`onPointerMove`) ou le focus clavier
   *  du peintre. Un seul état survolé, donc un seul rendu à l'écran et un seul armement du geste. */
  const survolerArete = (arete: AreteUtilisable | null) => {
    if ((areteSurvolee?.cle ?? null) !== (arete?.cle ?? null)) setAreteSurvolee(arete);
  };

  // Action de clic (DIFFÉRÉE au relâchement, sautée si on a fait un panoramique) — sélection / cible / déplacement.
  const performClick = (v: Verdict | null) => {
    const st = useGame.getState();
    const sc = st.scene;
    const t = v ? tuileDe(v) : null;
    if (!sc || st.dialogue || !v || !t) return;
    // ARÊTE : elle a déjà tranché en tête de chaîne, son geste prime sur la case qu'elle borde et
    // consomme le clic — rien ne redescend au clic-sol, qui écraserait l'aperçu qu'une frappe vient de
    // poser (`combatSlice.battleClickTile` réécrit `preview` à chaque sortie de déplacement).
    if (v.nature === 'arete') { activerArete(v.arete); return; }
    const { x, y } = t;
    const tz = t.z ?? 0;
    if (st.mode === 'battle') {
      if (!controlsActive(st)) return; // coop : tour du héros d'un AUTRE joueur — clics inertes
      const occ = st.battle ? combatantAtTile(st.battle.combatants, x, y, tz) : undefined; // clic sur N'IMPORTE quelle tuile de l'empreinte, au bon étage
      // Décision PARTAGÉE avec le clic d'un portrait de frise (`combatantClickActs`) : un ennemi
      // s'attaque en mode neutre, tout combattant se cible en mode sort / choix de cibles ; sinon
      // (allié/soi non actionnable) on inspecte. Desktop (survol) : la visée a déjà tout montré → un
      // clic COMMET ; tactile : deux-taps (tap 1 = aperçu) — cf. pointerCaps.
      if (occ && combatantClickActs(useGame.getState, occ)) st.battleClickEntity(occ.id, { confirm: hoverClickCommits() });
      else if (occ) { if (st.inspectEnabled) st.setInspectId(occ.id); } // allié/soi non-actionnable → inspecter
      else st.battleClickTile(tz ? { x, y, z: tz } : { x, y }, { confirm: hoverClickCommits() }); // z-aware : escalier / case de rempart
      return;
    }
    const ent = entiteDuGeste(sc, v, t);
    // Case d'arrivée partagée avec l'aperçu de survol (explorePath) — JAMAIS recalculée à part (cf.
    // exploreMoveDest) : escalier (autre bout), case adjacente d'un objet/PNJ interactif, ou déplacement simple.
    const plan = exploreMovePlan(sc, st.partyPos, t, pathOpts());
    // MEUBLE À PLACES : le MÊME `pendingInteract` que la fouille, mais la marche va jusqu'à l'ABORD
    // de la place (`exploreSeatPlan` via `exploreMovePlan`), jamais à la case d'ancrage du meuble.
    // Aucun second pending, aucune route `sit`/`seat` : le geste reste `interactEntity`. Cette branche
    // n'INTERCEPTE rien : sans place servable elle repasse la main à la chaîne fouille/marchand/dialogue.
    if (ent && ent.kind === 'prop' && placesJouables(sc, ent.id).length) {
      const meneur = meneurDuMonde(st)?.id;
      const assisIci = !!meneur && seatPoseOf(sc, { kind: 'party', rang: RANG_MENEUR })?.propId === ent.id;
      // UNE SEULE source de « place LIBRE » : le plan d'assise (`exploreSeatPlan`, qui filtre les
      // places prises et rend un chemin d'un seul point quand on est DÉJÀ sur l'abord d'une libre).
      // Le lire deux fois — ici « suis-je sur un abord ? », là « où marcher ? » — les faisait diverger :
      // debout sur l'abord d'une place PRISE, trois places libres ailleurs, le clic servait
      // « Vous devez rejoindre la place » et personne ne marchait.
      const place = exploreSeatPlan(sc, st.partyPos, ent.id, pathOpts());
      if (assisIci || (place && place.path.length < 2)) {
        // Sur place : le store arbitre entre se relever, servir la fouille/le marchand, et s'asseoir.
        setHover(null);
        st.setPendingInteract(null);
        st.interactEntity(ent.id);
        return;
      }
      // Une place SERVABLE au loin : on marche jusqu'à son ABORD (jamais la case d'ancrage), et le
      // MÊME `pendingInteract` que la fouille se consomme à l'arrivée.
      if (plan && place) {
        setHover(null);
        st.setPendingInteract({ id: ent.id, at: plan.dest });
        moveAlong(sc.id, plan);
        return;
      }
      // REPLI — aucune place servable (toutes prises, ou aucun abord atteignable) : les places
      // AJOUTENT une affordance, elles n'en retirent AUCUNE. La chaîne fouille/marchand/dialogue
      // ci-dessous reprend la main. Un meuble qui n'a QUE des places, lui, se rejoint quand même : le
      // clic PARCOURT le plan que le survol trace déjà (`exploreMovePlan`, source unique des deux) —
      // sinon le tracé promettait une marche que le clic n'honorait pas — et ne dit pourquoi il ne
      // sert pas qu'une fois À PORTÉE, plus rien à marcher (parité exacte avec le décor sans affordance).
      if (!estUtilisable(sc, ent, st.flags)) {
        setHover(null);
        st.setPendingInteract(null);
        if (plan) moveAlong(sc.id, plan);
        else st.log(message('seating.noReachableSeat'));
        return;
      }
    }
    if (ent && estUtilisable(sc, ent, st.flags)) {
      // CE QUE L'ENTITÉ OFFRE, dit par le dériveur unique — aucun champ n'est interrogé ici. UNE offre :
      // le clic la JOUE (adjacent) ou la vise à travers la marche (loin). N offres : le joueur choisit,
      // et c'est le PANNEAU borné de la pastille qui les sert — le clic ne devine pas à sa place.
      // Les offres OUVERTES, au même verdict que la pastille (`porteDOffre`) : une offre refusée
      // (toutes les places prises) se lit au survol, elle ne se joue pas — et ne compte donc pas
      // dans « une seule offre ».
      const offres = actionsDe(sc, ent, st.flags).filter((o) => porteDOffre(sc, ent, o.origine).ok);
      const seule = offres.length === 1 ? offres[0] : null;
      if (aPorteeDe(st.partyPos, ent)) {
        if (!seule) return; // la pastille de l'entité, montée dès qu'elle est à portée, porte les N gestes
        setHover(null);
        st.setPendingInteract(null);
        st.jouerAction(ent.id, seule.id);
      } else if (plan) {
        // Déplacement-puis-geste (P5) : marche vers la case adjacente libre, puis le geste à l'arrivée.
        setHover(null);
        st.setPendingInteract({ id: ent.id, ...(seule ? { actionId: seule.id } : null), at: plan.dest });
        moveAlong(sc.id, plan);
      }
      return;
    }
    if (ent && ent.kind === 'personnage') {
      // FIGURANT (PNJ sans dialogue/boutique/fouille) : on ne lui marche pas DESSUS — on s'approche
      // d'une case adjacente, ou on le dit s'il est déjà à côté.
      setHover(null);
      st.setPendingInteract(null);
      if (aPorteeDe(st.partyPos, ent)) st.log(`${ficheDEntite(ent).label} n’a rien à vous dire.`);
      else if (plan) moveAlong(sc.id, plan);
      return;
    }
    if (ent && ent.kind === 'prop' && entityBlockedAt(sc, ent.pos.x, ent.pos.y, ent.z ?? 0)) {
      // DÉCOR SANS AFFORDANCE qui OCCUPE sa case (règle unique `sceneRules.entityBlockedAt`, celle
      // d'`isWalkable`) : on ne monte pas dessus, mais on ne reste pas non plus sans effet — le sol nu,
      // lui, fait MARCHER. Loin : on s'en approche (`exploreMoveDest` rend la case adjacente). À
      // portée : il n'y a rien à en tirer, et on le DIT plutôt que d'avaler le geste. Un décor
      // PASSABLE (mare de sang, tas de foin) n'entre pas ici : sa case se foule, elle se clique comme
      // le sol, et c'est la marche générique ci-dessous qui la sert.
      setHover(null);
      st.setPendingInteract(null);
      if (plan) moveAlong(sc.id, plan);
      else st.log(message('store.propInerte', { what: ent.label ?? message('store.propInerteFallback') }));
      return;
    }
    // Clic ailleurs : annule un déplacement-puis-fouille en attente. `dest` couvre l'ESCALIER (geste
    // explicite pour changer d'étage) et le déplacement simple ; moveAlong filtre les cases non marchables.
    st.setPendingInteract(null);
    if (plan) {
      setHover(null);
      moveAlong(sc.id, plan);
    }
  };

  /** RE-POSE la base du panoramique sur l'état courant : le décalage vivant devient l'origine, et le
   *  point de viewBox sous le doigt aussi. Ce que le geste a déjà parcouru est acquis, ce qui suit se
   *  mesure à partir d'ici. */
  const rebaser = (d: NonNullable<typeof dragRef.current>, p: { x: number; y: number }): void => {
    d.pan0 = getStagePan();
    d.vbX = p.x;
    d.vbY = p.y;
    d.zoom0 = zoom;
    d.accord0 = accordsPan();
  };

  // Un glisser survit à la souris : l'écran peut être QUITTÉ en plein geste (changement de scène,
  // combat qui s'ouvre) et aucun `pointerup` n'arrive. Le décalage vivant reviendrait alors hanter le
  // montage suivant, sans que le store — seul état commis — n'en sache rien. On le rend au commis.
  useEffect(() => () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const commis = useGame.getState().camPan;
    poserPan(commis.x, commis.y);
  }, []);
  // Caméra libre : on ARME un glisser au pointer-down (sans agir), on panoramique au mouvement
  // au-delà du seuil, et le clic ne se déclenche au relâchement QUE si on n'a pas glissé.
  const onPointerDown = (ev: React.PointerEvent) => {
    if (useGame.getState().dialogue) return;
    // Bouton MILIEU : le navigateur y arme son défilement automatique (curseur en rose des vents,
    // la page défile au moindre mouvement) — il prendrait le glisser-tourner à chaque geste.
    if (ev.button === 1) ev.preventDefault();
    ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.current.size === 2) {
      // 2ᵉ doigt : le geste devient un PINCER. Le glisser à un doigt est DÉSARMÉ — sinon son
      // relâchement commettrait le clic différé (un ordre de déplacement au bout d'un zoom).
      const [a, b] = [...ptrs.current.values()];
      pinchRef.current = { dist: Math.hypot(b.x - a.x, b.y - a.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, accord0: accordsPan() };
      dragRef.current = null;
      svgRef.current?.setPointerCapture?.(ev.pointerId);
      return;
    }
    const p = clientToSvg(ev);
    dragRef.current = { sx: ev.clientX, sy: ev.clientY, vbX: p?.x ?? 0, vbY: p?.y ?? 0, panned: false, button: ev.button, verdict: pickVerdict(ev), yaw0: getStageYaw(), pan0: getStagePan(), zoom0: zoom, accord0: accordsPan() };
    svgRef.current?.setPointerCapture?.(ev.pointerId);
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    if (ptrs.current.has(ev.pointerId)) ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    // DEUX DOIGTS : l'écart entre eux pilote le ZOOM, la translation de leur MILIEU pilote le
    // PANORAMIQUE. Le geste est lu en variables LOCALES avant tout appel au store (patron
    // `ui/MapCanvas`) — jamais un `pinchRef.current` déréférencé dans un callback différé, que le
    // `pointerup` a pu remettre à `null` entre-temps.
    const pinch = pinchRef.current;
    if (pinch && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const st = useGame.getState();
      st.setZoom(st.zoom * (dist / (pinch.dist || dist))); // le store borne
      const from = clientPtToSvg(pinch.cx, pinch.cy);
      const to = clientPtToSvg(cx, cy);
      if (from && to) {
        // Comme le glisser à un doigt : le pan se pose HORS de React (`state/stagePan`) et le store ne
        // converge qu'au relâchement — ici en RELATIF, le milieu des doigts n'a pas de base stable.
        const cur = getStagePan();
        poserPan(cur.x + (to.x - from.x) / zoom, cur.y + (to.y - from.y) / zoom); // delta écran (viewBox) → unités caméra
        battreStageFrames();
      }
      pinch.dist = dist;
      pinch.cx = cx;
      pinch.cy = cy;
      return; // pendant un pincer : ni survol, ni panoramique à un doigt
    }
    const d = dragRef.current;
    if (d) {
      if (!d.panned && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > PAN_THRESHOLD) d.panned = true;
      if (d.panned) {
        // Bouton MILIEU = TOURNER (le principal déplace le groupe, le droit ouvre l'attaque la plus
        // pertinente) : le lacet se pose ABSOLUMENT depuis l'angle du début de geste, la vue suit donc
        // le doigt sans dériver au fil des images.
        if (d.button === 1) {
          poserYaw(d.yaw0 + (ev.clientX - d.sx) * SENSIBILITE_DRAG_DEG_PX);
          (ev.currentTarget as SVGElement).style.cursor = 'grabbing';
          return;
        }
        const p = clientToSvg(ev);
        if (p) {
          // Une hypothèse de la base a bougé sous le geste (recentrage, cran de molette) : on se re-cale
          // dessus AVANT d'appliquer quoi que ce soit — le recentrage gagne, et le doigt repart de là.
          if (accordsPan() !== d.accord0 || zoom !== d.zoom0) rebaser(d, p);
          // Le décalage se pose ABSOLUMENT depuis celui de la base, comme le lacet ci-dessus, et RIEN
          // n'entre dans le store avant le relâchement : un `set` par événement de souris re-rendait le
          // stage ENTIER. Le battement repose les deux clients de la caméra sur la même valeur.
          poserPan(d.pan0.x + (p.x - d.vbX) / zoom, d.pan0.y + (p.y - d.vbY) / zoom); // delta écran (viewBox) → unités caméra
          battreStageFrames();
        }
        (ev.currentTarget as SVGElement).style.cursor = 'grabbing';
        return; // pendant un panoramique : pas d'affordance ni de hover de visée
      }
    }
    const v = pickVerdict(ev);
    const t = tuileDe(v);
    // Affordance : curseur main au survol d'un décor interactif / dialogue (DOM direct, sans re-render).
    // MÊME entité que celle qu'un clic traiterait (`utilisableSous` → `entiteDuGeste`) : l'affordance ne
    // peut pas annoncer autre chose que ce que le clic fera — un décor dont l'unique action `unique`
    // est épuisée n'appelle plus.
    const st = useGame.getState();
    // SURVOL-ARMEMENT d'une ARÊTE : le verdict est la seule source du seuil survolé — l'accent du
    // peintre, l'aperçu de marche et le tap-1 tactile en descendent tous.
    survolerArete(v.nature === 'arete' ? v.arete : null);
    // Le stage n'écrit le curseur que pour ce qu'il résout LUI-MÊME — le décor utilisable en
    // exploration. Une ARÊTE porte le sien sur son propre trait, par capacité
    // (`stage/AreteOverlay.tsx:Matiere.cursor` : réticule sur une structure, main sur un seuil), comme
    // un jeton de combat survolé, pour lequel cette ligne n'écrit rien non plus.
    const idSurvolé = utilisableSous(v, t);
    if (idSurvolé !== entiteSurvolee) setEntiteSurvolee(idSurvolé);
    const overInteractive = !!idSurvolé && st.mode === 'exploration';
    (ev.currentTarget as SVGElement).style.cursor = overInteractive ? 'pointer' : '';
    // Survol suivi en COMBAT (visée) ET en EXPLORATION (halo renforcé du décor interactif + aperçu de
    // déplacement) — borné aux changements de tuile, donc peu de re-rendus.
    if (!hoverTracking && useGame.getState().mode !== 'exploration') {
      if (hover) setHover(null);
      return;
    }
    if (!t) {
      if (hover) setHover(null);
      return;
    }
    if (!hover || hover.x !== t.x || hover.y !== t.y || (hover.z ?? 0) !== (t.z ?? 0)) {
      if (useGame.getState().combatCursor) useGame.getState().clearCursor(); // la souris (nouvelle tuile) reprend la main sur le curseur clavier/manette
      setHover(t);
      const apres = useGame.getState();
      if (apres.hoverCombatantId) apres.setHoverCombatant(null); // la souris reprend la main sur le ciblage clavier (Tab) / frise
    }
  };

  const onPointerUp = (ev: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    ptrs.current.delete(ev.pointerId);
    if (ptrs.current.size < 2 && pinchRef.current) {
      // FIN DU PINCER : même convergence que le glisser ci-dessous — le décalage vivant se commet au
      // store en UN `set`, sauf si un recentrage a déjà eu le dernier mot pendant le geste.
      if (accordsPan() === pinchRef.current.accord0) setCamPan(getStagePan().x, getStagePan().y);
      pinchRef.current = null;
    }
    svgRef.current?.releasePointerCapture?.(ev.pointerId);
    (ev.currentTarget as SVGElement).style.cursor = '';
    if (!d) return;
    // FIN DU GLISSER-CAMÉRA : le décalage vivant se COMMET au store, en UN seul `set` ABSOLU pour tout
    // le geste — c'est là, et là seulement, que l'état React converge sur ce que la vue montre déjà.
    // Un recentrage arrivé APRÈS le dernier mouvement a le dernier mot : il a déjà commis {0,0} et
    // ramené le vivant, il n'y a rien à écrire par-dessus.
    if (d.panned && d.button === 0 && accordsPan() === d.accord0) setCamPan(getStagePan().x, getStagePan().y);
    if (!d.panned && d.button === 0) performClick(d.verdict); // tap (sans glisser) au bouton principal = clic
  };

  const onPointerLeave = () => {
    ptrs.current.clear();
    pinchRef.current = null;
    if (hover) setHover(null);
    if (areteSurvolee) setAreteSurvolee(null);
    if (entiteSurvolee) setEntiteSurvolee(null);
  };

  // Clic droit en combat = attaque la plus PERTINENTE sur l'ennemi survolé (scoreur partagé avec l'IA :
  // poids éditable × dégâts/multi-cible), sans muter `selectedAttack`. Raccourci sur `availableAttacks`.
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const st = useGame.getState();
    const b = st.battle;
    if (st.mode !== 'battle' || !b || b.over || !controlsActive(st) || !hover) return;
    const active = b.combatants.find((c) => c.id === b.order[b.turn]);
    if (!active || active.kind !== 'hero') return;
    const occ = combatantAtTile(b.combatants, hover.x, hover.y, hover.z ?? 0);
    if (!occ || occ.kind !== 'enemy') return;
    const best = bestAttack(useGame.getState, active, b, occ);
    if (best) st.battleClickEntity(occ.id, { forceAttackId: best.id, confirm: true });
  };

  return {
    hover,
    entiteSurvolee,
    areteSurvolee,
    activerArete,
    survolerArete,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave, onContextMenu },
  };
}
