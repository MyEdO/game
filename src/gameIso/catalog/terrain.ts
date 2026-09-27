/** Présentation des terrains — DÉRIVÉE du dataset `src/data/terrains.json` via la façade
 *  `state/terrain` (lecture VIVANTE, index O(1)). La méta sémantique (walkable/priority) vient du même
 *  document : ici on n'expose que ce que le rendu lit. */
import { terrainEntree, type TerrainDef } from '../../state/terrain';
import type { TerrainStops } from '../../data/terrains.types';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE } from './missing';

/**
 * Arrêts d'une rampe de terrain, ORDONNÉS par offset croissant — source UNIQUE des émetteurs de
 * `<linearGradient>` (`gameIso/sprites.ts`, `gameIso/authoring/detailSvg.ts`). SVG lit les `<stop>`
 * dans l'ordre d'ÉMISSION et clampe un offset qui recule sur son prédécesseur : un arrêt émis hors
 * ordre est inerte, sans un mot. L'ordre est aussi exigé au PARSE (`schemas/defs/terrains.ts`) ; le
 * tri ici rend l'émission indépendante de l'ordre des clés du Record.
 */
export const terrainStopsOrdonnes = (stops: TerrainStops): [string, string][] =>
  Object.entries(stops).sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10));

/**
 * Id du `<linearGradient>` d'un terrain — DÉRIVÉ de son id, jamais une donnée : aucun partage de
 * rampe entre deux terrains n'est représentable (#1690).
 */
export const terrainGradientId = (id: string): string => `g_${id}`;

/** Dégradé de REPLI VISIBLE (#877) : id du `<linearGradient>` d'alarme émis par `defsGlobaux()` (`gameIso/sprites`)
 *  à côté des dégradés de terrain — un id de terrain absent du dataset peint la case en magenta criard,
 *  jamais l'herbe (ni aucun autre terrain réel). */
export const MISSING_GRADIENT = 'g_terrain_manquant';

/** Entrée de REPLI VISIBLE (#877) : un terrain au ton d'alarme, jamais l'apparence d'un autre terrain.
 *  `stops` VIDE : le dégradé peint du repli est `MISSING_GRADIENT`, émis par `defsGlobaux()` — une rampe recopiée
 *  ici en serait une seconde définition. Infranchissable et de priorité nulle : le repli ne déborde sur
 *  aucun voisin et n'ouvre aucun passage que la donnée n'a pas authorisé. */
const MANQUANT: TerrainDef = {
  id: MISSING_ID,
  type: 'terrains',
  label: MISSING_LABEL,
  maison: 'entrée de REPLI VISIBLE du catalogue de rendu — hors dataset, aucune donnée ne la référence',
  walkable: false,
  priority: 0,
  swatch: MISSING_TONE,
  stops: {},
};

/** Terrain par id ; id absent du dataset → repli VISIBLE + avertissement DEV. Le seul accès du rendu
 *  au dataset : `swatch`, `detail` et `gradient` en sortent tous, donc du MÊME repli. */
export function terrainDef(id: string): TerrainDef {
  return catalogEntry(terrainEntree, id, 'terrain', MANQUANT);
}

/** Id du dégradé d'un terrain ; id absent du dataset → repli VISIBLE + avertissement DEV. */
export function terrainGradient(id: string): string {
  const def = terrainDef(id);
  return def.id === MISSING_ID ? MISSING_GRADIENT : terrainGradientId(def.id);
}
