import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { effectTables, findEffectTableById } from './index';
import { deDeLaTableTiree, facesDuDe } from '../engine/tables';
import { estObjet } from '../lib/objet.mjs';
import { gameOpSchema } from './schemas/grammaire/mecanique';

/**
 * Intégrité de `tables.json` (tables d'effets référençables) + BIEN-FORMATION des ops `rollTable` dans TOUS
 * les `src/data/*.json` : la contrainte XOR (`entries` ⊕ `table`) et la résolution de `table.id` dans tables.json.
 */
const DIR = __dirname;
const files = listerDossier(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

/** Collecte toutes les ops d'un `op` donné, en profondeur, de tous les datasets. */
function collectOps(op: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(walk);
    if (!estObjet(n)) return;
    if (n.op === op && !('kind' in n)) out.push(n);
    for (const v of Object.values(n)) walk(v);
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
      expect([{ n: 1, sides: 10 }, { n: 1, sides: 100 }]).toContainEqual(t.die);
      expect(t.entries.length).toBeGreaterThan(0);
      expect(t.source?.book, `${t.id} sans source`).toBeTruthy();
      for (const r of findEffectTableById(t.id).entries) expect(r.min).toBeLessThanOrEqual(r.max);
    }
  });

  it('les 4 colonnes du Tableau des aspects démoniaques (EDOC 13) existent, une rangée par face de leur dé', () => {
    for (const dom of ['nurgle', 'slaanesh', 'tzeentch', 'indivisible']) {
      const t = findEffectTableById(`allure-demoniaque-${dom}`);
      expect(t.entries).toHaveLength(facesDuDe(deDeLaTableTiree(t)));
      expect(t.die).toEqual({ n: 1, sides: 10 });
    }
  });

  it('findEffectTableById fail-fast sur un id inconnu', () => {
    expect(() => findEffectTableById('inexistante')).toThrow(/introuvable/i);
  });
});

describe('bien-formation des ops rollTable (tous les datasets)', () => {
  const ops = collectOps('rollTable');

  it('les deux formes portent exactement une table, en ligne ou référencée', () => {
    expect(ops.some((o) => 'entries' in o)).toBe(true);
    expect(ops.some((o) => 'table' in o)).toBe(true);
    const bad = ops.filter((o) => ('entries' in o) === ('table' in o));
    expect(bad, `rollTable doit porter entries OU table :\n${JSON.stringify(bad)}`).toEqual([]);
  });

  it('chaque référence de table est jugée au parse', () => {
    const refs = ops.filter((o) => 'table' in o);
    expect(refs.length).toBeGreaterThan(0);
    const bad = refs.flatMap((op) => {
      const resultat = gameOpSchema.safeParse(op);
      return resultat.success ? [] : [{ op, fautes: resultat.error.issues }];
    });
    expect(bad, `référence de table refusée :\n${JSON.stringify(bad)}`).toEqual([]);
  });
});
