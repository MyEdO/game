/**
 * RÉSOLUTION DU PICKING — « quel pixel désigne quoi ? », en UN lieu et en entier.
 *
 * Deux porteurs posent la question : le GESTE (`useStagePointer.pickVerdict`, ce qu'un clic fait) et la
 * SONDE DE RECETTE (`pickProbe.pickTileAt`, ce qu'une recette lit sans cliquer). Tenue en double, la
 * chaîne dérive — et une sonde qui a dérivé RAPPORTE un verdict que le clic ne rend pas, donc innocente
 * le pixel que le clic manque. `resoudrePixel` porte la chaîne COMPLÈTE (rayon → meuble dessiné → pas
 * inter-étages → case marchable → sol cross-couche) : aucun étage n'appartient plus à un porteur.
 * L'INVERSION DU PIXEL y est comprise (`pointStageSousPixel`) : c'est le dernier étage qui restait
 * tenu en double, et il divergeait par sa CAMÉRA — le geste inversait avec celle du rendu, la sonde
 * avec `store.camPan`, qui vaut (0,0) sur un écran centré sur le groupe.
 *
 * VERROU D'EXHAUSTIVITÉ (#1680 ligne 13) : ce module est le SEUL consommateur de la NATURE d'un
 * `PickResult`. Le `never` du défaut fait refuser par le compilateur une nature qu'aucune branche ne
 * nomme, là où une égalité sur `kind` la laisserait tomber en silence dans le repli de sol.
 */
import { isWalkable, liftDe, type Scene } from '../../noyau/monde/scene';
import { metricToLift } from '../../noyau/monde/relief';
import { memoByRef } from '../../noyau/monde/sceneMemo';
import { decorEnCaseEtage } from '../../noyau/monde/decorIndex';
import { resolveCursorZ } from '../../state/combatCursor';
import { walkNeighbors, type Pt } from '../../noyau/monde/path';
import { inBattleId } from '../../noyau/monde/combatants';
import { sceneAUnPropVolumique } from '../builders/props';
import { hasSpritePicker } from './spritePicker';
import { distanceAuSegment, type AreteProjetee } from './aretesProjetees';
import { screenToTileAtLift, type StagePose } from './projection';
import { stagePointAt, viewBoxPointAt } from './stageCam';
import type { Dims } from '../../geometry/iso';
import type { EtatEtage } from '../../state/viewLevel';
import type { AreteUtilisable } from '../../state/aretes';
import type { PickResult } from '../backends/webgl/spriteRaycast';

/** Ce que la résolution lit de l'état — la tranche EXACTE, jamais le store entier. Elle ÉTEND celle de
 *  l'étage affiché (`state/viewLevel.ts`) : le picking résout sur l'étage que l'écran montre. */
export interface EtatDePick extends EtatEtage {
  scene: Scene | null;
}

/** Par quelle voie la case a été désignée. L'ordre de ce type EST celui de la chaîne. */
export type PickVia = 'arete' | 'sprite' | 'decor' | 'meuble' | 'pas-etage' | 'sol' | 'aucune';

/** Verdict du picking sous un pixel : la case d'ANCRAGE (`null` = rien de dessiné), la NATURE de ce
 *  qui est frappé, et l'étage de la chaîne qui a tranché.
 *
 *  CE QUE CE TYPE FAIT (#1687) : le RAYON nomme l'entité qu'il a frappée (`nature: 'entite'`, `entId`)
 *  ou le combattant dont le jeton est sous le pixel (`nature: 'combattant'`, `cid`). Une case rendue
 *  par un étage de SURFACE (meuble dessiné, pas inter-étages, case marchable, sol cross-couche) ne
 *  nomme RIEN d'autre : ces étages inversent une géométrie, ils ne devinent aucune identité. La lecture
 *  PAR POSITION — « quelles entités sont ancrées sur cette case ? » — est assumée, unique et vit
 *  ailleurs : l'index case → entités de `noyau/monde/decorIndex.ts` (`entitesEnCaseEtage`), que les lecteurs
 *  composent quand la case, et non le pixel, est la question.
 *
 *  L'UNION est DISCRIMINÉE par `nature` : `'entite'` sans `entId` ne compile pas, et un lecteur qui
 *  branche sur `nature` reçoit du compilateur le `never` de son défaut si une nature s'ajoute. */
