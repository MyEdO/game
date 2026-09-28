/**
 * OÙ se corrige un défaut de plan, tel que `map:check` l'imprime. Deux provenances, une seule interface
 * (`Sites`) : carte CODÉE (grille ASCII source → `fichier:ligne:colonne` + extrait) et PROJET exporté
 * (aucune grille derrière : coordonnées de case). Le CLI (`check.mts`) n'est que la mise en page.
 */
import { terrainAt, type PlanDefect, type PlanDefectAt } from '../../src/state/planDefects';
import { locateGrid, snippet, wallCellPos, wallEdgePos, type GridLocation } from './locate';
import type { MapEntry, MapSource } from './registry';
import type { Scene } from '../../src/state/scene';

/** `snippet` n'existe que si une grille ASCII source porte la case ; `sort` ordonne le rapport
 *  (ligne/colonne du fichier, ou y/x de la carte). */
export interface Site {
  where: string;
  sort: [number, number];
  snippet?: string;
}

export interface Sites {
  banner: string;
  /** `null` = défaut non localisable dans les grilles source disponibles (jamais une position devinée). */
  of: (d: PlanDefect) => Site | null;
  cell: (x: number, y: number, z: number) => Site;
  charAt: (x: number, y: number, z: number) => string;
}

export function coord(at: PlanDefectAt): string {
  if (at.kind === 'zone') return `zone « ${at.zoneId} »`;
  return at.kind === 'edge' ? `(${at.x},${at.y})${at.side}` : `(${at.x},${at.y})`;
}

/** Position en cases (`at`) hors zone — une position de zone ne pointe aucune case unique. */
type CellAt = Extract<PlanDefectAt, { kind: 'cell' } | { kind: 'edge' }>;

/** Ligne/colonne DANS la grille ASCII `walled` (repère du `snippet`). */
function rowColOf(at: CellAt): [number, number] {
  if (at.kind === 'edge') {
    switch (at.side) {
      case 'N': return [2 * at.y, 2 * at.x + 1];
      case 'S': return [2 * (at.y + 1), 2 * at.x + 1];
      case 'O': return [2 * at.y + 1, 2 * at.x];
      case 'E': return [2 * at.y + 1, 2 * (at.x + 1)];
    }
  }
  return [2 * at.y + 1, 2 * at.x + 1];
}

/** Carte CODÉE : la position exacte dans le fichier ASCII source (`locate.ts`), plus l'extrait 3 lignes. */
export function codedSites(source: MapSource): Sites {
  const walledLoc = new Map<number, GridLocation>();
  const walled = (z: number): GridLocation => {
    let loc = walledLoc.get(z);
    if (!loc) {
      const raw = source.walledGrids[`z${z}`];
      if (raw === undefined) throw new Error(`walledGrids.z${z} absent du registre pour cette carte`);
      loc = locateGrid(source.sourceDir, raw);
      walledLoc.set(z, loc);
    }
    return loc;
  };
  /** Le calque de zones est DÉRIVÉ (`zonesFromSeeds`) : aucun char n'existe dans un fichier source. Le
   *  site d'un défaut de calque est donc la CASE, plus le char de la pièce et sa PREMIÈRE GRAINE — la
   *  ligne qu'on va éditer étant celle de la graine, pas celle du calque. */
  const zoneLayers = source.zoneLayers?.();
  const zoneSite = (x: number, y: number, z: number): Site | null => {
    const ch = zoneLayers?.[`z${z}`]?.split('\n')[y]?.[x];
    if (!ch) return null;
    const seed = source.zoneSeeds?.[`z${z}`]?.find((s) => s.char === ch)?.at[0];
    const piece = seed ? `graine ${ch}@${seed[0]},${seed[1]}` : `hors pièce : aucune graine n’atteint cette case`;
    return { where: `calque z${z} (${x},${y})  ${piece}`, sort: [y, x] };
  };
  const site = (loc: GridLocation, line: number, col: number, row: number, srcCol: number, label: string): Site => ({
    where: `${loc.file}:${line}:${col}  ${label}`,
    sort: [line, col],
    snippet: snippet(loc, row, srcCol),
  });
  return {
    banner: `Positions : fichier:ligne:colonne dans la grille ASCII source.`,
    of: (d) => {
      if (d.at.kind === 'zone') return null; // une zone n'occupe aucune case unique de la grille source
      const at = d.at;
      if (d.grid === 'zone') return zoneSite(at.x, at.y, at.z);
      const [row, col] = rowColOf(at);
      const loc = walled(at.z);
      const pos = at.kind === 'edge' ? wallEdgePos(loc, at.x, at.y, at.side) : wallCellPos(loc, at.x, at.y);
      return site(loc, pos.line, pos.col, row, col, coord(at));
    },
    cell: (x, y, z) => {
      const loc = walled(z);
      const pos = wallCellPos(loc, x, y);
      return site(loc, pos.line, pos.col, 2 * y + 1, 2 * x + 1, `(${x},${y})`);
    },
    charAt: (x, y, z) => walled(z).rows[2 * y + 1]?.[2 * x + 1] ?? ' ',
  };
}

/** PROJET exporté : aucune grille ASCII n'existe derrière ces cases — le rapport donne la COORDONNÉE
 *  de case et le dit, plutôt que de fabriquer une ligne de fichier qui n'existe pas. Un trou de
 *  plancher y est toujours SUSPECT : le document ne porte aucune recette d'escalier à opposer. */
export function projectSites(entry: MapEntry, scene: Scene): Sites {
  const at = (label: string, x: number, y: number, z: number): Site => ({
    where: `${entry.key}  z${z} ${label}`,
    sort: [y, x],
  });
  return {
    banner: `Positions : COORDONNÉES de case (x,y) — ce projet exporté n'a aucune grille ASCII source,\n           donc aucune ligne:colonne à citer. Les corrections se font dans l'éditeur.`,
    // Une zone se corrige dans l'éditeur de zones, pas sur une case : le site la NOMME et donne son étage.
    of: (d) => (d.at.kind === 'zone' ? at(coord(d.at), 0, 0, d.at.z) : at(coord(d.at), d.at.x, d.at.y, d.at.z)),
    cell: (x, y, z) => at(`(${x},${y})`, x, y, z),
    charAt: (x, y, z) => terrainAt(scene, x, y, z),
  };
}
