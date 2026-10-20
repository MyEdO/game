/**
 * `brancherLeJeu` pose les tables et les crochets du noyau UNE fois par propriétaire (#2889, D7) : une
 * seconde pose sans `debrancherLeJeu` écraserait le premier propriétaire en silence.
 */
import { describe, it, expect } from 'vitest';
import { useGame } from '../state/store';
import { brancherLeJeu, jeuBranche } from './branchement';
import { tablesDuJeu } from './tablesDuJeu';
import { tablesPosees } from './tablesPosees';

describe('brancherLeJeu — une pose par propriétaire', () => {
  it('le store branche le jeu à sa création, sur ses propres get/set et les tables du jeu', () => {
    expect(jeuBranche()).toEqual({ get: useGame.getState, set: useGame.setState });
    expect(tablesPosees()).toBe(tablesDuJeu());
  });

  it('une seconde pose sans retrait LÈVE, et le premier branchement reste en place', () => {
    const avant = jeuBranche();
    expect(() => brancherLeJeu(useGame.getState, useGame.setState, tablesDuJeu())).toThrow(/déjà branché/);
    expect(jeuBranche()).toBe(avant);
    expect(tablesPosees()).toBe(tablesDuJeu());
  });
});
