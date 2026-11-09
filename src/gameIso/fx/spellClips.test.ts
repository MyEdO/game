import { describe, it, expect } from 'vitest';
import { classifySpell, spellFx, spellFxForSpell } from './spellClips';

describe('classifySpell — data-driven par id (spells.json + engine/magic)', () => {
  it('un sort « Béni » est divin', () => {
    expect(classifySpell('benediction-de-bataille').school).toBe('divine');
  });
  it('un sort de Magie mineure est arcanique', () => {
    expect(classifySpell('drain').school).toBe('arcane');
  });
  it('« Drain » est un projectile magique (desc)', () => {
    expect(classifySpell('drain').missile).toBe(true);
  });
  it('id inconnu → défaut arcanique non-missile', () => {
    expect(classifySpell('sort-imaginaire')).toEqual({ school: 'arcane', missile: false });
  });
});

describe('spellFx — tintage arcane/divin (source de vérité unique du feedback)', () => {
  it('arcane → dégradé fixe violet/bleu, divin → dégradé fixe or (dégradés fixes distincts)', () => {
    expect(spellFx('arcane').gradient).toBe('g_arcane');
    expect(spellFx('divine').gradient).toBe('g_divine');
    expect(spellFx('arcane').gradient).not.toBe(spellFx('divine').gradient);
    expect(spellFx('arcane').core).not.toBe(spellFx('divine').core);
  });
  it('depuis un id : Béni → divin, Magie mineure → arcane', () => {
    expect(spellFxForSpell('benediction-de-bataille')).toEqual(spellFx('divine'));
    expect(spellFxForSpell('drain')).toEqual(spellFx('arcane'));
  });
});
