/**
 * POSE PAR FRAME des billboards du monde volumique (#1176, P2-4) — la passe que la MARCHE rejoue
 * soixante fois par seconde, hors de tout rendu React. Elle ne construit RIEN : ni géométrie, ni
 * matériau, ni texture ; elle ne fait que ré-orienter des quads déjà montés et les décaler du
 * glissement de l'instant.
 *
 * Module à part de `GameStage3D` — et c'est STRUCTUREL : cette passe est PURE (aucun DOM, aucun
 * contexte WebGL), donc mesurable telle quelle, là où la frame complète de l'écran demande un
 * renderer que jsdom ne sait pas fournir.
 *
 * Ce qui appartient à UN sujet voyage AVEC lui : son quad, son ombre de contact plaquée à l'aplomb de
 * la même ancre, et les LAMPES qu'il porte (#1245, L2). Une ombre laissée à l'ancre cuite attendrait le
 * marcheur sur sa case d'arrivée ; une lanterne laissée là éclairerait la case qu'il vient de quitter.
 */
import * as THREE from 'three';
import { billboardDepthOffsetUnits, billboardViewDepth, frameRectOf, poseContactShadow, type BillboardSubject, type FrameRectUniform, type TintAt } from '../backends/webgl/sceneMeshes';
import { billboardExposure, type PointLightSlots } from './stagePointLights';
import { withRenderRank } from '../backends/webgl/renderRanks';
import { materiauPlanTransparent } from '../backends/webgl/worldMaterials';
import { LUMA_709 } from '../shade';
import { RASTER_PX_MAX, RASTER_PX_MIN, frameUvRect, rasterPxHeight, type AtlasLayout } from '../backends/webgl/billboardMath';
import { clipTotalMs, type ClipDef } from '../rig/anim/actorAnimSelect';

/** Un billboard monté : ce qu'il faut pour le RE-POSER quand la caméra bouge, sans le reconstruire. */
export interface Board {
  sub: BillboardSubject;
  quad: { widthM: number; heightM: number; centerLiftM: number };
  mesh: THREE.Mesh;
  /** Matériau du quad — jamais lambertien (P2-5) : la normale d'un quad aligné écran est l'axe caméra.
   *  Le type reste ouvert : un hôte peut monter les siens. */
  material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
  /** Disque d'ombre de contact du sujet, quand il en porte un (`wantsContactShadow`). */
  shadow?: THREE.Object3D;
  /** JUMEAU DE SILHOUETTE du corps, quand il en porte un (`attachBodySilhouette`). Il CAPTE la texture
   *  du corps à l'attache : l'écrivain de frames doit donc lui réécrire `map` en même temps qu'au
   *  corps, et `poseBoards` ne descend jamais dans les enfants d'un quad. */
  jumeau?: THREE.Mesh;
}

/** Caméra de la frame — l'offset de profondeur des quads se dérive de son plan (`near`/`far`), et de la
 *  DISTANCE à l'œil quand elle est en perspective (la profondeur fenêtre n'y est pas linéaire).
 *  `isPerspectiveCamera` est le drapeau que three pose lui-même sur ses caméras. */
export type FrameCamera = THREE.Camera & { near: number; far: number; isPerspectiveCamera?: boolean };

/** SEUIL de découpe des texels d'un sprite : sous lui, le fragment est REJETÉ (le sprite garde sa
 *  silhouette au lieu d'un rectangle voilé). Exporté : l'allure d'un jeton se pose sous ce seuil et
 *  doit pouvoir se mesurer contre lui. */
export const ALPHA_TEST = 0.5;

/**
 * CADRE UV d'un billboard (#1176, L3) : `offset.xy` + `scale.zw` appliqués à la coordonnée de texture
 * du corps. Un quad ne montre alors qu'une CELLULE de sa planche de flipbook — c'est ce qui fait jouer
 * les frames sans toucher ni la texture (partagée entre tous les sujets de même signature) ni la
 * géométrie. Défaut = la texture entière.
 */
export const FRAME_RECT_PLEIN: readonly [number, number, number, number] = [0, 0, 1, 1];

/**
 * Corps de `map_fragment` RÉÉCRIT pour échantillonner la cellule (#1176, L3). Le chunk est EXPANSÉ ici
 * puis substitué à son `#include` : à `onBeforeCompile`, three n'a pas encore résolu les includes, et
 * une ligne AJOUTÉE après l'include laisserait `sampledDiffuseColor` échantillonné à la planche
 * ENTIÈRE — l'uniforme serait branché, sans le moindre effet, et rien ne le dirait.
 *
 * L'ancre manquante (chunk amont modifié) est une ERREUR à la charge du module, jamais un silence.
 */
const MAP_FRAGMENT_CADRE = ((): string => {
  const chunk = THREE.ShaderChunk.map_fragment;
  const cadre = chunk.replace('texture2D( map, vMapUv )', 'texture2D( map, vMapUv * uFrameRect.zw + uFrameRect.xy )');
  if (cadre === chunk) throw new Error('boardPose: `map_fragment` n’expose plus `texture2D( map, vMapUv )` — cadre de frame sans effet');
  return cadre;
})();


/**
 * MATÉRIAU d'un billboard du stage (#1176, P2-5) — TOUJOURS `MeshBasicMaterial`, et c'est structurel :
 * un quad aligné écran a pour normale l'axe caméra, donc un matériau lambertien y mesure l'angle
 * caméra↔soleil et la luminosité d'un personnage change quand la vue tourne (mesuré : ×2,36 entre deux
 * crans). Sa lumière est donc un SCALAIRE : `luminance` = l'exposition du sujet À CET ENDROIT
 * (`billboardExposure` : l'exposition globale de la frame, plus les flaques de lampe qui l'atteignent),
 * multipliée par la teinte de visibilité du sujet.
 */