export type Verdict = {
  tile: { x: number; y: number; z: number } | null;
  cid: string | null;
  via: PickVia;
} & (
  | { nature: 'case' }
  | { nature: 'combattant' }
  /** Entité de scène frappée PAR LE RAYON (décor volumique, PNJ…). */
  | { nature: 'entite'; entId: string }
  /** ARÊTE utilisable sous le pixel (`state/aretes.ts`) : le geste qu'elle porte prime sur la case
   *  qu'elle borde. `tile` est son ANCRAGE — la case d'où le geste part. */
  | { nature: 'arete'; arete: AreteUtilisable }
);

/** LIFTS D'AFFICHAGE distincts d'une scène, du plus HAUT au plus bas — l'ensemble des hauteurs
 *  auxquelles une case peut être DESSINÉE (`metricToLift` de chaque hauteur de relief authorée, plus le
 *  sol). Un pixel doit être inversé à CHACUN d'eux pour retrouver la case qu'on voit : le relief n'est
 *  pas une couche, c'est une hauteur continue. Mémoïsé par identité de scène (`memoByRef`). */
export const sceneLifts = memoByRef((scene: Scene): readonly number[] =>
  [...new Set([0, ...scene.layers.flatMap((layer) => [...(layer.height ?? [])]).map(metricToLift)])]
    .sort((a, b) => b - a));

/** La voie de rendu est-elle interrogée sous ce pixel ? Le hit-test tourne à CHAQUE `pointermove` et
 *  c'est lui qui coûte (la masse triangulée de la carte) : on ne le paie que là où sa réponse peut
 *  changer le verdict — en COMBAT (le jeton sous le pixel), et hors combat seulement si une voie
 *  volumique est inscrite ET que la scène porte un décor volumique, seule chose qu'un rayon MONDE
 *  puisse nommer. `hasSpritePicker` est une lecture de REGISTRE (le montage de `GameStage3D`) : c'est
 *  précisément ce que les deux porteurs doivent lire pareil. */
export function tireLeRayon(st: EtatDePick): boolean {
  if (st.mode === 'battle' && st.battle) return true;
  return !!st.scene && hasSpritePicker() && sceneAUnPropVolumique(st.scene);
}

/**
 * Ce que le rayon désigne → la case du monde. `null` quand rien n'est nommé, ou quand le nom ne
 * retrouve personne : la chaîne poursuit alors sur les surfaces dessinées.
 *
 * DÉCOR VOLUMIQUE : c'est le MEUBLE qui est dessiné sous le pixel, pas la tuile derrière lui — on
 * rend sa case d'ANCRAGE, d'où l'interaction d'exploration le reprend comme n'importe quel décor. Le
 * rayon touche la face réellement dessinée, à sa hauteur réelle : il est juste même sur le DESSUS
 * d'un meuble haut, là où une inversion écran→case au lift du SOL décale la case vers l'arrière et
 * désigne le décor voisin (banc `stage/pick-parity.test.tsx`).
 */
export function caseVisee(vise: PickResult, st: EtatDePick): Verdict | null {
  if (!vise) return null;
  switch (vise.kind) {
    case 'combatant': {
      if (st.mode !== 'battle') return null;
      const c = inBattleId(st.battle, vise.id);
      if (!c?.pos) return null;
      return { tile: { x: c.pos.x, y: c.pos.y, z: c.pos.z ?? 0 }, cid: c.id, via: 'sprite', nature: 'combattant' };
    }
    case 'entity': {
      const e = st.scene?.entities.find((x) => x.id === vise.id);
      if (!e) return null;
      return { tile: { x: e.pos.x, y: e.pos.y, z: e.z ?? 0 }, cid: null, via: 'decor', nature: 'entite', entId: e.id };
    }
    default: {
      const jamais: never = vise;
      throw new Error(`nature de cible non traitée par la résolution de picking : ${JSON.stringify(jamais)}`);
    }
  }
}

