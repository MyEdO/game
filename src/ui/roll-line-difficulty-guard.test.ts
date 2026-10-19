import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * CLIQUET — une LIGNE DE JET fabriquée à la main DIT sa Difficulté (#1112 G8b). Le contrat : une ligne
 * de `RollShell` naît de la fabrique (`ui/breakdown.ts` : `testBreakdown`/`testPending`/`opposedLines`),
 * qui pose la Difficulté en donnée de ligne. Un `RollBreakdown`/`PendingRoll` assemblé en littéral
 * (`{ label, base, modifier, target, roll, success, sl }`) court-circuite la fabrique : sans
 * `difficulty`, la cible affichée ne dit plus de quelle Difficulté elle est faite.
 *
 * Stock NOMINATIF (fichier + nombre), plafond COLLÉ et décroissant : assainir un site l'ABAISSE.
 */

const SCAN_DIRS = ['src/ui', 'src/state', 'src/noyau'];

/** Littéraux de LIGNE DE JET sans `difficulty` — exporté pour la preuve fail-closed. */
export function scanHandmadeRollLines(src: string): number[] {
  const lines: number[] = [];
  for (const m of src.matchAll(/\broll:/g)) {
    const i = m.index!;
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (src[j] === '}') depth++;
      else if (src[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    let end = -1;
    depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (start < 0 || end < 0) continue;
    const lit = src.slice(start, end);
    if (lit.length > 600) continue; // accolade d'un bloc, pas d'une ligne
    // Signature d'un `RollBreakdown` littéral : libellé + base + cible + dé.
    if (!/\blabel\s*:/.test(lit) || !/\bbase\s*:/.test(lit) || !/\btarget\s*:/.test(lit)) continue;
    if (/\bdifficulty\b/.test(lit)) continue; // Difficulté déclarée (clé, raccourci ou propagation ...)
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/** Stock NOMINATIF au 2026-08-05 — ZÉRO ailleurs. */
const BASELINE: Record<string, number> = {};

describe('cliquet — une ligne de jet fabriquée à la main dit sa Difficulté (#1112 G8b)', () => {
  it('aucun site NEUF, et toute baseline assainie est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const { rel, text } of readCorpus(SCAN_DIRS)) {
      const hits = scanHandmadeRollLines(text);
      if (hits.length) counts[rel] = hits;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['Ligne de jet fabriquée à la main SANS Difficulté — passer par `ui/breakdown.ts` :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : une ligne littérale SANS Difficulté est détectée, une ligne AVEC ne l’est pas', () => {
    const sans = `const d = { label: 'Voile', base: 40, modifier: 0, target: 40, roll: 12, success: true, sl: 3 };`;
    const avec = `const d = { label: 'Voile', base: 40, difficulty: 'intermediaire', modifier: 0, target: 40, roll: 12, success: true, sl: 3 };`;
    const propage = `const d = { label: 'Voile', base: 40, ...(p.difficulty ? { difficulty: p.difficulty } : {}), modifier: 0, target: 40, roll: 12, success: true, sl: 3 };`;
    expect(scanHandmadeRollLines(sans)).toHaveLength(1);
    expect(scanHandmadeRollLines(avec)).toHaveLength(0);
    expect(scanHandmadeRollLines(propage)).toHaveLength(0);
  });
});
