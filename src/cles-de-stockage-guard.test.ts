import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { analyserCorpus } from '../scripts/guards/lib/dialecte.mjs';
import { scanClesDeStockage, SCAN_DIRS } from '../scripts/guards/lib/clesDeStockage.mjs';

/**
 * Garde d'unicité des clés de stockage web (#1897) : une clé `wfrp4.…` n'est écrite en littéral
 * qu'une fois, chez son propriétaire, qui l'exporte. Scanner en lib (`clesDeStockage.mjs`), test qui
 * le joue.
 */
const corpus = (dirs: string[]) => readCorpus(dirs, { exts: ['.ts', '.tsx', '.mts', '.cts'] });

/** Clés de stockage écrites en littéral dans PLUSIEURS sites : clé → sites. */
function clesEnDouble(dirs: string[]): Record<string, string[]> {
  const sites = new Map<string, string[]>();
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(corpus(dirs))) {
    for (const f of scanClesDeStockage(rel, text, sourceFile!)) sites.set(f.cle, [...(sites.get(f.cle) ?? []), `${rel}:${f.line}`]);
  }
  return Object.fromEntries([...sites].filter(([, s]) => s.length > 1));
}

describe('garde — une clé de stockage n’est écrite qu’une fois', () => {
  it('aucune clé `wfrp4.…` écrite en littéral dans deux sites : son propriétaire l’exporte', { timeout: 120_000 }, () => {
    expect(clesEnDouble(SCAN_DIRS), 'clé de stockage recopiée : l’exporter depuis son propriétaire et l’importer').toEqual({});
  });

  it('MORSURE : une clé recopiée dans un second fichier est vue', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cle-stockage-guard-'));
    try {
      writeFileSync(join(dir, 'proprietaire.ts'), "export const CLE = 'wfrp4.essai';\n");
      writeFileSync(join(dir, 'copie.ts'), "const CLE = `wfrp4.essai`;\nexport const k = (s: string) => `wfrp4.essai.${s}`;\n");
      expect(Object.keys(clesEnDouble([dir]))).toEqual(['wfrp4.essai']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
