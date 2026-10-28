import { describe, it, expect } from 'vitest';
import { isOptionalNote, parseStatEntry, resoudreTrait, statName, traitsDuPorteur } from './statEntry';
import type { EffectSource } from './types';
import { creatureToCombatant, porteurDuProfil, statblockToCombatant } from '../noyau/monde/spawn';
import { findCreatureById } from '../data';
import { armourFromTraits } from './creatureEquip';

describe('parseStatEntry — parseur canonique des chaînes de statbloc', () => {
  const cases: [string, Partial<ReturnType<typeof parseStatEntry>>][] = [
    ['Arme +7', { name: 'Arme', bonus: 7 }],
    ['Arme (Bâton de combat) +7', { name: 'Arme', arg: 'Bâton de combat', bonus: 7 }],
    ['À distance +8 (50)', { name: 'À distance', bonus: 8, range: 50 }],
    ['8 Tentacules +9', { name: 'Tentacules', count: 8, bonus: 9 }],
    ['Animosité (Tiléens)', { name: 'Animosité', arg: 'Tiléens' }],
    ['Démoniaque 8+', { name: 'Démoniaque', indice: 8 }],
    ['Immunité (Poison)', { name: 'Immunité', arg: 'Poison' }],
    ['Vol 100', { name: 'Vol', indice: 100 }],
    ['Souffle +15 (Feu)', { name: 'Souffle', bonus: 15, arg: 'Feu' }],
    ['Peur 2', { name: 'Peur', indice: 2 }],
    ['Vision nocturne', { name: 'Vision nocturne' }],
    ['Chevaucher (Cheval) 58', { name: 'Chevaucher', arg: 'Cheval', indice: 58 }],
    ["Corps à corps (Arme d'hast) 62", { name: 'Corps à corps', arg: "Arme d'hast", indice: 62 }],
    ['Commandement 47', { name: 'Commandement', indice: 47 }],
    ['Magie des Arcanes (Ghur)', { name: 'Magie des Arcanes', arg: 'Ghur' }],
    ['Magie mineure', { name: 'Magie mineure' }],
    ['Lire/Écrire', { name: 'Lire/Écrire' }],
    ['Résistance à la Magie 2', { name: 'Résistance à la Magie', indice: 2 }],
    ['Taille (Énorme)', { name: 'Taille', arg: 'Énorme' }],
  ];

  for (const [raw, expected] of cases) {
    it(`« ${raw} »`, () => {
      const got = parseStatEntry(raw);
      for (const [k, v] of Object.entries(expected)) {
        expect(got[k as keyof typeof got]).toBe(v);
      }
      // les champs non attendus restent absents (pas de bruit)
      for (const k of ['count', 'bonus', 'indice', 'range', 'arg'] as const) {
        if (!(k in expected)) expect(got[k]).toBeUndefined();
      }
    });
  }

  it('une fourchette, en fin ou en parenthèse, n’est ni un bonus signé ni un Aspect', () => {
    expect(parseStatEntry('Armure 1-3')).toEqual({ name: 'Armure', plage: { min: 1, max: 3 }, raw: 'Armure 1-3' });
    expect(parseStatEntry('Protection (7-9)')).toEqual({ name: 'Protection', plage: { min: 7, max: 9 }, raw: 'Protection (7-9)' });
    expect(parseStatEntry('Résistance à la Magie (1- 3)')).toEqual({ name: 'Résistance à la Magie', plage: { min: 1, max: 3 }, raw: 'Résistance à la Magie (1- 3)' });
  });

  it('statName = nom canonique seul', () => {
    expect(statName('8 Tentacules +9')).toBe('Tentacules');
    expect(statName('À distance +8 (50)')).toBe('À distance');
  });
});

