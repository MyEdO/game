/**
 * #57 — Recherche active de Disponibilité (LDB 59 l.50) : « passe une journée entière à effectuer des
 * achats et des Tests de Ragot ». `searchAvailability` (marchand) consacre UNE JOURNÉE (avance l'horloge)
 * et jette un Test de Ragot du groupe ; sur un succès, un réassort FRAIS est tiré avec +10 % de
 * Disponibilité (LDB 59 l.50) — cumulable avec la Carrière cohérente jusqu'au plafond +20 %.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene } from './monde/scene';
import { MINUTES_PER_DAY } from '../engine/clock';
import { availabilitySearchBonus } from '../engine/disponibilite';
import { setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { battleRng } from './battleRng';
import { cibleDuTest, evaluateTest } from '../engine/tests';
import { partyAssisted } from '../engine/skills';
import { traceLineOf } from '../engine/traceLine';
import { stepDetail } from './rollSeam';
import { dataLabel, refLabel } from '../data';
import { t } from '../i18n';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Héros doué en Ragot (Soc élevée) — le Test réussit tant que le d100 ≤ sa valeur. */
const gossiper = (soc: number): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', name: 'Colporteur', career: '', careerLevel: 1, items: [],
    skills: [{ id: 'ragot', advances: 20 }], talents: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: soc },
    wounds: blessuresDeBase(10), conditions: [], weapons: [], armour: {},
  }) as unknown as Combatant);

const merchantScene = () => {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } } as never);
  return sc;
};

beforeEach(() => banc.getState().seedRng(4));

describe('#57 — recherche active de Disponibilité (LDB 59 l.50)', () => {
  it('availabilitySearchBonus compte la journée de Ragot (+10, cumulable, plafond +20)', () => {
    expect(availabilitySearchBonus({ gossipDay: true })).toBe(10);
    expect(availabilitySearchBonus({ gossipDay: true, coherentCareer: true })).toBe(20);
  });

  it('avance l’horloge d’exactement une journée', () => {
    banc.setState({ party: [gossiper(90)], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60 });
    banc.getState().openMerchant('pnj');
    const t0 = banc.getState().gameTime;
    banc.getState().searchAvailability();
    expect(banc.getState().gameTime).toBe(t0 + MINUTES_PER_DAY);
    expect(banc.getState().merchant).not.toBeNull(); // le marchand reste ouvert, stock rafraîchi
  });

  // Journal : le jet au patron UNIQUE des Tests nommés (`traceLineOf`, dérivé par le socle de cascade),
  // puis la conséquence, qui ne redit pas le dé — jamais « (Ragot dé) », où le dé se lit comme un niveau.
  it('le journal porte la ligne de dé du Ragot, puis la journée aux marchés', () => {
    const h = { ...gossiper(90), label: 'Colporteur' } as Combatant;
    banc.setState({ party: [h], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60, journal: [] });
    banc.getState().openMerchant('pnj');
    const des = vi.spyOn(battleRng(), 'int');
    banc.getState().searchAvailability();
    const d100 = des.mock.calls.flatMap((args, i) => (args[0] === 1 && args[1] === 100 ? [des.mock.results[i].value as number] : []));
    des.mockRestore();
    expect(d100, 'un seul d100 : le Ragot').toHaveLength(1);
    const jet = evaluateTest(d100[0], cibleDuTest(partyAssisted([h], 'ragot', 'sociabilite')!.value));
    const journal = banc.getState().journal.map(String);
    const de = journal.indexOf(traceLineOf({ who: h.label, label: refLabel('skills', { id: 'ragot' }), roll: jet.roll, target: jet.target, sl: jet.sl, success: jet.success }));
    expect(de, journal.join(' | ')).toBeGreaterThanOrEqual(0);
    expect(journal.slice(de + 1), journal.join(' | ')).toContain(String(stepDetail(dataLabel(h.label), t(jet.success ? 'mf.searchOk' : 'mf.searchKo'))));
  });

  it('Ragot réussi → réassort AVEC le bonus ; échoué → réassort SANS (stocks distincts)', () => {
    // Le stock est tiré par un seed dérivé de l'entité + période + bonus de recherche : réussite et échec
    // produisent des tirages DIFFÉRENTS (l'effort change le résultat). On isole les deux issues via la Soc :
    //  - Soc 99 → le Ragot réussit quasi toujours (bonus appliqué) ;
    //  - Soc 1  → le Ragot échoue quasi toujours (pas de bonus).
    const run = (soc: number) => {
      banc.getState().seedRng(4);
      banc.setState({ party: [gossiper(soc)], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60 });
      banc.getState().openMerchant('pnj');
      banc.getState().searchAvailability();
      return banc.getState().merchant!.stock.map((l) => `${l.id}:${l.qty}`).sort().join('|');
    };
    const success = run(99);
    const failure = run(1);
    expect(success).not.toEqual(failure); // le bonus de recherche a bel et bien influé sur le réassort
  });

  it('Carrière cohérente par ID (marchand/receleur, LDB 59 l.50) décale le réassort — id STABLE, pas libellé', () => {
    const stockFor = (career: string) => {
      banc.getState().seedRng(4);
      const h = gossiper(30); (h as unknown as { career: string }).career = career;
      banc.setState({ party: [h], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60 });
      banc.getState().openMerchant('pnj');
      return banc.getState().merchant!.stock.map((l) => `${l.id}:${l.qty}`).sort().join('|');
    };
    const marchand = stockFor('marchand'); // carrière cohérente (id) → +10 % de Disponibilité
    const roublard = stockFor('roublard'); // carrière NON cohérente → 0
    const libellePiege = stockFor('Marchand'); // un LIBELLÉ n'est pas un id → ne déclenche PLUS le bonus
    expect(marchand).not.toEqual(roublard); // l'id cohérent a bel et bien décalé le tirage
    expect(libellePiege).toEqual(roublard); // id-only : le libellé se comporte comme une carrière quelconque
  });

  it('système simplifié (pas de Test de Disponibilité) : recherche = no-op (rien à améliorer, pas de journée perdue)', () => {
    setRule('market-mode', 'simplifie');
    banc.setState({ party: [gossiper(90)], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60 });
    banc.getState().openMerchant('pnj');
    const t0 = banc.getState().gameTime;
    banc.getState().searchAvailability();
    expect(banc.getState().gameTime).toBe(t0); // pas de journée consommée : le marché simplifié ignore la Disponibilité
  });
});
