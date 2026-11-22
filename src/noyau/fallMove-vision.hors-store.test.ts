import { describe, expect, it } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { testDeRegle } from '../engine/reglesChiffrees';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { fixtureText } from '../i18n/fixtureText';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { ouvrirLeBanc } from './banc.testkit';
import type { Jeu } from './etat';
import { refusDesDeclarationsDues } from './refusDeChute';
import { lancerLeScenario } from './lancementDeScenario';
import type { PendingFall } from './pendings';
import { combattantEnVue } from './visionDuGroupe';

const INCONNU = t('vision.horsDeVue');

/** Le banc sur `siege-enceinte`, un assaillant hors de vue et un en vue. */
function siege() {
  const banc = ouvrirLeBanc();
  lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((s) => s.id === 'siege-enceinte')!, idsDeTest));
  const etat = banc.getState() as unknown as Jeu;
  const ennemis = etat.battle!.combatants.filter((c) => c.kind === 'ennemi');
  const cache = ennemis.find((c) => !combattantEnVue(etat, c));
  const vu = ennemis.find((c) => combattantEnVue(etat, c));
  expect(cache, 'un assaillant hors de vue').toBeDefined();
  expect(vu, 'un assaillant en vue').toBeDefined();
  return { banc, cache: cache!, vu: vu! };
}

describe('tombantsNommes — le refus d’un jet de chute masque les identifiants hors de vue', () => {
  /** La chute volontaire que `c` ouvre, sa déclaration due (la forme que pose `CORPS_DU_FRANCHISSEMENT.chute`). */
  const chuteDe = (c: Combatant): PendingFall => ({
    test: testDeRegle('chute', 'tenter'), to: { ...c.pos! }, metres: 3, initiateurId: c.id,
    participants: [{ id: c.id, interactive: true, attempt: null, result: null }],
  });

  it('hors de vue : « Inconnu »', () => {
    const { banc, cache } = siege();
    const refus = refusDesDeclarationsDues(banc.getState() as unknown as Jeu, chuteDe(cache));
    expect(refus).toBe(t('fall.refus.declarationsDues', { tombants: INCONNU }));
    expect(refus).not.toContain(cache.id);
  });

  it('en vue : son nom', () => {
    const { banc, vu } = siege();
    expect(refusDesDeclarationsDues(banc.getState() as unknown as Jeu, chuteDe(vu))).toBe(t('fall.refus.declarationsDues', { tombants: `${fixtureText(vu.label)} (${vu.id})` }));
  });
});
