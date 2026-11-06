/**
 * Composants d'incantation offerts par la fiche (`composantsOfferts`) : un Sort offert est EXACTEMENT un
 * Sort connu que `refusAchatDeComposant` ne refuse pas, la bourse couvrant tout. LDB 46 l.107-113
 */
import { describe, it, expect } from 'vitest';
import { composantsOfferts, refusAchatDeComposant } from './partyFlow';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { toMoney } from '../engine/money';

// Arcane à NI, Chaos à NI, Mineure, Bénédiction, Arcane sans NI, id hors catalogue.
const CONNUS = ['mur-de-feu', 'allure-demoniaque', 'alerte', 'benediction-de-bataille', 'peau-d-ecorce-et-d-os', 'sort-inexistant'];

function mageRiche() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
  return { ...withBourseMoney(hero, toMoney({ gold: 100 })), spells: CONNUS };
}

describe('composantsOfferts — l’offre de la fiche est le verdict du geste (LDB 46 l.107-113)', () => {
  it('offre exactement les Sorts connus que le refus ne refuse pas', () => {
    const hero = mageRiche();
    const offerts = composantsOfferts(hero).map((sp) => sp.id);
    expect(offerts).toEqual(CONNUS.filter((id) => refusAchatDeComposant(hero, id) === null));
    expect(offerts).toEqual(['mur-de-feu', 'allure-demoniaque']);
  });
});
