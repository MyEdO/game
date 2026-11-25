/**
 * #4208 — option « Armure, règles rapides » (LDB 63 l.95-103) : l'offre au joueur (`trappingsEnVente`, `bandeDe`),
 * la superposition des trois armures d'une pièce (LDB 63 l.74), la conversion des possessions (`armuresRapides`) et les
 * cases de carrière 5e (CRB 018 l.25).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bandeDe, findTrappingEnVente, trappingsEnVente, trappingsInstanciables } from '.';
import { resetRule, setRule } from '../engine/policy';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { armuresRapides, equipConflicts, itemFromTrappingById, wornArmourPoints } from '../engine/items';
import { cocherLaDotation } from '../engine/casesDeCarriere';
import { LOCALISATIONS_DE_COUP } from '../engine/localisations';
import { tableTotale } from '../lib/tableTotale';
import type { Combatant, ItemInstance } from '../engine/types';

const REGLE = 'armure-regles-rapides';
const BANDES = ['armure-legere', 'armure-moyenne', 'armure-lourde'];
const PIECES = ['plastron', 'cotte-de-mailles', 'calotte-de-cuir'];
const MONTURES = ['barde', 'caparacon-pour-blaireau'];
const TYPES_REMPLACES = new Set(['cuir-souple', 'cuir-bouilli', 'mailles', 'plate']);
const porte = (...ids: string[]): ItemInstance[] => ids.map((id) => ({ ...itemFromTrappingById(id, idsDeTest)!, equipped: true }));
const partout = (pa: number) => tableTotale(LOCALISATIONS_DE_COUP, () => pa);

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

describe('conversion des possessions (`armuresRapides`)', () => {
  const armures = (items: ItemInstance[]) => items.filter((i) => i.kind === 'armor').map((i) => [i.trappingId, i.equipped]);
  const PLATE = ['brassards', 'heaume', 'jambieres-d-acier', 'plastron'];
  const MAILLES = ['chausses-de-mailles', 'coiffe-de-mailles', 'cotte-de-mailles'];
  const CUIR = ['calotte-de-cuir', 'jambieres-en-cuir', 'veste-de-cuir'];

  it('règle inactive : la même référence', () => {
    const items = porte(...PLATE);
    expect(armuresRapides(items)).toBe(items);
  });

  describe('règle active', () => {
    beforeEach(() => setRule(REGLE, true));

    it('une coiffe de mailles seule : une armure moyenne portée, 2 PA partout', () => {
      const items = armuresRapides(porte('coiffe-de-mailles'));
      expect(armures(items)).toEqual([['armure-moyenne', true]]);
      expect(wornArmourPoints(items)).toEqual(partout(2));
    });
    it('veste de cuir et chemise de mailles : 2 PA partout, l’armure légère possédée non portée', () => {
      const items = armuresRapides(porte('veste-de-cuir', 'chemise-de-mailles'));
      expect(armures(items)).toEqual([['armure-legere', false], ['armure-moyenne', true]]);
      expect(wornArmourPoints(items)).toEqual(partout(2));
    });
    it('une plate complète : une seule armure lourde, sous l’uid de sa première pièce, 3 PA partout', () => {
      const pieces = porte(...PLATE);
      const items = armuresRapides(pieces);
      expect(armures(items)).toEqual([['armure-lourde', true]]);
      expect(items[0].uid).toBe(pieces[0].uid);
      expect(wornArmourPoints(items)).toEqual(partout(3));
    });
    it('plate, mailles et cuir complètes : 5 PA partout', () => {
      const items = armuresRapides(porte(...PLATE, ...MAILLES, ...CUIR));
      expect(armures(items)).toEqual([['armure-lourde', true], ['armure-moyenne', true], ['armure-legere', false]]);
      expect(wornArmourPoints(items)).toEqual(partout(5));
    });
    it('un plastron de cuir : 1 PA partout', () => {
      expect(wornArmourPoints(armuresRapides(porte('plastron-de-cuir')))).toEqual(partout(1));
    });
    it('heaume et plastron : 3 PA partout', () => {
      expect(wornArmourPoints(armuresRapides(porte('heaume', 'plastron')))).toEqual(partout(3));
    });
    it('une armure lourde déjà possédée absorbe la pièce et garde son uid', () => {
      const [lourde, heaume] = porte('armure-lourde', 'heaume');
      const items = armuresRapides([{ ...lourde, equipped: false }, heaume]);
      expect(items.map((i) => [i.uid, i.trappingId, i.equipped])).toEqual([[lourde.uid, 'armure-lourde', true]]);
    });
    it('la cotte de mailles de bravoure usurpée devient une armure moyenne qui garde Maudit', () => {
      const [moyenne] = armuresRapides(porte('cotte-de-mailles-de-bravoure-usurpee'));
      expect(moyenne.trappingId).toBe('armure-moyenne');
      expect(moyenne.qualities.map((q) => q.id)).toEqual(['flexible', 'en-perception', 'en-discretion', 'maudit']);
    });
    it('les qualités communes des pièces du Livre de base ne passent pas à l’armure légère', () => {
      const [legere] = armuresRapides(porte('plastron-de-cuir', 'calotte-de-cuir'));
      expect(legere.qualities.map((q) => q.id)).toEqual(['flexible']);
    });
    it('deux cottes de bravoure usurpée donnent une armure moyenne Maudite une fois', () => {
      const [moyenne] = armuresRapides(porte('cotte-de-mailles-de-bravoure-usurpee', 'cotte-de-mailles-de-bravoure-usurpee'));
      expect(moyenne.qualities.filter((q) => q.id === 'maudit')).toHaveLength(1);
    });
    it('la pansière ogre ne double pas Impénétrable et garde sa taille', () => {
      const [lourde] = armuresRapides(porte('pansiere-ogre'));
      expect(lourde.qualities.filter((q) => q.id === 'impenetrable')).toHaveLength(1);
      expect(lourde.sizeFor).toBe(itemFromTrappingById('pansiere-ogre', idsDeTest)!.sizeFor);
    });
    it('une pièce brisée laisse l’armure brisée à ses Localisations, les PA perdus de la plus abîmée ailleurs', () => {
      const [heaume, plastron] = porte('heaume', 'plastron');
      const [lourde] = armuresRapides([{ ...heaume, usure: { tete: 3 } }, { ...plastron, usure: { corps: 1 } }]);
      expect(lourde.usure).toEqual({ tete: 4, corps: 1 });
      expect(wornArmourPoints([lourde])).toEqual({ ...partout(3), tete: 0, corps: 2 });
    });
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
