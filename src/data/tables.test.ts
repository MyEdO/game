import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { effectTables, findEffectTableById, mutationTables } from './index';

/**
 * Intégrité de `tables.json` (tables d'effets référençables) + BIEN-FORMATION des ops `rollTable`/
 * `rollMutation` dans TOUS les `src/data/*.json` : `gameOpSchema` est LOOSE (seul `op` validé), donc les
 * contraintes XOR (`entries` ⊕ `tableId`) et la résolution des refs (`tableId` → tables.json ; `table` →
 * mutationTables.json) vivent ICI (jamais un tirage vers une table fantôme au runtime).
 */
const DIR = __dirname;
const files = listerDossier(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
const effectIds = new Set(effectTables.map((t) => t.id));
const mutationTableIds = new Set(mutationTables.map((t) => t.id));

/** Collecte toutes les ops d'un `op` donné, en profondeur, de tous les datasets. */
function collectOps(op: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.op === op && !('kind' in o)) out.push(o);
    for (const v of Object.values(o)) walk(v);
  };
  for (const f of files) walk(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
  return out;
}

describe('tables.json — tables d’effets référençables', () => {
  it('chaque table : id unique, die valide, rangées non vides, source citée', () => {
    const seen = new Set<string>();
    for (const t of effectTables) {
      expect(seen.has(t.id), `id dupliqué : ${t.id}`).toBe(false);
      seen.add(t.id);
      expect(['d10', 'd100']).toContain(t.die);
      expect(t.entries.length).toBeGreaterThan(0);
      expect(t.source?.book, `${t.id} sans source`).toBeTruthy();
      for (const r of t.entries) expect(r.min).toBeLessThanOrEqual(r.max);
    }
  });

  it('les 4 colonnes du Tableau des aspects démoniaques (EDOC 13) existent, 10 rangées chacune', () => {
    for (const dom of ['nurgle', 'slaanesh', 'tzeentch', 'indivisible']) {
      const t = findEffectTableById(`allure-demoniaque-${dom}`);
      expect(t.entries).toHaveLength(10);
      expect(t.die).toBe('d10');
    }
  });

  it('findEffectTableById fail-fast sur un id inconnu', () => {
    expect(() => findEffectTableById('inexistante')).toThrow(/introuvable/i);
  });
});

describe('bien-formation des ops rollTable / rollMutation (tous les datasets)', () => {
  it('rollTable : EXACTEMENT un de `entries` ⊕ `tableId`', () => {
    const bad = collectOps('rollTable').filter((o) => ('entries' in o) === ('tableId' in o));
    expect(bad, `rollTable doit porter entries OU tableId (jamais les deux, jamais aucun) :\n${JSON.stringify(bad)}`).toEqual([]);
  });

  it('rollTable.tableId résout dans tables.json', () => {
    const bad = collectOps('rollTable').filter((o) => 'tableId' in o && !effectIds.has(o.tableId as string));
    expect(bad, `tableId introuvable :\n${JSON.stringify(bad)}`).toEqual([]);
  });

  it('rollMutation.table résout dans mutationTables.json', () => {
    const bad = collectOps('rollMutation').filter((o) => !mutationTableIds.has(o.table as string));
    expect(bad, `table de mutation introuvable :\n${JSON.stringify(bad)}`).toEqual([]);
  });
});
