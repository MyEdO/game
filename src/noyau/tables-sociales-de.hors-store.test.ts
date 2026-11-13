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
import { resetRule, setRule } from '../engine/policy';

const PERSPICACE = { [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' } };

afterEach(() => { vi.restoreAllMocks(); resetRule('social-reaction-au-statut'); });

function ouvrirLeTest(spec: Parameters<typeof testFlow>[0], regle?: 'social-reaction-au-statut') {
  const banc = ouvrirLeBanc();
  if (regle) setRule(regle, true);
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Felix', seed: 1, speciesTalentChoices: PERSPICACE });
  banc.setState({ party: [h], pendingTest: null, battle: null });
  seedBattleRng(1);
  const int = vi.spyOn(battleRng(), 'int').mockImplementation((_min, max) => max);
  runFlow(banc.getState, banc.setState, testFlow(spec, EMPTY_FLOW, EMPTY_FLOW));
  return { pt: banc.getState().pendingTest!, int };
}

describe('Tables sociales — tirées au dé de leur table', () => {
  it('Capricieux : un seul tirage, au d4 posé sur la table, et la rangée de sa face', () => {
    sousLeDe('tableauCapricieux', 'd4', () => {
      const { pt, int } = ouvrirLeTest({ skill: { id: 'charme' }, difficulty: 'intermediaire', vsCapricieux: true });
      expect(int.mock.calls).toEqual([[1, 4]]);
      expect(pt.capriciousRoll).toBe(4);
      expect(pt.capriciousDR).toBeUndefined(); // face 4 : « Utiliser le DR indiqué »
    });
  });

  it('Réaction au Statut : un seul tirage, au d2 posé sur la table, « Braver le Statut » annule le mod', () => {
    sousLeDe('reactionAuStatut', 'd2', () => {
      const { pt, int } = ouvrirLeTest({ skill: { id: 'charme' }, difficulty: 'intermediaire', vsStatus: 'Or 1' }, 'social-reaction-au-statut');
      expect(int.mock.calls).toEqual([[1, 2]]);
      expect(pt.psychMod ?? 0).toBe(0);
    });
  });
});
