/**
 * `adresseUnPassage` (`valeurs.ts`) : contrat déclaré, SEUIL UNIQUE avec `descRefSchema` (`MIN_FRAGMENTS`) — l'écran et
 * le disque tranchent pareil. Sur la vraie donnée (`regles.json`, `psychology.json`) et sur une adresse en composition.
 */
import { describe, it, expect } from 'vitest';
import { adresseUnPassage, descRefSchema, MIN_FRAGMENTS } from './valeurs';
import { psychologies, regles } from '../../index';

const adresses = [...regles, ...psychologies].flatMap((e) => (e.descRef === undefined ? [] : [e.descRef]));

describe('adresseUnPassage — même seuil que le schéma', () => {
  it('chaque adresse de la donnée réelle désigne un passage, et le schéma l’accepte', () => {
    expect(adresses.length, 'la donnée porte des adresses').toBeGreaterThan(0);
    for (const ref of adresses) {
      expect(adresseUnPassage(ref)).toBe(true);
      expect(descRefSchema.safeParse(ref).success).toBe(true);
    }
  });

  it('sous le seuil, ni l’écran ni le disque n’y voient une adresse', () => {
    const vraie = adresses[0];
    const enComposition = { ...vraie, parts: vraie.parts.slice(0, MIN_FRAGMENTS - 1) };
    expect(adresseUnPassage(enComposition)).toBe(false);
    expect(descRefSchema.safeParse(enComposition).success).toBe(false);
  });

  it('ce qui n’est pas une adresse n’en désigne aucune', () => {
    for (const x of [null, undefined, {}, { parts: 'a' }, 3]) expect(adresseUnPassage(x)).toBe(false);
  });
});
