/** Le canal d'un son (#3949) : une musique de fond joue sur `musique`, un autre son sur son `canal`, `effets` sans lui ;
 *  `sonDEffet` le porte à l'hôte. */
import { describe, it, expect } from 'vitest';
import { canalDuSon, sonDEffet } from './registre';
import type { SoundDef } from './types';

const son = (over: Partial<SoundDef>): SoundDef => ({ id: 'son-de-test', label: 'Son de test', files: ['test.ogg'], ...over });

describe('canalDuSon', () => {
  it('une musique de fond joue sur `musique`, un son sur son canal, `effets` par défaut', () => {
    expect(canalDuSon(son({ music: { contexts: ['combat'] } }))).toBe('musique');
    expect(canalDuSon(son({ canal: 'ambiance' }))).toBe('ambiance');
    expect(canalDuSon(son({}))).toBe('effets');
  });

  it('`sonDEffet` porte le canal de sa def', () => {
    expect(sonDEffet('musique-combat')?.canal).toBe('musique');
    expect(sonDEffet('pluie')?.canal).toBe('ambiance');
    expect(sonDEffet('impact')?.canal).toBe('effets');
  });
});
