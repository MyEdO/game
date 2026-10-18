import { describe, it, expect, afterEach } from 'vitest';
import { critiquesDuCoup, estUnCoupCritique, porteurDeCritique, type CauseCoupCritique, type JeuDeCritique } from './critical';
import { resetRule, setRule } from './policy';
import type { Combatant } from './types';

// #1595 c.6220635824, c.6221792068, c.6219992594 — le compte des Blessures critiques d'un coup.

const porteur = (p: Partial<Combatant>): Combatant =>
  ({ id: 'c', label: 'Cible', kind: 'enemy', important: true, conditions: [], talents: [], skills: [], characteristics: { endurance: 30, force: 30, agilite: 30, initiative: 30, 'force-mentale': 30 }, wounds: { current: 10, max: 10 }, ...p } as unknown as Combatant);

const personnage = porteur({});
const figurant = porteur({ important: false });
const structure = porteur({ bodyShape: 'structure', creatureId: 'porte' });
const navire = porteur({ bodyShape: 'vehicule', creatureId: 'cogue' });
const bateauFluvial = porteur({ bodyShape: 'vehicule', creatureId: 'barge-fluviale' });
const routier = porteur({ bodyShape: 'vehicule', creatureId: 'charrette' });
const engin = porteur({ bodyShape: 'engin', inert: true });

const compte = (
  c: Combatant, jeu: JeuDeCritique, coup: { cc?: CauseCoupCritique; prise?: boolean; current: number; lost: number },
) => critiquesDuCoup(c, { coupCritique: coup.cc ?? null, prise: coup.prise ?? true, current: coup.current, blessures: () => coup.lost }, jeu);

afterEach(() => { resetRule('combat-sudden-death'); });

describe('porteurDeCritique — classifieur TOTAL', () => {
  it.each([
    [personnage, 'personnage'], [structure, 'structure'], [navire, 'navire'], [bateauFluvial, 'navire'],
    [routier, 'vehicule-routier'], [engin, 'inerte'],
  ] as const)('%#', (c, attendu) => expect(porteurDeCritique(c)).toBe(attendu));

  it('une forme sans ligne lève, jamais de repli sur personnage', () => {
    expect(() => porteurDeCritique(porteur({ bodyShape: 'army' }))).toThrow(/REGIMES_DE_PORTEUR/);
  });

  it('la barque fluviale est un navire (#1595 c.6221792068 Q6)', () => {
    expect(porteurDeCritique(porteur({ bodyShape: 'vehicule', creatureId: 'barque-fluviale' }))).toBe('navire');
  });
});

