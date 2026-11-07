/**
 * KIT DU DÉCOR VOLUMIQUE — la population des recettes de `props.json` et les mesures que ses contrats partagent, dont le
 * contrat de la donnée (`props-volumiques.test.ts`, ce dossier).
 */
import { findPropById, props } from '../../../data';
import { empriseLocaleM, placeAssiseDe, type PropPrimitive } from '../../../data/props.types';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../scene';

/** Une ref de décor que le catalogue ne résout pas : la seule qui se serve encore en billboard, celui
 *  d'ERREUR (#877) — chaque type du catalogue porte sa recette (#3198). */
export const REF_HORS_CATALOGUE = 'decor-hors-catalogue';

/** Les refs du catalogue, chacune à recette (#3198) : une recette de plus entre sous contrat par sa seule déclaration. */
export const IDS = props.map((p) => p.id);

/** Les recettes qui offrent une place assise. */
export const propsAvecPlaces = props.filter((p) => (p.seatSlots?.length ?? 0) > 0);

export const propEntity = ({ id, ref, pos, facing }: { id: string; ref: string; pos: { x: number; y: number }; facing: 'N' | 'E' | 'S' | 'O' }): SceneEntity =>
  ({ id, kind: 'prop', pos, ref, facing }) as SceneEntity;
export const sceneWith = (...entities: SceneEntity[]): Scene => ({ ...emptyScene('scene-test', 8, 8), entities });
/** L'échelle des scènes de ces contrats — LUE sur la scène, jamais redite : `emptyScene` ne pose pas de
 *  `metresPerTile`, donc c'est le défaut du monde (`LDB 15 l.12`) qui s'applique. */
export const METRES_PAR_CASE = sceneMetresPerTile(sceneWith());

/** Emprise d'une primitive (`empriseLocaleM`, la seule) : sa boîte englobante au sol ramenée en CASES
 *  (la recette est en mètres, #1507 — c'est l'échelle de la scène qui la ramène à la grille) et ses
 *  deux hauteurs, en mètres. */
export function emprise(p: PropPrimitive): { x0: number; x1: number; y0: number; y1: number; bas: number; haut: number } {
  const e = empriseLocaleM(p);
  return { ...e, x0: e.x0 / METRES_PAR_CASE, x1: e.x1 / METRES_PAR_CASE, y0: e.y0 / METRES_PAR_CASE, y1: e.y1 / METRES_PAR_CASE };
}

/** Le CORPS d'une recette (sièges exclus) et ses SIÈGES, chacun avec la place qu'il porte. */
export const corpsEtSieges = (id: string) => {
  const prop = findPropById(id)!;
  const parts = prop.volume.primitives.map((p) => ({ e: emprise(p), slot: placeAssiseDe(prop, p) }));
  return { corps: parts.filter((v) => !v.slot), sieges: parts.filter((v) => v.slot) };
};

/** Le barycentre des sommets d'un polygone (ou d'un triangle) monde. */
export const centroide = (poly: readonly { x: number; y: number; z: number }[]) =>
  poly.reduce((s, q) => ({ x: s.x + q.x / poly.length, y: s.y + q.y / poly.length, z: s.z + q.z / poly.length }), { x: 0, y: 0, z: 0 });
