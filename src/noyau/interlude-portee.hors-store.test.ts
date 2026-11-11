/**
 * LA PORTÉE DES ÉVÉNEMENTS D'INTERLUDE, sans store (#3059 S7) : un Événement de GROUPE tiré par un héros vaut
 * pour chaque participant, une fois ; un Événement individuel, pour le seul héros qui l'a tiré ; deux
 * Événements qui modifient la même valeur s'additionnent sur la même assiette. Les Événements sont tirés par
 * A, les effets lus sur B. LDB 22 l.5, l.32-123
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { avanceEtapeCascade } from './cascade.testkit';
import { emptyScene } from './monde/scene';
import { createHero } from '../engine/character';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import { toBrass } from '../engine/money';
import { blocageDeRevenus, devisDeDepot, revenusDeLaPeriode } from './verdictsDInterlude';
import type { BankDeposit } from './interludeFlow';
import { pratiquer } from './interlude.testkit';

const SCENE = { ...emptyScene('altdorf-centre', 2, 2), label: 'Altdorf', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] };
const ALTDORF = { id: 'w', label: 'Monde', places: [{ id: 'altdorf', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: SCENE.id }], routes: [] };

/** Dés d'Événement choisis dans la donnée (`interludeEvents.json`). */
const DE = {
  sansEffet: 1, repression: 19, prevot: 22, fausseMonnaie: 26, profits: 30, averti: 34, festivites: 37,
  mauvaiseRecolte: 49, complications: 57, nouvelleLune: 64, vieillesDettes: 66, opportunite: 68, miseASac: 77,
  emeutes: 80, suspect: 89,
};

/** A (soldat) tire `deA`, B (carrière `carriereB`) tire `deB` ; dix CO chacun, les dépôts `bank(a, b)`, deux
 *  semaines, séquence dénouée. */
function tirage(deA: number, carriereB = 'soldat', deB = DE.sansEffet, bank: (a: string, b: string) => BankDeposit[] = () => []): { banc: Banc; a: string; b: string; chance: number[] } {
  const party = [
    withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 }), { gold: 10, silver: 0, brass: 0 }, idsDeTest),
    withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: carriereB, label: 'B', seed: 2 }), { gold: 10, silver: 0, brass: 0 }, idsDeTest),
  ];
  const chance = party.map((h) => h.fortune ?? 0);
  const banc = ouvrirLeBanc({ graine: 3, desFixes: true, etat: { party, scene: SCENE, worldMap: ALTDORF as never, bank: bank(party[0].id, party[1].id) } });
  banc.actions.ouvrirLInterlude(2);
  for (const de of [deA, deB]) avanceEtapeCascade(banc.getState, () => de);
  avanceEtapeCascade(banc.getState); // dénouement de groupe
  expect(banc.getState().interlude?.phase, 'témoin : le tirage est dénoué').toBe('activities');
  const [a, b] = banc.getState().party.map((h) => h.id);
  return { banc, a, b, chance };
}

/** Le gain de Revenus réussis du batelier B, graine 42, sans Événement (`revenusDeB(DE.sansEffet, 'batelier')`). */
const REVENUS_DU_BATELIER = 60;

const restantes = (banc: Banc, id: string) => banc.getState().interlude!.perHero[id].left;
const bourse = (banc: Banc, id: string) => toBrass(bourseOf(banc.getState().party.find((h) => h.id === id)!));

/** Le gain de Revenus réussis de B sous `deA` et `deB`, joué par le geste, graine fixe. */
function revenusDeB(deA: number, carriereB: string, deB = DE.sansEffet): number {
  const { banc, b } = tirage(deA, carriereB, deB);
  banc.actions.ensemencerLeTirage(42);
  pratiquer(banc.getState, b, 'revenus');
  banc.actions.jetLancer('activite');
  banc.setState((s) => ({ pendingActivity: { ...s.pendingActivity!, roll: 10, success: true, sl: 1 } }));
  banc.actions.jetValider('activite');
  return banc.getState().interlude!.perHero[b].revenueBrass;
}

