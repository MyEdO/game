/**
 * LE BANC DU NOYAU (#3058, `banc.testkit.ts`) : il s'ouvre et se ferme par test, avant comme après une fixture de
 * tables (`avecLesTables`) ; ses gestes d'horloge rejouent les jetons de la plateforme (`programmer`) comme les
 * minuteurs factices de Vitest ; son propriétaire planifie le tick automatique à chaque écriture ; la barrière de
 * partage du setup (`src/test-setup-noyau.ts`) juge son état.
 */
import { describe, expect, it, onTestFinished } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { avecLesTables } from './noyau.testkit';
import { enAttente, programmer } from './plateforme';
import { jeuBranche } from './branchement';
import { makePregens } from '../data/pregens';
import { trappings } from '../data';
import type { ItemInstance } from '../engine/types';

/** Programme `nom` après `delai` ms, inscrit à `journal` à sa reprise, avec ses `suites` programmées à leur tour. */
function planifier(journal: string[], nom: string, delai: number, suites: [string, number][] = []) {
  return programmer(() => {
    journal.push(nom);
    for (const [s, d] of suites) planifier(journal, s, d);
  }, delai);
}

describe('banc du noyau : ouverture et fermeture', () => {
  it('ouvre le jeu sur son propriétaire, l’écrit et l’abonne comme zustand', () => {
    const banc = ouvrirLeBanc({ etat: { screen: 'party' } });
    expect(jeuBranche()?.get).toBe(banc.getState);
    const vus: [string, string][] = [];
    banc.subscribe((etat, prev) => vus.push([prev.screen, etat.screen]));
    banc.setState({ screen: 'test' });
    banc.setState((s) => ({ screen: s.screen === 'test' ? 'menu' : 'party' }));
    expect([banc.getState().screen, vus]).toEqual(['menu', [['party', 'test'], ['test', 'menu']]]);
    expect(banc.getState().startScene).toBe(banc.actions.startScene);
  });

  it('une écriture faite PENDANT un updater survit à son patch, comme sous zustand', () => {
    const banc = ouvrirLeBanc({ etat: { screen: 'party', flags: {} } });
    const vus: [string, string][] = [];
    banc.subscribe((etat, prev) => vus.push([prev.screen, etat.screen]));
    banc.setState((s) => {
      banc.setState({ screen: 'test' });
      return { flags: { ...s.flags, vu: true } };
    });
    expect([banc.getState().screen, banc.getState().flags, vus]).toEqual(['test', { vu: true }, [['party', 'test'], ['test', 'test']]]);
  });

  it('un updater qui rend l’état REÇU après une écriture imbriquée la recouvre, comme sous zustand', () => {
    const banc = ouvrirLeBanc({ etat: { screen: 'party' } });
    const vus: [string, string][] = [];
    banc.subscribe((etat, prev) => vus.push([prev.screen, etat.screen]));
    banc.setState((s) => {
      banc.setState({ screen: 'test' });
      return s;
    });
    expect([banc.getState().screen, vus]).toEqual(['party', [['party', 'test'], ['test', 'party']]]);
  });

  it('une fixture de tables posée après l’ouverture est restaurée avant la fermeture', () => {
    const banc = ouvrirLeBanc();
    avecLesTables({});
    expect([jeuBranche()?.get, banc.getState().screen]).toEqual([banc.getState, 'menu']);
  });

  it('l’ouverture suivante réussit : le test précédent a fermé son banc', () => {
    expect(jeuBranche()).toBeNull();
    expect(() => ouvrirLeBanc()).not.toThrow();
  });
});

