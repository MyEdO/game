/**
 * INDEX arête → murs d'une scène — la seule lecture de « quels segments tiennent CETTE arête ? ».
 *
 * Les quatre accesseurs par arête de `state/scene.ts` (`areteEntre` — donc `wallBetween` et
 * `areteOcculteEntre` —, `structureAt`, `doorAt`, `climbAt`) y répondent en O(1). L'enjeu est le
 * VOLUME : une Ligne de Vue pose une question d'arête par PAS de rayon, et un tour d'IA en demande
 * des dizaines de milliers. Sans index, chaque question balaie les 668 arêtes de La Diligence —
 * banc `wallIndex.test.ts`, 10 000 questions : 3,3 ms par l'index, 30 à 49 ms au balayage.
 *
 * Il n'indexe que la GÉOMÉTRIE (`x,y,side,z`), jamais un verdict : l'état vivant d'une arête (porte
 * ouverte, structure abattue) vit dans `scene.flags`, et les prédicats (`wallIsOpen`, `areteOcculte`)
 * s'appliquent au segment rendu, à chaque appel. Ouvrir une porte n'a donc rien à invalider.
 *
 * Une arête peut porter PLUSIEURS segments (le schéma ne l'interdit pas, et les accesseurs
 * filtraient par `door`/`structure`/`climb` sur la même arête) : la valeur est une LISTE, dans
 * l'ordre du document — le même verdict que le `find`/`some` qu'elle remplace.
 *
 * Mémoïsé par IDENTITÉ de `scene.walls` (patron `state/sceneMemo.ts`) : toute pose/retrait d'arête
 * (`sceneEdit.ts`) reconstruit le tableau, tout changement d'ÉTAT ne touche que `flags`. Aucune
 * invalidation manuelle.
 *
 * Module FEUILLE : n'importe de `scene.ts` que des TYPES (aucun cycle runtime).
 */
import { memoByRef } from './sceneMemo';
import type { Scene, WallSeg, WallSide } from './scene';
import { cleArete } from '../geometry/arete';

/** Tableau STABLE (identité fixe) pour une scène sans mur — clé de mémoïsation valide, et réponse
 *  partagée des arêtes vides. */
const AUCUNE: readonly WallSeg[] = [];

const index = memoByRef((walls: readonly WallSeg[]): ReadonlyMap<string, WallSeg[]> => {
  const parArete = new Map<string, WallSeg[]>();
  for (const w of walls) {
    const k = cleArete(w.x, w.y, w.side, w.z ?? 0);
    const liste = parArete.get(k);
    if (liste) liste.push(w);
    else parArete.set(k, [w]);
  }
  return parArete;
});

/** L'index d'arêtes de la scène — même Map tant que `scene.walls` garde son identité. */
export const wallIndexOf = (scene: Pick<Scene, 'walls'>): ReadonlyMap<string, WallSeg[]> =>
  index(scene.walls ?? AUCUNE);

/** Les segments posés sur l'arête (x, y, side, z) — liste vide si aucun. */
export const aretesA = (
  scene: Pick<Scene, 'walls'>, x: number, y: number, side: WallSide, z = 0,
): readonly WallSeg[] => wallIndexOf(scene).get(cleArete(x, y, side, z)) ?? AUCUNE;
