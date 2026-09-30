import { describe, it, expect } from 'vitest';
import { statblockToCombatant, entitySize } from './spawn';
import { sizeFromTraits } from '../engine/size';

describe('sizeFromTraits + dérivation de Taille au spawn (LDB 85)', () => {
  it('parse le trait Taille (insensible accents/casse)', () => {
    expect(sizeFromTraits([{ id: 'taille', arg: 'Énorme' }])).toBe('enorme');
    expect(sizeFromTraits([{ id: 'arme', value: 7, arg: 'Épée' }, { id: 'taille', arg: 'Grande' }])).toBe('grande');
    expect(sizeFromTraits([{ id: 'taille', arg: 'de Petite à Énorme' }])).toBe('enorme'); // plage → borne haute
    expect(sizeFromTraits([{ id: 'arme', value: 5 }])).toBeNull();
  });

  // #146 : `arene-projet.json` portait `arg:'Petite'`/`arg:'Monstrueuse'` (LIBELLÉ du livre, capitalisé)
  // au lieu de l'id du registre FERMÉ `sizes` (`petite`/`monstrueuse`) — `parseTraitInstance` (couture
  // d'édition, `engine/traits/dispatch.ts`) ne normalise QUE la clé du trait, jamais son `arg` (verbatim).
  // Ce test EXPOSE que `sizeFromTraits` n'en résout pas moins correctement : `parseSizeLabel` est un
  // parseur de texte tolérant (accents/casse), PAS le registre `SPEC_SOURCES.sizes` strict (par id
  // exact) qu'utilise la garde `trait-args-derived.test.ts` — un `arg` en libellé ne retombe donc PAS
  // silencieusement sur Moyenne (aucun bug de Taille en jeu), mais reste un LIBELLÉ pris pour un id à
  // migrer (dette de forme, corrigée dans `arene-projet.json`).
  it('#146 : un arg en LIBELLÉ capitalisé (« Petite »/« Monstrueuse », comme dans arene-projet.json avant migration) résout quand même — pas de repli silencieux sur Moyenne', () => {
    expect(sizeFromTraits([{ id: 'taille', arg: 'Petite' }])).toBe('petite');
    expect(sizeFromTraits([{ id: 'taille', arg: 'Monstrueuse' }])).toBe('monstrueuse');
  });
  it('statblockToCombatant : Taille dérivée du trait', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'Troll', char: { B: 30 }, traits: [{ id: 'taille', arg: 'Grande' }] }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('grande');
  });
  it('statblockToCombatant : champ size explicite prioritaire sur le trait', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'X', char: {}, size: 'enorme', traits: [{ id: 'taille', arg: 'Grande' }] }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('enorme');
  });
  it('statblockToCombatant : défaut Moyenne sans trait ni champ', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'X', char: {} }, 'x', { x: 0, y: 0 });
    expect(c.size).toBe('moyenne');
  });
  it('wounds.base : sans char.B → formule (woundsForSize) ; avec char.B → surcharge', () => {
    const f = statblockToCombatant({ type: 'statblock', label: 'X', char: { force: 30, endurance: 30, 'force-mentale': 30 } }, 'x', { x: 0, y: 0 });
    expect(f.wounds.max).toBe(12); // 3 + 2·3 + 3 (Moyenne)
    expect(f.wounds.base).toBe(12);
    const o = statblockToCombatant({ type: 'statblock', label: 'Y', char: { force: 30, endurance: 30, 'force-mentale': 30, B: 50 } }, 'y', { x: 0, y: 0 });
    expect(o.wounds.max).toBe(50); // surcharge
    expect(o.wounds.base).toBe(50);
  });
});

describe('entitySize — Taille d’une entité posée (rendu éditeur/exploration)', () => {
  it('champ explicite du statbloc prioritaire', () => {
    expect(entitySize({ statblock: { type: 'statblock', label: 'X', char: {}, size: 'enorme' } })).toBe('enorme');
  });
  it('sinon dérivée des Traits du statbloc', () => {
    expect(entitySize({ statblock: { type: 'statblock', label: 'X', char: {}, traits: [{ id: 'taille', arg: 'Grande' }] } })).toBe('grande');
  });
  it('aucune info → Moyenne', () => {
    expect(entitySize({})).toBe('moyenne');
    expect(entitySize({ statblock: { type: 'statblock', label: 'X', char: {} } })).toBe('moyenne');
  });
});
