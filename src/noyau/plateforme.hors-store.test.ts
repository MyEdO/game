/**
 * Le noyau sans hôte (#2817 D6, D7) : aucun store dans ce graphe de modules, donc ni plateforme posée ni
 * jeu branché. La plateforme web se prouve à `src/state/plateforme-web.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from '../engine/types';
import type { Jeu } from './etat';
import { enAttente, persisterLeHeros, programmer, retirerLaPlateforme, type Jeton } from './plateforme';
import { brancherLeJeu, debrancherLeJeu, jeuBranche } from './branchement';
import { tablesDuJeu } from './tablesDuJeu';
import { tablesPosees } from './tablesPosees';

describe('plateforme du noyau, sans hôte', () => {
  it('tout appel sans plateforme posée lève', () => {
    expect(() => programmer(() => {}, 0)).toThrow(/Plateforme absente/);
    expect(() => enAttente({} as Jeton)).toThrow(/Plateforme absente/);
    expect(() => persisterLeHeros({ id: 'h' } as Combatant)).toThrow(/Plateforme absente/);
    expect(() => retirerLaPlateforme()).toThrow(/Plateforme absente/);
  });
});

describe('brancherLeJeu — une pose par propriétaire', () => {
  it('une seconde pose sans retrait LÈVE, et le premier branchement reste en place', () => {
    const premier = { get: () => ({}) as Jeu, set: () => {} };
    const second = { get: () => ({}) as Jeu, set: () => {} };
    brancherLeJeu(premier.get, premier.set, tablesDuJeu());
    try {
      expect(() => brancherLeJeu(second.get, second.set, tablesDuJeu())).toThrow(/déjà branché/);
      expect(jeuBranche()).toEqual(premier);
      expect(tablesPosees()).toBe(tablesDuJeu());
    } finally {
      debrancherLeJeu();
    }
    expect(jeuBranche()).toBeNull();
  });
});