describe('critiquesDuCoup — porteur × jeu × cause', () => {
  const origines = (r: ReturnType<typeof critiquesDuCoup>) => r.critiques.map((x) => `${x.origine}:${x.overkill}`);

  it.each(['double', 'empaleuse', 'incantation-critique'] as const)('ldb, Personnage, %s qui dépasse → 2 (d100 nu puis dépassement)', (cc) => {
    expect(origines(compte(personnage, 'ldb', { cc, current: 3, lost: 7 }))).toEqual(['coup-critique:0', 'depassement:4']);
  });
  it('ldb, Personnage, double sans dépassement → 1', () => {
    expect(origines(compte(personnage, 'ldb', { cc: 'double', current: 8, lost: 7 }))).toEqual(['coup-critique:0']);
  });
  it('ldb, Personnage, dépassement seul → 1 ; égalité → 0 (LDB 13 l.161)', () => {
    expect(origines(compte(personnage, 'ldb', { current: 3, lost: 5 }))).toEqual(['depassement:2']);
    expect(origines(compte(personnage, 'ldb', { current: 3, lost: 3 }))).toEqual([]);
  });
  it('aa, Personnage, double qui dépasse → 1, avec le +10 par Blessure (AA 07 l.36, l.42)', () => {
    expect(origines(compte(personnage, 'aa', { cc: 'double', current: 3, lost: 7 }))).toEqual(['coup-critique:4']);
  });
  it('aa, Personnage, tomber à 0 suffit (AA 07 l.36)', () => {
    expect(origines(compte(personnage, 'aa', { current: 3, lost: 3 }))).toEqual(['coup-critique:0']);
  });
  it("estUnCoupCritique : en aa, le Critique du passage à 0 d'un Personnage est un Coup Critique ; en ldb, le dépassement ne l'est pas (AA 07 l.34, l.38 ; LDB 18 l.23 ; #1595 c.6226467544)", () => {
    expect(compte(personnage, 'aa', { current: 3, lost: 3 }).critiques.map((x) => estUnCoupCritique(x.origine))).toEqual([true]);
    expect(compte(personnage, 'aa', { current: 0, lost: 5 }).critiques.map((x) => estUnCoupCritique(x.origine))).toEqual([true]);
    expect(compte(personnage, 'aa', { cc: 'double', current: 3, lost: 7 }).critiques.map((x) => estUnCoupCritique(x.origine))).toEqual([true]);
    expect(compte(personnage, 'ldb', { current: 3, lost: 5 }).critiques.map((x) => estUnCoupCritique(x.origine))).toEqual([false]);
  });
  it('Inoffensive contre un Personnage à 0 : +0 en aa, rien en ldb (#1595 c.6221792068 Q2, c.6227274650 Q1)', () => {
    expect(origines(compte(personnage, 'aa', { current: 0, lost: 0 }))).toEqual(['coup-critique:0']);
    expect(origines(compte(personnage, 'ldb', { current: 0, lost: 0 }))).toEqual([]);
  });

  it.each(['ldb', 'aa'] as const)('%s, Structure : double sous 25 %% → 0, au-dessus → 1 ; à 0 tout coup → 1 (AA 10 l.114)', (jeu) => {
    expect(origines(compte(structure, jeu, { cc: 'double', current: 40, lost: 9 }))).toEqual([]);
    expect(origines(compte(structure, jeu, { cc: 'empaleuse', current: 40, lost: 10 }))).toEqual(['coup-critique:0']);
    expect(origines(compte(structure, jeu, { current: 0, lost: 3 }))).toEqual(['a-zero:3']);
    expect(origines(compte(structure, jeu, { current: 2, lost: 30 }))).toEqual([]);
  });

  it.each([[navire], [bateauFluvial]])('%#, navire et bateau : double → 1, à 0 tout coup → 1, jamais de dépassement (MDG 13 l.656 ; MSRC 07 l.74)', (c) => {
    for (const jeu of ['ldb', 'aa'] as const) {
      expect(origines(compte(c, jeu, { cc: 'incantation-critique', current: 30, lost: 2 }))).toEqual(['coup-critique:0']);
      expect(origines(compte(c, jeu, { current: 0, lost: 2 }))).toEqual(['a-zero:2']);
      expect(origines(compte(c, jeu, { cc: 'double', current: 0, lost: 2 }))).toEqual(['coup-critique:2']);
      expect(origines(compte(c, jeu, { current: 3, lost: 9 }))).toEqual([]);
    }
  });

  it('véhicule routier : dépassement et double, plafond 1 (EDOC 07 l.334 ; LDB 14 l.3 ; c.6221792068 Q1)', () => {
    expect(origines(compte(routier, 'ldb', { current: 3, lost: 9 }))).toEqual(['depassement:6']);
    expect(origines(compte(routier, 'ldb', { cc: 'double', current: 3, lost: 9 }))).toEqual(['coup-critique:6']);
    expect(origines(compte(routier, 'ldb', { current: 0, lost: 0 }))).toEqual([]);
  });

  it('engin inerte : jamais de Critique', () => {
    expect(origines(compte(engin, 'ldb', { cc: 'double', current: 0, lost: 5 }))).toEqual([]);
  });

  it('coup sans prise (sauvegarde, Bouclier anti-flèches, immunité, coque bloquée) : rien, sur tout porteur', () => {
    for (const c of [personnage, structure, navire, routier])
      expect(compte(c, 'ldb', { cc: 'double', prise: false, current: 0, lost: 9 })).toEqual({ critiques: [], mortSubite: false, relance: false });
  });
});

