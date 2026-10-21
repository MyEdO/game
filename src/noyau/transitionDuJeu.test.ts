import { describe, it, expect } from 'vitest';
import { transitionDuJeu } from './transitionDuJeu';
import { ALDO, BRUNA, CORA, etatAttable, rangsAssis, taverneAttablee } from './taverneAttablee.testkit';

/** Transition du jeu (#2817 D7) : la chaise suit le corps, observée sur l'état avant/après. */
describe('transitionDuJeu — occupation des sièges', () => {
  it('une écriture qui ne touche pas `party` n’appelle rien', () => {
    const prev = etatAttable();
    expect(transitionDuJeu(prev, { ...prev, gameTime: prev.gameTime + 1 })).toBeNull();
  });

  it('une permutation du groupe sous la même occupation lève les deux chaises', () => {
    const prev = etatAttable();
    expect(rangsAssis(prev.scene)).toEqual([1, 2]);
    const ecriture = transitionDuJeu(prev, { ...prev, party: [BRUNA, ALDO] });
    expect(ecriture?.scene, 'la permutation n’a levé aucune chaise').toBeTruthy();
    expect(rangsAssis(ecriture!.scene!)).toEqual([]);
  });

  it('un héros ajouté derrière les rangs assis ne lève rien', () => {
    const prev = etatAttable();
    expect(transitionDuJeu(prev, { ...prev, party: [ALDO, BRUNA, CORA] })).toBeNull();
  });

  it('une occupation NEUVE dans la même écriture porte sa propre vérité : rien à réconcilier', () => {
    const prev = etatAttable();
    expect(transitionDuJeu(prev, { ...prev, party: [BRUNA, ALDO], scene: taverneAttablee() })).toBeNull();
  });

  it('réentrance structurelle : l’écriture de libération ne se rejoue pas', () => {
    const prev = etatAttable();
    const s = { ...prev, party: [BRUNA, ALDO] };
    const apres = { ...s, ...transitionDuJeu(prev, s)! };
    expect(transitionDuJeu(s, apres)).toBeNull();
  });
});
