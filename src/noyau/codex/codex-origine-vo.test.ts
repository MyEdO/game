/**
 * CÂBLAGE de `SpellData.titreVO` / `livreVO` (#3666) : l'origine VO d'un sort qu'un livre fan traduit
 * atteint la fiche Codex des Sorts (`registry.ts`). Débrancher le fait « Origine VO » le rend rouge.
 */
import { describe, it, expect } from 'vitest';
import { spells } from '../../data/index';
import { CODEX } from './registry';
import type { CodexItem } from './registry';

const items = new Map<string, CodexItem>(CODEX.find((c) => c.key === 'spells')!.items.map((i) => [i.id, i]));
const origineVO = (id: string): string | undefined => (items.get(id)!.meta ?? []).find((f) => f.label === 'Origine VO')?.value;

describe('fiche Codex — origine VO d’un sort traduit', () => {
  it('titre VO et libellé du livre VO, ou le titre seul quand le livre fan ne nomme aucun livre', () => {
    expect(origineVO('depecage')).toBe('Flensing Ruin · Le Rat Cornu – Compagnon');
    expect(origineVO('algues-cruelles')).toBe('Tangleweed');
  });

  it('chaque sort qui porte un titre VO l’affiche ; aucun autre n’a ce fait', () => {
    for (const s of spells) expect(origineVO(s.id) != null, s.id).toBe(s.titreVO != null);
  });
});