describe('traitsDuPorteur / resoudreTrait — d’un Trait posé à l’instance de jeu', () => {
  const provenance = { source: { book: 'livre-fixture', page: 1 }, alsoIn: [{ book: 'livre-fixture', page: 2 }], maison: 'raison fixture' };
  const jeu = { id: 'trait-fixture', value: 3, arg: 'spec-fixture', count: 2, range: 10, natural: true, hidden: true };
  const src: EffectSource = { kind: 'mutation', id: 'mutation-fixture' };

  it('l’instance de jeu garde tout le Trait posé sauf sa provenance de livre', () => {
    expect(resoudreTrait({ ...jeu, ...provenance })).toEqual(jeu);
    expect(traitsDuPorteur([{ ...jeu, ...provenance }], porteurDuProfil('porteur-fixture', {}))).toEqual([jeu]);
  });
  it('un Trait accordé porte la provenance de son octroi', () => {
    expect(resoudreTrait({ ...jeu, ...provenance }, { src })).toEqual({ ...jeu, src });
  });
  it('une fourchette se tire pour son porteur, entre ses bornes, toujours la même pour le même porteur', () => {
    const pose = { id: 'trait-fixture', plage: { min: 1, max: 3 } };
    const valeurs = Array.from({ length: 40 }, (_, i) => traitsDuPorteur([pose], porteurDuProfil(`porteur-${i}`, {}))[0].value!);
    expect(valeurs.every((v) => v >= 1 && v <= 3)).toBe(true);
    expect(new Set(valeurs)).toEqual(new Set([1, 2, 3]));
    expect(traitsDuPorteur([pose], porteurDuProfil('porteur-7', {}))).toEqual([{ id: 'trait-fixture', value: valeurs[7] }]);
  });
  it('le tirage d’une fourchette ne dépend que de son Trait et de son rang parmi les homonymes que le porteur a', () => {
    const pose = { id: 'trait-fixture', plage: { min: 1, max: 20 } };
    const seule = traitsDuPorteur([pose], porteurDuProfil('porteur-fixture', {}))[0];
    expect(traitsDuPorteur([{ id: 'autre-fixture', value: 2 }, pose], porteurDuProfil('porteur-fixture', {}))[1]).toEqual(seule);
    const [premiere, seconde] = traitsDuPorteur([pose, pose], porteurDuProfil('porteur-fixture', {}));
    expect(premiere).toEqual(seule);
    expect(traitsDuPorteur([pose], porteurDuProfil('porteur-fixture', {}), [{ id: 'trait-fixture' }])).toEqual([seconde]);
  });
  it('un Indice formulé se lit sur le profil du porteur (Middenheim 04 l.29)', () => {
    const pose = { id: 'trait-fixture', value: { sum: [{ bonusOf: 'force' as const }, 4] } };
    expect(traitsDuPorteur([pose], porteurDuProfil('porteur-fixture', { force: 35 }))).toEqual([{ id: 'trait-fixture', value: 7 }]);
    expect(traitsDuPorteur([pose], porteurDuProfil('porteur-fixture', { force: 52 }))).toEqual([{ id: 'trait-fixture', value: 9 }]);
  });
  it('les Traits conférés se résolvent pour le porteur du Trait qui les confère (ZI 03 l.75, l.77)', () => {
    const pose = { id: 'trait-fixture', value: 3, confere: [{ id: 'autre-fixture', value: { bonusOf: 'force' as const }, ...provenance }] };
    expect(traitsDuPorteur([pose], porteurDuProfil('porteur-fixture', { force: 40 }))).toEqual([{ id: 'trait-fixture', value: 3, confere: [{ id: 'autre-fixture', value: 4 }] }]);
  });
  it('une fourchette non tirée ne se résout pas : la pose tirée est un type', () => {
    // @ts-expect-error — `resoudreTrait` prend une `PoseTiree` ; une fourchette passe par `traitsDuPorteur`.
    const nonTiree = () => resoudreTrait({ id: 'trait-fixture', plage: { min: 1, max: 3 } });
    expect(typeof nonTiree).toBe('function');
  });
  it('le spawn d’un statbloc pose les Traits résolus', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'Fixture', char: {}, traits: [{ id: 'elite', ...provenance }] }, 'fixture', { x: 0, y: 0 });
    expect(c.traits).toEqual([{ id: 'elite' }]);
  });
  it('le spawn lit l’Indice formulé sur le profil du statbloc', () => {
    const sb = { type: 'statblock' as const, label: 'Fixture', char: { force: 35 }, traits: [{ id: 'arme', value: { sum: [{ bonusOf: 'force' as const }, 4] } }] };
    expect(statblockToCombatant(sb, 'fixture', { x: 0, y: 0 }).traits).toEqual([{ id: 'arme', value: 7 }]);
  });
  it('le spawn fixe la fourchette sur la graine du porteur, et l’Armure tirée vaut à toutes ses Localisations', () => {
    const sb = { type: 'statblock' as const, label: 'Fixture', char: {}, traits: [{ id: 'armure', plage: { min: 1, max: 3 } }] };
    const c = statblockToCombatant(sb, 'fixture', { x: 0, y: 0 });
    const tiree = c.traits!.find((t) => t.id === 'armure')!.value!;
    expect(tiree).toBeGreaterThanOrEqual(1);
    expect(tiree).toBeLessThanOrEqual(3);
    expect(statblockToCombatant(sb, 'fixture', { x: 0, y: 0 }).traits).toEqual(c.traits);
    expect(Object.values(armourFromTraits(c.traits!))).toEqual(Array(6).fill(tiree));
  });
  it('Sirène (ZI 13 l.31) : l’Armure 1-3 facultative choisie se tire au spawn, PA comprises', () => {
    const sirene = findCreatureById('sirene')!;
    const armure = sirene.optionals!.find((o) => !isOptionalNote(o) && o.id === 'armure')!;
    const c = creatureToCombatant(sirene, 'sirene-fixture', { x: 0, y: 0 }, { optionals: [armure] });
    const tiree = c.traits!.find((t) => t.id === 'armure')!.value!;
    expect([1, 2, 3]).toContain(tiree);
    expect(Object.values(c.armour!)).toEqual(Array(6).fill(tiree));
  });
});
