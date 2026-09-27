/**
 * #1957 — l'Indice et la Portée d'un Trait (`LDB 85` l.94, l.209) vivent en `value` / `range`, jamais en
 * `arg`, dès que la def du Trait les DÉCLARE (marqueurs `indice` / `range`, `defs/traits.ts`).
 * Garde : `refusDArgDeTrait` (`schemas/grammaire/reference.ts`), portée par `traitInstanceSchema`.
 */
import { describe, it, expect } from 'vitest';
import { creatures } from './index';
import { wardSaves } from '../engine/traits/dispatch';
import { traitInstanceSchema, refusDArgDeTrait } from './schemas/grammaire/reference';

const datasets = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });

describe('Démoniaque (Indice) — la sauvegarde de chaque démon de la donnée', () => {
  it('wardSaves rend l’Indice de chaque démon de creatures.json', () => {
    const demons = creatures.filter((c) => c.traits.some((t) => t.id === 'demoniaque'));
    const sansSauvegarde = demons.filter((c) => wardSaves(c.traits).length === 0).map((c) => c.id);
    expect(sansSauvegarde).toEqual([]);
    expect(demons).not.toHaveLength(0);
    for (const c of demons) {
      const indice = c.traits.find((t) => t.id === 'demoniaque')!.value;
      expect(wardSaves(c.traits), c.id).toContain(indice);
    }
  });
});

describe('instance de Trait — un Indice ou une Portée déclarés ne vivent pas en `arg`', () => {
  it('refuse `{ id: "demoniaque", arg: "8+" }` en nommant le Trait, la valeur et le champ', () => {
    const r = traitInstanceSchema.safeParse({ id: 'demoniaque', arg: '8+' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['arg', 'Trait « demoniaque » : « 8+ » est un Indice — il s\'écrit en « value » (nombre), jamais en « arg ».'],
    ]);
  });

  it('refuse `{ id: "langue-prehensile", arg: "6 mètres" }` en nommant le champ `range`', () => {
    const r = traitInstanceSchema.safeParse({ id: 'langue-prehensile', value: 6, arg: '6 mètres' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['arg', 'Trait « langue-prehensile » : « 6 mètres » est une Portée — il s\'écrit en « range » (nombre), jamais en « arg ».'],
    ]);
  });

  it('accepte la forme corrigée `value` / `range`', () => {
    expect(traitInstanceSchema.safeParse({ id: 'demoniaque', value: 8 }).success).toBe(true);
    expect(traitInstanceSchema.safeParse({ id: 'langue-prehensile', value: 6, range: 6 }).success).toBe(true);
  });

  it('un Trait qui ne déclare ni Indice ni Portée garde son `arg`', () => {
    expect(refusDArgDeTrait('perturbant', '8+')).toBeNull();
  });

  it('aucun `grantTrait` de la donnée ne porte en `arg` un Indice ou une Portée déclarés', () => {
    const refus: string[] = [];
    const walk = (n: unknown, where: string): void => {
      if (Array.isArray(n)) { for (const x of n) walk(x, where); return; }
      if (!n || typeof n !== 'object') return;
      const o = n as Record<string, unknown>;
      if (o.op === 'grantTrait' && typeof o.traitId === 'string' && typeof o.arg === 'string') {
        const r = refusDArgDeTrait(o.traitId, o.arg);
        if (r) refus.push(`${where} — ${r}`);
      }
      for (const v of Object.values(o)) walk(v, where);
    };
    for (const [fichier, doc] of Object.entries(datasets)) walk(doc, fichier);
    expect(refus).toEqual([]);
  });
});