/** Point de PROJECTION du stage : le repère où `tileCenter`/`worldToScreen` dessinent. */
export interface PointStage {
  x: number;
  y: number;
}

/** Point de VIEWBOX : le repère `0 0 VW VH` du stage SVG, AVANT la caméra du groupe. */
export interface PointViewBox {
  x: number;
  y: number;
}

/** Pixel CLIENT → point de VIEWBOX : premier étage de l'inversion (recouvrement `slice` centré), le
 *  seul que le panoramique défait — la caméra du groupe y reste en place, c'est elle qu'on déplace.
 *  `null` quand l'élément n'a aucune surface mesurée : il n'y a alors pas de pixel à inverser. */
export function pointViewBoxSousPixel(svg: SVGSVGElement | null, clientX: number, clientY: number): PointViewBox | null {
  const r = svg?.getBoundingClientRect();
  if (!r || !r.width || !r.height) return null;
  return viewBoxPointAt({ sx: clientX - r.left, sy: clientY - r.top }, { w: r.width, h: r.height });
}

/** Pixel CLIENT → point de PROJECTION, les DEUX étages de `stageCam` à l'envers, en UN lieu pour les
 *  deux porteurs. La `cam` et le `zoom` sont ceux du RENDU COURANT : le geste les tient de son hôte
 *  (`camRef.current`, prop `zoom`), la sonde les lit du cadre publié
 *  (`spritePicker.ts:CadreRendu.camRendue`). */
export function pointStageSousPixel(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
  cam: { x: number; y: number },
  zoom: number,
): PointStage | null {
  const vb = pointViewBoxSousPixel(svg, clientX, clientY);
  return vb ? stagePointAt(vb, cam, zoom) : null;
}

/** Contexte de PROJECTION que les étages de surface inversent — la même géométrie que le peintre. */
export interface CadreDePick {
  pose: StagePose;
  dims: Dims;
  activeZ: number;
  /** ARÊTES utilisables DÉJÀ projetées (`stage/aretesProjetees.ts`), filtrées par l'hôte comme `vise`
   *  l'est : brouillard, contrôleur, couche active. La chaîne ne les dérive pas — elle les lit. */
  aretes: readonly AreteProjetee[];
}

/** Case du MEUBLE réellement dessinée sous le pixel, à la couche `z` : la MÊME inversion par LIFT que
 *  `caseMarchable`, mais pour une case qu'un décor `prop` OCCUPE — donc justement celle que la
 *  marchabilité écarte (l'empreinte d'un meuble solide n'est pas marchable). Sans elle, le pixel d'un
 *  plateau FIN que le rayon ne touche pas retombe sur la boucle CROSS-COUCHE, qui rend une case de
 *  l'ÉTAGE DU DESSUS — et envoie le groupe à l'autre bout du bâti.
 *
 *  L'OCCUPATION se lit à l'index case → décor (`noyau/monde/decorIndex.ts`, bâti sur `propFootTiles`) : un
 *  meuble répond sur TOUTES les cases de son empreinte, donc les deux d'une table 2×1. Le verdict,
 *  lui, rend la case d'ANCRAGE du meuble — la même que la voie `decor` du rayon (`caseVisee`), d'où
 *  l'interaction d'exploration le reprend comme n'importe quel décor. */
export function meubleDessine(scene: Scene, cadre: CadreDePick, g: PointStage, z: number): Pt | null {
  for (const lift of sceneLifts(scene)) {
    const { x, y } = screenToTileAtLift(cadre.pose, g, lift);
    if (x < 0 || y < 0 || x >= cadre.dims.w || y >= cadre.dims.h) continue;
    if (liftDe(scene, { x, y, z }) !== lift) continue; // cette case n'est pas dessinée à ce lift
    // PREMIÈRE case dessinée sous le pixel (lift le plus haut) : c'est celle qu'on VOIT, et elle
    // décide seule — porte-t-elle un meuble ou non. Continuer à sonder les lifts plus bas
    // rendrait un meuble d'AILLEURS, la maladie même qu'on soigne.
    const meuble = decorEnCaseEtage(scene, x, y, z);
    return meuble ? { x: meuble.pos.x, y: meuble.pos.y, z } : null;
  }
  return null;
}

