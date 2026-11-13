/**
 * LA LIGNE DE TRACE NE NOMME PAS UN COMBATTANT HORS DE VUE (#4017) : `TraceRow.who` et `TraceSide.who` s'écrivent par
 * `nomDe`, comme `OpposedFreeze.attackerName` ; l'issue d'une Approche nomme sa source par `nomEnVue`, celle d'un jet (`describeReload`…) son acteur, celle d'une Peur surmontée sa source. `siege-enceinte` pose au départ des assaillants que la muraille cache au groupe, d'autres qu'il voit.
 */
import { describe, expect, it } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { lancerLeScenario } from './lancementDeScenario';
import { combattantEnVue } from './visionDuGroupe';
import { resolveActGates } from './combat/turnHooks';
import { resolveFlowTest } from './combat/triggeredTest';
import { jetsEnVue } from './jetsEnVue';
import { appliquerLaRecharge, jetDeRecharge, openRoundEndCascade } from './combatFlow';
import { draineEtLit } from './cascade.testkit';
import { testDeRegle } from '../engine/reglesChiffrees';
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

describe('OpposedFreeze.attackerName — la ligne du jet figé d’un Test opposé en fenêtre', () => {
  /** Les libellés des lignes de jet de la fenêtre ouverte quand `attaquant` oppose sa Force à un héros. */
  function lignesDeLaFenetre(attaquant: 'cache' | 'vu'): { tests: string[]; nom: string } {
    const s = siege();
    const etat = s.banc.getState() as unknown as Jeu;
    const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
    const noeud = { kind: 'test', test: { characteristic: 'force', opposed: { attacker: 'force' }, stake: { key: { dataset: 'combat', kind: 'mutation' } } }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW } as Extract<Flow, { kind: 'test' }>;
    resolveFlowTest({ get: s.banc.getState, set: s.banc.setState, target: heros, caster: s[attaquant], label: 'Test opposé' }, noeud, EMPTY_FLOW);
    const tests = jetsEnVue(s.banc.getState() as unknown as Jeu).flatMap((j) => j.lignes).flatMap((l) => (l.genre === 'test' ? [l.test] : []));
    return { tests, nom: s[attaquant].label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { tests, nom } = lignesDeLaFenetre('cache');
    expect(tests.some((l) => l.startsWith(`${INCONNU} — `)), tests.join('\n')).toBe(true);
    expect(tests.some((l) => l.includes(nom)), tests.join('\n')).toBe(false);
  });

  it('en vue : son nom', () => {
    const { tests, nom } = lignesDeLaFenetre('vu');
    expect(tests.some((l) => l.startsWith(`${nom} — `)), tests.join('\n')).toBe(true);
  });
});

describe('PendingApproach — l’issue d’une Approche nomme sa source par `nomEnVue`', () => {
  /** La ligne de journal de l'Approche ratée d'un héros vers `source`. */
  function ligneDeLApproche(source: 'cache' | 'vu'): { ligne: string; nom: string } {
    const s = siege();
    const etat = s.banc.getState() as unknown as Jeu;
    const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
    s.banc.setState({ pendingApproach: { combatantId: heros.id, test: testDeRegle('calme-d-approche', 'se-rapprocher'), sourceId: s[source].id, intent: { kind: 'tile', pt: { x: 0, y: 0 } }, result: { success: false, roll: 95, target: 30, sl: -6 } } });
    s.banc.getState().jetValider('approche');
    const log = (s.banc.getState() as unknown as Jeu).battle!.log;
    return { ligne: log[log.length - 1].text, nom: s[source].label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { ligne, nom } = ligneDeLApproche('cache');
    expect(ligne.includes(INCONNU), ligne).toBe(true);
    expect(ligne.includes(nom), ligne).toBe(false);
  });

  it('en vue : son nom', () => {
    const { ligne, nom } = ligneDeLApproche('vu');
    expect(ligne.includes(nom), ligne).toBe(true);
  });
});

describe('actorName — l’issue d’un jet nomme son acteur par `nomEnVue`', () => {
  /** La ligne de journal du Rechargement inachevé, par `qui`, d'une arme d'assaillant (`appliquerLaRecharge`, le tour de l'IA). */
  function ligneDeRecharge(qui: 'cache' | 'vu'): { ligne: string; nom: string } {
    const s = siege();
    const c = s[qui];
    const arme = [s.cache, s.vu].flatMap((x) => x.weapons)[0]; // l'assaillant en vue peut n'en porter aucune
    const pr = { ...jetDeRecharge(c, arme, (s.banc.getState() as unknown as Jeu).battle!.combatants), reload: 3, roll: 40, sl: 1, success: true };
    appliquerLaRecharge(s.banc.getState, s.banc.setState, pr, arme);
    const log = (s.banc.getState() as unknown as Jeu).battle!.log;
    return { ligne: log[log.length - 1].text, nom: c.label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { ligne, nom } = ligneDeRecharge('cache');
    expect(ligne.includes(INCONNU), ligne).toBe(true);
    expect(ligne.includes(nom), ligne).toBe(false);
  });

  it('en vue : son nom', () => {
    const { ligne, nom } = ligneDeRecharge('vu');
    expect(ligne.includes(nom), ligne).toBe(true);
  });
});

describe('sourceName de la psychologie — la Peur surmontée nomme sa source par `nomDe`', () => {
  /** La ligne de journal de la Peur de `source` qu'un héros surmonte au Test étendu de fin de Round (LDB 21 l.25). */
  function ligneDeLaPeur(source: 'cache' | 'vu'): { lignes: string[]; nom: string } {
    const s = siege();
    const etat = s.banc.getState() as unknown as Jeu;
    const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
    heros.characteristics['force-mentale'] = 200; // le Test de Calme réussit, la Peur d'Indice 1 tombe
    heros.psychState = [{ type: 'peur', sourceId: s[source].id, indice: 1, calmeDR: 0 }];
    s.banc.setState({ battle: { ...etat.battle!, round: etat.battle!.round + 1 }, pendingCascade: null });
    openRoundEndCascade(s.banc.getState, s.banc.setState);
    const lues = draineEtLit(s.banc.getState);
    return { lignes: lues.filter((l) => l.includes(heros.label)), nom: s[source].label };
  }

  it('hors de vue : « Inconnu »', () => {
    const { lignes, nom } = ligneDeLaPeur('cache');
    expect(lignes.some((l) => l.includes(INCONNU)), lignes.join('\n')).toBe(true);
    expect(lignes.some((l) => l.includes(nom)), lignes.join('\n')).toBe(false);
  });

  it('en vue : son nom', () => {
    const { lignes, nom } = ligneDeLaPeur('vu');
    expect(lignes.some((l) => l.includes(nom)), lignes.join('\n')).toBe(true);
  });
});
