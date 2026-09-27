/**
 * #57 — Recherche active de Disponibilité (LDB 59 l.50) : « passe une journée entière à effectuer des
 * achats et des Tests de Ragot ». `searchAvailability` (marchand) consacre UNE JOURNÉE (avance l'horloge)
 * et jette un Test de Ragot du groupe ; sur un succès, un réassort FRAIS est tiré avec +10 % de
 * Disponibilité (LDB 59 l.50) — cumulable avec la Carrière cohérente jusqu'au plafond +20 %.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { emptyScene } from './scene';
import { MINUTES_PER_DAY } from '../engine/clock';
import { availabilitySearchBonus } from '../engine/disponibilite';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

/** Héros doué en Ragot (Soc élevée) — le Test réussit tant que le d100 ≤ sa valeur. */
const gossiper = (soc: number): Combatant =>
  ({
    id: 'h', name: 'Colporteur', career: '', careerLevel: 1, items: [],
    skills: [{ id: 'ragot', advances: 20 }], talents: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: soc },
    wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {},
  } as unknown as Combatant);

const merchantScene = () => {
  const sc = emptyScene(4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } } as never);
  return sc;
};

beforeEach(() => useGame.getState().seedRng(4));
afterEach(() => { resetRule('market-mode'); });

describe('#57 — recherche active de Disponibilité (LDB 59 l.50)', () => {
  it('availabilitySearchBonus compte la journée de Ragot (+10, cumulable, plafond +20)', () => {
    expect(availabilitySearchBonus({ gossipDay: true })).toBe(10);
    expect(availabilitySearchBonus({ gossipDay: true, coherentCareer: true })).toBe(20);
  });

  it('avance l’horloge d’exactement une journée', () => {
    useGame.setState({ party: [gossiper(90)], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60 });
    useGame.getState().openMerchant('pnj');
    const t0 = useGame.getState().gameTime;
    useGame.getState().searchAvailability();
    expect(useGame.getState().gameTime).toBe(t0 + MINUTES_PER_DAY);
    expect(useGame.getState().merchant).not.toBeNull(); // le marchand reste ouvert, stock rafraîchi
  });

  it('Ragot réussi → réassort AVEC le bonus ; échoué → réassort SANS (stocks distincts)', () => {
    // Le stock est tiré par un seed dérivé de l'entité + période + bonus de recherche : réussite et échec
    // produisent des tirages DIFFÉRENTS (l'effort change le résultat). On isole les deux issues via la Soc :
    //  - Soc 99 → le Ragot réussit quasi toujours (bonus appliqué) ;
    //  - Soc 1  → le Ragot échoue quasi toujours (pas de bonus).
    const run = (soc: number) => {
      useGame.getState().seedRng(4);
      useGame.setState({ party: [gossiper(soc)], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60 });
      useGame.getState().openMerchant('pnj');
      useGame.getState().searchAvailability();
      return useGame.getState().merchant!.stock.map((l) => `${l.id}:${l.qty}`).sort().join('|');
    };
    const success = run(99);
    const failure = run(1);
    expect(success).not.toEqual(failure); // le bonus de recherche a bel et bien influé sur le réassort
  });

  it('Carrière cohérente par ID (marchand/receleur, LDB 59 l.50) décale le réassort — id STABLE, pas libellé', () => {
    const stockFor = (career: string) => {
      useGame.getState().seedRng(4);
      const h = gossiper(30); (h as unknown as { career: string }).career = career;
      useGame.setState({ party: [h], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60 });
      useGame.getState().openMerchant('pnj');
      return useGame.getState().merchant!.stock.map((l) => `${l.id}:${l.qty}`).sort().join('|');
    };
    const marchand = stockFor('marchand'); // carrière cohérente (id) → +10 % de Disponibilité
    const roublard = stockFor('roublard'); // carrière NON cohérente → 0
    const libellePiege = stockFor('Marchand'); // un LIBELLÉ n'est pas un id → ne déclenche PLUS le bonus
    expect(marchand).not.toEqual(roublard); // l'id cohérent a bel et bien décalé le tirage
    expect(libellePiege).toEqual(roublard); // id-only : le libellé se comporte comme une carrière quelconque
  });

  it('système simplifié (pas de Test de Disponibilité) : recherche = no-op (rien à améliorer, pas de journée perdue)', () => {
    setRule('market-mode', 'simplifie');
    useGame.setState({ party: [gossiper(90)], scene: merchantScene(), merchantStocks: {}, gameTime: 8 * 60 });
    useGame.getState().openMerchant('pnj');
    const t0 = useGame.getState().gameTime;
    useGame.getState().searchAvailability();
    expect(useGame.getState().gameTime).toBe(t0); // pas de journée consommée : le marché simplifié ignore la Disponibilité
  });
});
