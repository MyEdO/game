/**
 * LA LIGNE DE TRACE NE NOMME PAS UN COMBATTANT HORS DE VUE (#4017) : `TraceRow.who` et `TraceSide.who` s'écrivent par
 * `nomDe`. `siege-enceinte` pose au départ des assaillants que la muraille cache au groupe, d'autres qu'il voit.
 */
import { describe, expect, it } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { lancerLeScenario } from './lancementDeScenario';
import { combattantEnVue } from './visionDuGroupe';
import { resolveActGates } from './combat/turnHooks';
import { resolveFlowTest } from './combat/triggeredTest';
import { EMPTY_FLOW, type Flow } from '../engine/flowCore';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios/index';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { t } from '../i18n';
import type { Jeu } from './etat';
import type { Combatant } from '../engine/types';

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

/** La ligne du Test d'agir (`resolveActGates`) que `c` jette sous un effet qui l'exige. */
function ligneDuTestDAgir(banc: ReturnType<typeof siege>['banc'], c: Combatant): string {
  c.activeEffects = [{ label: 'Racine de mandragore', bonus: 0, duration: { scale: 'clock', until: 99999 }, testDAgir: { characteristic: 'force-mentale' } }];
  return resolveActGates(banc.getState, banc.setState, c).lines[0];
}

describe('TraceRow.who — la ligne d’un Test jeté sans fenêtre', () => {
  it('hors de vue : « Inconnu »', () => {
    const { banc, cache } = siege();
    const ligne = ligneDuTestDAgir(banc, cache);
    expect(ligne.startsWith(`${INCONNU} `), ligne).toBe(true);
    expect(ligne.includes(cache.label), ligne).toBe(false);
  });

  it('en vue : son nom', () => {
    const { banc, vu } = siege();
    const ligne = ligneDuTestDAgir(banc, vu);
    expect(ligne.startsWith(`${vu.label} `), ligne).toBe(true);
  });
});

describe('TraceSide.who — la ligne d’un Test opposé jeté sans fenêtre', () => {
  it('l’attaquant hors de vue se dit « Inconnu », le défenseur en vue par son nom', () => {
    const { banc, cache, vu } = siege();
    const noeud = { kind: 'test', test: { characteristic: 'force', opposed: { attacker: 'force' } }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW } as Extract<Flow, { kind: 'test' }>;
    resolveFlowTest({ get: banc.getState, set: banc.setState, target: vu, caster: cache, label: 'Test opposé' }, noeud, EMPTY_FLOW);
    const lignes = banc.getState().pendingLogQueue.map((l) => l.line);
    const ligne = lignes.find((l) => l.includes(vu.label));
    expect(ligne, lignes.join('\n')).toBeDefined();
    expect(ligne!.startsWith(`${INCONNU} `), ligne).toBe(true);
    expect(lignes.some((l) => l.includes(cache.label)), lignes.join('\n')).toBe(false);
  });
});