describe('Événements de GROUPE tirés par A : ils valent pour B', () => {
  it('Répression du crime : le roublard B ne peut pas entreprendre Revenus (LDB 22 l.32)', () => {
    const { banc, b } = tirage(DE.repression, 'charlatan');
    expect(blocageDeRevenus(banc.getState(), b)).toBe('B ne peut pas entreprendre Revenus (événement : Répression du crime).');
  });

  it('Le Prévôt arrive : la bourse de B perd 30 % (LDB 22 l.36)', () => {
    const { banc, b } = tirage(DE.prevot);
    expect(bourse(banc, b)).toBe(1680);
  });

  it('Fausse monnaie : le dépôt de B perd 20 %, ses Revenus aussi (LDB 22 l.40)', () => {
    const { banc, b } = tirage(DE.fausseMonnaie);
    expect(devisDeDepot(banc.getState(), b, 'planque', 1000).depose).toBe(800);
    expect(revenusDeLaPeriode(banc.getState(), b).pct).toBe(-20);
  });

  it('Profits abondants : le Riverain B gagne 50 % de plus, par le geste (LDB 22 l.44)', () => {
    expect(revenusDeB(DE.profits, 'batelier')).toBe(Math.floor((REVENUS_DU_BATELIER * 150) / 100));
  });

  it('Mauvaise récolte : le Rural B ne peut pas entreprendre Revenus (LDB 22 l.64)', () => {
    const { banc, b } = tirage(DE.mauvaiseRecolte, 'chasseur');
    expect(blocageDeRevenus(banc.getState(), b)).toBe('B ne peut pas entreprendre Revenus (événement : Mauvaise récolte).');
  });

  it('Complications monstrueuses : B, quelle que soit sa Classe, ne peut pas entreprendre Revenus (LDB 22 l.72)', () => {
    const { banc, b } = tirage(DE.complications);
    expect(blocageDeRevenus(banc.getState(), b)).toBe('B ne peut pas entreprendre Revenus (événement : Complications monstrueuses).');
  });

  it('Nouvelle lune : le roublard B gagne 20 % de plus (LDB 22 l.83)', () => {
    const { banc, b } = tirage(DE.nouvelleLune, 'charlatan');
    expect(revenusDeLaPeriode(banc.getState(), b).pct).toBe(20);
  });

  it('Opportunité de passage : le Citadin B gagne 50 % de plus (LDB 22 l.91)', () => {
    const { banc, b } = tirage(DE.opportunite, 'artisan');
    expect(revenusDeLaPeriode(banc.getState(), b).pct).toBe(50);
  });

  it('Émeutes : le Courtisan B ne peut pas entreprendre Revenus, et le dépôt investi déjà en banque vérifie sa faillite (LDB 22 l.111)', () => {
    const { banc, b } = tirage(DE.emeutes, 'artiste', DE.sansEffet, (_a, b) => [{ uid: 'depot-b', heroId: b, kind: 'investir', brass: 500, rate: 10 }]);
    expect(blocageDeRevenus(banc.getState(), b)).toBe('B ne peut pas entreprendre Revenus (événement : Émeutes).');
    expect(banc.getState().journal.filter((l) => l.startsWith('Vérification de faillite') || l.includes('la banque a fait faillite')), 'la vérification de faillite est dite au dénouement').toHaveLength(1);
  });

  it('Suspect : A et B renoncent chacun à une Activité (LDB 22 l.123)', () => {
    const { banc, a, b } = tirage(DE.suspect);
    expect([restantes(banc, a), restantes(banc, b)]).toEqual([1, 1]);
    expect(banc.getState().interlude!.perHero[b].granted).toBe(1);
  });

  it('Suspect tiré par les deux : une seule Activité perdue chacun', () => {
    const { banc, a, b } = tirage(DE.suspect, 'soldat', DE.suspect);
    expect([restantes(banc, a), restantes(banc, b)]).toEqual([1, 1]);
  });
});

describe('Événements INDIVIDUELS tirés par A : B n’en subit rien', () => {
  it.each([['Festivités', DE.festivites], ['Vieilles dettes', DE.vieillesDettes]])('%s : seul A perd une Activité (LDB 22 l.52, l.87)', (_nom, de) => {
    const { banc, a, b } = tirage(de);
    expect([restantes(banc, a), restantes(banc, b)]).toEqual([1, 2]);
  });

  it('Un homme averti en vaut deux : seul A gagne un Point de Chance (LDB 22 l.48)', () => {
    const { banc, chance } = tirage(DE.averti);
    expect(banc.getState().party.map((h) => h.fortune ?? 0)).toEqual([chance[0] + 1, chance[1]]);
  });

  it('Mise à sac : seule la planque de A est dévalisée (LDB 22 l.107)', () => {
    const { banc, b } = tirage(DE.miseASac, 'soldat', DE.sansEffet, (a, b) => [
      { uid: 'depot-a', heroId: a, kind: 'planque', brass: 100, rate: 0 }, { uid: 'depot-b', heroId: b, kind: 'planque', brass: 100, rate: 0 },
    ]);
    expect(banc.getState().bank).toEqual([{ uid: 'depot-b', heroId: b, kind: 'planque', brass: 100, rate: 0 }]);
  });
});

describe('Cumul : deux Événements sur la même valeur s’additionnent sur la même assiette (LDB 22)', () => {
  it('Fausse monnaie (A) et Profits abondants (B) : le Riverain B a +30 % de Revenus', () => {
    const { banc, b } = tirage(DE.fausseMonnaie, 'batelier', DE.profits);
    expect(revenusDeLaPeriode(banc.getState(), b).pct).toBe(30);
  });

  it('… et le geste Revenus le crédite : 130 % du gain de base', () => {
    expect(revenusDeB(DE.fausseMonnaie, 'batelier', DE.profits)).toBe(Math.floor((REVENUS_DU_BATELIER * 130) / 100));
  });
});
