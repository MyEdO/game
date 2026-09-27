/**
 * Retrouve la LIGNE/COLONNE exacte dans le fichier source d'une grille ASCII authorée (`String.raw`),
 * pour une case ou une arête. Ne DEVINE jamais un décalage : la grille du fichier est retrouvée par
 * ÉGALITÉ de contenu avec la chaîne effectivement passée à `buildScene` (`MapSpec.walled`). Un calque
 * de zones n'a, lui, aucun littéral à localiser : il est DÉRIVÉ de la grille par `zonesFromSeeds`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CellSide } from '../../src/data/schemas/defs-scenes/communs';

export interface GridLocation {
  file: string;
  rows: string[];
  lineOf: (row: number) => number;
}

function lineNumberAt(text: string, charIndex: number): number {
  let n = 1;
  for (let i = 0; i < charIndex; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** Retire l'ARTEFACT de gabarit — la ligne vide immédiatement après le backtick d'ouverture et celle
 *  qui précède le backtick de fermeture, UNE de chaque côté et pas une de plus : dans une grille
 *  box-drawing `walled`, une rangée vide INTERNE (ou de tête/queue) est une rangée d'ARÊTES sans aucun
 *  mur, parfaitement significative. Même découpe que `walledRowsOf` (`src/state/asciiMap.ts`), qui la
 *  fait sur la chaîne compilée — ici c'est sur le littéral du fichier, pour en compter les LIGNES. */
function stripArtifact(rows: string[]): { rows: string[]; lead: number } {
  let start = 0;
  let end = rows.length;
  if (rows.length && rows[0].trim() === '') start = 1;
  if (end > start && rows[end - 1].trim() === '') end -= 1;
  return { rows: rows.slice(start, end), lead: start };
}

/** Cherche, dans les `.ts` d'un dossier, le `export const NOM = String.raw\`…\`` dont le contenu
 *  correspond EXACTEMENT (égalité stricte) à `raw` — la même chaîne que celle compilée par `buildScene`.
 *  JETTE si ≥2 blocs correspondent (deux ailes symétriques, deux étages jumeaux, un `export const` recopié)
 *  — ne devine JAMAIS lequel des deux corriger : une position devinée à tort fait éditer le mauvais bloc,
 *  une carte juste devient fausse en silence (#823 défaut 3). */
export function locateGrid(dir: string, raw: string): GridLocation {
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  const re = /export const (\w+)\s*=\s*String\.raw`([\s\S]*?)`/g;
  const matches: { file: string; name: string; loc: GridLocation }[] = [];
  for (const f of files) {
    const path = join(dir, f);
    const text = readFileSync(path, 'utf8');
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[2] !== raw) continue;
      const backtickIdx = m.index + m[0].indexOf('`') + 1;
      const backtickLine = lineNumberAt(text, backtickIdx);
      const { rows, lead } = stripArtifact(m[2].split('\n'));
      matches.push({ file: path, name: m[1], loc: { file: path, rows, lineOf: (row) => backtickLine + lead + row } });
    }
  }
  if (matches.length === 0) {
    throw new Error(`grille introuvable sous ${dir} (aucun export const = String.raw\` ne correspond au contenu compilé)`);
  }
  if (matches.length > 1) {
    const named = matches.map((m) => `${m.name} (${m.file})`).join(' · ');
    throw new Error(`grille AMBIGUË sous ${dir} : ${matches.length} blocs identiques correspondent au contenu compilé — ${named} — impossible de savoir lequel éditer, renomme/désambiguïse la donnée source`);
  }
  return matches[0].loc;
}

export interface SourcePos {
  file: string;
  line: number;
  col: number;
  char: string;
}

function charAt(loc: GridLocation, row: number, col: number): string {
  const line = loc.rows[row];
  if (line === undefined) return ' ';
  return line[col] ?? ' ';
}

/** Position d'une CASE (x,y) dans une grille `walled` (case = ligne/colonne impaires, (2W+1)×(2H+1)). */
export function wallCellPos(loc: GridLocation, x: number, y: number): SourcePos {
  const row = 2 * y + 1;
  const col = 2 * x + 1;
  return { file: loc.file, line: loc.lineOf(row), col: col + 1, char: charAt(loc, row, col) };
}

const EDGE_RC: Record<CellSide, (x: number, y: number) => [number, number]> = {
  N: (x, y) => [2 * y, 2 * x + 1],
  S: (x, y) => [2 * (y + 1), 2 * x + 1],
  O: (x, y) => [2 * y + 1, 2 * x],
  E: (x, y) => [2 * y + 1, 2 * (x + 1)],
};

/** Position d'une ARÊTE (x,y,side) dans une grille `walled`. */
export function wallEdgePos(loc: GridLocation, x: number, y: number, side: CellSide): SourcePos {
  const [row, col] = EDGE_RC[side](x, y);
  return { file: loc.file, line: loc.lineOf(row), col: col + 1, char: charAt(loc, row, col) };
}

/** Extrait de 3 lignes centré sur `row`, curseur `^` sous la colonne fautive. */
export function snippet(loc: GridLocation, row: number, col: number): string {
  const out: string[] = [];
  for (let r = Math.max(0, row - 1); r <= Math.min(loc.rows.length - 1, row + 1); r++) {
    const text = loc.rows[r] ?? '';
    out.push(`  ${String(loc.lineOf(r)).padStart(5)} | ${text}`);
    if (r === row) out.push(`        | ${' '.repeat(col)}^`);
  }
  return out.join('\n');
}
