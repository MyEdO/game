import { describe, it, expect } from 'vitest';
import { transitionDuJeu } from './transitionDuJeu';
import { etatInitialDuJeu, type EtatDeJeu } from './etat';
import { emptyScene, type Scene } from './monde/scene';
import { assignSeat } from './monde/seating';
import type { Combatant } from '../engine/types';

/** Transition du jeu (#2817 D7) : la chaise suit le corps, observée sur l'état avant/après. */
const hero = (id: string): Combatant =>
  ({ id, label: id.toUpperCase(), kind: 'hero', xp: 0, wounds: { current: 12, max: 12 }, conditions: [], movement: 4 }) as unknown as Combatant;

const ALDO = hero('aldo');
const BRUNA = hero('bruna');
const CORA = hero('cora');

/** La taverne : une table ronde, les rangs 1 et 2 du groupe assis (place-1, place-2). */
function taverneAttablee(): Scene {
  let sc: Scene = emptyScene(12, 12);
  sc.id = 'taverne';
  sc.entities.push({ id: 'table-1', kind: 'prop', pos: { x: 5, y: 5 }, ref: 'table-ronde-4-tabourets', facing: 'N', usable: { assise: true } });
  for (const rang of [1, 2]) {
    const r = assignSeat(sc, 'table-1', `place-${rang}`, { kind: 'party', rang }, 2);
    if (!r.ok) throw new Error(`assignSeat refusé (rang ${rang}) : ${r.reason}`);
    sc = r.scene;
  }
  return sc;
}

const rangsAssis = (sc: Scene | null) =>
  Object.values(sc?.seatAssignments ?? {}).flatMap((m) => Object.values(m)).flatMap((o) => (o.kind === 'party' ? [o.rang] : [])).sort();

function etatAttable(): EtatDeJeu {
  return { ...etatInitialDuJeu(), party: [ALDO, BRUNA], scene: taverneAttablee() };
}

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
