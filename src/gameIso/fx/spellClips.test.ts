import { describe, it, expect } from 'vitest';
import { spellCastStyle, isSupportiveCast, classifySpellByLabel, spellFx, spellFxForLabel } from './spellClips';

describe('spellCastStyle — offensif vs soutien (depuis la relation lanceur↔cible)', () => {
  it('sur soi-même → bénédiction', () => {
    expect(spellCastStyle('hero', 'hero', true)).toBe('blessing');
  });
  it('sur un allié (même camp) → bénédiction', () => {
    expect(spellCastStyle('hero', 'hero', false)).toBe('blessing');
  });
  it('sur un ennemi → bolt offensif', () => {
    expect(spellCastStyle('hero', 'enemy', false)).toBe('bolt');
    expect(spellCastStyle('enemy', 'hero', false)).toBe('bolt');
  });
});

describe('isSupportiveCast — gating du projectile', () => {
  it('soutien = pas de projectile', () => {
    expect(isSupportiveCast('hero', 'hero', true)).toBe(true);
    expect(isSupportiveCast('hero', 'enemy', false)).toBe(false);
  });
});

describe('classifySpellByLabel — data-driven (spells.json + engine/magic)', () => {
  it('un sort « Béni » est divin', () => {
    expect(classifySpellByLabel('Bénédiction de Bataille').school).toBe('divine');
  });
  it('un sort de Magie mineure est arcanique', () => {
    expect(classifySpellByLabel('Drain').school).toBe('arcane');
  });
  it('« Drain » est un projectile magique (desc)', () => {
    expect(classifySpellByLabel('Drain').missile).toBe(true);
  });
  it('libellé inconnu → défaut arcanique non-missile', () => {
    expect(classifySpellByLabel('Sort Imaginaire')).toEqual({ school: 'arcane', missile: false });
  });
});

describe('spellFx — tintage arcane/divin (source de vérité unique du feedback)', () => {
  it('arcane → dégradé fixe violet/bleu, divin → dégradé fixe or (dégradés fixes distincts)', () => {
    expect(spellFx('arcane').gradient).toBe('g_arcane');
    expect(spellFx('divine').gradient).toBe('g_divine');
    expect(spellFx('arcane').gradient).not.toBe(spellFx('divine').gradient);
    expect(spellFx('arcane').core).not.toBe(spellFx('divine').core);
  });
  it('depuis un libellé : Béni → divin, Magie mineure → arcane', () => {
    expect(spellFxForLabel('Bénédiction de Bataille')).toEqual(spellFx('divine'));
    expect(spellFxForLabel('Drain')).toEqual(spellFx('arcane'));
  });
  it('libellé absent → arcane par défaut', () => {
    expect(spellFxForLabel(undefined)).toEqual(spellFx('arcane'));
  });
});
