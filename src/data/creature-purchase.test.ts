/**
 * Garde-fou T0-b (#611) : les créatures ACHETABLES du bestiaire (LDB 70, EDOC 07, ADE III) portent une
 * facette d'ACHAT valide et des traits/optionnels tous résolvables — zéro id fantôme.
 */
import { describe, it, expect } from 'vitest';
import { creatures, trappings, vehicles, findTraitById, findCreatureById } from './index';
import monturesJson from './montures.json';

const ACHAT_IDS = [
  'chien',
  'chien-de-trait',
  'blaireau',
  'cheval-de-trait',
  'cheval-de-trait-lourd',
  'boeuf',
  'cheval-de-monte',
  'cheval-de-guerre-leger',
  'destrier-cheval-de-guerre-lourd',
  'mule',
  'ane',
  'poney',
  'mouton',
  'cochon',
] as const;

/** Détecteurs PURS : la garde et sa preuve par mutation portent sur la MÊME fonction. */
const porteursDePurchase = (liste: typeof creatures) =>
  liste.filter((c) => c.purchase).map((c) => c.id).sort();
const idsCaptes = (ids: readonly string[], pris: readonly string[]) =>
  ids.filter((id) => new Set(pris).has(id));

const ATTENDU = [...ACHAT_IDS].sort();

describe('creatures achetables (T0-b, #611)', () => {
  it('les créatures achetables existent dans le bestiaire', () => {
    for (const id of ACHAT_IDS) {
      expect(findCreatureById(id), `créature manquante : ${id}`).toBeDefined();
    }
  });

  it('la liste est EXHAUSTIVE : aucune autre créature ne porte purchase', () => {
    expect(porteursDePurchase(creatures)).toEqual(ATTENDU);
  });

  it('la garde d\'exhaustivité MORD sur un porteur en trop ou en moins', () => {
    const enTrop = structuredClone(creatures);
    enTrop.find((c) => c.id === 'poulet')!.purchase = {
      price: { gold: 0, silver: 0, brass: 5 },
      availability: 'Commune',
    };
    expect(porteursDePurchase(enTrop)).not.toEqual(ATTENDU);

    const enMoins = structuredClone(creatures);
    delete enMoins.find((c) => c.id === 'cochon')!.purchase;
    expect(porteursDePurchase(enMoins)).not.toEqual(ATTENDU);
  });

  it('aucune ne partage son id avec un trapping ou un véhicule', () => {
    // `catalogEntryOf` (noyau/merchantFlow) résout un id trapping AVANT la créature, et le stock
    // jette toute ligne d'unité sans `unit` : un id partagé rend la facette purchase de la
    // créature illisible par le marché.
    expect(idsCaptes(ACHAT_IDS, [...trappings.map((t) => t.id), ...vehicles.map((v) => v.id)])).toEqual([]);
  });

  it('la garde de collision d\'id MORD sur un id capté par le catalogue d\'objets', () => {
    const pris = [...trappings.map((t) => t.id), ...vehicles.map((v) => v.id), 'cochon'];
    expect(idsCaptes(ACHAT_IDS, pris)).toEqual(['cochon']);
  });

  it('chacune porte une facette purchase avec un prix non nul', () => {
    for (const id of ACHAT_IDS) {
      const c = findCreatureById(id)!;
      expect(c.purchase, `purchase manquant sur ${id}`).toBeDefined();
      const { price } = c.purchase!;
      const total = price.gold + price.silver + price.brass;
      expect(total, `prix nul sur ${id}`).toBeGreaterThan(0);
    }
  });

  it('traits et optionnels résolvent tous à des ids réels de traits.json', () => {
    for (const id of ACHAT_IDS) {
      const c = findCreatureById(id)!;
      for (const t of c.traits) {
        expect(findTraitById(t.id), `trait fantôme "${t.id}" sur ${id}`).toBeDefined();
      }
      for (const o of c.optionals) {
        if ('id' in o) {
          expect(findTraitById(o.id), `optionnel fantôme "${o.id}" sur ${id}`).toBeDefined();
        }
      }
    }
  });

  it('aucun doublon d\'id parmi les créatures du bestiaire', () => {
    const ids = creatures.map((c) => c.id);
    const dups = [...new Set(ids.filter((i, idx) => ids.indexOf(i) !== idx))];
    expect(dups).toEqual([]);
  });
});

/** Deux entrées, un livre chacune (#673) : le chien du bestiaire
 *  (LDB 78 folio 315) et le chien de trait (EDOC 07 folio 22) sont deux profils distincts, comme
 *  `cheval` (LDB) / `cheval-de-guerre-leger` (EDOC). */
describe('chien LDB vs chien de trait EDOC (#673)', () => {
  const traitsDe = (id: string) =>
    findCreatureById(id)!.traits.map((t) => ('arg' in t && t.arg ? `${t.id}:${t.arg}` : 'value' in t && t.value !== undefined ? `${t.id}+${t.value}` : t.id));

  it('chien-de-trait porte le profil EDOC 07 l.13-18, champ par champ', () => {
    const c = findCreatureById('chien-de-trait')!;
    expect(c.char).toEqual({
      M: 4,
      'capacite-de-combat': 25,
      'capacite-de-tir': null,
      force: 20,
      endurance: 20,
      initiative: 35,
      agilite: 30,
      dexterite: null,
      intelligence: 15,
      'force-mentale': 10,
      sociabilite: 25,
      B: 7,
    });
    expect(traitsDe('chien-de-trait')).toEqual(['arme+5', 'dresse-dompte', 'dresse-trait', 'foulee', 'nerveux']);
    expect(c.optionals).toEqual([]);
    expect(c.source).toEqual({ book: 'ennemi-dans-l-ombre-compagnon', page: 22 });
    expect(c.purchase).toEqual({ price: { gold: 2, silver: 0, brass: 0 }, availability: 'Rare' });
  });

  it('chien reste le profil LDB 78 folio 315, sans trait EDOC', () => {
    const c = findCreatureById('chien')!;
    expect(c.char.sociabilite).toBe(15);
    expect(c.char.B).toBe(5);
    expect(traitsDe('chien')).toEqual(['arme+5', 'bestial', 'foulee', 'nerveux', 'taille:petite', 'vision-nocturne']);
    expect(c.source).toEqual({ book: 'livre-de-base', page: 315 });
    expect(c.purchase).toEqual({ price: { gold: 2, silver: 0, brass: 0 }, availability: 'Rare' });
  });

  it('la table de mouvement/charge (EDOC 07 folio 24) route vers le chien de trait, jamais le chien LDB', () => {
    const cibles = monturesJson.entries.flatMap((e) => e.creatureIds);
    expect(cibles).toContain('chien-de-trait');
    expect(cibles).not.toContain('chien');
    expect(monturesJson.entries.find((e) => e.id === 'chien')!.encPortee).toBe(8);
  });
});
