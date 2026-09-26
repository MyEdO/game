/**
 * UN SEUL MONDE, DEUX REGARDS (#1385) — le monde volumique est possédé par l'hôte, ne se démonte
 * qu'avec l'écran de campagne ; une vue n'est pas un écran, c'est un `frame` servi à un monde déjà là.
 *
 * LA FRONTIÈRE, DITE SANS FARD : est une VÉRITÉ MONDE tout ce qui ENTRE DANS LE CANEVAS — vision,
 * exploré, teinte, lumières, éléments (jetons/décors), marche, dégagement, perçage, cadre de regard.
 * Ça vit ICI, et une feuille n'en recalcule aucune. Le reste est de l'OVERLAY : la surcouche de
 * plateau dérive bel et bien sa propre géométrie d'affordance (grille, murs au trait `wallTraitObjs`,
 * accès de pièce `portalsForParty`, réticules, FX) — rien de tout cela n'atteint le canevas, et un
 * regard qui ne les montre pas ne les paie pas.
 *
 * CE QUI DÉPEND DU REGARD SE PARAMÈTRE, et se compte : SIX branches, plus le slot de surcouche.
 * Trois de SÉLECTION — `keepEl` (dehors la loi de dégagement, dedans tout se dessine), le dégagement
 * des décors dans `propEls`, le jeton de groupe `partyToken` (on ne se voit pas soi-même). Une de
 * CADRE — `frameMonde` (plateau : `dims`/`camAt`/zoom ; œil : case, cap, intérieur, sujet suivi). Deux
 * de STYLE — `politique` et `dims.view`, parce que la vue du DESSUS est un regard de plateau et ne
 * saurait s'hériter à hauteur d'homme. Les sorties anticipées de `cleared`/`lids`/`percage`/`roofEls`
 * n'ajoutent aucune règle : elles ne font pas payer à un regard ce qu'il ne lit pas.
 *
 * LE CHANGEMENT DE REGARD EST UNE REPOSE — toute reconstruction à la bascule est un défaut, sauf le
 * meneur et les nappes de brume (mesuré : `stage/bascule-de-vue.test.tsx`). LA VUE N+1 COÛTE UNE LIGNE.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useGame } from '../../state/store';
import { heightAt, isIndoor, liftDe, sceneMetresPerTile } from '../../state/scene';
import { computeStateVisibleAndLight, sceneLightSources } from '../../state/visionState';
import { capDuGroupe, meneurDuMonde } from '../../state/combatants';
import { placingZoneOf } from '../../state/combatFlow';
import { controlsActive } from '../../state/netOwnership';
import { Dims, capsuleCenter } from '../../geometry/iso';
import { etageActif, getViewZ, subscribeViewZ } from '../../state/viewLevel';
import { setStageFrame } from './spritePicker';
import { setVisibleTileBounds } from '../viewport';
import { useWalkAnim } from '../fx/useWalkAnim';
import { subscribeStageFrames, subscribeStagePrelude, battreStageFrames, demanderFrames, relacherFrames, useBattementContinu } from './stageFrames';
import { getStagePan, subscribeStagePan } from '../../state/stagePan';
import { walkPoseAt, type WalkPos } from '../fx/walkPose';
import { buildRoofs, clearedSpace } from '../builders/roofs';
import { buildProps } from '../builders/props';
import { nappePorteuse } from '../builders/types';
import { buildTokens, partyTokenOf } from '../builders/tokens';
import { RANG_MENEUR, seatPoseOf } from '../../state/seating';
import { seatedEyeH } from '../pov/camera';
import { elOccluder } from './occluders';
import { tireurSurvole, type HighlightOpts } from './highlightLayer';
import { dynamicMarks } from '../builders/dynamicMarks';
import { interactionHalos, NO_INTERACTION_HALOS, type InteractHalo } from '../builders/interactHalos';
import { tokenChromes, tokenGesteMarks, type GesteMark, type TokenChromeMark } from '../builders/tokenChrome';
import { entityGestes } from '../../state/registreOffres';
import { offresUtilisables } from '../../state/offresUtilisables';
import { actorCapsuleOf } from './actorCapsule';
import { VolumetricWorld, type WorldFrame } from './VolumetricWorld';
import { viewPolicy } from './viewPolicy';
import { SansWebgl, useWebglRefusé } from './SansWebgl';
import { avancerLacet, getStageYaw, lacetActif, subscribeStageYaw, viewRot, viewYawDeg } from '../../state/stageYaw';
import { visibilityField } from '../backends/webgl/visibilityTint';
import { useExploreCourant } from './exploreCourant';
import { roomZonesByElKey, type KeepEl, type TintAt } from '../backends/webgl/sceneMeshes';
import { stageCamTransform, stageYawCorrection } from './stageCam';
import { roomCutawayAllies, roomFocusAt } from './roomFocus';
import { NO_CLEARED_SPACE, frontFacadeCutaway, cutawayForSection, cutawayOverhead, spaceCellKey } from './architectureVisibility';
import { clePercage } from './percage';
import { useStageCamera, cameraTargeting, stageFocus, computeViewBounds, adoucirFocal, DUREE_FOCALE_MS, VW, VH, type LissageFocal } from './useStageCamera';
import { useStagePointer } from './useStagePointer';
import { projeterAretes, type AreteProjetee } from './aretesProjetees';
import { aretesUtilisables } from '../../state/aretes';
import { portalsForParty } from '../../state/roomPortals';
import { occupiedInteriorZoneIds } from './roomFocus';
import type { Pt } from '../../state/path';
import { inBattleId } from '../../state/combatants';
import { useHoverTargeting } from './useHoverTargeting';
import { SceneErrorBoundary } from '../../ui/SceneErrorBoundary';
import { SurcoucheIso } from '../SurcoucheIso';
import { SurcouchePov } from '../pov/SurcouchePov';
// KEYFRAMES DU STAGE (`gameIso/anim.css`) : projectiles et halos de FX, fourmis de gabarit de ZdE,
// pastilles d'état des jetons, faune et ambiance. Elles servent les DEUX regards, donc elles entrent
// par l'hôte — la feuille qui les porte peut se démonter, le monde non.
import '../anim.css';

/** À HAUTEUR D'ŒIL, TOUT SE DESSINE (#1176, P3-1a) : le dégagement d'architecture est une loi de la vue
 *  de PLATEAU (retirer ce qui coiffe le groupe pour voir dedans depuis le dessus). Appliqué en première
 *  personne, il ouvrirait le ciel au-dessus de la tête du groupe dès qu'il entre sous un toit. */
const TOUT_SE_DESSINE: KeepEl = () => true;

/**
 * L'écran de campagne : le filet du MONDE, et le corps dessous. Un boundary ne rattrape JAMAIS
 * l'erreur du composant qui le rend — le corps (≈500 lignes de dérivations : vision, dégagement,
 * caméra, éléments) doit donc vivre SOUS le sien, sans quoi un crash de dérivation emporterait le HUD
 * de l'écran entier.
 */
export function MondeDeCampagne() {
  return (
    <SceneErrorBoundary>
      <CorpsDuMonde />
    </SceneErrorBoundary>
  );
}

