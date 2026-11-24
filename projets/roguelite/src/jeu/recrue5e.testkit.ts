/**
 * Une recrue 5e de témoin : un Soldat bâti par le brouillon du noyau sous la règle `creation-5e` et ses gestes publics,
 * engagé par `engagement`, posé au roster d'une partie dont la salle d'armes enseigne le niveau 3.
 */
import { expect } from 'vitest';
import { apresLeGeste, brouillonDeLaPartie, engagement, type GesteDuBrouillon } from '../../../../src/noyau';
import { resetRule, setRule } from '../../../../src/engine/policy';
import { rosterDeTest } from '../../../../src/engine/idsDeTest.testkit';
import { ameliorer, nouvellePartie, recrue, PROFILS, type Etat, type Heros } from './index';

const GESTES: GesteDuBrouillon[] = [
  { geste: 'espece', args: ['humains-reiklander'] },
  { geste: 'carriere', args: ['soldat'] },
  { geste: 'tirerLesCaracteristiques', args: [] },
  { geste: 'competencesDEspece', args: [] },
  { geste: 'competencesDeCarriere', args: [] },
  { geste: 'talentDeCarriere', args: [{ id: 'guerrier-ne' }] },
  { geste: 'tirerLesTalents', args: [] },
  { geste: 'tirerLaBourse', args: [] },
  { geste: 'tirerUnNom', args: [7] },
];

/** La partie et sa recrue 5e, `xp` PX à dépenser. */
export function recrue5e(xp: number): { e: Etat; h: Heros } {
  const e = nouvellePartie(7);
  e.or = 10_000; e.trophees = 10;
  expect(ameliorer(e, 'salle')).toBeNull();
  expect(ameliorer(e, 'salle')).toBeNull();
  setRule('creation-5e', true);
  const d = brouillonDeLaPartie(3, 0);
  resetRule('creation-5e');
  const h = recrue(e, PROFILS.find((p) => p.id === 'soldat')!);
  h.c = { ...engagement(GESTES.reduce(apresLeGeste, d), rosterDeTest('recrue5e')).hero, xp };
  expect(h.c.progression).toBe('5e');
  e.roster.push(h);
  return { e, h };
}
