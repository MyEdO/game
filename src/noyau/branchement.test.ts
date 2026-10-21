/**
 * `brancherLeJeu` pose les tables et les crochets du noyau UNE fois par propriétaire (#2889, D7) ; la
 * seconde pose qui lève se prouve sans hôte, à `plateforme.hors-store.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { useGame } from '../state/store';
import { jeuBranche } from './branchement';
import { tablesDuJeu } from './tablesDuJeu';
import { tablesPosees } from './tablesPosees';

describe('brancherLeJeu — une pose par propriétaire', () => {
  it('le store branche le jeu à sa création, sur ses propres get/set et les tables du jeu', () => {
    expect(jeuBranche()).toEqual({ get: useGame.getState, set: useGame.setState });
    expect(tablesPosees()).toBe(tablesDuJeu());
  });
});