export function billboardMaterial(map: THREE.Texture, luminance: number): THREE.MeshBasicMaterial {
  const mat = materiauPlanTransparent({ map, alphaTest: ALPHA_TEST });
  mat.color.setScalar(luminance);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  // DÉSATURATION du quad (P3-0f) : la teinte de matériau MULTIPLIE la texture, elle ne peut donc pas
  // en retirer la couleur — un jeton hors Ligne de Vue se lit au gris, pas au sombre. Un uniforme, une
  // ligne de fragment, et la MÊME source pour tous les billboards (un seul programme compilé).
  const desat = { value: 0 };
  // OPACITÉ D'ALLURE (P3-0f) : elle ne peut PAS passer par `material.opacity`. La chaîne de fragment de
  // `MeshBasicMaterial` part de `vec4( diffuse, opacity )`, multiplie par le texel dans `map_fragment`,
  // puis REJETTE le fragment sous le seuil (`alphatest_fragment` : `if ( diffuseColor.a < alphaTest )
  // discard`, three `ShaderLib/meshbasic.glsl.js`) : une opacité inférieure au seuil efface le sujet
  // ENTIER, texels opaques compris. Elle se multiplie donc APRÈS l'alphatest, qui garde son unique
  // office — découper les texels transparents du sprite.
  const allureAlpha = { value: 1 };
  // CADRE DE FRAME (#1176, L3) : la cellule de flipbook que ce quad montre, ou la texture entière.
  const frameRect: FrameRectUniform = { value: new THREE.Vector4(...FRAME_RECT_PLEIN) };
  mat.userData.desat = desat;
  mat.userData.allureAlpha = allureAlpha;
  mat.userData.frameRect = frameRect;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDesat = desat;
    shader.uniforms.uAllureAlpha = allureAlpha;
    shader.uniforms.uFrameRect = frameRect;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uDesat;\nuniform float uAllureAlpha;\nuniform vec4 uFrameRect;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `${MAP_FRAGMENT_CADRE}\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, vec3( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ), uDesat );`,
      )
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n\tdiffuseColor.a *= uAllureAlpha;');
  };
  // Clé de programme EXPLICITE (même défense qu'au jumeau) : le défaut de three la dérive de la SOURCE
  // de `onBeforeCompile`, qui ne dit rien du fragment réellement injecté.
  mat.customProgramCacheKey = () => 'billboard:cadre';
  return mat;
}

/**
 * MATÉRIAU DE PROFONDEUR d'un billboard (#1334) — celui que la passe d'OMBRES rend, et lui seul.
 *
 * Sans lui, three fabrique son propre matériau de profondeur : il y recopie `map` et `alphaTest`, mais
 * ne connaît RIEN de l'injection de cadre (elle ne vit que dans l'`onBeforeCompile` du matériau
 * COULEUR). La passe d'ombre découpe alors la silhouette sur la PLANCHE ENTIÈRE — mesuré à l'écran :
 * une grille de mini-corps gris au sol, qui suit le personnage.
 *
 * Le cadre s'y réécrit donc par le MÊME remplacement de `map_fragment` et sur le MÊME OBJET uniforme
 * que le corps (patron du jumeau de silhouette) : la cellule que l'ombre découpe ne peut pas dériver
 * de celle que le corps montre. L'ÉCRIVAIN de frames (`writeBoardFrames`) y réécrit `map` en même
 * temps qu'au corps — comme au jumeau, et sous la même comparaison.
 *
 * `RGBADepthPacking` : c'est l'encodage que la carte d'ombre de three attend d'un matériau de
 * profondeur fourni par l'hôte.
 */
export function billboardDepthMaterial(corps: Board['material']): THREE.MeshDepthMaterial {
  const mat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: corps.map,
    alphaTest: ALPHA_TEST,
    side: THREE.DoubleSide,
  });
  const frameRect = (corps.userData.frameRect as FrameRectUniform | undefined) ?? { value: new THREE.Vector4(...FRAME_RECT_PLEIN) };
  mat.userData.frameRect = frameRect;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFrameRect = frameRect;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec4 uFrameRect;\nvoid main() {')
      .replace('#include <map_fragment>', MAP_FRAGMENT_CADRE);
  };
  // Clé de programme EXPLICITE, même défense qu'au corps et au jumeau.
  mat.customProgramCacheKey = () => 'billboard:profondeur:cadre';
  return mat;
}

/** Matériau de profondeur d'un board, quand son quad en porte un (`billboardDepthMaterial`). */
export function boardDepthMaterial(b: Board): THREE.MeshDepthMaterial | undefined {
  return b.mesh.customDepthMaterial as THREE.MeshDepthMaterial | undefined;
}

