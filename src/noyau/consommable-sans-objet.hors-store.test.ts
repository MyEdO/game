/**
 * UN CONSOMMABLE SANS OBJET N'EST PAS PERDU, sans store (#3059 S5) : boire un produit dont l'effet réussi
 * n'aurait rien à changer au buveur (Potion de vitalité sans Exténué, Gesundheit sans la maladie qu'il soigne)
 * est refusé, ET le dit, avant toute consommation ; avec son objet, le produit se boit. La raison est celle du
 * prédicat unique `opSansObjet`, que l'application des ops tait. LDB 16, MSRC 04 l.184-186
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { addCondition } from '../engine/conditions';
import { itemFromTrappingById } from '../engine/items';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { Combatant } from '../engine/types';

/** Un banc dont le Vétéran porte le produit `trappingId` (uid `produit`), sa fiche ajustée par `fiche`. */
function avecLeProduit(trappingId: string, fiche: (h: Combatant) => void = () => {}): { banc: Banc; heroId: string } {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 });
  h.items = [...(h.items ?? []), { ...itemFromTrappingById(trappingId)!, uid: 'produit' }];
  fiche(h);
  return { banc: ouvrirLeBanc({ graine: 7, etat: { party: [h] } }), heroId: h.id };
}

const produit = (banc: Banc) => banc.getState().party[0].items?.find((i) => i.uid === 'produit');

/** Joue `geste` : les lignes qu'il ajoute au journal. */
function journalDe(banc: Banc, geste: () => void): string[] {
  const avant = banc.getState().journal.length;
  geste();
  return banc.getState().journal.slice(avant);
}

describe('Consommable — refusé sans objet, avant de le boire', () => {
  it('Potion de vitalité sans Exténué : refusée et dite, l’objet est gardé', () => {
    const { banc, heroId } = avecLeProduit('potion-de-vitalite');
    expect(journalDe(banc, () => banc.actions.usePartyItem(heroId, 'produit')))
      .toEqual(['Vétéran n’a aucun pion Exténué qui puisse être retiré. Potion de vitalité ne lui apporterait rien : l’objet est gardé.']);
    expect(produit(banc), 'l’objet est gardé').toBeTruthy();
  });

  it('Potion de vitalité, Exténué : bue, l’État part', () => {
    const { banc, heroId } = avecLeProduit('potion-de-vitalite', (h) => addCondition(h, 'extenue', 2));
    banc.actions.usePartyItem(heroId, 'produit');
    expect(produit(banc), 'consommée').toBeUndefined();
    expect(banc.getState().party[0].conditions.some((c) => c.id === 'extenue')).toBe(false);
  });

  it('Gesundheit sans Blessure purulente : refusé et dit avant le Test au boire, l’objet est gardé', () => {
    const { banc, heroId } = avecLeProduit('gesundheit');
    expect(journalDe(banc, () => banc.actions.usePartyItem(heroId, 'produit')))
      .toEqual(['Vétéran : aucune maladie active à soulager (ciblée). Gesundheit ne lui apporterait rien : l’objet est gardé.']);
    expect(produit(banc), 'l’objet est gardé').toBeTruthy();
  });

  it('Gesundheit, Blessure purulente : bu même si son effet dépend du DR du Test à venir', () => {
    const { banc, heroId } = avecLeProduit('gesundheit', (h) => {
      h.diseases = [{ id: 'blessure-purulente', symptoms: [], phase: 'active', minutesLeft: 5 * MINUTES_PER_DAY, durationMinutes: 10 * MINUTES_PER_DAY }];
    });
    banc.actions.usePartyItem(heroId, 'produit');
    expect(produit(banc), 'consommé').toBeUndefined();
  });
});