describe('CompteDesCritiques.relance — la relance suit le Coup Critique du Personnage (AA 07 l.25, l.32 ; LDB 18 l.53 ; #1595 c.6226467544)', () => {
  it.each([
    [personnage, 'aa', null, 0, true],
    [personnage, 'aa', null, -2, true],
    [personnage, 'aa', null, 3, false],
    [personnage, 'ldb', null, 0, false],
    [personnage, 'ldb', 'double', 3, true],
    [personnage, 'aa', 'empaleuse', 3, true],
    [structure, 'aa', null, 0, false],
    [structure, 'aa', 'double', 3, false],
    [navire, 'aa', null, 0, false],
    [navire, 'aa', 'incantation-critique', 3, false],
    [routier, 'aa', null, 0, false],
  ] as const)('%#', (c, jeu, cause, current, attendu) => {
    expect(critiquesDuCoup(c, { coupCritique: cause, prise: true, current, blessures: () => 5 }, jeu).relance).toBe(attendu);
  });

  it.each([
    ['aa', 0, [true]],
    ['aa', 3, [false]],
    ['ldb', 0, [false]],
  ] as const)('critiquesDuCoup, Personnage, %s, %i PB, sans cause : relance %j', (jeu, current, attendu) => {
    const relances: boolean[] = [];
    critiquesDuCoup(personnage, { coupCritique: null, prise: true, current, blessures: (rel) => { relances.push(rel); return 5; } }, jeu);
    expect(relances).toEqual(attendu);
  });
});

describe("Le Coup Critique du passage à 0 reste au Personnage, en aa (#1595 c.6227274650 Q4)", () => {
  it.each([[structure], [navire], [bateauFluvial]])('%#, structure ou navire : aucun coup-critique sans cause, a-zero inchangé', (c) => {
    const r0 = compte(c, 'aa', { current: 0, lost: 3 });
    expect(r0.critiques.map((x) => x.origine)).toEqual(['a-zero']);
    expect(compte(c, 'aa', { current: 3, lost: 9 }).critiques).toEqual([]);
  });
  it('véhicule routier : aucun coup-critique sans cause', () => {
    for (const current of [0, 3])
      expect(compte(routier, 'aa', { current, lost: 9 }).critiques.some((x) => estUnCoupCritique(x.origine))).toBe(false);
  });
});

describe('critiquesDuCoup — Mort subite (LDB 18 l.44, l.46 ; AA 07 l.65, l.67 ; #1595 c.6219992594)', () => {
  it('ldb : aucun Critique, même sur un double ; la Mort subite sur le dépassement, sans relance de Localisation', () => {
    const relances: boolean[] = [];
    const r = critiquesDuCoup(figurant, { coupCritique: 'double', prise: true, current: 3, blessures: (rel) => { relances.push(rel); return 5; } }, 'ldb');
    expect(r).toEqual({ critiques: [], mortSubite: true, relance: false });
    expect(relances).toEqual([false]);
    expect(compte(figurant, 'ldb', { cc: 'double', current: 8, lost: 5 })).toEqual({ critiques: [], mortSubite: false, relance: false });
  });
  it('aa : aucun Critique, et la sortie reste celle de horsDeCombatParMortSubite', () => {
    expect(compte(figurant, 'aa', { cc: 'double', current: 3, lost: 5 })).toEqual({ critiques: [], mortSubite: false, relance: false });
  });
  it('règle off : le figurant reçoit ses Critiques', () => {
    setRule('combat-sudden-death', 'off');
    expect(compte(figurant, 'ldb', { cc: 'double', current: 3, lost: 5 }).critiques).toHaveLength(2);
  });
});

