/**
 * BÂTIMENTS — façade de lecture du dataset `src/data/buildings.json` (#1715) et helper PUR du cutaway
 * de toit. Ajouter un bâtiment = ajouter une entrée au dataset ; plus aucun module TS ne déclare de
 * type de bâtiment.
 *
 * C'est le SEAM unique : la palette de l'éditeur, les ornements du rendu et la dérivation des toitures
 * (`toitureEffective`, `state/sceneEdit.ts`) passent par les accesseurs ci-dessous, jamais par le
 * tableau brut. La façade vit dans `src/state` — patron `state/terrain/index.ts` (#1690, même
 * domicile) : une façade de DONNÉE lue par le store obligerait sinon `src/state` à importer
 * `src/gameIso`, alors que le rendu dépend du store et jamais l'inverse (CLAUDE.md règle 3, garde
 * `state/frontiere-state-gameiso.test.ts`).
 *
 * LECTURE VIVANTE, index O(1). Le tableau exporté par `src/data/index.ts` est le binding que `setDataset`
 * mute EN PLACE (`data/overrides.ts`) : son IDENTITÉ ne change jamais, et le témoin est la VERSION du
 * dataset posée par le seam d'écriture (`memoParVersion`, `data/versionDataset.ts`, #1692). Des
 * accesseurs, jamais une const de module : une entrée éditée au Codex se voit dans l'éditeur et au
 * rendu sans rechargement.
 *
 * Le CUTAWAY, plus bas, est l'autre moitié du domaine : la structure réelle d'un bâtiment est faite de
 * murs d'arête (`WallSeg`, destructibles via `structure`) sur un sol de terrain — la walkability et la
 * vue passent par le terrain + `wallBetween` (plus aucune empreinte de bâtiment). Ne subsiste que le
 * RENDU du toit (masses de `ArchitectureBody`, `gameIso/builders/roofs.ts`), qui se lève en cutaway
 * quand un allié entre dans l'empreinte.
 */
import { buildings } from '../data/index';
import { memoParVersion } from '../data/versionDataset';
import type { BuildingDef, BuildingFeature } from '../data/buildings.types';
import type { ArchitectureRect } from './scene';

export type { BuildingDef, BuildingFeature } from '../data/buildings.types';

/** Ce qu'un porteur de type de bâtiment NOMME à l'écran : l'id qu'il référence et son libellé FR. */
export type BuildingMeta = Pick<BuildingDef, 'id' | 'label'>;

/** UN mémo pour le dataset : les deux vues (entrée complète, méta d'écran) se reconstruisent au MÊME
 *  témoin de version — deux cellules sur la même clé recalculeraient deux fois le même balayage. */
const vues = memoParVersion('buildings', () => ({
  parId: Object.fromEntries(buildings.map((b) => [b.id, b])) as Readonly<Record<string, BuildingDef>>,
  metas: Object.fromEntries(
    buildings.map((b) => [b.id, { id: b.id, label: b.label }]),
  ) as Readonly<Record<string, BuildingMeta>>,
}));

/** Les métas indexées par id — reconstruites à la première lecture qui suit une écriture. */
export function buildingsMeta(): Readonly<Record<string, BuildingMeta>> {
  return vues().metas;
}

/** COUVERTURE de référence d'un TYPE de bâtiment (`buildings.json › roofMaterial`) : une forge est
 *  couverte d'ardoise par son type. Rendue à `toitureEffective` (`state/sceneEdit.ts`), qui l'insère
 *  entre la surcharge du corps et la toiture de la scène. Corps SANS type, ou type inconnu du dataset
 *  (un id hors dataset est refusé au parse) : `undefined` — l'étage suivant tranche. */
export function buildingRoofMaterial(style: string | undefined): string | undefined {
  return style === undefined ? undefined : vues().parId[style]?.roofMaterial;
}

/** Ornements d'identité d'un type de bâtiment (clocheton/cheminée/enseigne/étal), repli `[]` — lus par
 *  `builders/props` pour émettre un billboard par ornement. SÉPARÉ des métas d'éditeur.
 *  Un corps SANS type de bâtiment (`ArchitectureBody.style` absent : bourg, hameau) n'en porte aucun. */
export function buildingFeatures(style: string | undefined): BuildingFeature[] {
  return style === undefined ? [] : vues().parId[style]?.features ?? [];
}

/** Boîte englobante d'une empreinte de masse (`BuildingMass.footprint`, plusieurs rectangles). */
export function massFootBBox(footprint: readonly ArchitectureRect[]): ArchitectureRect {
  const x = Math.min(...footprint.map((r) => r.x));
  const y = Math.min(...footprint.map((r) => r.y));
  const x1 = Math.max(...footprint.map((r) => r.x + r.w));
  const y1 = Math.max(...footprint.map((r) => r.y + r.h));
  return { x, y, w: x1 - x, h: y1 - y };
}

/** Le toit d'un bâtiment composé doit-il être masqué (cutaway) ? Vrai dès qu'un allié se tient dans
 *  l'empreinte du toit — l'intérieur est tout-en-scène, plus aucune scène-intérieur séparée. */
export function roofHidden(foot: ArchitectureRect, allies: { x: number; y: number }[]): boolean {
  return allies.some((a) => a.x >= foot.x && a.x < foot.x + foot.w && a.y >= foot.y && a.y < foot.y + foot.h);
}
