/**
 * TEXTURES STATIQUES d'un billboard de décor et leur RANG dans la file
 * cadencée du cuiseur (#1373).
 *
 * Une texture statique se mémoïse sur sa clé (`getBillboardTexture`) et s'obtient à un REGARD donné :
 * l'identité de cache d'un décor porte son cran (`identiteAuCran`).
 * Ce module tient la carte des POIGNÉES : le rang d'une clé qui ATTEND encore son tour, pour que la
 * caméra puisse le relever ou le rendre au réchauffage sans jamais reconstruire la file.
 */
import type * as THREE from 'three';
import type { Rot } from '../../geometry/iso';
import { billboardTextureKey } from '../backends/webgl/billboardMath';
import type { View } from '../facing';
import { clearBillboardTextures, getBillboardTexture, octetsTextureStatique, setStaticTexturePins, svgToTexture } from '../backends/webgl/svgTexture';
import { PRIORITE_RECHAUFFAGE, queueBakeTask, type BakePriority } from '../backends/webgl/atlasBake';
import type { BillboardSubject } from '../backends/webgl/sceneMeshes';
import { identiteAuCran } from './regard';

/**
 * POIGNÉES DE PRIORITÉ des textures statiques EN FILE, par clé (`BakePriority`, l'objet mutable que le
 * cuiseur relit à chaque tranche).
 *
 * Sans elle, une clé posée en réchauffage puis redemandée par la caméra restait servie en dernier : la
 * mémoïsation (`getBillboardTexture`) rend la promesse DÉJÀ en file sans jamais toucher à son rang, et
 * la relève du cran franchi passait derrière toute la pré-chauffe (mesuré : rang 31/31 contre 1/31 à
 * froid ; 56 rasterisations pour 20 décors utiles).
 *
 * Elle ne tient QUE ce qui attend : la poignée se pose à l'entrée en file et se retire au départ de la
 * tâche. Une clé déjà servie par le cache n'y entre pas — une poignée fantôme se ferait relire par
 * chaque passage de `rendreAuRechauffage`, sans plus rien commander.
 */
const POIGNEES_STATIQUES = new Map<string, BakePriority>();

/** CLÉ de cache d'une texture statique — la SEULE formule : celle que `textureAuCran` demande, et
 *  celle que l'épingle du regard courant désigne (`epinglerStatiques`). PURE. */
export function cleStatique(sub: BillboardSubject, view: View, mirror: boolean, rot: Rot, pxHeight: number): string {
  return billboardTextureKey(identiteAuCran(sub, rot), view, mirror, pxHeight);
}

/** TEXTURE STATIQUE d'un sujet à une vue et un cran, mémoïsée sur sa clé (`getBillboardTexture`).
 *
 *  `priorité` la range dans la file CADENCÉE du cuiseur (`queueBakeTask`) : TOUTE rasterisation de
 *  texture statique y passe — celle qu'un changement de regard réclame comme celle du MONTAGE d'une
 *  scène (#1372) —, une par tranche d'inactivité et jamais en rafale. AUCUN chemin direct.
 *
 *  Une clé DÉJÀ EN FILE que la caméra réclame voit son rang RELEVÉ, jamais abaissé : la mémoïsation
 *  rend la promesse en attente telle quelle, et le montage comme la repose hériteraient sinon du rang
 *  du temps mort qui l'a posée. */
export function textureAuCran(
  sub: BillboardSubject,
  view: View,
  mirror: boolean,
  rot: Rot,
  pxHeight: number,
  priorité: number,
): Promise<THREE.Texture> {
  const clé = cleStatique(sub, view, mirror, rot, pxHeight);
  const rasteriser = () => svgToTexture(sub.svg(view, mirror, rot), sub.box, pxHeight);
  // POIDS ESTIMÉ : ce que l'entrée pèse au stock borné tant que sa rasterisation court. Sans lui, une
  // rafale de demandes (montage, pré-chauffe) ne pèse rien et le stock gonfle jusqu'à leur service
  // (recette #1374 : 338 entrées pour 8,9 Mo comptés pendant un demi-tour).
  const bytesEst = octetsTextureStatique(sub.box, pxHeight);
  const rang = POIGNEES_STATIQUES.get(clé);
  if (rang) rang.value = Math.max(rang.value, priorité);
  // La poignée se pose DANS la fabrique : elle seule court sur un vrai manque de cache. Posée avant,
  // une clé déjà servie en laissait une que rien ne retirerait jamais.
  return getBillboardTexture(clé, () => {
    const poignée = rang ?? { value: priorité };
    POIGNEES_STATIQUES.set(clé, poignée);
    return queueBakeTask(poignée, () => {
      // La carte ne tient que ce qui ATTEND : une tâche partie n'a plus de rang à défendre.
      POIGNEES_STATIQUES.delete(clé);
      return rasteriser();
    });
  }, bytesEst);
}

/** Rend au RÉCHAUFFAGE les textures statiques que la caméra n'attend plus (le regard qu'on vient de
 *  quitter) : laissées en tête de file, elles font patienter celles du regard courant.
 *
 *  INVARIANT : ce geste ne distingue pas l'origine d'une clé — les demandes de MONTAGE encore en
 *  attente y descendent aussi. Ce qui les relève est la re-demande du regard d'arrivée, dont le rang
 *  ne fait que MONTER (`Math.max` de `textureAuCran`) ; un montage qu'aucune repose ne redemande
 *  reste donc servi en temps mort, après le regard courant (#1372). */
export function rendreAuRechauffage(): void {
  for (const poignée of POIGNEES_STATIQUES.values()) {
    if (poignée.value > PRIORITE_RECHAUFFAGE) poignée.value = PRIORITE_RECHAUFFAGE;
  }
}

/** ÉPINGLE les textures statiques POSÉES sur les quads montés : le stock est BORNÉ (#1374), et une
 *  texture à l'écran évincée laisserait son quad sans art jusqu'à la recuisson. Le jeu d'épingles se
 *  REMPLACE à chaque pose — il décrit ce qui est porté maintenant, jamais un cumul. */
export function epinglerStatiques(clés: Iterable<string>): void {
  setStaticTexturePins(clés);
}

/** Oublie le cache de textures statiques ET les rangs de ce qui l'attendait (changement de scène). */
export function viderTexturesStatiques(): void {
  clearBillboardTextures();
  POIGNEES_STATIQUES.clear();
}

/** RANG de chaque clé statique encore EN ATTENTE — la carte que le cuiseur relit, en lecture seule.
 *  C'est par elle que se mesurent l'ordre de service d'un changement de regard et l'absence de
 *  poignée fantôme. */
export function poigneesEnAttente(): ReadonlyMap<string, number> {
  return new Map([...POIGNEES_STATIQUES].map(([clé, p]) => [clé, p.value]));
}