/**
 * MATÉRIAU du JUMEAU DE SILHOUETTE d'un corps (#1297, LOT C) : la MÊME texture de rig que le corps,
 * mais peinte en APLAT de la couleur d'équipe du jeton, et sous un test de profondeur RETOURNÉ
 * (`GreaterDepth`) — il ne reste donc que les pixels où la géométrie du monde a déjà écrit devant le
 * corps, c'est-à-dire exactement là où celui-ci est occulté. Même patron que le jumeau d'anneau
 * (`backends/webgl/dynamicMarkMeshes.buildSilhouetteTwin`), à l'échelle d'un quad.
 *
 * TROIS points que le fragment porte, et qui ne se règlent pas par propriétés de matériau :
 *  - l'APLAT : `map_fragment` MULTIPLIE le texel par la teinte, donc la couleur d'équipe y sortirait
 *    assombrie par l'art du rig. La couleur du matériau REMPLACE le texel, dont seul l'alpha survit ;
 *  - la DÉCOUPE au texel BRUT : `alphaTest` reste le seul juge de la forme, comme pour le corps ;
 *  - l'ALPHA, multiplié APRÈS la découpe (même raison qu'au corps : sous le seuil, `opacity` efface le
 *    sujet ENTIER, texels opaques compris). Il reprend l'uniforme d'allure DU CORPS — le MÊME objet,
 *    pas une copie : la passe de pose l'écrit une fois et alimente les deux, et une silhouette ne peut
 *    pas dériver de l'allure de son corps.
 *
 * `fog` reste celui du corps (allumé) : cette silhouette est de la MATIÈRE de jeton, pas du chrome
 * d'interface — elle s'embrume donc comme le billboard qu'elle double, sinon un jeton lointain se
 * lirait plus net à travers un mur qu'à découvert.
 */
