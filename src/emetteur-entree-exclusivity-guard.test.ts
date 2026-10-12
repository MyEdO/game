import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { analyserCorpus } from '../scripts/guards/lib/dialecte.mjs';
import { scanEmetteurBrut, SCAN_DIRS, PROPRIETAIRE } from '../scripts/guards/lib/emetteurEntreeExclusivity.mjs';

/**
 * Garde d'exclusivité de l'émetteur d'entrée du kit de recette (#1953) : l'émetteur brut du CDP
 * (`emetteursBruts`) n'est référencé que dans `brancherCdp`, `geste` et `frappe`
 * (`scripts/recette/lib.mjs`). Patron `stockage-web-exclusivity-guard.test.ts`.
 */
function referencesHorsEmetteurs(dirs: string[], relDe: (rel: string) => string = (rel) => rel): string[] {
  const out: string[] = [];
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(readCorpus(dirs, { exts: ['.mjs'], tests: true }))) {
    for (const f of scanEmetteurBrut(relDe(rel), text, sourceFile!)) out.push(`${rel}:${f.line} ${f.dans}`);
  }
  return out;
}

describe('garde — l’émetteur brut d’entrée n’est lu que par les émetteurs', () => {
  it('aucune référence à `emetteursBruts` hors de `brancherCdp`, `geste` et `frappe`', { timeout: 120_000 }, () => {
    expect(referencesHorsEmetteurs(SCAN_DIRS), 'émetteur brut lu hors des émetteurs : passer par `geste` (souris, toucher) ou `frappe` (clavier)').toEqual([]);
  });

  it('MORSURE : une référence dans une autre fonction du propriétaire, ou dans un autre fichier, est vue', () => {
    const dir = mkdtempSync(join(tmpdir(), 'emetteur-entree-guard-'));
    try {
      writeFileSync(join(dir, 'lib.mjs'), [
        'const emetteursBruts = new WeakMap();',
        'export function geste(s) { return emetteursBruts.get(s); }',
        'export function clicBrut(s) { return emetteursBruts.get(s)("Input.dispatchMouseEvent", {}); }',
      ].join('\n'));
      writeFileSync(join(dir, 'autre.mjs'), 'export const fuite = (m, s) => m.emetteursBruts.get(s);\n// emetteursBruts en commentaire\nconst t = "emetteursBruts";\n');
      expect(referencesHorsEmetteurs([dir], (rel) => (rel.endsWith('/lib.mjs') ? PROPRIETAIRE : rel)).sort()).toEqual([
        expect.stringMatching(/autre\.mjs:1 \(module\)$/),
        expect.stringMatching(/lib\.mjs:3 clicBrut$/),
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