/** Case d'un AUTRE étage visée par le pointeur, BORNÉE au voisinage marchable du groupe
 *  (`walkNeighbors` — exactement la connectivité qu'emprunte le pas clavier `exploreStepDest`) : le
 *  franchissement vertical (marches, rampe, tablier) se CLIQUE donc comme il se pousse au clavier.
 *  Hors de ce voisinage l'étage ACTIF garde la priorité : une case d'un étage qu'AUCUN pas ne rejoint
 *  reste une silhouette translucide posée au-dessus du sol qu'on foule, et ne lui vole jamais le clic.
 *  Le LIFT de chaque candidat est sa HAUTEUR MÉTRIQUE rendue (`noyau/monde/scene.ts:liftDe`), PAS son index
 *  de couche — même correction qu'au curseur clavier (`screenStepDot`, `combatCursor.ts`). */
export function pasInterEtages(scene: Scene, cadre: CadreDePick, partyPos: Pt, g: PointStage): Pt | null {
  for (const n of walkNeighbors(scene, partyPos)) {
    const nz = n.z ?? 0;
    if (nz === cadre.activeZ) continue; // même étage : la résolution de l'étage actif suffit
    const { x, y } = screenToTileAtLift(cadre.pose, g, liftDe(scene, { x: n.x, y: n.y, z: nz }));
    if (x === n.x && y === n.y) return { x: n.x, y: n.y, z: nz };
  }
  return null;
}

/** Case MARCHABLE de la couche `z` réellement DESSINÉE sous le pixel. Chaque case est projetée à son
 *  LIFT MÉTRIQUE (`noyau/monde/scene.ts:liftDe`), JAMAIS au seul index de couche : une marche d'escalier est
 *  dessinée soulevée, et l'inverser à plat rend la case voisine 1 à 3 pas plus loin — un escalier
 *  entier devient injouable à la souris, donc l'étage qu'il dessert inatteignable. Le lift le plus
 *  HAUT gagne : c'est lui qu'on voit, et une case cachée DERRIÈRE une marche n'a pas à être cliquable.
 *  Scène sans relief ⇒ un seul lift (0) ⇒ strictement l'inversion plan-sol. */
export function caseMarchable(scene: Scene, cadre: CadreDePick, g: PointStage, z: number): Pt | null {
  for (const lift of sceneLifts(scene)) {
    const { x, y } = screenToTileAtLift(cadre.pose, g, lift);
    if (x < 0 || y < 0 || x >= cadre.dims.w || y >= cadre.dims.h) continue;
    if (liftDe(scene, { x, y, z }) !== lift) continue; // cette case n'est pas dessinée à ce lift
    if (!isWalkable(scene, x, y, z)) continue;
    return { x, y, z };
  }
  return null;
}

/** Repli CROSS-COUCHE aligné sur le curseur clavier : chaque couche est inversée à son lift, puis
 *  `resolveCursorZ` tranche la surface réelle la plus haute de la case candidate. */
export function caseAuSol(scene: Scene, cadre: CadreDePick, g: PointStage): Pt | null {
  for (const z of scene.layers.map((l) => l.z).sort((a, b) => b - a)) {
    const { x, y } = screenToTileAtLift(cadre.pose, g, z);
    if (x < 0 || y < 0 || x >= cadre.dims.w || y >= cadre.dims.h) continue;
    if (resolveCursorZ(scene, x, y) !== z) continue; // la surface réelle la plus haute ici n'est pas cette couche
    return { x, y, z };
  }
  return null;
}

/**
 * ARÊTE sous le pixel : celle dont le SEGMENT projeté passe à moins de `largeurPrise / 2` du point —
 * la moitié du trait que l'overlay exposait au pointeur, donc la même prise qu'avant, capacité par
 * capacité (`state/aretes.ts:LARGEUR_PRISE_ARETE`). La PLUS PROCHE gagne ; à égalité stricte c'est
 * l'ordre de la liste qui tranche, et cet ordre EST `PRIORITE_ARETES` (`aretesUtilisables` la rend
 * déjà triée) — une enceinte enrôlée se frappe, elle ne s'ouvre pas.
 */