export function silhouetteMaterial(corps: Board['material'], teamColor: string): THREE.MeshBasicMaterial {
  const mat = materiauPlanTransparent({
    map: corps.map,
    alphaTest: ALPHA_TEST,
    depthWrite: false,
    depthFunc: THREE.GreaterDepth,
  });
  mat.color.set(teamColor);
  // L'uniforme d'ALLURE du corps, partagé (cf. ci-dessus). Un corps sans uniforme (matériau d'un
  // appelant qui monte les siens) reçoit le sien, figé à l'allure pleine.
  const allureAlpha = (corps.userData.allureAlpha as { value: number } | undefined) ?? { value: 1 };
  mat.userData.allureAlpha = allureAlpha;
  // Le CADRE DE FRAME du corps, partagé sur le MÊME patron : la silhouette montre la même cellule de
  // flipbook que le corps qu'elle double, et l'écrivain de frames n'écrit qu'un objet pour les deux.
  const frameRect = (corps.userData.frameRect as FrameRectUniform | undefined) ?? { value: new THREE.Vector4(...FRAME_RECT_PLEIN) };
  mat.userData.frameRect = frameRect;
  // Littéral GLSL de l'opacité propre : un flottant, jamais un entier nu (`a * 1` ne compile pas).
  const k = SILHOUETTE_BODY_OPACITY.toFixed(4);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAllureAlpha = allureAlpha;
    shader.uniforms.uFrameRect = frameRect;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uAllureAlpha;\nuniform vec4 uFrameRect;\nvoid main() {')
      .replace('#include <map_fragment>', `${MAP_FRAGMENT_CADRE}\n\tdiffuseColor.rgb = diffuse;`)
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\n\tdiffuseColor.a *= uAllureAlpha * ${k};`);
  };
  // Clé de programme EXPLICITE, par DÉFENSE : le défaut de three la dérive de la SOURCE de
  // `onBeforeCompile` (`Material.customProgramCacheKey`), la même pour tous les jumeaux, mais qui ne
  // verrait pas `k` devenir variable — deux opacités partageraient alors un programme compilé.
  mat.customProgramCacheKey = () => `silhouette:${k}`;
  return mat;
}

/**
 * Accroche à un corps monté son JUMEAU DE SILHOUETTE, et le rend (#1297, LOT C).
 *
 * Le jumeau est un ENFANT du quad : géométrie EMPRUNTÉE (`userData.emprunte`, comme le jumeau
 * d'anneau) et transformation héritée de son parent — la passe de pose ne le connaît donc pas, et une
 * frame de marche n'écrit rien de plus pour lui. Rang `jumeau` (registre
 * `backends/webgl/renderRanks.ts`) : il passe AVANT les billboards, qui trichent de 0,3 m vers la
 * caméra et écrivent leur profondeur ensuite ; rendu après eux, il couvrirait des corps VISIBLES.
 *
 * FRONTIÈRE avec le DÉGAGEMENT D'ARCHITECTURE (#818/#907/#950) : les deux se complètent au lieu de se
 * remplacer — le cutaway retire du MONDE ce qui masque la scène (murs et toits de la pièce regardée),
 * la silhouette signale le JETON là où le monde reste debout (autre pièce, relief, étage tenu).
 *
 * ÉCARTS DÉCLARÉS (#1297) : rien derrière un AUTRE billboard — l'occlusion sprite contre sprite reste
 * souveraine, à l'identique du picker (LOT B) ; et aucun signal de SURVOL sur la silhouette (elle porte
 * la couleur d'ÉQUIPE, là où le corps prend la couleur de relation).
 */
export function attachBodySilhouette(board: Board, teamColor: string): THREE.Mesh {
  const jumeau = new THREE.Mesh(board.mesh.geometry, silhouetteMaterial(board.material, teamColor));
  jumeau.name = `silhouette:${board.sub.cid ?? board.sub.identity}`;
  withRenderRank(jumeau, 'jumeau');
  jumeau.userData.emprunte = true;
  // Le rayon de picking descend dans les enfants d'un quad (`spriteRaycast`) : le jumeau doublerait
  // chaque cible sans changer aucun verdict. Il ne se lance pas, il se regarde.
  jumeau.raycast = () => undefined;
  board.mesh.add(jumeau);
  // Le jumeau entre dans le board : sa texture se réécrit AVEC celle du corps à chaque changement de
  // planche (il l'a captée à l'attache, et rien ne descend dans les enfants d'un quad à la frame).
  board.jumeau = jumeau;
  return jumeau;
}

/** Ce que le CHROME d'un jeton change à l'ALLURE de son billboard (#1176, P3-0f) — la même donnée que
 *  la surcouche SVG porte en style CSS sur son disque (`stage/TokenChromeOverlay.allureStyle`). */
export interface BoardChrome {
  ghost: boolean;
  dim: boolean;
  highlight: string | null;
}

/** Opacité d'un corps HORS D'ACTION, et d'un corps hors Ligne de Vue — celle d'un QUAD, déjà découpé à
 *  l'alpha (un disque plein s'estompe plus bas : `stage/TokenChromeOverlay.DISQUE_DIM_OPACITY`). */
export const DIM_OPACITY = 0.82;
export const GHOST_OPACITY = 0.45;
/** Part de couleur retirée à un corps hors Ligne de Vue (`grayscale(0.85)`, même site). */
export const GHOST_DESAT = 0.85;
/** Opacité PROPRE du JUMEAU DE SILHOUETTE du corps (#1297, LOT C) — le facteur que la silhouette
 *  applique EN PLUS de l'allure de son corps. Elle vit ici, avec les deux opacités de corps ci-dessus :
 *  l'alpha rendu d'une silhouette est `SILHOUETTE_BODY_OPACITY × boardChromeOpacity(chrome)`, donc un
 *  jeton fantôme ou hors d'action garde son statut à travers le mur. Pleine : contrairement à l'anneau
 *  (`SILHOUETTE_TWIN_OPACITY`, un trait de deux pixels au sol), le corps offre une grande surface —
 *  c'est sa TEINTE PLATE d'équipe qui le distingue d'un corps visible.
 *
 *  FORME : l'APLAT PLEIN à la couleur d'équipe (trace de l'arbitrage : ticket #1297, commentaire du
 *  2026-08-13 — le « contour teinté » d'origine y est révisé). Seul le DOSAGE reste une molette de
 *  goût (LOT D). */
export const SILHOUETTE_BODY_OPACITY = 1;

/** LUMINANCE perçue d'une couleur `three` déjà parsée (Rec. 709) — la même pondération que la
 *  désaturation du fragment, et les MÊMES poids que la luminance d'une couleur hexa (`LUMA_709`,
 *  `gameIso/shade.ts`) : une seule définition du gris. */
export function luminance709(c: THREE.Color): number {
  return LUMA_709.r * c.r + LUMA_709.g * c.g + LUMA_709.b * c.b;
}

/** PART de la teinte de relation dans la couleur d'un corps SURVOLÉ, le reste étant l'exposition
 *  neutre de la frame (#1337). La couleur de matériau MULTIPLIE le texel : à part pleine, elle écrase
 *  le rapport de canaux de l'ART — mesuré sur le gris pâle d'un cheval (#CFD2D0, rapport max/min 1,03
 *  de son cru) : 14,25 sous la teinte d'allié pleine, c'est-à-dire un aplat vert, contre 1,68 à cette
 *  part. Et l'ORDRE des canaux du corps ne survit qu'aux corps dont le rapport dépasse celui de la
 *  teinte mélangée (1,63 pour l'allié, 2,74 pour l'adversaire ici, contre 13,8 et 21,8 à part pleine).
 *
 *  0,35 plutôt que plus haut, et ça se mesure : c'est le seul palier où les TROIS teintes tiennent
 *  l'exposition sans borner un canal à pleine lumière (le rouge d'adversaire y demande 0,970 de canal
 *  rouge pour 0,5 de luminance ; à 0,40 il demande 1,04, borne, et rend 0,492 — soit −1,6 %). */
export const HIGHLIGHT_MIX = 0.35;

/** TEINTE du quad : son exposition, MÉLANGÉE vers la couleur de relation quand ce jeton est la cible
 *  survolée. Trois canaux en tout (teinte, opacité, désaturation), tous portés par le matériau DÉJÀ
 *  monté — aucun n'en ajoute un quatrième, et la passe de pose reste leur unique écrivain. */
export function boardChromeTint(chrome: BoardChrome | null, luminance: number, out: THREE.Color): THREE.Color {
  if (!chrome?.highlight) return out.setScalar(luminance);
  // MISE EN ÉVIDENCE de la cible survolée : la couleur de relation portée À EXPOSITION CONSTANTE, puis
  // mélangée au neutre de la frame. La normalisation se mesure en LUMINANCE (Rec. 709), jamais sur le
  // canal le plus fort : le rouge d'adversaire n'a que 0,143 de luminance pour 0,527 de canal rouge, et
  // le ramener par son canal max lui retirait 73 % de sa lumière (mesuré) — le survol ASSOMBRISSAIT sa
  // cible. Les deux bouts du mélange portent la MÊME luminance, et le mélange est linéaire : l'exposition
  // du corps est donc tenue à l'exact, quelle que soit la part.
  out.set(chrome.highlight);
  const L = luminance709(out);
  out.multiplyScalar(L > 0 ? luminance / L : luminance);
  const k = HIGHLIGHT_MIX;
  out.setRGB(luminance + (out.r - luminance) * k, luminance + (out.g - luminance) * k, luminance + (out.b - luminance) * k);
  // La borne à 1 ne mord qu'au-delà de 0,515 d'exposition sous la teinte d'adversaire (mesuré) : en deçà,
  // aucun canal ne dépasse et la luminance rendue est celle demandée.
  const max = Math.max(out.r, out.g, out.b);
  return max > 1 ? out.setRGB(Math.min(1, out.r), Math.min(1, out.g), Math.min(1, out.b)) : out;
}

/** Opacité du quad sous ce chrome. */
export function boardChromeOpacity(chrome: BoardChrome | null): number {
  return chrome?.dim ? DIM_OPACITY : chrome?.ghost ? GHOST_OPACITY : 1;
}

/** Part de couleur retirée au quad sous ce chrome. */
export function boardChromeDesat(chrome: BoardChrome | null): number {
  return chrome?.ghost && !chrome.dim ? GHOST_DESAT : 0;
}

/** Teinte de travail de la passe — une seule, comme l'ancre de glissement. */
const TEINTE = new THREE.Color();

/** Applique les trois canaux au matériau monté — l'unique écrivain de l'ALLURE d'un board.
 *
 *  ÉCART RÉSIDUEL (P3-0f) : la mise en évidence du survol est une TEINTE, là où la surcouche du jeton
 *  ajoute en plus une lueur externe (`TokenChromeOverlay.allureStyle`, `drop-shadow` doublé). Un halo
 *  extérieur au quad demanderait une seconde passe — un second quad par sujet, ou un rendu de
 *  silhouette hors écran — que ce lot ne monte pas. */
export function applyBoardChrome(material: Board['material'], chrome: BoardChrome | null, luminance: number): void {
  material.color.copy(boardChromeTint(chrome, luminance, TEINTE));
  // `material.opacity` reste à 1 : l'opacité d'allure vit dans `uAllureAlpha`, APRÈS l'alphatest
  // (cf. `billboardMaterial`). L'y remettre effacerait tout jeton dont l'allure passe sous le seuil.
  const allure = material.userData.allureAlpha as { value: number } | undefined;
  if (allure) allure.value = boardChromeOpacity(chrome);
  const desat = material.userData.desat as { value: number } | undefined;
  if (desat) desat.value = boardChromeDesat(chrome);
}

/** Un disque d'ombre de contact, tel que la passe le retouche : son matériau porte une opacité. */
type ShadowLike = THREE.Object3D & { material?: { opacity: number } };

/** ATTÉNUE l'ombre de contact d'un corps sous son allure (P3-0f) : un jeton s'estompe ENTIER,
 *  ombre comprise — une ombre restée pleine sous un fantôme le rattache au sol qu'il
 *  ne foule plus. L'opacité de MONTAGE (celle que le disque porte avant toute allure) est relevée à la
 *  première pose : cette passe est le seul écrivain suivant.
 *
 *  ÉCART RÉSIDUEL : sous le SOLEIL, le corps ne porte pas de disque mais projette sa vraie ombre
 *  (`wantsContactShadow`) — celle-là est rendue par la passe d'ombres de three, sur un matériau de
 *  profondeur que l'allure n'atteint pas : l'ombre d'un fantôme y reste pleine. */
export function applyShadowAllure(shadow: THREE.Object3D, opacité: number): void {
  const mat = (shadow as ShadowLike).material;
  if (!mat) return;
  const base = (shadow.userData.opacitéMontage ??= mat.opacity) as number;
  mat.opacity = base * opacité;
}

/** Ancre de travail du glissement — une seule, réutilisée : `billboardPose` ne mute pas ce qu'on lui
 *  donne, et une allocation par billboard et par frame n'a rien à faire dans la boucle. */
const ANCRE = new THREE.Vector3();

/** VERTICALE MONDE, et le HAUT D'ÉCRAN de travail — deux ancres de plus, jamais réallouées. */
const VERTICALE = new THREE.Vector3(0, 1, 0);
const HAUT_ECRAN = new THREE.Vector3();

/**
 * SEUIL sous lequel le HAUT D'ÉCRAN de la caméra est COUCHÉ dans le plan du sol : sa composante
 * verticale monde. 0,05 ≈ 87° de tangage — la vue du DESSUS regarde à 90°, l'iso à 30° (`up.y` ≈ 0,87).
 * Aucune vue de ce jeu ne se pose entre les deux : le seuil ne coupe pas une transition, il nomme un
 * régime.
 */
export const UP_ECRAN_COUCHE = 0.05;

/**
 * CENTRE MONDE du quad d'un billboard ancré aux PIEDS.
 *
 * DEUX RÉGIMES, et c'est structurel — la grandeur `centerLiftM` est une DEMI-HAUTEUR DE CORPS, donc une
 * élévation :
 *  - caméra INCLINÉE (iso, POV) : le quad monte le long du HAUT D'ÉCRAN (`billboardPose`), pour que
 *    l'arête basse reste exactement sur l'ancre quelle que soit la rotation ;
 *  - caméra à la VERTICALE (vue du dessus) : ce haut d'écran est couché dans le plan du sol, et la
 *    même montée devient une TRANSLATION HORIZONTALE — mesuré 0,767 case à `mpt` 1,5 pour un sujet de
 *    2,3 m, proportionnelle à sa taille, et TOURNANT avec le lacet. Le corps se lève alors selon la
 *    VERTICALE MONDE : son centre reste à l'aplomb de son ancre, donc de sa case.
 *
 * Le lift est CONSERVÉ (jamais annulé) : à zéro, le quad se retrouve coplanaire du plancher cuit et les
 * deux se disputent la profondeur.
 */
export function boardCenter(anchor: THREE.Vector3, centerLiftM: number, camQuat: THREE.Quaternion, out: THREE.Vector3): THREE.Vector3 {
  HAUT_ECRAN.copy(VERTICALE).applyQuaternion(camQuat);
  return Math.abs(HAUT_ECRAN.y) < UP_ECRAN_COUCHE
    ? out.copy(anchor).addScaledVector(VERTICALE, centerLiftM)
    : out.copy(anchor).addScaledVector(HAUT_ECRAN, centerLiftM);
}

/** Centre de travail de la pose — une ancre de plus, jamais réallouée. */
const CENTRE = new THREE.Vector3();

/** Décalage MONDE du sujet `cid` à l'instant de la frame, `null` s'il ne marche pas. */
export type GlideAt = (cid: string) => { dx: number; dy: number; dz: number } | null;

/** ALLURE du sujet `cid` à l'instant de la frame, `null` s'il n'a rien de particulier à montrer. */
export type ChromeAt = (cid: string) => BoardChrome | null;

/** Aucune allure particulière — la valeur d'une voie qui n'en fournit pas (planches QC). */
export const AUCUN_CHROME: ChromeAt = () => null;

/** Aucun brouillard — la teinte d'une voie qui n'échantillonne aucun champ de vision (planches QC,
 *  bancs de pose). */
export const TEINTE_PLEINE: TintAt = () => 1;

/** Les FLAQUES de la frame (#1245, L2/L3) : le POOL de lampes ponctuelles monté et la table qui vient
 *  d'y être écrite (`stage/stagePointLights.ts`), index par index, plus l'exposition globale du moment. */
export interface FrameLights {
  /** Le pool monté — ce que la passe DÉPLACE (les lampes d'un porteur qui glisse). */
  pool: readonly THREE.PointLight[];
  /** La table écrite : la position LOGIQUE de chaque lampe, celle d'où le glissement se compte. */
  slots: PointLightSlots;
  /** Exposition globale de la frame (`stageLights.surfaceLuminance`), que les flaques COMPLÈTENT. */
  surfaceLuminance: number;
}

/** Remet chaque lampe du pool sur sa position LOGIQUE — le point d'où le glissement de la frame se
 *  compte, et celui où une lampe revient dès que son porteur a fini son pas. */
function reposerLampes(lights: FrameLights): void {
  for (let i = 0; i < lights.pool.length; i++) {
    const w = lights.slots[i];
    if (w) lights.pool[i].position.set(w.x, w.y, w.z);
  }
}

/** Emmène les lampes PORTÉES par `cid` sur le glissement de leur porteur (`LightSource.srcId`). */
function glisserLampesDe(lights: FrameLights, cid: string, g: { dx: number; dy: number; dz: number }): void {
  for (let i = 0; i < lights.pool.length; i++) {
    const w = lights.slots[i];
    if (w?.srcId !== cid) continue;
    lights.pool[i].position.set(w.x + g.dx, w.y + g.dy, w.z + g.dz);
  }
}

/** Glissements de la frame, un par board, dans l'ordre du tableau. Tampon de module réutilisé : la
 *  passe demande son glissement UNE fois par sujet (`glide` lit l'horloge — deux appels dans la même
 *  frame rendraient deux instants), et une allocation par frame n'a rien à faire dans la boucle. */
const GLISSEMENTS: ({ dx: number; dy: number; dz: number } | null)[] = [];

/** Re-pose tous les quads face à la caméra de la frame, glissement de marche compris. Rend `true` si au
 *  moins un sujet a GLISSÉ — c'est le seul cas où la frame déplace un casteur, donc le seul où la carte
 *  d'ombre de la frame précédente cesse d'être valide (une rotation de caméra ne bouge aucune ombre).
 *
 *  Ce qui appartient à un sujet voyage avec lui, et une LAMPE PORTÉE en fait partie (#1245, L2) : la
 *  lanterne d'un marcheur suit la MÊME courbe de glissement que son quad — celle-ci, pas une seconde.
 *
 *  L'EXPOSITION des quads se recalcule ici (#1245, L3) parce qu'elle DÉPEND de la pose : un personnage
 *  qui marche entre dans la flaque case par case, à la cadence de la frame et non des rendus React.
 *
 *  DEUX PASSES, et c'est structurel : toutes les lampes glissent d'abord, les quads s'exposent ensuite.
 *  En une seule passe, l'exposition d'un sujet dépendrait de sa PLACE dans le tableau — le décor, posé
 *  avant les acteurs, échantillonnerait des lanternes encore à leur case de départ.
 *
 *  L'ALLURE du corps (#1176, P3-0f) se pose au même endroit et sur le même matériau : fantôme hors
 *  Ligne de Vue, corps hors d'action, cible survolée. `chromeAt` est demandé à la frame, comme le
 *  glissement — un survol ne remonte donc AUCUN quad, il en réécrit trois nombres.
 *
 *  Le BIAIS DE PROFONDEUR des quads (#1176, P3-1b) se prend PAR BOARD sous une caméra perspective :
 *  la profondeur fenêtre n'y est pas linéaire, donc un même biais métrique ne vaut pas le même nombre
 *  d'unités à 1 m et à 30 m (`billboardDepthOffsetUnits`, branche `depthM`). La grandeur qui la
 *  gouverne est `z_view` (`billboardViewDepth`), pas la distance à l'œil. En ortho, la profondeur EST
 *  linéaire : une seule valeur pour toute la frame.
 *
 *  La TEINTE DE VISIBILITÉ du quad (#1396) se prend ici aussi, à la case du sujet (`sub.cell`) : c'est
 *  une valeur de FRAME, au même titre que l'exposition. Cuite dans le sujet, elle entrait dans
 *  l'identité des sujets, et un pas du groupe — qui change le champ de vision — remontait tous les
 *  quads du monde (mesuré #1371 : ~126 disposes et 0/63 quads gardés par pas). */
export function poseBoards(boards: readonly Board[], camera: FrameCamera, glide: GlideAt, lights: FrameLights, chromeAt: ChromeAt, tintAt: TintAt): boolean {
  const perspective = camera.isPerspectiveCamera === true;
  const unitsOrtho = perspective ? 0 : billboardDepthOffsetUnits(camera.near, camera.far);
  let aGlissé = false;
  reposerLampes(lights);
  GLISSEMENTS.length = boards.length;
  for (let i = 0; i < boards.length; i++) {
    const b = boards[i];
    const g = b.sub.cid ? glide(b.sub.cid) : null;
    GLISSEMENTS[i] = g;
    if (!g) continue;
    aGlissé = true;
    if (b.sub.cid) glisserLampesDe(lights, b.sub.cid, g);
  }
  for (let i = 0; i < boards.length; i++) {
    const b = boards[i];
    const g = GLISSEMENTS[i];
    const ancre = g ? ANCRE.set(b.sub.anchor.x + g.dx, b.sub.anchor.y + g.dy, b.sub.anchor.z + g.dz) : b.sub.anchor;
    b.mesh.quaternion.copy(camera.quaternion);
    b.mesh.position.copy(boardCenter(ancre, b.quad.centerLiftM, camera.quaternion, CENTRE));
    b.material.polygonOffsetUnits = perspective
      ? billboardDepthOffsetUnits(camera.near, camera.far, billboardViewDepth(camera, b.mesh.position))
      : unitsOrtho;
    const chrome = b.sub.cid ? chromeAt(b.sub.cid) : null;
    const teinte = tintAt(b.sub.cell.x, b.sub.cell.y, b.sub.cell.z);
    if (b.shadow) {
      poseContactShadow(b.shadow, ancre);
      applyShadowAllure(b.shadow, boardChromeOpacity(chrome) * teinte);
    }
    applyBoardChrome(
      b.material,
      chrome,
      teinte * billboardExposure(ancre, lights.pool, lights.surfaceLuminance),
    );
  }
  return aGlissé;
}

// ————————————————————————————————————————————————————————————————
// FLIPBOOK — l'ÉCRIVAIN DE FRAMES (#1176, L3)
// ————————————————————————————————————————————————————————————————
//
// La boucle volumique ne rasterise RIEN : elle choisit, par board et par image, une planche déjà cuite
// (`backends/webgl/atlasBake.ts`) et la CELLULE qu'il faut y montrer. Deux écritures de matériau, pas
// une géométrie, pas un `needsUpdate`.
//
// IDEMPOTENCE PAR IMAGE, et c'est structurel : l'écrivain compare l'état COURANT du matériau à celui
// qu'il veut, et n'écrit qu'à l'écart. Piloté par TRANSITION (« au changement de clip »), il perdrait
// la planche à chaque rebuild de board — `actorPoseKey` porte x,y,facing, donc les sujets se
// reconstruisent à CHAQUE pas commité, et le quad neuf repartirait sur sa texture statique sans que
// rien ne le réécrive.

/** Cadence de cuisson d'un flipbook : une frame tous les `ATLAS_FRAME_MS`. */
export const ATLAS_FRAME_MS = 1000 / 24;
/** Bornes du nombre de frames d'une planche — sous 2 il n'y a pas d'animation, au-delà de 12 la
 *  planche coûte plus qu'elle ne rend (sonde #1176 : ~10 ms de rasterisation par frame). */
export const ATLAS_FRAMES_MIN = 2;
export const ATLAS_FRAMES_MAX = 12;

/** Nombre de frames de la planche d'un geste : sa durée TOTALE à la cadence de cuisson, bornée. */
export function atlasFrames(def: ClipDef): number {
  return Math.max(ATLAS_FRAMES_MIN, Math.min(ATLAS_FRAMES_MAX, Math.round(clipTotalMs(def) / ATLAS_FRAME_MS)));
}

/** Frame à montrer à `elapsedMs` : modulo pour un geste EN BOUCLE (marche, repos), clampée à la
 *  dernière pour un geste qui se joue une fois (attaque, parade, touché, effondrement). */
export function frameIndexAt(elapsedMs: number, durationMs: number, n: number, loop: boolean): number {
  if (n <= 1 || !(durationMs > 0)) return 0;
  const t = elapsedMs / durationMs;
  if (loop) return Math.min(n - 1, Math.max(0, Math.floor((((t % 1) + 1) % 1) * n)));
  return Math.min(n - 1, Math.max(0, Math.floor(t * n)));
}

/**
 * PLAFOND de rapport de pixels du rendu — la valeur que le renderer reçoit (`setPixelRatio`). Elle vit
 * ICI parce que le PALIER de cuisson en dépend : le renderer peint le canevas en pixels de DISPOSITIF,
 * là où `rasterPxHeight` se mesure en pixels CSS. Mesuré (#1328) : à zoom maximal et DPR 2, un quad
 * couvre exactement deux fois plus de pixels que sa texture n'en porte — la texture est sous-résolue
 * du facteur DPR, et le POV proche pixelise.
 */
export const DPR_PLAFOND = 2;

/** Rapport de pixels EFFECTIF du rendu (celui que le renderer reçoit). */
export function dprEffectif(dpr: number): number {
  return Math.min(DPR_PLAFOND, dpr > 0 ? dpr : 1);
}

/** Palier de cuisson d'une planche : le palier CSS du billboard, porté au rapport de pixels réel du
 *  rendu, sous le même plafond de texture. */
export function atlasPxHeight(heightM: number, pxPerM: number, dpr: number): number {
  return Math.min(RASTER_PX_MAX, Math.round(rasterPxHeight(heightM, pxPerM) * dprEffectif(dpr)));
}

/** Grossissement au-delà duquel un quad réclame le palier SUPÉRIEUR, et en deçà duquel il redescend.
 *  Deux seuils, jamais un : à seuil unique, un quad posé sur la frontière basculerait à chaque image. */
export const GROSSISSEMENT_HAUT = 1.5;
export const GROSSISSEMENT_BAS = 0.6;

/** Palier voulu pour un quad dont la hauteur PROJETÉE vaut `projetéPx` alors que sa planche est cuite à
 *  `courant`. Hystérésis : entre les deux seuils, le palier ne bouge pas. */
export function palierAtlas(courant: number, projetéPx: number): number {
  if (projetéPx > courant * GROSSISSEMENT_HAUT) return Math.min(RASTER_PX_MAX, courant * 2);
  if (projetéPx < courant * GROSSISSEMENT_BAS) return Math.max(RASTER_PX_MIN, Math.round(courant / 2));
  return courant;
}

const HAUT = new THREE.Vector3();
const BAS = new THREE.Vector3();
const AXE = new THREE.Vector3();

/**
 * Hauteur PROJETÉE d'un quad, en pixels de DISPOSITIF : les deux bouts de son arête verticale passés
 * par la caméra de la frame. C'est la grandeur que le palier de cuisson doit suivre — ni le zoom seul
 * (le POV n'en a pas), ni la distance seule (l'ortho n'en dépend pas).
 */
export function boardProjectedPx(b: Board, camera: FrameCamera, viewportH: number, dpr: number): number {
  camera.updateMatrixWorld();
  AXE.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(b.quad.heightM / 2);
  HAUT.copy(b.mesh.position).add(AXE).project(camera);
  BAS.copy(b.mesh.position).sub(AXE).project(camera);
  return (Math.abs(HAUT.y - BAS.y) / 2) * viewportH * dprEffectif(dpr);
}

/** Ce qu'une image veut voir sur un board : la planche de flipbook, et la cellule à y montrer. */
export interface FramePick {
  /** Clé de planche (`atlasKey`, `backends/webgl/atlasBake.ts`). */
  key: string;
  /** Index de frame dans cette planche. */
  frame: number;
}

/** Le choix de l'image pour un board — `null` = ce sujet ne joue rien (décor, corps sans flipbook). */
export type FramePickAt<B extends Board = Board> = (b: B) => FramePick | null;

/** Planche DÉJÀ CUITE d'une clé. Jamais une cuisson : aucune rasterisation n'entre dans une image. */
export type AtlasAt = (key: string) => { texture: THREE.Texture; layout: AtlasLayout } | undefined;

/** Demande de cuisson d'une planche absente du cache — l'hôte la DIFFÈRE hors de l'image. */
export type BakeAsk<B extends Board = Board> = (pick: FramePick, b: B) => void;

/** Planche montée sur un board, telle que l'écrivain l'y a laissée. */
function layoutOf(b: Board): AtlasLayout | undefined {
  return b.material.userData.atlasLayout as AtlasLayout | undefined;
}

/** Pose la texture (corps, jumeau ET matériau de profondeur) et la cellule sur un board — chaque
 *  écriture sous sa comparaison. Les trois matériaux échantillonnent la MÊME planche : la passe
 *  d'ombres rend le sien (#1334), et une planche laissée derrière y découperait l'ombre d'un geste
 *  révolu. */
function poserFrame(b: Board, texture: THREE.Texture | undefined, layout: AtlasLayout | undefined, k: number): void {
  if (texture && b.material.map !== texture) {
    b.material.map = texture;
    b.material.userData.atlasLayout = layout;
    const jumeau = b.jumeau?.material as THREE.MeshBasicMaterial | undefined;
    if (jumeau) jumeau.map = texture;
    const profondeur = boardDepthMaterial(b);
    if (profondeur) profondeur.map = texture;
  }
  const u = frameRectOf(b.material);
  if (!u) return;
  const r = layout ? frameUvRect(layout, k) : { x: FRAME_RECT_PLEIN[0], y: FRAME_RECT_PLEIN[1], w: FRAME_RECT_PLEIN[2], h: FRAME_RECT_PLEIN[3] };
  if (u.value.x !== r.x || u.value.y !== r.y || u.value.z !== r.w || u.value.w !== r.h) u.value.set(r.x, r.y, r.w, r.h);
}

/**
 * ÉCHANGE EN PLACE de la texture STATIQUE d'un board déjà monté — la REPOSE d'un sujet dont l'art
 * change de vue sans que rien de sa géométrie ne bouge (franchissement d'un cran de caméra : le décor
 * n'a d'art qu'aux quarts de tour). Mêmes trois matériaux que l'écrivain de frames, et le cadre revient
 * à la planche ENTIÈRE : cette texture est une image d'UNE frame.
 */
export function poserTextureStatique(b: Board, texture: THREE.Texture): void {
  poserFrame(b, texture, undefined, 0);
}

/**
 * Écrit la frame de l'image sur chaque board (#1176, L3).
 *
 * REPLI quand la planche voulue manque au cache : on garde la planche COURANTE et on y CLAMPE
 * l'index. Après un rebuild froid, la planche courante est la texture statique — une frame ≥ 1 y
 * pointerait hors cellule, et le quad montrerait du vide. La cuisson, elle, est DEMANDÉE à l'hôte, qui
 * la sort de l'image.
 */
export function writeBoardFrames<B extends Board>(boards: readonly B[], pickAt: FramePickAt<B>, atlasAt: AtlasAt, ask?: BakeAsk<B>): void {
  for (const b of boards) {
    const pick = pickAt(b);
    if (!pick) {
      poserFrame(b, undefined, layoutOf(b), 0);
      continue;
    }
    const cuite = atlasAt(pick.key);
    if (cuite) {
      poserFrame(b, cuite.texture, cuite.layout, Math.min(pick.frame, cuite.layout.n - 1));
      continue;
    }
    ask?.(pick, b);
    const courant = layoutOf(b);
    poserFrame(b, undefined, courant, courant ? Math.min(pick.frame, courant.n - 1) : 0);
  }
}