describe('banc du noyau : les gestes de l’horloge, ceux des minuteurs factices de Vitest', () => {
  it('`avancer(ms)` reprend chaque échéance au plus `ms`, celles programmées dans la fenêtre comprises', () => {
    const banc = ouvrirLeBanc();
    const journal: string[] = [];
    planifier(journal, 'a', 100, [['a1', 50], ['a2', 200]]);
    planifier(journal, 'b', 150);
    planifier(journal, 'c', 300);
    expect(banc.avancer(150)).toBe(3);
    expect(journal).toEqual(['a', 'b', 'a1']);
    expect(banc.avancer(150)).toBe(2);
    expect(journal).toEqual(['a', 'b', 'a1', 'c', 'a2']);
    expect(banc.enAttente()).toBe(0);
  });

  it('`avancer(ms)` : un délai nul programmé pendant le geste échoit une milliseconde plus tard', () => {
    const banc = ouvrirLeBanc();
    const journal: string[] = [];
    programmer(() => {
      journal.push('T');
      planifier(journal, 'T1', 0, [['T2', 0]]);
    }, 0);
    expect(banc.avancer(1)).toBe(2);
    expect([journal, banc.enAttente()]).toEqual([['T', 'T1'], 1]);
  });

  it('`reprendreLesEnAttente()` avance jusqu’à la dernière échéance présente, celles programmées avant elle comprises', () => {
    const banc = ouvrirLeBanc();
    const journal: string[] = [];
    planifier(journal, 'A', 10, [['X', 5]]);
    planifier(journal, 'B', 20);
    expect(banc.reprendreLesEnAttente()).toBe(3);
    expect([journal, banc.enAttente()]).toEqual([['A', 'X', 'B'], 0]);
  });

  it('`reprendreLesEnAttente()` laisse ce que les reprises programment après la dernière échéance présente', () => {
    const banc = ouvrirLeBanc();
    const journal: string[] = [];
    planifier(journal, 'a', 500, [['a1', 0]]);
    planifier(journal, 'b', 10);
    expect(banc.reprendreLesEnAttente()).toBe(2);
    expect([journal, banc.enAttente()]).toEqual([['b', 'a'], 1]);
  });

  it('`jusquALaProchaine()` reprend toute la prochaine échéance, ex æquo compris', () => {
    const banc = ouvrirLeBanc();
    const journal: string[] = [];
    const tard = planifier(journal, 'tard', 40);
    planifier(journal, 'tot', 40);
    planifier(journal, 'premier', 5);
    expect(banc.jusquALaProchaine()).toBe(1);
    expect(journal).toEqual(['premier']);
    expect(banc.jusquALaProchaine()).toBe(2);
    expect([journal, enAttente(tard), banc.enAttente()]).toEqual([['premier', 'tard', 'tot'], false, 0]);
  });

  it('`abandonner()` retire chaque jeton sans le reprendre, à l’horloge et à la plateforme', () => {
    const banc = ouvrirLeBanc();
    const journal: string[] = [];
    const jeton = planifier(journal, 'a', 10);
    planifier(journal, 'b', 0);
    banc.abandonner();
    expect([banc.enAttente(), enAttente(jeton), banc.avancer(100), journal]).toEqual([0, false, 0, []]);
    planifier(journal, 'c', 5);
    expect([banc.avancer(5), journal]).toEqual([1, ['c']]);
  });
});

describe('banc du noyau : tick automatique', () => {
  it('cadence auto : toute écriture planifie le tick, sans `initCombatAuto`', () => {
    const auto = ouvrirLeBanc({ cadence: 'auto' });
    auto.setState({ screen: 'party' });
    expect(auto.enAttente()).toBe(1);
  });

  it('cadence manuelle : une écriture ne planifie rien', () => {
    const manuel = ouvrirLeBanc();
    manuel.setState({ screen: 'party' });
    expect(manuel.enAttente()).toBe(0);
  });
});

describe('banc du noyau : la barrière de partage (#2097) du setup de la suite', () => {
  let erreurs: string[] = [];

  it.fails('un banc dont l’état partage une donnée du catalogue fait échouer le test qui l’a posée', () => {
    const [heros] = makePregens();
    const banc = ouvrirLeBanc();
    banc.setState({ party: [{ ...heros, items: [trappings[0] as unknown as ItemInstance] }] });
    onTestFinished(({ task }) => {
      erreurs = (task.result?.errors ?? []).map((e) => String(e.message));
    });
  });

  it('l’échec est celui de la barrière, qui nomme le chemin partagé', () => {
    expect(erreurs.some((m) => m.includes('PARTAGÉ avec une donnée') && m.includes('party.0.items.0')), erreurs.join('\n')).toBe(true);
  });
});
