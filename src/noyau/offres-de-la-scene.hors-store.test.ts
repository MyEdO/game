/**
 * LES OFFRES DE LA SCÈNE (#5149) : `ouvrirLeRepos` sans argument, hors lieu de la carte, ouvre la nuit aux offres
 * d'auberge que la scène déclare (`Scene.rest.offres`), une liste vide comprise, et à celles du catalogue sans elles.
 * LDB 66 l.5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene } from './monde/scene';
import { seedBattleRng } from './battleRng';
import { makeRNG } from '../engine/dice';
import { toBrass } from '../engine/money';
import { totalDesBourses } from './bourseFlow';
import { draineCascade } from './cascade.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();

const LDB = { book: 'livre-de-base', page: 302 };
const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 };
/** Un héros sans bourse. */
const heros = (id: string): Combatant => blessuresSurLeProfil({
  id, label: id, kind: 'heros', characteristics: { ...CHARS }, conditions: [], skills: [], talents: [], weapons: [], advantage: 0,
  wounds: blessuresDeBase(12), movement: 4, items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as Combatant) as Combatant;

/** Le relais : une auberge piètre de scène, aux offres `offres` s'il en porte ; le groupe à bourse vide sur la scène. */
function auRelais(offres?: NonNullable<Scene['rest']>['offres']): void {
  const scene = emptyScene('relais', 10, 10);
  scene.rest = { auberge: true, quality: 'pietre', ...(offres ? { offres } : {}) };
  banc.setState({ mode: 'exploration', battle: null, party: [heros('h1'), heros('h2')], pendingRest: null, pendingCascade: null, scene, partyPos: { x: 1, y: 1 } } as never);
}

describe('une auberge de scène au séjour déjà payé (LDB 66 l.5)', () => {
  it('ouvre chambre et repas à note nulle : la nuit se valide sur bourse vide et le repas piètre expose à la Courante galopante', () => {
    auRelais([{ id: 'chambre', prix: { brass: 0 }, source: LDB }, { id: 'repas', prix: { brass: 0 }, source: LDB }]);
    const graine = Array.from({ length: 1000 }, (_, i) => i + 1).find((s) => makeRNG(s).int(1, 100) <= 10)!;
    seedBattleRng(graine);
    g().ouvrirLeRepos();
    expect(g().pendingRest!.perHero).toEqual({ h1: { lodging: 'chambre-1', food: 'repas' }, h2: { lodging: 'chambre-1', food: 'repas' } });
    g().fenetreValider('repos');
    expect(g().pendingRest).toBeNull();
    const exposes = g().pendingCascade!.participants
      .filter((s) => s.kind === 'contagion' && s.meta?.diseaseName === 'courante-galopante')
      .flatMap((s) => s.participants?.map((r) => r.id) ?? (s.actorId ? [s.actorId] : []));
    expect(exposes.length).toBeGreaterThan(0);
    draineCascade(g);
    expect(toBrass(totalDesBourses(g().party))).toBe(0);
  });

  it('sans offres déclarées, la même auberge facture le livre : la note n’est pas couverte et la nuit reste à régler', () => {
    auRelais();
    g().ouvrirLeRepos();
    g().fenetreValider('repos');
    expect(g().pendingRest).not.toBeNull();
    expect(g().pendingCascade).toBeNull();
  });

  it('une liste d’offres déclarée vide ne vend rien, et ne retombe pas sur le catalogue', () => {
    auRelais([]);
    g().ouvrirLeRepos();
    expect(g().pendingRest!.offres).toEqual([]);
  });
});
