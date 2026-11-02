import { describe, it, expect } from 'vitest';
import { statblockToCombatant, creatureToCombatant, entitySize } from '../noyau/monde/spawn';
import { findCreatureById } from '../data';
import { sizeFromTraits } from '../engine/size';

describe('sizeFromTraits + dérivation de Taille au spawn (LDB 85)', () => {
  it('parse le trait Taille (insensible accents/casse)', () => {
    expect(sizeFromTraits([{ id: 'taille', arg: 'Énorme' }])).toBe('enorme');
    expect(sizeFromTraits([{ id: 'arme', arg: 'Épée' }, { id: 'taille', arg: 'Grande' }])).toBe('grande');
    expect(sizeFromTraits([{ id: 'taille', arg: 'de Petite à Énorme' }])).toBe('enorme'); // plage → borne haute
    expect(sizeFromTraits([{ id: 'arme' }])).toBeNull();
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
  it('Blessures : sans char.B → formule (woundsForSize), écart 0 ; avec char.B → B imprimé, écart figé', () => {
    const f = statblockToCombatant({ type: 'statblock', label: 'X', char: { force: 30, endurance: 30, 'force-mentale': 30 } }, 'x', { x: 0, y: 0 });
    expect(f.wounds).toEqual({ current: 12, max: 12, ecart: 0 }); // 3 + 2·3 + 3 (Moyenne)
    const o = statblockToCombatant({ type: 'statblock', label: 'Y', char: { force: 30, endurance: 30, 'force-mentale': 30, B: 50 } }, 'y', { x: 0, y: 0 });
    expect(o.wounds).toEqual({ current: 50, max: 50, ecart: 38 });
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

describe('creatureToCombatant — le B imprimé est celui du profil sans facultatif ; un facultatif le déplace (LDB 77 l.91-95, LDB 05 l.1001)', () => {
  // Destrier (cheval de guerre lourd) : F 50, E 50, FM 10, Taille (Grande), B 32 = (5 + 2×5 + 1) × 2 (LDB 85 l.393-401).
  const destrier = (optionals: { id: string }[] = []) =>
    creatureToCombatant(findCreatureById('destrier-cheval-de-guerre-lourd')!, 'd', { x: 0, y: 0 }, { optionals });
  it('sans facultatif : le B imprimé, écart 0', () => {
    expect(destrier().wounds).toEqual({ current: 32, max: 32, ecart: 0 });
  });
  it('Endurant facultatif : + BE 5 avant la Taille, (5 + 10 + 1 + 5) × 2 = 42 (LDB 85 l.130)', () => {
    expect(destrier([{ id: 'endurant' }]).wounds).toEqual({ current: 42, max: 42, ecart: 0 });
  });
  it('Coriace facultatif : E 60 et FM 20, (5 + 12 + 2) × 2 = 38 (LDB 85 l.79)', () => {
    expect(destrier([{ id: 'coriace' }]).wounds).toEqual({ current: 38, max: 38, ecart: 0 });
  });
});

describe('Nuée au spawn : cinq fois les Blessures d’une créature type, écart du livre compris (LDB 85 l.253)', () => {
  const ne = (id: string, optionals: { id: string }[] = []) =>
    creatureToCombatant(findCreatureById(id)!, id, { x: 0, y: 0 }, { optionals });
  it('Nuée facultative : 5 × le B imprimé de la créature type', () => {
    expect(ne('rat-geant', [{ id: 'nuee' }]).wounds.max).toBe(5 * 5);
    expect(ne('araignee-geante', [{ id: 'nuee' }]).wounds.max).toBe(5 * 2);
    expect(ne('serpent', [{ id: 'nuee' }]).wounds.max).toBe(5 * 8);
    expect(ne('snotling', [{ id: 'nuee' }]).wounds.max).toBe(5 * 7);
  });
  it('Nuée facultative imprimée au livre : Volée de rasoirs, CC 48 et B 55 (ZI 10 l.25)', () => {
    const volee = ne('macareux-a-bec-tranchant', [{ id: 'nuee' }]);
    expect(volee.characteristics['capacite-de-combat']).toBe(48);
    expect(volee.wounds.max).toBe(55);
  });
  it('Nuée facultative : +10 CC (LDB 85 l.253)', () => {
    const rat = findCreatureById('rat-geant')!;
    expect(ne('rat-geant', [{ id: 'nuee' }]).characteristics['capacite-de-combat']).toBe((rat.char['capacite-de-combat'] as number) + 10);
  });
  it('Nuée imprimée : B et CC du profil imprimé, Nuée comprise (ZI 02 l.138-140)', () => {
    const squigs = ne('nuee-de-squigs-des-cavernes');
    expect(squigs.wounds.max).toBe(60);
    expect(squigs.characteristics['capacite-de-combat']).toBe(55);
    expect(ne('volee-de-noctecorbes').wounds.max).toBe(75);
  });
  it('statbloc : `char.B` d’une Nuée est celui d’une créature type, 5 × B', () => {
    const nuee = statblockToCombatant({ label: 'Nuée de rats', size: 'petite', char: { force: 30, endurance: 25, 'force-mentale': 15, B: 5 }, traits: [{ id: 'nuee' }] } as Parameters<typeof statblockToCombatant>[0], 'n', { x: 0, y: 0 });
    expect(nuee.wounds.max).toBe(25);
  });
});