export function areteSousLePixel(g: PointStage, aretes: readonly AreteProjetee[]): AreteUtilisable | null {
  let prise: AreteUtilisable | null = null;
  let meilleure = Infinity;
  for (const { arete, a, b } of aretes) {
    const d = distanceAuSegment(g, a, b);
    if (d > arete.largeurPrise / 2 || d >= meilleure) continue;
    meilleure = d;
    prise = arete;
  }
  return prise;
}

/** Verdict d'un étage de SURFACE : une case, et rien d'autre — aucune identité n'est devinée depuis
 *  la position rendue (cf. le JSDoc de `Verdict`). */
const verdict = (t: Pt, via: PickVia): Verdict => ({ tile: { x: t.x, y: t.y, z: t.z ?? 0 }, cid: null, via, nature: 'case' });

const RIEN: Verdict = { tile: null, cid: null, via: 'aucune', nature: 'case' };

/**
 * LA CHAÎNE — l'ordre dans lequel les étages se départagent, et le seul endroit où il est écrit.
 * `vise` = ce que la voie de rendu a nommé (`null` si le rayon n'a pas été tiré).
 *
 * `pointStage` est un THUNK, et c'est une contrainte de COÛT, pas un style : inverser le pixel coûte un
 * `getBoundingClientRect()` (mesure forcée du layout) et la chaîne tourne à CHAQUE `pointermove`. Le
 * thunk n'est appelé QU'UNE fois par résolution — l'étage d'arête et les étages de surface partagent le
 * point inversé — et il n'est appelé DU TOUT que si un étage en a besoin : aucune arête offerte et un
 * rayon qui nomme sa cible, et le pixel n'est jamais inversé. CE QUE ÇA COÛTE, dit au présent : dès que
 * `cadre.aretes` est non vide, l'étage d'arête inverse, donc UNE mesure de layout par `pointermove` —
 * en combat, chaque `pointermove` de mon tour, où le contrôleur d'accès EST le héros actif
 * (`MondeDeCampagne.tsx:590-598`). C'est le prix de la PARITÉ de geste : le seuil se prend au pixel
 * comme la cible SVG le prend. Le thunk rend `null` quand rien n'est inversable (élément sans surface
 * mesurée) : seul le rayon peut alors répondre.
 *
 * L'ARÊTE passe AVANT le rayon, et c'est la PARITÉ avec la cible SVG de l'overlay, qui retient le
 * `pointerdown` avant que la chaîne ne soit consultée : le pixel du centre d'un seuil est résolu par
 * les étages de SURFACE en une case marchable de son portail (sonde `priorite-arete-vs-rayon`) —
 * placer l'étage après le rayon change chacun de ces verdicts.
 */
export function resoudrePixel(st: EtatDePick, vise: PickResult, pointStage: () => PointStage | null, cadre: CadreDePick): Verdict {
  let inversé: PointStage | null | undefined;
  const pointInversé = () => (inversé === undefined ? (inversé = pointStage()) : inversé);
  if (cadre.aretes.length) {
    const p = pointInversé();
    const arete = p && areteSousLePixel(p, cadre.aretes);
    if (arete) {
      const { x, y, z } = arete.ancrage;
      return { tile: { x, y, z: z ?? 0 }, cid: arete.cid ?? null, via: 'arete', nature: 'arete', arete };
    }
  }
  const nommé = caseVisee(vise, st);
  if (nommé) return nommé;
  const scene = st.scene;
  if (!scene) return RIEN;
  const g = pointInversé();
  if (!g) return RIEN;
  if (st.mode !== 'battle') {
    const meuble = meubleDessine(scene, cadre, g, cadre.activeZ);
    if (meuble) return verdict(meuble, 'meuble');
  }
  if (st.mode === 'exploration') {
    const pas = pasInterEtages(scene, cadre, st.partyPos, g);
    if (pas) return verdict(pas, 'pas-etage');
    const ici = caseMarchable(scene, cadre, g, cadre.activeZ);
    if (ici) return verdict(ici, 'sol');
  }
  const sol = caseAuSol(scene, cadre, g);
  return sol ? verdict(sol, 'sol') : RIEN;
}
