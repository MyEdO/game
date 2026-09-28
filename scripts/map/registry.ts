/**
 * Cartes contrôlables par `npm run map:check -- <clé|chemin/projet.json>`. Deux PROVENANCES, une
 * seule interface (`MapEntry`) :
 *  - carte CODÉE (`MAP_REGISTRY`) : Scène compilée par `buildScene`, plus les mêmes chaînes ASCII que
 *    celles passées à `buildScene` (`source`) pour que `locate.ts` retrouve leur position exacte dans
 *    le fichier — le rapport donne alors `fichier:ligne:colonne` ;
 *  - PROJET exporté par l'éditeur (`.json`) : la Scène y est DÉJÀ compilée, `parseProject` la relit
 *    telle quelle (aucune recompilation). Aucune grille ASCII n'existe derrière ces cases, donc aucun
 *    `source` : le rapport donne des COORDONNÉES de case et le dit (`check.mts`).
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Scene } from '../../src/state/scene';
import type { ZoneSeed } from '../../src/state/asciiMap';
import { parseProject } from '../../src/state/worldMap';
import { buildOperaFloorplan, operaZoneLayers, OPERA_ZONE_SEEDS } from '../../src/scenes/opera/floorplan';
import { REZ_ASCII, ETAGE_ASCII } from '../../src/scenes/opera/floorplan.ascii';

const HERE = dirname(fileURLToPath(import.meta.url));
const sceneDir = (name: string) => join(HERE, '../../src/scenes', name);

/** Grilles ASCII SOURCE d'une carte codée — la seule chose qu'un projet exporté n'a pas. */
export interface MapSource {
  /** Dossier où chercher les `export const … = String.raw\`…\`` sources (tous les `.ts` du dossier). */
  sourceDir: string;
  /** Grilles `walled` (box-drawing) par étage — MÊME chaîne que `MapSpec.walled[z]`. */
  walledGrids: Record<string, string>;
  /** CALQUE de zones par étage, TEL QUE la scène l'a dérivé (`zonesFromSeeds`), et les GRAINES dont il
   *  vient. Le calque n'est écrit dans AUCUN fichier : un défaut de zone se cite en case + graine de la
   *  pièce, jamais en ligne de fichier. Le calque se dérive à l'appel (#1692), par la MÊME dérivation que
   *  la scène, jamais une seconde. */
  zoneLayers?: () => Record<string, string>;
  zoneSeeds?: Record<string, readonly ZoneSeed[]>;
  /** Chars de case (grille `walled` de l'étage source) qui posent une volée d'escalier légitime
   *  (`MapSpec.cells[c].stair`) — un « trou » de plancher d'étage sur ces chars est une TRÉMIE voulue. */
  stairChars?: Set<string>;
}

export interface MapEntry {
  key: string;
  label: string;
  build: () => Scene;
  /** Absent = aucune grille ASCII derrière la Scène (projet exporté) : positions en coordonnées de case. */
  source?: MapSource;
  /** Terrain « plancher » (bâti au rez) et « pavé » (cour/passage couvert) — pour la carte de
   *  superposition `--carte` uniquement (légende `#`/`1`/`0`/`,`/`.`). Absents (projet exporté) = la
   *  carte classe le rez par `builtTerrains()`. */
  floorTerrain?: string;
  paveTerrain?: string;
}

export const MAP_REGISTRY: MapEntry[] = [
  // `stairChars` : IMPOSSIBLE — l'étage se rejoint par 2 RAMPES (`operaRelief`, cf. `opera/floorplan.ts`),
  // AUCUN escalier n'existe sur ce plan (`MapSpec.cells` n'est pas authoré). Sans recette `stair`,
  // `auditStairwells` classe donc tout trou de plancher `SUSPECT` — correct.
  {
    key: 'opera',
    label: 'Théâtre Staatsoper',
    build: buildOperaFloorplan,
    source: {
      sourceDir: sceneDir('opera'),
      walledGrids: { z0: REZ_ASCII, z1: ETAGE_ASCII },
      zoneLayers: operaZoneLayers,
      zoneSeeds: OPERA_ZONE_SEEDS,
    },
    floorTerrain: 'plancher',
  },
];

export function findMap(key: string): MapEntry {
  const entry = MAP_REGISTRY.find((m) => m.key === key);
  if (!entry) {
    const known = MAP_REGISTRY.map((m) => m.key).join(', ');
    throw new Error(`scène « ${key} » inconnue de scripts/map/registry.ts (connues : ${known})`);
  }
  return entry;
}

/** Scènes d'un PROJET exporté (`.json` de l'éditeur), une entrée par scène du document. La Scène est
 *  relue par `parseProject` (migrations de schéma + `normalizeScene`, le MÊME chemin que le jeu) : elle
 *  est déjà compilée dans le document, rien n'est rebâti. */
export function loadProjectMaps(path: string): MapEntry[] {
  const doc = parseProject(JSON.parse(readFileSync(path, 'utf8')));
  const file = basename(path);
  return doc.scenes.map((scene) => ({
    key: `${path}#${scene.id}`,
    label: `${scene.label || scene.id} — ${file}`,
    build: () => scene,
  }));
}

/** Cartes désignées par l'argument de ligne de commande : soit une clé du registre, soit le CHEMIN
 *  d'un projet exporté (`.json`) — dans ce cas TOUTES ses scènes, une par une. */
export function findMaps(arg: string): MapEntry[] {
  return arg.toLowerCase().endsWith('.json') ? loadProjectMaps(arg) : [findMap(arg)];
}
