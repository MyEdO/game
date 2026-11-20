/** #1667 C-g — les tables Capricieux (MSRC 15 l.151-159) et Réaction au Statut (LDB 08 l.40-46) se
 *  tirent, à l'ouverture d'un Test social (`openSkillTest`), au dé que porte la table. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { runFlow } from './combatEffects';
import { testFlow } from './monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { battleRng, seedBattleRng } from './battleRng';
import { createHero } from '../engine/character';
import { adresseDeCreation } from '../engine/adresseDeCreation';
import { sousLeDe } from '../data/deDeLaTable.testkit';
import type { JeuDeRegles } from '../engine/policy';
import { RULE_REF } from '../engine/ruleRefs';
import { ligneDe } from '../engine/modLine.testkit';

const PERSPICACE = { [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' } };

afterEach(() => { vi.restoreAllMocks(); });

function ouvrirLeTest(spec: Parameters<typeof testFlow>[0], options: {
  reglesMaison?: JeuDeRegles;
  face?: number;
  niveau?: number;
} = {}) {
  const { reglesMaison = {}, face, niveau = 2 } = options;
  const banc = ouvrirLeBanc({ reglesMaison, desFixes: false });
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'bourgeois', label: 'Felix', seed: 1, speciesTalentChoices: PERSPICACE });
  h.careerLevel = niveau;
  h.characteristics.sociabilite = 45;
  h.characteristics.force = 45;
  h.talents = [];
  h.skills = spec.skill ? [{
    id: spec.skill.id,
    characteristic: spec.skill.id === 'intimidation' ? 'force' : 'sociabilite',
    advances: 5,
  }] : [];
  banc.setState({ party: [h], pendingTest: null, battle: null });
  seedBattleRng(1);
  const int = vi.spyOn(battleRng(), 'int').mockImplementation((_min, max) => max === 100 ? 65 : face ?? max);
  runFlow(banc.getState, banc.setState, testFlow({ difficulty: 'intermediaire', noSupport: true, ...spec }, EMPTY_FLOW, EMPTY_FLOW));
  return { banc, pt: banc.getState().pendingTest!, int };
}

const REACTION = { 'social-reaction-au-statut': true } as const;
const BRONZE = { tier: 'bronze', standing: 1 } as const;
const ARGENT = { tier: 'argent', standing: 2 } as const;
const OR = { tier: 'or', standing: 1 } as const;

describe('Tables sociales — tirées au dé de leur table', () => {
  it('Capricieux : un seul tirage, au d4 posé sur la table, et la rangée de sa face', () => {
    sousLeDe('tableauCapricieux', { n: 1, sides: 4 }, () => {
      const { pt, int } = ouvrirLeTest({ skill: { id: 'charme' }, difficulty: 'intermediaire', vsCapricieux: true });
      expect(int.mock.calls).toEqual([[1, 4]]);
      expect(pt.capriciousRoll).toBe(4);
      expect(pt.capriciousDR).toBeUndefined(); // face 4 : « Utiliser le DR indiqué »
    });
  });

  it('Réaction au Statut : un seul tirage, au d2 posé sur la table, « Braver le Statut » annule le mod', () => {
    sousLeDe('reactionAuStatut', { n: 1, sides: 2 }, () => {
      const { pt, int } = ouvrirLeTest({ skill: { id: 'charme' }, difficulty: 'intermediaire', vsStatus: OR }, { reglesMaison: REACTION });
      expect(int.mock.calls).toEqual([[1, 2]]);
      expect(ligneDe(pt.mods, RULE_REF.statut)).toBeUndefined();
      expect(pt.target).toBe(50);
    });
  });
});

describe('Opinions extrêmes dans le flux du Test de scène', () => {
  it.each([
    [8, BRONZE, 10], [9, BRONZE, -10], [10, BRONZE, -10],
    [8, OR, -10], [9, OR, 10], [10, OR, 10],
    [8, ARGENT, 0], [9, ARGENT, 0], [10, ARGENT, 0],
  ] as const)('Charme, d10 = %i, Statut de l’interlocuteur %j : %i', (face, vsStatus, mod) => {
    const { pt, int } = ouvrirLeTest({ skill: { id: 'charme' }, vsStatus }, { face, reglesMaison: REACTION });
    expect(int.mock.calls).toEqual([[1, 10]]);
    expect(ligneDe(pt.mods, RULE_REF.statut)?.value ?? 0).toBe(mod);
    expect(pt.target).toBe(50 + mod);
  });

  it.each([
    ['favorable', undefined, 30],
    ['hostile', 'favorable', 10],
    [undefined, 'favorable', 30],
    [undefined, 'hostile', 10],
    [undefined, undefined, 20],
  ] as const)('Commandement Or → Bronze, avis %s, surcharge %s : +%i', (avisSurLeStatut, surcharge, mod) => {
    const reglesMaison: JeuDeRegles = surcharge
      ? { ...REACTION, 'social-opinions-extremes-avis-par-defaut': surcharge }
      : REACTION;
    const { banc, pt, int } = ouvrirLeTest(
      { skill: { id: 'commandement' }, vsStatus: BRONZE, avisSurLeStatut },
      { face: 9, niveau: 4, reglesMaison },
    );
    expect(int.mock.calls).toEqual([[1, 10]]);
    expect(ligneDe(pt.mods, RULE_REF.statut)).toMatchObject({ value: mod, famille: 'jet', ref: RULE_REF.statut });
    expect(pt).toMatchObject({ base: 50, skillValue: 50 + mod, target: 50 + mod });
    banc.getState().jetLancer('test');
    expect(int.mock.calls).toEqual([[1, 10], [1, 100]]);
    expect(banc.getState().pendingTest).toMatchObject({ roll: 65, success: 65 <= 50 + mod });
    banc.getState().jetValider('test');
    expect(banc.getState().pendingTest).toBeNull();
  });

  it.each([
    ['intimidation', BRONZE, 'favorable', 20],
    ['ragot', BRONZE, 'favorable', 0],
    ['ragot', OR, 'hostile', -20],
    ['ragot', ARGENT, 'hostile', -10],
  ] as const)('%s, Statut %j, avis %s : %i', (id, vsStatus, avisSurLeStatut, mod) => {
    const { pt, int } = ouvrirLeTest(
      { skill: { id }, vsStatus, avisSurLeStatut },
      { face: 10, reglesMaison: REACTION },
    );
    expect(int.mock.calls).toEqual([[1, 10]]);
    expect(ligneDe(pt.mods, RULE_REF.statut)?.value ?? 0).toBe(mod);
    expect(pt.target).toBe(50 + mod);
  });

  it('un Test de Sociabilité sans règle de Statut ne déclenche pas la réaction', () => {
    const { pt, int } = ouvrirLeTest(
      { skill: { id: 'marchandage' }, vsStatus: BRONZE, avisSurLeStatut: 'hostile' },
      { face: 10, reglesMaison: REACTION },
    );
    expect(int.mock.calls).toEqual([]);
    expect(pt.target).toBe(50);
  });
});