function CorpsDuMonde() {
  // ── État (store) ────────────────────────────────────────────────────────────────────────────────
  const scene = useGame((s) => s.scene);
  const mode = useGame((s) => s.mode);
  const partyPos = useGame((s) => s.partyPos);
  const flags = useGame((s) => s.flags); // B4 : masquer le halo d'un décor déjà fouillé (__fouille_<id>)
  const party = useGame((s) => s.party);
  const battle = useGame((s) => s.battle);
  const gameTime = useGame((s) => s.gameTime);
  const lightLevel = useGame((s) => s.lightLevel);
  const explored = useGame((s) => s.explored);
  const markExplored = useGame((s) => s.markExplored);
  const dialogue = useGame((s) => s.dialogue);
  // REGARD COURANT : la seule chose qui distingue les deux vues. Il ne démonte plus le monde.
  const pov = useGame((s) => s.mode === 'exploration' && s.povActive);
  // Télégraphe ENNEMI de visée : entrée du cadrage caméra (la paire à tenir dans le champ).
  const actorAim = useGame((s) => s.actorAim);
  // COOP : le tour du héros d'un AUTRE joueur s'affiche comme un tour ennemi — AUCUNE affordance.
  const myTurn = useGame(controlsActive);
  const planView = useGame((s) => s.pendingRoundStart?.round === 1); // ouverture : cadrer tout le champ
  const pendingAttack = useGame((s) => s.pendingAttack);
  const pendingCast = useGame((s) => s.pendingCast);
  const pendingSiegeAim = useGame((s) => s.pendingSiegeAim); // pilonnage indirect : placeur de CASE
  const pendingCleave = useGame((s) => s.pendingCleave);
  const pendingDualStrike = useGame((s) => s.pendingDualStrike);
  const preemptAiming = useGame((s) => s.preemptAiming); // Tir rapide armé (pause) : cible par la carte hors tour
  const localIntent = useGame((s) => s.localIntent); // intention ARMÉE : sa portée est une marque de cases
  const hovered = useGame((s) => s.hovered); // tireur SURVOLÉ (frise ou token) : ses bandes de portée sont des marques de cases
  const viewMode = useGame((s) => s.viewMode);
  const debugRoofCut = useGame((s) => s.debugRoofCut); // recette #1478 : lève-toit débrayable (`__wfrp.roofCut`)
  // CAP du groupe (`capDuGroupe`, entrée UNIQUE de la table), lu SEULEMENT sous le regard de première
  // personne : la table se reforge à chaque pas et à chaque attaque, et un abonnement à la table
  // entière re-rendrait tout l'hôte. Le sélecteur rend une valeur PRIMITIVE, constante hors POV.
  const capPov = useGame((s) => (s.povActive ? capDuGroupe(s) : null));
  // L'orientation MONDE vivante n'est PAS lue ici : `VolumetricWorld` s'y abonne pour ses billboards.
  // MONDE INAFFICHABLE (#1176 C5a) : contexte volumique refusé = plus aucun peintre du monde — l'écran
  // le DIT, il ne se replie plus en silence (`stage/webglSupport`).
  const sansMonde = useWebglRefusé();
  const reveler = useGame((s) => s.reveler); // Alt maintenu : tous les utilisables visibles se révèlent (halo + plaque)
  const hoverCombatantId = useGame((s) => s.hoverCombatantId); // survol de la frise → peek caméra + réticule
  const svgRef = useRef<SVGSVGElement>(null);
  const camRef = useRef({ x: 0, y: 0 }); // caméra du rendu courant, lue par les handlers du pointeur
  // ARÊTES projetées du rendu courant — même rôle que `camRef` pour le cadre publié : la sonde de
  // recette les lit À L'APPEL, sur l'offre que l'écran rend à cet instant.
  const aretesEcranRef = useRef<readonly AreteProjetee[]>([]);
  const camGRef = useRef<SVGGElement>(null); // groupe à la transform CAMÉRA — recalé hors React pendant une marche volumique
  // Un pas FRANCHI pendant une marche volumique : le seul rendu que la boucle demande (cf. son battement).
  const [, setWalkStep] = useState(0);
  const demandeRef = useRef<string | null>(null);
  // ADOUCISSEMENT DE FOCALE : le point focal du dernier calcul de vue, le lissage EN COURS (départ figé
  // + horodatage) et le SUJET que la caméra suivait. Le saut se détecte au SUJET, jamais aux
  // coordonnées : un marcheur qui glisse déplace la cible sans en changer.
  const focalRef = useRef({ x: 0, y: 0 });
  const lissageRef = useRef<LissageFocal | null>(null);
  const sujetFocalRef = useRef<string | null>(null);
  // Source de battement PROPRE À CET HÔTE : deux écrans montés côte à côte (jeu + aperçu) ne peuvent
  // pas se relâcher les images l'un de l'autre.
  const sourceFocale = useRef(Symbol('focale')).current;

  // ── Caméra (transition de crans, zoom, pan) & animations ───────────────────────────────────────
  const { shownRot, shownEdge, turning, zoom, attacherMolette } = useStageCamera();
  // La surcouche de plateau se démonte au passage en première personne : le SVG qu'elle porte se pose
  // ICI par ref-callback (la molette suit l'élément vivant, jamais celui du premier montage).
  const poserSvg = useRef((el: SVGSVGElement | null) => {
    (svgRef as { current: SVGSVGElement | null }).current = el;
    attacherMolette(el);
  }).current;
  // Marche visuelle : le token GLISSE le long du chemin. La boucle de rendu volumique lit `walksRef`
  // elle-même (#1176, P2-4) — aucun rendu React par frame.
  const walksRef = useWalkAnim(false);

  // ── Vérités de scène : étage actif, hauteurs métriques, brouillard ──────────────────────────────
  // Étages rendus = l'ACTIF + ceux du DESSOUS (sélection des builders). Override DEBUG viewLevel(z).
  const viewZ = useSyncExternalStore(subscribeViewZ, getViewZ, getViewZ);
  const activeC = mode === 'battle' && battle ? inBattleId(battle, battle.order[battle.turn]) : undefined;
  // L'étage actif se DÉDUIT (`state/viewLevel.ts:etageActif`), il ne se recalcule pas ici : le
  // picking résout sur le MÊME étage que celui-ci montre, sinon la sonde de recette et le clic
  // désignent des couches différentes.
  const activeZ = etageActif({ mode, battle, partyPos }, viewZ);
  // STYLE DE LA VUE (#1176, P3-5) : ce que ce regard choisit de MONTRER (`stage/viewPolicy`). Les
  // verdicts en descendent tous — l'étage isolé ci-dessous comme le découvert des toits de `keepEl`.
  // La vue du DESSUS est un regard de PLATEAU : à hauteur d'œil, c'est le style iso qui vaut.
  const politique = useMemo(() => viewPolicy({ view: pov ? 'iso' : viewMode }), [viewMode, pov]);
  // VUE DU DESSUS (`view: 'top'`, mode tactique et source de la minimap) : on regarde UN plancher à la
  // VERTICALE — l'étage ACTIF, et lui seul. Ce n'est pas un réglage d'affichage de plus : c'est le
  // `viewZ` du pivot (isolement d'un étage) que l'APPELANT fournit, là où l'iso fournit `null`
  // (l'actif + le contrebas, contexte utile en 3D). Les builders ne connaissent PAS le mode de vue —
  // ils ne lisent que le `viewZ` reçu ; la MASSE du monde, cuite en bloc, le reçoit par `keepEl`.
  const planVue = politique.etageIsole;
  const layerZ = planVue ? activeZ : viewZ;
  /** ÉLÉVATION d'affichage d'un point de grille — le SOCLE `state/scene.ts:liftDe` fermé sur la scène,
   *  servi au peintre des seuils comme à la projection des arêtes, au jeton (qui monte avec son sol) et
   *  aux surlignages de case : tous posent le même segment que le trait de mur (`stage/layers.tsx:99`). */
  const liftOf = useCallback((p: Pt) => (scene ? liftDe(scene, p) : 0), [scene]);
  /** La même élévation, appelée par coordonnées (forme que réclament les peintres qui balaient une
   *  grille) — un DÉRIVÉ de `liftOf`, jamais un second calcul. */
  const liftAt = useCallback((x: number, y: number, z = 0) => liftOf({ x, y, z }), [liftOf]);
  // BROUILLARD DE GUERRE (cases visibles) + CHAMP DE LUMIÈRE par tuile en UN calcul (`sceneLightField`,
  // potentiellement lourd, ne tourne qu'UNE fois par pas — la vue ET l'éclairage des sols le partagent).
  // Dérivé des positions LOGIQUES, pas du glissement → memo STABLE pendant la marche. UNE vision pour
  // les deux regards (#1385) : la première personne en dérivait une seconde, sur les mêmes entrées.
  const vl = useMemo(
    () => (scene ? computeStateVisibleAndLight({ scene, battle, party, partyPos, gameTime, lightLevel }) : { visible: new Set<string>(), light: undefined, smoke: [] }),
    [scene, battle, party, partyPos, gameTime, lightLevel],
  );
  const visible = vl.visible;
  // Sources PONCTUELLES (brasero posé, lanterne portée) : la MÊME liste que celle dont `vl` dérive son
  // champ de lumière (`sceneLightSources`), passée telle quelle à la voie volumique, qui en pose les
  // flaques. Elle ne dépend NI de l'heure NI du palier — seulement de qui porte quoi, et où.
  // `party` fait partie des dépendances même en COMBAT, où les sources viennent de `battle` : la purge
  // d'entretien mute `activeEffects` EN PLACE sur les combattants (`state/upkeep.ts:71`) sans changer la
  // réf `battle`, et ne repose que `party` (`upkeep.ts:90`). Un sort de Lumière qui se dissipe passerait
  // donc inaperçu d'un memo qui ne dépendrait que de `battle`.
  const lightSources = useMemo(
    () => (scene ? sceneLightSources({ scene, battle, party, partyPos }) : []),
    [scene, battle, party, partyPos],
  );
  // L'EXPLORÉ DU PAS COURANT : ce que le store a retenu, PLUS ce que le groupe voit à l'instant. Un pas
  // découvre des cases, et l'accumulation persistante ci-dessous ne fait que les CONFIRMER au commit
  // SUIVANT : sans cette union, un pas passait DEUX champs de teinte (un au calcul de `visible`, un au
  // retour du store), donc deux fois toute la cascade qui en dépend (#1396).
  // Sa RÉFÉRENCE ne change qu'au CONTENU : le commit de confirmation rend un ensemble égal, et la
  // teinte qui en descend ne doit pas s'y reforger.
  const exploredSet = useExploreCourant(explored, scene?.id, visible);
  // Accumulation persistante de l'exploré (no-op si rien de neuf → pas de boucle de rendu). Explorer
  // en première personne nourrit la MÊME mémoire de carte : c'est le même hôte.
  useEffect(() => {
    if (visible.size) markExplored([...visible]);
  }, [visible, markExplored]);

  const mpt = scene ? sceneMetresPerTile(scene) : 2;
  const indoor = useMemo(() => (scene ? isIndoor(scene) : false), [scene]);
  // LACET CONTINU (#1176, P2-7 ; #1403) : trois formes du MÊME regard — le CRAN (`dims`), la
  // projection du COMMIT (`dimsVue`) et celle de l'IMAGE (`dimsAt`).
  // `dims` est le CRAN — la géométrie de DÉGAGEMENT s'y décide, et ses memos ne doivent pas se rejouer
  // soixante fois par seconde pendant une rotation. Son cran est celui que le lacet RÉEL regarde
  // (`viewRot`), pas celui du store : sous lacet libre `camRot` ne bouge plus, et un demi-tour
  // laisserait le dégagement au cran du départ. Il ne change qu'au FRANCHISSEMENT d'un quart —
  // l'abonnement au lacet est ce qui fait re-rendre à ce moment-là.
  // `dimsVue` porte en plus le lacet, celui de l'instant du COMMIT : c'est la projection que reçoivent
  // le picking et TOUS les overlays SVG — le seul endroit où le lacet entre dans un rendu du stage,
  // `tileCenter` s'occupant du reste (`geometry/iso.ts`). Ce qui vit à l'IMAGE (caméra volumique,
  // groupe d'overlays) lit `dimsAt`, jamais cette valeur-là.
  // Le lacet n'AVISE qu'au DISCRET (#1403, `state/stageYaw`) : franchissement de cran, départ et arrêt
  // du régime, pose au pointeur. S'y abonner EST la dépendance de rendu des deux formes ci-dessous
  // (`viewRot`/`viewYawDeg` lisent la source à l'instant du commit, pas une valeur passée) ; entre deux
  // avis, le lacet AVANCE quand même (le prélude du battement, ci-dessous) et ce sont les lecteurs
  // par-frame qui le suivent : la caméra volumique par `yawAt`, le groupe d'overlays par sa
  // reprojection. Un avis par image serait un commit React par image.
  useSyncExternalStore(subscribeStageYaw, getStageYaw, getStageYaw);
  // RÉGIME du lacet — état DISCRET (il ne change qu'au départ et à l'arrêt du geste) : c'est lui, et
  // rien d'autre, qui fait tenir les images à l'hôte pendant une rotation. Le module n'a plus d'horloge.
  const lacetTenu = useSyncExternalStore(subscribeStageYaw, lacetActif, lacetActif);
  useBattementContinu(lacetTenu, 'lacet');
  const cranVue = viewRot(shownRot) ?? shownRot;
  const dims = useMemo<Dims>(() => ({ ...(scene?.dimensions ?? { w: 1, h: 1 }), rot: cranVue, view: pov ? 'iso' : viewMode, edge: shownEdge }), [scene, cranVue, viewMode, shownEdge, pov]);
  /** Projection VIVE à l'instant d'une IMAGE : le lacet y est RELU. Ce que lisent les consommateurs
   *  par-frame (caméra, cadre de tuiles visibles), jamais un rendu React. */
  const dimsAt = (): Dims => ({ ...dims, yawDeg: viewYawDeg(shownRot, shownEdge) });
  // Projection du COMMIT : le lacet y est celui de l'instant du rendu — RELU à chaque rendu, et donc
  // dépendance de la projection commise. C'est ce qui rend la reprojection d'écran du groupe
  // TENABLE : elle se mesure entre cette projection et celle de l'image, et tout commit la ramène à
  // rien (le lacet n'avise qu'au discret, un rendu par cran / départ / arrêt / pose — jamais par
  // image). La figer au cran, c'est laisser le résidu sous-cran survivre au dernier battement :
  // overlays et picking peints à un lacet, monde à un autre, sans plus rien pour les recaler.
  const yawVue = viewYawDeg(shownRot, shownEdge);
  const dimsVue = useMemo<Dims>(() => ({ ...dims, yawDeg: yawVue }), [dims, yawVue]);
  const dimsVueRef = useRef(dimsVue);
  dimsVueRef.current = dimsVue;
  // Le cadre COMMIS est PUBLIÉ (`stage/spritePicker.ts`) : la sonde de recette résout sur celui que
  // l'écran rend — première personne et lacet lissé compris — au lieu de le rebâtir depuis le store.
  // La CAMÉRA y va en LECTEUR de `camRef` (jamais une copie) : c'est la valeur que le pointeur lui-même
  // inverse, et la boucle d'images la réécrit après chaque calcul de focal, sans rendu React.
  useEffect(() => { setStageFrame({ dims: dimsVue, camRendue: () => camRef.current, zoom, aretes: () => aretesEcranRef.current }); }, [dimsVue, zoom]);
  useEffect(() => () => setStageFrame(null), []);
  const partyLeader = meneurDuMonde({ party });
  // PLACE ASSISE du meneur — résolue UNE fois pour tout l'écran (corps, chrome, caméra, POV). Le
  // point de RENDU du meneur en découle : son ancre s'il est attablé, sa case sinon. `partyPos`, lui,
  // ne bouge jamais : c'est la case d'abord, celle du brouillard, des chemins et des déclencheurs.
  const partySeat = scene && partyLeader ? seatPoseOf(scene, { kind: 'party', rang: RANG_MENEUR }) : null;
  const posDeRendu = partySeat ? { x: partySeat.anchor.x, y: partySeat.anchor.y, z: partyPos.z } : partyPos;
  const wnow = performance.now();
  // Position VISUELLE des jetons à un instant donné : le rendu la demande au sien, les boucles hors
  // React (caméra volumique, chrome des jetons) la redemandent à chaque frame de marche.
  const walkPosAt = (now: number): WalkPos => (id, x, y) => walkPoseAt(walksRef.current[id], x, y, now);
  const walkPosOf: WalkPos = walkPosAt(wnow);

  // ── CAMÉRA À UN INSTANT (la seule définition) : point focal (paire de visée / actif / leader),
  // ADOUCI quand la cible SAUTE, puis décalage manuel de la vue. Le rendu la demande à `wnow` ; la
  // boucle de rendu la redemande PAR FRAME, ce qui la fait glisser sans aucun rendu React (#1176,
  // P2-4). UNE valeur par image pour ses DEUX clients — la caméra three (par `camAt` du cadre) et le
  // groupe d'overlays SVG : aucun d'eux ne lisse quoi que ce soit de son côté.
  const targeting = mode === 'battle' && battle ? cameraTargeting(battle, actorAim) : null;
  // La caméra cadre le CORPS, donc son point de rendu (assis : l'ancre de sa place).
  const argsFocal = { mode, battle, partyPos: posDeRendu, partyLeader, planView, hoverCombatantId, targeting, pendingAttack, pendingCast };
  /** Point focal ÉCRAN à un instant (avant décalage manuel), sans adoucissement : la cible VIVE. */
  const focalBrutAt = (now: number) => {
    const focus = stageFocus({ ...argsFocal, walkPosOf: walkPosAt(now) });
    // Visée du SUJET : le milieu de sa capsule (`actorCapsuleOf`, la même que consomme l'occlusion), et
    // non le sol de sa case — viser le sol décale le cadre d'une demi-capsule vers le haut de la scène,
    // donc vers ce qui SURPLOMBE le sujet (biais multiplié par le zoom).
    // Projection VIVE (`dimsAt`) et non celle du commit : la caméra volumique cadre le point MONDE que
    // cette valeur désigne à l'écran (`stage3dFramingFor`), et lire deux lacets aux deux bouts de la
    // même image ferait dériver le sujet au lieu de le faire tourner autour.
    const fc = capsuleCenter(actorCapsuleOf(
      { x: focus.x, y: focus.y, h: heightAt(scene!, Math.round(focus.x), Math.round(focus.y), activeZ) },
      dimsAt(),
    ));
    return { x: VW / 2 - fc.x, y: VH / 2 - fc.y };
  };
  /** Caméra ET point focal adouci du même instant, en UN calcul (la boucle a besoin des deux). */
  const camEtFocalAt = (now: number) => {
    const pan = getStagePan();
    if (!scene) return { cam: { x: pan.x, y: pan.y }, focal: focalRef.current };
    const focal = adoucirFocal(lissageRef.current, focalBrutAt(now), now);
    return { cam: { x: focal.x + pan.x, y: focal.y + pan.y }, focal };
  };
  const camAt = (now: number) => camEtFocalAt(now).cam;
  // SUJET que la caméra suit à ce rendu — l'entrée du saut de focale, décidé dans la phase d'EFFET
  // ci-dessous (`useLayoutEffect`) : un rendu jeté avant commit n'arme donc aucune image et ne laisse
  // aucun lissage derrière lui.
  const sujetFocal = scene ? stageFocus({ ...argsFocal, walkPosOf }).sujet : '';
  // ZOOM APPLIQUÉ (creux de la transition de cran compris) : la même valeur pour le canevas et pour le
  // groupe d'overlays.
  const zoomVue = zoom * (turning ? 0.97 : 1);
  // REGARD servi au monde volumique : référence STABLE tant que la géométrie de la vue ne bouge pas
  // (cran/lacet, zoom). La caméra n'y est pas une VALEUR mais `camAt`, que la boucle de rendu redemande
  // à SA cadence — un cadre reforgé par image re-rendait tout le sous-arbre volumique à chaque geste.
  const camAtRef = useRef(camAt);
  camAtRef.current = camAt;
  const camAtStable = useRef((now: number) => camAtRef.current(now)).current;
  // LACET À L'IMAGE, même patron : le monde volumique le REDEMANDE dans sa passe de dessin au lieu de
  // recevoir l'angle du dernier commit — sans quoi il ne tournerait qu'aux crans.
  const yawAtRef = useRef(() => viewYawDeg(shownRot, shownEdge));
  yawAtRef.current = () => viewYawDeg(shownRot, shownEdge);
  const yawAtStable = useRef((): number => yawAtRef.current()).current;
  // LE REGARD, et rien d'autre : c'est le SEUL endroit où les deux vues divergent de cadrage.
  const frameMonde = useMemo<WorldFrame>(
    () => (pov
      // L'ŒIL suit le CORPS : attablé, on regarde depuis sa place, pas depuis la case d'abord.
      ? { mode: 'pov', partyPos: posDeRendu, facing: capPov ?? 'S', indoor, cid: partyLeader?.id ?? null, ...(partySeat && scene ? { eyeH: seatedEyeH(scene, partySeat, partyPos.z ?? 0) } : {}) }
      : { mode: 'plateau', dims: dimsVue, camAt: camAtStable, yawAt: yawAtStable, zoom: zoomVue }),
    [pov, posDeRendu.x, posDeRendu.y, posDeRendu.z, capPov, indoor, partyLeader?.id, partySeat?.anchor.h, dimsVue, zoomVue, camAtStable, yawAtStable],
  );
  // ── BUILDERS (camera-free) : memos qui survivent aux rotations/projections ──────────────────────
  // Cases LOGIQUES des alliés — ce que la marche fait glisser, jamais ce qu'elle fait bouger.
  const allyBases = mode === 'battle' && battle
    ? battle.combatants.filter((c) => c.kind === 'hero' && c.pos).map((c) => ({ id: c.id, x: c.pos!.x, y: c.pos!.y, z: c.pos!.z ?? 0 }))
    : [{ id: partyLeader?.id ?? 'party', x: partyPos.x, y: partyPos.y, z: partyPos.z ?? 0 }];
  // Case ARRONDIE (grille) : la position VISUELLE glisse en continu (~60/s pendant la marche) mais la
  // case qu'elle OCCUPE (pièce/toit/prop) est un événement DISCRET — la clé ne change qu'au
  // franchissement d'une case, ce qui stabilise la RÉFÉRENCE `visualAllies` (donc `cutawayAllies`/
  // `propEls`, #817) tant que le groupe reste dans la même case ; le jeton continue de glisser sans
  // à-coup ailleurs (`walkPosOf` direct dans la caméra, non affecté par ce memo).
  const visualTilesAt = (now: number) => allyBases.map((a) => {
    const p = walkPoseAt(walksRef.current[a.id], a.x, a.y, now);
    return { id: a.id, x: Math.round(p.x), y: Math.round(p.y), z: a.z };
  });
  const tilesKey = (tiles: readonly { id: string; x: number; y: number; z: number }[]) => tiles.map((t) => `${t.id}:${t.x},${t.y},${t.z}`).join('|');
  const visualAlliesKey = tilesKey(visualTilesAt(wnow));
  const visualAllies = useMemo(
    () => visualTilesAt(wnow).map(({ x, y, z }) => ({ x, y, z })),
    [visualAlliesKey],
  );
  const visualPartyPos = visualAllies[0] ?? partyPos;
  const roomFocus = useMemo(
    () => scene ? roomFocusAt(scene, { x: Math.round(visualPartyPos.x), y: Math.round(visualPartyPos.y), z: visualPartyPos.z }) : null,
    [scene, visualPartyPos.x, visualPartyPos.y, visualPartyPos.z],
  );
  const cutawayAllies = debugRoofCut ? roomCutawayAllies(roomFocus, visualAllies) : undefined;
  // Le monde glisse dans la boucle de rendu et React ne rend plus rien entre deux pas — ni pendant un
  // glisser-caméra, ni pendant l'approche d'une focale. Ce que l'hôte écrit HORS de React suit donc
  // le BATTEMENT (`stage/stageFrames`) : la caméra que lisent les handlers du pointeur (`camRef` —
  // seule source de l'inversion pixel→tuile, `useStagePointer`), le cadre de tuiles visibles
  // (`setVisibleTileBounds`) et le transform du groupe d'overlays SVG (curseur, aperçu de chemin,
  // télégraphes), qui décrocheraient du monde d'une case entière.
  // Le FRANCHISSEMENT d'une case, lui, n'est pas une affaire d'image : c'est l'événement DISCRET dont
  // dépendent les vérités de pièce et de dégagement (`visualAllies` → `roomFocus`/`cleared`/`propEls`).
  // Il demande UN rendu — à la cadence du PAS, jamais à celle de la frame.
  // LE LACET AVANCE ICI, et nulle part ailleurs (#1403) : le battement le tire, il ne se pousse pas.
  // En PRÉLUDE de l'image, donc avant TOUT lecteur — la passe de dessin du canevas volumique et la
  // reprojection d'overlays ci-dessous lisent le même angle, celui de leur propre image.
  useEffect(() => subscribeStagePrelude(avancerLacet), []);
  useEffect(() => subscribeStageFrames(() => {
    const now = performance.now();
    const lissage = lissageRef.current;
    if (lissage && now - lissage.t0 >= DUREE_FOCALE_MS) {
      lissageRef.current = null;
      relacherFrames(sourceFocale); // la focale est arrivée : plus rien à tenir en images
    }
    const { cam: c, focal } = camEtFocalAt(now);
    const dimsImage = dimsAt();
    camRef.current = c;
    focalRef.current = focal;
    setVisibleTileBounds(computeViewBounds(c, zoom, dimsImage));
    const g = camGRef.current;
    // Le groupe d'overlays porte sa caméra ET, pendant une rotation, la reprojection d'écran de ce que
    // le lacet a parcouru depuis le commit (`stageYawCorrection`, chaîne vide hors rotation).
    if (g) g.style.transform = `${stageCamTransform(c, zoomVue)} ${stageYawCorrection(dimsVueRef.current, dimsImage)}`.trim();
    const k = tilesKey(visualTilesAt(now));
    if (k !== visualAlliesKey && demandeRef.current !== k) {
      demandeRef.current = k;
      setWalkStep((n) => n + 1);
    }
  }));
  // SAUT DE FOCALE : la caméra change de SUJET (unité active, peek de frise, paire de visée). La vue y
  // court depuis le point qu'elle occupait, en JS, dans la valeur que les DEUX clients lisent, et un
  // rAF tient l'image tant que l'approche dure. Un panoramique manuel n'est pas un saut : il reste 1:1.
  // En phase d'EFFET (jamais de rendu) et AVANT la peinture : le battement immédiat réécrit la vue au
  // point quitté, que le rendu venait de poser sur la nouvelle cible.
  useLayoutEffect(() => {
    const now = performance.now();
    if (sujetFocalRef.current !== sujetFocal) {
      if (sujetFocalRef.current !== null) {
        lissageRef.current = { depart: focalRef.current, t0: now };
        demanderFrames(sourceFocale);
        battreStageFrames();
      }
      sujetFocalRef.current = sujetFocal;
    }
    focalRef.current = camEtFocalAt(now).focal;
  });
  // La demande de frames de l'adoucissement meurt AVEC l'écran : une source oubliée ferait battre la
  // boucle sur un stage démonté.
  useEffect(() => () => relacherFrames(sourceFocale), [sourceFocale]);
  // RECENTRAGE (touche dédiée, nouvelle unité active, cran de vue) : il remet le décalage vivant à zéro
  // sans qu'aucun rendu ne suive forcément — un glisser en cours n'a rien commis. La vue le peint donc
  // au battement, comme tout le reste.
  useEffect(() => subscribeStagePan(battreStageFrames), []);
  // ESPACE DÉGAGÉ (#818, #907, #950) — UNE loi pour toute l'architecture. Une nappe n'est peinte que
  // si le groupe la VOIT (`seenSections`, nourri des cases explorées de `state/vision.ts`), et ce
  // qui l'ABRITE est RETIRÉ, à l'échelle de la MASSE, jamais voilé ni découpé panneau par panneau :
  // sa pièce, l'emprise qui l'abrite, les niveaux au-dessus de lui (`clearedSpace`). Les façades
  // frontales de cet espace tombent du même geste (`frontFacadeCutaway`), et rien au niveau du groupe
  // n'est retiré. Une masse qui le CACHE à l'écran sans l'abriter n'est PAS retirée — elle reçoit un
  // trou local (#1176, M3, `stage/percage.ts`).
  const roofGeom = useMemo(() => (scene ? buildRoofs(scene) : []), [scene]);
  const lids = useMemo(
    () => (pov ? [] : roofGeom.map((el) => ({
      sectionId: el.sectionId ?? el.key, // nappe hors masse authorée : elle est sa propre section
      z: el.cell.z,
      cells: el.cells,
      occluder: elOccluder(el, dims),
    }))),
    [roofGeom, dims, pov],
  );
  // ALLIÉS COIFFABLES : leur case VISUELLE, leur `cid` et leur capsule d'écran — les entrées du trou
  // local (#1176, M3), résolues ICI parce qu'elles exigent la projection (donc l'hôte, jamais le
  // builder).
  const alliesCoiffables = useMemo(
    () => (scene
      ? visualTilesAt(wnow).map((t) => ({
        cid: t.id,
        capsule: actorCapsuleOf({ x: t.x, y: t.y, h: heightAt(scene, t.x, t.y, t.z) }, dims),
        z: t.z,
      }))
      : []),
    [scene, visualAlliesKey, dims],
  );
  // À hauteur d'œil, RIEN n'est dégagé (`keepEl` y rend tout) : la résolution du dégagement — la
  // passe la plus chère de la chaîne, rejouée à chaque pas — n'aurait aucun lecteur.
  const cleared = useMemo(
    () => (scene && !pov && debugRoofCut ? clearedSpace(scene, visualAllies, exploredSet) : NO_CLEARED_SPACE),
    [scene, visualAllies, exploredSet, pov, debugRoofCut],
  );
  // DÉCOUPE LOCALE PAR OCCLUSION (#1176, M3) : ce que la boucle de rendu volumique reprend à la CLÉ
  // (pas franchi, quart de tour, étage) pour percer un trou dans la masse qui cache un héros à
  // l'écran. Les entrées sont celles ci-dessus, sans un seul second calcul.
  const percage = useMemo(
    () => (scene && !pov
      ? { cle: clePercage({ tuiles: visualTilesAt(wnow), rot: dims.rot ?? 0, view: dims.view ?? 'iso', activeZ }), lids, heros: alliesCoiffables }
      : null),
    [scene, visualAlliesKey, dims, activeZ, lids, alliesCoiffables, pov],
  );
  // Les MÊMES vérités, dans la forme que consomme la voie VOLUMIQUE (#1176) : le dégagement en canal
  // GÉOMÉTRIE (une masse dégagée ne se rend pas), la visibilité en canal TEINTE. Un seul jeu de lois.
  // ZONES DE PIÈCE résolues sur la scène VIVE (#1176, P3-3) : le monde cuit ne les retient PLUS
  // (`elCuit`, `backends/webgl/sceneMeshes.ts`) parce qu'elles descendent de `scene.effectZones`, qui
  // n'est pas dans le read-set de la cuisson — un `roomZoneIds` cuit aurait périmé en silence. La loi
  // ci-dessous les redemande par la CLÉ de l'élément.
  const zonesVives = useMemo(() => (scene ? roomZonesByElKey(scene) : new Map<string, readonly string[]>()), [scene]);
  const loiDeDégagement = useMemo<KeepEl>(() => (el) => {
    // VUE DU DESSUS (#892) : on regarde UN plancher à la VERTICALE — superposer le rez à l'étage rend
    // le plan illisible. La loi voyageait dans le `viewZ` que les builders de sols et de murs
    // recevaient ; la masse est désormais CUITE en bloc (`bakeWorldGeometry` prend la scène entière),
    // c'est donc ici qu'elle s'applique. Les NAPPES en sont exemptes, comme elles l'étaient : leur
    // retrait se décide par MASSE (loi de dégagement), jamais par étage rendu.
    // NAPPE PORTEUSE (`nappePorteuse`) : un pan de toit et le décor volumique qui lui est SOLIDAIRE
    // (faîteau) suivent le même sort, par le même canal — l'ornement se lève avec son toit au lieu de
    // flotter au-dessus du vide, et l'étage rendu ne les tranche ni l'un ni l'autre.
    const nappe = nappePorteuse(el);
    if (planVue && !nappe && el.cell.z !== activeZ) return false;
    if (nappe) {
      // DÉCOUVERT PERMANENT (#1176, P3-5) : sous un regard qui ne montre pas les toits, aucune nappe
      // ne se dessine — la loi de dégagement (`clearedSpace`) reste entière pour le plateau iso, où
      // elle continue de retirer ce qui abrite le groupe.
      if (!politique.toitsVisibles) return false;
      return cutawayForSection({
        sectionId: nappe.sectionId,
        roomZoneIds: zonesVives.get(el.key),
        cells: nappe.cells.map((c) => spaceCellKey(c.x, c.y, el.cell.z)),
      }, cleared) === 'visible';
    }
    // Sol, mur d'étage, décor : tout ce qui se pose ou se dresse sur un niveau n'obéit qu'au couvercle
    // au-dessus des têtes (`cutawayOverhead`).
    if (cutawayOverhead(el.cell, cleared)) return false;
    if (el.kind === 'wall') {
      // MURS AU TRAIT (#1176, P3-5b) : sous un regard qui les rend au trait symbolique SVG
      // (`stage/layers.wallTraitObjs`), le monde volumique n'en peint AUCUN — verdict exclusif, jamais
      // une coiffe gardée sous le trait.
      if (politique.mursAuTrait) return false;
      return !frontFacadeCutaway({ ...el, roomZoneIds: zonesVives.get(el.key), x: el.cell.x, y: el.cell.y, z: el.cell.z }, cleared, dims);
    }
    return true;
  }, [cleared, dims, zonesVives, planVue, politique, activeZ]);
  // ÉCART DE REGARD nº 1 : à hauteur d'œil, tout se dessine.
  const keepEl = pov ? TOUT_SE_DESSINE : loiDeDégagement;
  // CHAMP de visibilité (#1176, C6) : le monde volumique l'échantillonne PAR SOMMET, les corps posés
  // sur leur case y lisent la valeur discrète de la leur. Les dimensions bornent le champ : hors carte,
  // il se rabat sur le bord au lieu d'assombrir le pourtour d'un dehors inconnu.
  const tintAt = useMemo<TintAt>(
    () => visibilityField(visible, exploredSet, scene?.dimensions ?? { w: 0, h: 0 }),
    [visible, exploredSet, scene],
  );
  // `roofEls` garde l'identité de ses sections d'un pas à l'autre (aucune section réallouée) — ce dont
  // dépendent les memos en aval : la GÉOMÉTRIE des nappes est mémoïsée par la scène, et seul le
  // dégagement s'y rejoue, par la loi commune, sur la SECTION entière (tous les pans d'une masse).
  const roofEls = useMemo(
    () => (pov ? [] : roofGeom.filter((el) => cutawayForSection({
      sectionId: el.sectionId ?? el.key,
      roomZoneIds: el.roomZoneIds,
      cells: el.cells.map((cell) => spaceCellKey(cell.x, cell.y, el.cell.z)),
    }, cleared) === 'visible')),
    [roofGeom, cleared, pov],
  );
  // Le MÊME verdict, rendu par SECTION : les nappes que la frame PEINT. La météo volumique s'en sert
  // pour écrêter ce qui tombe au-dessus d'un toit levé (#1247) — la pluie s'y arrêtait en l'air. Il se
  // LIT sur `roofEls`, la sortie même de la loi de dégagement : aucune seconde application.
  const nappesVues = useMemo(() => new Set(roofEls.map((el) => el.sectionId ?? el.key)), [roofEls]);
  const nappeVue = useMemo(() => (sectionId: string) => nappesVues.has(sectionId), [nappesVues]);
  // ÉCART DE REGARD nº 2 : le dégagement des décors est une loi de plateau (retirer ce qui coiffe le
  // groupe) ; à hauteur d'œil rien n'est retiré, et aucun allié ne « découvre » sa pièce — c'est
  // exactement ce que `keepEl` dit déjà à la masse, et le décor billboard n'en est qu'une INSTANCE
  // (#1317) : une seule expression de la loi d'écran, jamais une copie par voie de rendu. Le décor
  // VOLUMIQUE la reçoit par le même `keepEl`, au masque du monde cuit (`applyCutawayMask`).
  // DEUX mémos, parce que ce sont deux CADENCES : l'ÉMISSION scanne toute la scène (500+ entités à
  // l'opéra) et ne dépend que de vérités de scène ; le FILTRE est la loi d'écran, dont la chaîne
  // contient `dims` — un cran de rotation de caméra en fait une référence neuve. Fondus en un seul
  // mémo, un quart de tour rebâtissait tout le décor de la carte (#817, même maladie que `visualAllies`).
  const propsEmis = useMemo(
    () => (scene ? buildProps(scene, visible, pov ? { viewZ: layerZ } : { viewZ: layerZ, allies: cutawayAllies }) : []),
    [scene, visible, layerZ, cutawayAllies, pov],
  );
  const propEls = useMemo(() => propsEmis.filter(keepEl), [propsEmis, keepEl]);
  const tokenEls = useMemo(
    () => (scene ? buildTokens(scene, visible, mode === 'battle' && battle ? battle : null, { activeZ, viewZ: layerZ, top: politique.montesDissocies }) : []),
    [scene, visible, mode, battle, activeZ, layerZ, politique],
  );

  // Les vérités de surbrillance sont assemblées par le monde volumique lui-même
  // (`combatHighlightsView`), à partir de ce contexte de tour. TOUT ce dont ces marques dépendent y
  // entre, y compris ce qui vit à la RACINE du store, hors `battle` : l'INTENTION ARMÉE
  // (`state/localIntent`) et le SURVOL (`store.hovered`, qui allume les bandes de portée d'un tireur).
  // Sans elles ici, l'écran déjà monté ne réapprenait jamais leur changement — les marques ne se
  // peignaient qu'au MONTAGE (sonde `intention-peinture-vive`).
  // Le survol n'entre QUE s'il peint (`tireurSurvole`, verdict partagé avec la vue) : survoler un
  // combattant sans arme à distance ne change aucune marque, et reforger la liste pour lui faisait
  // réécrire tous les pools d'instances pour une image identique (garde `marques-en-place`).
  const combatBattle = mode === 'battle' && battle ? battle : null;
  const hoveredTireur = combatBattle ? tireurSurvole(combatBattle, hovered) : null;
  const highlightOpts = useMemo<HighlightOpts>(
    () => ({ myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast, localIntent, hovered: hoveredTireur }),
    [myTurn, pendingAttack, pendingCleave, pendingDualStrike, pendingCast, localIntent, hoveredTireur],
  );

  // ── Pointeur & visée au survol ──────────────────────────────────────────────────────────────────
  // Le picking désigne des cases du MONDE : il vit avec lui, et ses verdicts (survol, fantômes)
  // nourrissent les marques que le monde peint. La surcouche de plateau ne fait que porter les
  // handlers sur son SVG.
  // Suivi du SURVOL : tout contexte où l'on cible par la carte — mode neutre (attaque implicite),
  // incantation (tooltip + gabarit ZdE), et flux différés (Frappe Mortelle / 2ᵉ frappe / Surincantation).
  const hoverTracking =
    mode === 'battle' && !!battle && !battle.over &&
    (((battle.action === null || battle.action === 'cast') && activeC?.kind === 'hero') ||
      !!preemptAiming || // Tir rapide armé pendant la pause : on suit le survol (réticule + trait de visée) alors qu'il n'y a AUCUN actif
      !!pendingCleave || !!pendingDualStrike || !!pendingCast?.pickingTargets || !!placingZoneOf({ pendingCast, pendingSiegeAim, battle }));
  // Le picking inverse la projection COMMISE : exacte à chaque commit du lacet (cran, départ, arrêt,
  // pose au pointeur). PENDANT un maintien entre deux crans, elle retarde du lacet parcouru depuis le
  // dernier commit — jusqu'à un demi-cran, le temps du geste (#1403).
  // ── Accès de PIÈCE et ARÊTES UTILISABLES ──────────────────────────────────────────────
  // `portalsForParty` lit les accès de la scène (mémoïsés) et, hors zone intérieure, ne garde que les
  // sorties de la COMPOSANTE marchable du groupe (`walkComponentAt`, étiquetage bâti une fois par
  // scène — #1416). Ses seules vraies entrées sont la SCÈNE (réf neuve dès qu'une porte s'ouvre —
  // `wallEdges`/`doorIsOpen` lisent `scene.flags`) et la case de CONTRÔLE arrondie ; le glissement
  // visuel d'une marche n'en fait pas partie, donc une image d'animation ne recalcule aucun accès (#817).
  const doorCtrlKey = combatBattle
    ? (myTurn && activeC?.kind === 'hero' && activeC.pos ? `${activeC.id}@${activeC.pos.x},${activeC.pos.y},${activeC.pos.z ?? 0}` : '')
    : `party@${partyPos.x},${partyPos.y},${partyPos.z ?? 0}`;
  const doorCtrls = useMemo<Pt[]>(
    () => (combatBattle ? (myTurn && activeC?.kind === 'hero' && activeC.pos ? [activeC.pos] : []) : [partyPos]),
    [doorCtrlKey],
  );
  const portals = useMemo(
    () => (scene && doorCtrls.length ? portalsForParty(scene, doorCtrls[0], occupiedInteriorZoneIds(scene, doorCtrls)) : []),
    [scene, doorCtrls],
  );
  // Les ARÊTES que le picking consulte AVANT le rayon, et que le peintre unique rend : UNE population,
  // dérivée ici (`state/aretes.ts`) et projetée là (`stage/aretesProjetees.ts`). Le CONTRÔLEUR est le
  // même pour les quatre capacités — celui qui borde les seuils et qui FRAPPE : le groupe hors combat,
  // le héros actif quand c'est mon tour, personne sinon. Le COMBAT entre avec lui : une fortification
  // d'arête n'est une cible que tant qu'un Combattant la tient (`state/combatSlice.ts` l'enrôle), et
  // une arête qui porte un seuil ET une fortification sort en structure — `PRIORITE_ARETES` tranche, pas l'ordre
  // de peinture.
  const aretes = useMemo(
    () => (scene ? aretesUtilisables({ scene, visible, controleur: doorCtrls[0] ?? null, activeZ, battle: combatBattle, portails: portals }) : []),
    [scene, visible, activeZ, portals, doorCtrls, combatBattle],
  );
  const aretesEcran = projeterAretes(aretes, dimsVue, liftOf);
  // La réf ne se pose qu'au COMMIT, comme celle de la caméra : un rendu jeté avant commit publierait
  // aux sondes une offre que l'écran ne montre pas.
  useLayoutEffect(() => { aretesEcranRef.current = aretesEcran; }, [aretesEcran]);

  const pointeur = useStagePointer({ svgRef, dims: dimsVue, zoom, camRef, hoverTracking, partyLeader, activeZ, aretes: aretesEcran });
  const hover = pointeur.hover;
  const visée = useHoverTargeting(scene, hover, myTurn, pointeur.areteSurvolee?.portail ?? null);

  // MARQUES DYNAMIQUES : dérivées UNE fois (`builders/dynamicMarks`) et servies au monde volumique — le
  // contexte qui les autorise (mode, dialogue ouvert) se tranche ici, et nulle part ailleurs. Les
  // ANNEAUX d'équipe (P3-0e) se dérivent des jetons du builder et du meneur hors combat : la population
  // des jetons RÉELLEMENT postés.
  // Les trois dérivations qui suivent sont RETENUES sur leurs entrées (#1371) : le monde volumique les
  // prend en dépendance de son redessin, et une liste neuve par rendu y faisait peindre une image à
  // chaque commit de l'hôte — c'est ce qui les place AVANT les sorties anticipées ci-dessous.
  // ÉCART DE REGARD nº 3 : le meneur ne porte AUCUN billboard quand on regarde par ses yeux.
  // ASSISE DU MENEUR : dérivée UNE fois, ici (`builders/tokens.partyTokenOf`) — corps, chrome et
  // caméra lisent la MÊME pose. `partyPos` reste la position LOGIQUE (brouillard, chemins) ; le RENDU
  // suit l'ancre de la place.
  const partyToken = useMemo(
    () => (pov || combatBattle || !scene ? null : partyTokenOf(scene, partyLeader, partyPos)),
    [pov, combatBattle, scene, partyLeader, partyPos],
  );
  const marquesDyn = useMemo(
    () => dynamicMarks(mode === 'battle' ? battle : null, mode === 'exploration' && !dialogue ? partyPos : null, tokenEls, partyToken),
    [mode, battle, dialogue, partyPos, tokenEls, partyToken],
  );
  // JETONS POSTÉS (P3-0f, P3-5c) : même dérivation, même population que les marques dynamiques (les
  // jetons du builder, plus le meneur du groupe hors combat). La surcouche SVG en peint le chrome, et
  // le CORPS sous le verdict `pionsEnDisques` ; le monde volumique n'en reprend que l'allure, au
  // matériau de ses quads. Dérivée SANS condition de mode : un figurant d'exploration est un jeton, et
  // sous ce verdict c'est ici qu'il se dessine (le chrome, lui, reste vide pour lui).
  const chromes = useMemo<TokenChromeMark[]>(
    () => tokenChromes(tokenEls, { ghostIds: visée.ghostIds, hoveredId: visée.hoveredId }, partyToken),
    [tokenEls, visée.ghostIds, visée.hoveredId, partyToken],
  );
  // PASTILLES D'ENTITÉ (#1411 P2-C, spec zone 4) : ce que les CHOSES du champ offrent — en combat à
  // l'actif contrôlé, lu au REGISTRE (`state/entityGestes`, aucun id d'action ici) ; hors combat au
  // groupe (`state/offresUtilisables`) — puis posé sur leur porteur par le même ancrage que le chrome.
  // UN RÉGIME pour les deux producteurs : les porteurs À PORTÉE, le survol n'y entre pas. Les offres se
  // relisent quand change ce dont elles dépendent : le combat, la scène (les objets au sol y vivent),
  // les drapeaux de fouille, le siège qui joue, et la position du groupe (qui décide de la portée).
  const offresDEntite = useMemo(
    () => (combatBattle && myTurn ? entityGestes(useGame.getState()) : offresUtilisables(useGame.getState())),
    [combatBattle, scene, flags, myTurn, partyPos],
  );
  const gesteEls = useMemo<GesteMark[]>(
    () => tokenGesteMarks(tokenEls, propEls, offresDEntite),
    [tokenEls, propEls, offresDEntite],
  );
  // HALOS D'INTERACTION (P3-0g ; régime de révélation #1687) : même partage que les marques dynamiques
  // — dérivés UNE fois (`builders/interactHalos`), et servis aux DEUX peintres (anneaux du monde
  // volumique, plaques de nom de la surcouche). Même couple d'entrées que les pastilles de gestes
  // (jetons ET décors) : un marchand à qui parler est un utilisable comme un coffre à fouiller. Le
  // RÉGIME est tout ce que la frame en dit : l'entité sous le curseur (celle que le clic traiterait,
  // résolue par le pointeur) et la révélation tenue (Alt). Aucun mode n'y entre : ce que le monde offre
  // ne dépend pas du combat.
  const halos = useMemo<readonly InteractHalo[]>(
    () => (scene ? interactionHalos(tokenEls, propEls, scene, flags, { survol: pointeur.entiteSurvolee, reveler }) : NO_INTERACTION_HALOS),
    [tokenEls, propEls, scene, flags, pointeur.entiteSurvolee, reveler],
  );

  if (!scene) return null;
  if (sansMonde) return <SansWebgl />;

  // ── Par-frame : position VISUELLE interpolée (anti-téléportation) ──────────────────────────────
  // Une marche en cours ? La caméra suit image par image : on COUPE la transition CSS du transform
  // (sinon elle « chasse » une cible mobile et traîne ~0,3 s derrière).
  const anyWalking = Object.keys(walksRef.current).length > 0;

  // ── Caméra : point focal (paire de visée / actif / leader) + culling d'animation ────────────────
  const cam = camAt(wnow);
  camRef.current = cam;
  setVisibleTileBounds(computeViewBounds(cam, zoom, dimsVue)); // écriture dans un module = pas de re-rendu

  // Transform CAMÉRA (pan/zoom/rotation) — partagée par le groupe principal ET l'overlay d'étiquettes
  // de zone (Bug lisibilité #782 : ce dernier doit suivre la même projection).
  // AUCUNE transition sur `transform` : ce groupe suit la caméra à l'image près, comme le canevas
  // volumique qui se pose, lui, sans le moindre lissage. Ce qui doit glisser glisse dans `camAt`
  // (`adoucirFocal`), donc pour les DEUX à la fois. Le creux du dim-and-turn reste une OPACITÉ.
  const camTransform = stageCamTransform(cam, zoomVue);

  return (
    <>
      {/* Le MONDE : POSITION ET TYPE FIXES dans l'arbre. Il ne se démonte qu'avec l'écran de campagne
          — une bascule de regard ne fait que lui servir un autre `frame`. */}
      <VolumetricWorld
        scene={scene}
        mpt={mpt}
        frame={frameMonde}
        tintAt={tintAt}
        keepEl={keepEl}
        nappeVue={pov ? undefined : nappeVue}
        tokenEls={tokenEls}
        propEls={propEls}
        walksRef={walksRef}
        gameTime={gameTime}
        lightLevel={lightLevel}
        lights={lightSources}
        battle={combatBattle}
        highlightOpts={highlightOpts}
        dynMarks={marquesDyn}
        halos={halos}
        partyToken={partyToken}
        chromes={chromes}
        percage={percage}
        pionsEnDisques={politique.pionsEnDisques}
      />
      {/* LA SURCOUCHE — ce que le regard ADRESSE : overlays d'interaction et picking du plateau,
          voiles d'écran de la première personne. Elle se démonte et se remonte librement. */}
      <SceneErrorBoundary>
        {pov ? (
          <SurcouchePov indoor={indoor} />
        ) : (
          <SurcoucheIso
            scene={scene}
            dims={dimsVue}
            turning={turning}
            activeZ={activeZ}
            visible={visible}
            tintAt={tintAt}
            liftAt={liftAt}
            liftOf={liftOf}
            aretes={aretesEcran}
            politique={politique}
            chromes={chromes}
            gestes={gesteEls}
            walkPosAt={walkPosAt}
            activeC={activeC}
            battle={combatBattle}
            myTurn={myTurn}
            mode={mode}
            targeting={targeting}
            anyWalking={anyWalking}
            camTransform={camTransform}
            camGRef={camGRef}
            poserSvg={poserSvg}
            pointeur={pointeur}
            visée={visée}
            halos={halos}
          />
        )}
      </SceneErrorBoundary>
    </>
  );
}
