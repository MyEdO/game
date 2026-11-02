/**
 * `<defs>` de dégradés partagés du rendu iso : `defsGlobaux()` regroupe tous les dégradés.
 */
import { MISSING_GRADIENT, terrainGradientId, terrainStopsOrdonnes } from './catalog/terrain';
import { MISSING_TONE, MISSING_TONE_DARK } from './catalog/missing';
import { tousLesTerrains } from '../noyau/monde/terrain';
import { type TerrainDef } from '../data/terrains.types';
import { memoParVersion } from '../data/versionDataset';
import { FX_GRADIENTS_DEFS } from './fx/fxGradients';

// --- Définitions partagées (dégradés) -------------------------------------
/** Émetteur PUR des dégradés de TERRAIN (`TerrainDef.stops`) — UN dégradé par terrain, son id DÉRIVÉ
 *  de l'id du terrain (`terrainGradientId`), donc aucun partage possible ; arrêts émis dans l'ordre
 *  croissant (`terrainStopsOrdonnes`, source unique). Tous verticaux (x1=0 y1=0 x2=0 y2=1).
 *  `defsGlobaux()` le compose sur le dataset `src/data/terrains.json` via `tousLesTerrains()`. */
export const degradesDeTerrains = (terrains: readonly TerrainDef[]): string =>
  terrains
    .map((t) => {
      const stops = terrainStopsOrdonnes(t.stops)
        .map(([off, color]) => `<stop offset="${off}" stop-color="${color}"/>`)
        .join('');
      return `\n  <linearGradient id="${terrainGradientId(t.id)}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
    })
    .join('');

/** Dégradé d'ALARME du repli visible (#877) : peint la case d'un terrain absent du registre. */
const degradeAlarme =
  `\n  <linearGradient id="${MISSING_GRADIENT}" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0%" stop-color="${MISSING_TONE}"/><stop offset="100%" stop-color="${MISSING_TONE_DARK}"/></linearGradient>`;

/**
 * Les `<defs>` globaux = dégradés de TERRAIN (données) + dégradé d'alarme + dégradés FX
 * (`fx/fxGradients`, verbatim). FONCTION, jamais une constante de module : les rampes de terrain
 * viennent d'un dataset ÉDITABLE au Codex (`terrains.json`, #1690) — assemblées une fois à
 * l'import, une édition des `stops` ne repeindrait ni la vue plan ni l'éditeur sans rechargement.
 *
 * Mémoïsée par la VERSION du dataset, patron d'`indexDesTerrains` (`noyau/monde/terrain/index.ts`) :
 * `setDataset` splice le tableau EN PLACE (son identité ne change jamais) et VERSIONNE son écriture
 * (`memoParVersion`, `data/versionDataset.ts`, #1692) — c'est cette version qui dit qu'une rampe a
 * bougé. Les dégradés FX sont des littéraux : ils ne se re-lisent pas.
 */
const memoDefs = memoParVersion('terrains', () => degradesDeTerrains(tousLesTerrains()) + degradeAlarme + FX_GRADIENTS_DEFS);
export function defsGlobaux(): string {
  return memoDefs();
}
