/** Présentation des terrains — DÉRIVÉE du dataset `src/data/terrains.json` via la façade
 *  `noyau/monde/terrain` (lecture VIVANTE, index O(1)). La méta sémantique (walkable/priority) vient du même
 *  document : ici on n'expose que ce que le rendu lit. */
import { MISSING_ID } from '../../noyau/monde/volume/missing';
import { terrainDef } from '../../noyau/monde/volume/matieres';

/**
 * Id du `<linearGradient>` d'un terrain — DÉRIVÉ de son id, jamais une donnée : aucun partage de
 * rampe entre deux terrains n'est représentable (#1690).
 */
export const terrainGradientId = (id: string): string => `g_${id}`;

/** Dégradé de REPLI VISIBLE (#877) : id du `<linearGradient>` d'alarme émis par `defsGlobaux()` (`gameIso/sprites`)
 *  à côté des dégradés de terrain — un id de terrain absent du dataset peint la case en magenta criard,
 *  jamais l'herbe (ni aucun autre terrain réel). */
export const MISSING_GRADIENT = 'g_terrain_manquant';

/** Id du dégradé d'un terrain ; id absent du dataset → repli VISIBLE + avertissement DEV. */
export function terrainGradient(id: string): string {
  const def = terrainDef(id);
  return def.id === MISSING_ID ? MISSING_GRADIENT : terrainGradientId(def.id);
}
