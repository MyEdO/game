import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { analyserCorpus } from '../scripts/guards/lib/dialecte.mjs';
import { scanStockageWeb, scanClesDeStockage, SCAN_DIRS, PROPRIETAIRE } from '../scripts/guards/lib/stockageWebExclusivity.mjs';

/**
 * Garde d'exclusivité du stockage web (#1897) : hors `PROPRIETAIRE` (`src/lib/stockageWeb.ts`), aucun
 * code de production sous `src/` ne touche le `localStorage` ni le `sessionStorage` — tout passe par
 * `stockageWeb(genre)` ; et une clé de stockage n'est écrite en littéral qu'une fois, chez son
 * propriétaire. Patron `roll-seam-exclusivity-guard.test.ts` (scanner en lib, test qui le joue).
 */
const corpus = (dirs: string[]) => readCorpus(dirs, { exts: ['.ts', '.tsx', '.mts', '.cts'] });

function accesHorsProprietaire(dirs: string[]): string[] {
  const out: string[] = [];
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(corpus(dirs).filter(({ rel }) => rel !== PROPRIETAIRE))) {
    for (const f of scanStockageWeb(rel, text, sourceFile!)) out.push(`${rel}:${f.line} ${f.forme}`);
  }
  return out;
}

/** Clés de stockage écrites en littéral dans PLUSIEURS sites : clé → sites. */
function clesEnDouble(dirs: string[]): Record<string, string[]> {
  const sites = new Map<string, string[]>();
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(corpus(dirs))) {
    for (const f of scanClesDeStockage(rel, text, sourceFile!)) sites.set(f.cle, [...(sites.get(f.cle) ?? []), `${rel}:${f.line}`]);
  }
  return Object.fromEntries([...sites].filter(([, s]) => s.length > 1));
}

describe('garde — le stockage web ne passe que par `stockageWeb`', () => {
  it('aucun accès au localStorage/sessionStorage hors `src/lib/stockageWeb.ts`', { timeout: 240_000 }, () => {
    expect(accesHorsProprietaire(SCAN_DIRS), 'accès nu au stockage web : passer par `stockageWeb(genre)` (src/lib/stockageWeb.ts)').toEqual([]);
  });

  it('MORSURE : un accès nu réintroduit dans un fichier de production est vu', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stockage-web-guard-'));
    try {
      writeFileSync(join(dir, 'intrus.ts'), "export const lire = (k: string) => sessionStorage.getItem(k);\n");
      expect(accesHorsProprietaire([dir])).toEqual([expect.stringMatching(/intrus\.ts:1 sessionStorage$/)]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('FAIL-CLOSED : identifiant nu, propriété, accès indexé, `typeof` ; ignore commentaire, chaîne, type, nom de membre', () => {
    const vus = (code: string) => scanStockageWeb('x.ts', code).map((f) => f.forme);
    expect(vus('localStorage.setItem("k", "v");')).toEqual(['localStorage']);
    expect(vus('window.sessionStorage.clear();')).toEqual(['.sessionStorage']);
    expect(vus('(globalThis as any).localStorage;')).toEqual(['.localStorage']);
    expect(vus("globalThis['sessionStorage'];")).toEqual(["['sessionStorage']"]);
    expect(vus("typeof localStorage === 'undefined';")).toEqual(['localStorage']);
    expect(vus('const { localStorage: s } = window;')).toEqual(['localStorage']);
    expect(vus('// le localStorage en commentaire\nconst t = "miroir localStorage";')).toEqual([]);
    expect(vus("type G = 'localStorage' | 'sessionStorage'; let s: typeof localStorage;")).toEqual([]);
    expect(vus('type T = { localStorage?: Storage }; const o = { sessionStorage: 1 };')).toEqual([]);
  });
});

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
