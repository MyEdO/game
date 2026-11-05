import { describe, it, expect } from 'vitest';
import { ICON_FAMILIES } from './_registry.generated';
import { ICON_DEFS } from './index';

const ALL = ICON_FAMILIES.flat();

describe('registre d’icônes (src/data/icons/defs)', () => {
  it('a des ids uniques', () => {
    const seen = new Set<string>();
    for (const d of ALL) {
      expect(seen.has(d.id), `id en double : ${d.id}`).toBe(false);
      seen.add(d.id);
    }
    expect(Object.keys(ICON_DEFS).length).toBe(ALL.length);
  });

  it('nomme chaque icône `famille/nom` en kebab-case', () => {
    const kebab = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
    for (const d of ALL) expect(d.id, d.id).toMatch(kebab);
  });

  it('a un label FR non vide pour chaque def', () => {
    for (const d of ALL) expect(d.label.trim().length, d.id).toBeGreaterThan(0);
  });

  it('ne contient AUCUNE couleur en dur (currentColor / none / var(--gold) seulement)', () => {
    for (const d of ALL) {
      expect(d.svg, `${d.id} : couleur hex interdite`).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      for (const m of d.svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
        expect(['currentColor', 'none', 'var(--gold)'], `${d.id} : ${m[0]}`).toContain(m[1]);
      }
    }
  });

  it('a un fragment svg non vide (paths dans le viewBox 24×24)', () => {
    for (const d of ALL) expect(d.svg, d.id).toMatch(/<(path|circle|ellipse|rect|line|polyline|polygon|g)[\s>]/);
  });
});
