/**
 * #1231 — la chaîne psychologique ne se lit plus par CAMP.
 * · `agressifEnvers` (LDB 85 l.383) : un NEUTRE est jugé au COMPORTEMENT, comme un membre du même camp.
 * · trace d'attaque du Round (`markAttacked`) : ORIENTÉE attaquant→cible, purgée par `decayEngagement`.
 * · `targetedTrigger` (LDB 21) : Groupe-Cible seul ; `triggerOn:'threatened'` pour Amour/Camaraderie.
 */
import { describe, it, expect } from 'vitest';
import { agressifEnvers, fearSourceFor, targetedTrigger } from './psychology';
import { markAttacked, decayEngagement, engage } from './engagement';
import type { Combatant } from './types';
import { ciblePsy } from './psych/ciblage';

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 35, force: 40, endurance: 40, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 } as const;

const mk = (id: string, kind: Combatant['kind'], over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, advantage: 0, conditions: [], talents: [], activeEffects: [], skills: [],
    traits: [], psychTraits: [], psychState: [], groups: [], weapons: [], engagedWith: [],
    characteristics: { ...CHARS }, wounds: { current: 10, max: 10, base: 10 }, size: 'moyenne',
    movement: 4, ...over,
  }) as unknown as Combatant;

describe('#1231 — NEUTRES jugés au comportement (LDB 85 l.383)', () => {
  it('un bœuf NEUTRE et calme de grande Taille n’est pas agressif → aucune Peur', () => {
    const hero = mk('h', 'hero', { size: 'moyenne' });
    const boeuf = mk('boeuf', 'npc', { size: 'grande' });
    expect(agressifEnvers(boeuf, hero)).toBe(false);
    expect(fearSourceFor(hero, boeuf)).toBeNull();
  });

  it('le MÊME bœuf ENGAGÉ contre le héros devient agressif → Peur 1', () => {
    const hero = mk('h', 'hero', { size: 'moyenne', engagedWith: ['boeuf'] });
    const boeuf = mk('boeuf', 'npc', { size: 'grande', engagedWith: ['h'] });
    expect(agressifEnvers(boeuf, hero)).toBe(true);
    expect(fearSourceFor(hero, boeuf)).toEqual({ kind: 'peur', indice: 1 });
  });

  it('un ADVERSAIRE DÉCLARÉ (camp hostile ⇄ groupe joueur) reste agressif par défaut', () => {
    const hero = mk('h', 'hero', { size: 'moyenne' });
    const ogre = mk('ogre', 'enemy', { size: 'grande' });
    expect(agressifEnvers(ogre, hero)).toBe(true);
    expect(fearSourceFor(hero, ogre)).toEqual({ kind: 'peur', indice: 1 });
  });
});

describe('#1231 — trace d’attaque du Round, ORIENTÉE', () => {
  it('un tir marque l’attaquant seul : la victime n’est pas rendue agressive en retour', () => {
    const tireur = mk('t', 'npc', { size: 'moyenne' });
    const cible = mk('c', 'hero', { size: 'grande' });
    markAttacked(tireur, cible);
    expect(agressifEnvers(tireur, cible)).toBe(true);
    expect(agressifEnvers(cible, tireur)).toBe(false);
    // La cible est plus grande : c'est le tireur qui teste, parce qu'il est l'agresseur… l'inverse est nul.
    expect(fearSourceFor(cible, tireur)).toBeNull();
  });

  it('la trace est purgée au franchissement de Round, comme meleeThisRound', () => {
    const a = mk('a', 'npc');
    const b = mk('b', 'hero');
    engage(a, b);
    markAttacked(a, b);
    expect(a.attackedThisRound).toEqual(['b']);
    decayEngagement([a, b]);
    expect(a.attackedThisRound).toEqual([]);
    expect(a.meleeThisRound).toEqual([]);
  });

  it('idempotente, et jamais contre soi-même', () => {
    const a = mk('a', 'enemy');
    const b = mk('b', 'hero');
    markAttacked(a, b); markAttacked(a, b); markAttacked(a, a);
    expect(a.attackedThisRound).toEqual(['b']);
  });
});

describe('#1231 — Traits psy CIBLÉS : le Groupe-Cible seul, jamais le camp (LDB 21)', () => {
  it('Animosité (elfe) se déclenche sur un ALLIÉ du groupe honni (l.19 : « un groupe de personnes ou de créatures »)', () => {
    const self = mk('s', 'hero', { psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }] });
    const allieElfe = mk('f', 'hero', { groups: ['elfe'] });
    expect(targetedTrigger(self, [allieElfe])).toEqual({ type: 'animosite', cible: ciblePsy.groupe('elfe'), sourceId: 'f', indice: undefined });
  });

  it('Amour ne se déclenche que si l’aimé est MENACÉ (l.75), fût-il d’un autre camp', () => {
    const self = mk('s', 'hero', { psychTraits: [{ type: 'amour', cible: ciblePsy.groupe('soldat') }] });
    const aime = mk('a', 'npc', { groups: ['soldat'] });
    const brigand = mk('b', 'enemy');
    expect(targetedTrigger(self, [aime, brigand])).toBeNull(); // présent mais tranquille : rien à défendre
    markAttacked(brigand, aime);
    expect(targetedTrigger(self, [aime, brigand])?.type).toBe('amour'); // l'aimé, d'un AUTRE camp, est attaqué
  });

  it('Camaraderie : un compagnon menacé par un NEUTRE ne compte qu’une fois ce neutre agressif', () => {
    const self = mk('s', 'hero', { psychTraits: [{ type: 'camaraderie', cible: ciblePsy.groupe('soldat') }] });
    const compagnon = mk('c', 'hero', { groups: ['soldat'] });
    const boeuf = mk('boeuf', 'npc');
    expect(targetedTrigger(self, [compagnon, boeuf])).toBeNull();
    markAttacked(boeuf, compagnon);
    expect(targetedTrigger(self, [compagnon, boeuf])?.type).toBe('camaraderie');
  });

  it('la menace vient d’un TIERS : `self` présent dans le roster ne s’agresse pas lui-même en menace', () => {
    // CONTRAT de la fonction pure : elle accepte un roster CONTENANT `self` (elle l'écarte déjà côté cible,
    // `v.id !== self.id`) — le côté MENACE doit l'écarter pareillement, sinon un porteur d'Amour du camp
    // opposé à l'aimé se déclencherait sur SA PROPRE agression : « venir en aide » contre soi-même n'est
    // écrit nulle part (LDB 21 l.75). Les deux sites de production filtrent déjà `self` en amont
    // (`visibleFoesAndAllies`, `resolvePsychAI`) : c'est le contrat qui est verrouillé ici, pas eux.
    const self = mk('s', 'enemy', { psychTraits: [{ type: 'amour', cible: ciblePsy.groupe('soldat') }] });
    const aime = mk('a', 'hero', { groups: ['soldat'] });
    expect(agressifEnvers(self, aime)).toBe(true); // il EST bien agressif envers elle…
    expect(targetedTrigger(self, [self, aime])).toBeNull(); // …et pourtant rien ne se déclenche
    const brigand = mk('b', 'enemy');
    expect(targetedTrigger(self, [self, aime, brigand])?.type).toBe('amour'); // un TIERS la menace → Test dû
  });
});
