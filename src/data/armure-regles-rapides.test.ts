/**
 * #4208 — option « Armure, règles rapides » (LDB 63 l.95-103) : l'offre au joueur (`trappingsEnVente`, `bandeDe`),
 * la superposition des trois armures d'une pièce (LDB 63 l.74) et les cases de carrière 5e (CRB 018 l.25).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { bandeDe, findTrappingEnVente, trappingsEnVente, trappingsInstanciables } from '.';
import { resetRule, setRule } from '../engine/policy';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { equipConflicts, itemFromTrappingById, wornArmourPoints } from '../engine/items';
import { cocherLaDotation } from '../engine/casesDeCarriere';
import { LOCALISATIONS_DE_COUP } from '../engine/localisations';
import type { Combatant, ItemInstance } from '../engine/types';
import { tableTotale } from '../lib/tableTotale';

const REGLE = 'armure-regles-rapides';
const BANDES = ['armure-legere', 'armure-moyenne', 'armure-lourde'];
const PIECES = ['plastron', 'cotte-de-mailles', 'calotte-de-cuir'];
const MONTURES = ['barde', 'caparacon-pour-blaireau'];
const TYPES_REMPLACES = new Set(['cuir-souple', 'cuir-bouilli', 'mailles', 'plate']);

afterEach(() => resetRule(REGLE));

const idsEnVente = () => new Set(trappingsEnVente().map((t) => t.id));

describe('offre au joueur', () => {
  it('règle inactive : les pièces sont en vente, pas les armures d’une pièce, qui restent instanciables', () => {
    const enVente = idsEnVente();
    expect(BANDES.filter((id) => enVente.has(id))).toEqual([]);
    expect(PIECES.filter((id) => !enVente.has(id))).toEqual([]);
    const instanciables = new Set(trappingsInstanciables().map((t) => t.id));
    expect(BANDES.filter((id) => !instanciables.has(id))).toEqual([]);
    expect(bandeDe('plastron')).toBeUndefined();
  });

  it('règle active : les trois armures d’une pièce remplacent les pièces de leurs types, hors armures de monture', () => {
    setRule(REGLE, true);
    const vente = trappingsEnVente();
    const enVente = new Set(vente.map((t) => t.id));
    expect(BANDES.filter((id) => !enVente.has(id))).toEqual([]);
    expect(vente.filter((t) => t.categorie === 'armor' && t.subType && TYPES_REMPLACES.has(t.subType.id) && !t.remplace && !t.capabilities?.armureDeMonture).map((t) => t.id)).toEqual([]);
    expect(MONTURES.filter((id) => !enVente.has(id))).toEqual([]);
    expect(bandeDe('calotte-de-cuir')?.id).toBe('armure-legere');
    expect(bandeDe('plastron-de-cuir')?.id).toBe('armure-legere');
    expect(bandeDe('cotte-de-mailles')?.id).toBe('armure-moyenne');
    expect(bandeDe('plastron')?.id).toBe('armure-lourde');
    expect(MONTURES.map(bandeDe)).toEqual([undefined, undefined]);
    expect(findTrappingEnVente('plastron')).toBeUndefined();
    expect(findTrappingEnVente('armure-lourde')?.id).toBe('armure-lourde');
  });
});

describe('superposition par l’Atout Flexible (LDB 63 l.74)', () => {
  const porte = (...ids: string[]): ItemInstance[] => ids.map((id) => ({ ...itemFromTrappingById(id, idsDeTest)!, equipped: true }));
  const partout = (pa: number) => tableTotale(LOCALISATIONS_DE_COUP, () => pa);

  it('« Tous » couvre les six Localisations (LDB 63 l.101)', () => {
    expect(porte('armure-legere')[0].locs).toEqual([...LOCALISATIONS_DE_COUP]);
  });
  it('légère sous lourde : 4 PA partout ; moyenne sous lourde : 5 PA partout', () => {
    expect(wornArmourPoints(porte('armure-legere', 'armure-lourde'))).toEqual(partout(4));
    expect(wornArmourPoints(porte('armure-moyenne', 'armure-lourde'))).toEqual(partout(5));
  });
  it('deux Flexibles ne se superposent pas : la moyenne entre en conflit avec la légère', () => {
    const [legere, moyenne] = porte('armure-legere', 'armure-moyenne');
    expect(equipConflicts({ items: [legere] }, moyenne).map((i) => i.uid)).toEqual([legere.uid]);
  });
});

describe('cases de carrière 5e (CRB 018 l.25 ; #4208)', () => {
  /** Un Soldat de niveau 1 au modèle 5e : le niveau 2 lui demande heaume et plastron. */
  const soldat = (): Combatant => ({ ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'S', seed: 1 }), progression: '5e' });

  it('règle active : l’armure lourde coche le heaume et le plastron', () => {
    setRule(REGLE, true);
    const h = soldat();
    expect(cocherLaDotation(h, 'armure-lourde')).toBe(true);
    expect(h.casesDeCarriere?.soldat?.[1]?.dotations).toEqual(['heaume', 'plastron']);
  });
  it('règle inactive : l’armure lourde ne coche rien', () => {
    const h = soldat();
    expect(cocherLaDotation(h, 'armure-lourde')).toBe(false);
    expect(h.casesDeCarriere?.soldat?.[1]?.dotations ?? []).toEqual([]);
  });
});
