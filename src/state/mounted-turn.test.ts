/**
 * Combat monté (LDB 14 l.182) — « Une monture SANS le Trait Nerveux est un autre combattant à part
 * entière, et peut effectuer sa propre Action ; une monture POSSÉDANT le Trait Nerveux ne peut pas mener
 * sa propre Action d'attaque. » Donc une monture Nerveux CHEVAUCHÉE n'a pas de tour d'initiative propre
 * (elle disparaît de `battle.order` tant qu'elle est montée) ; à la descente elle le retrouve. Un destrier
 * (sans Nerveux) garderait son tour — non couvert ici (comportement inchangé).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { testScene } from '../scenes/test-fixture';

function setup() {
  const hero = makePregens()[0];
  hero.pos = { x: 5, y: 5 };
  hero.initiative = 50;
  const horse = spawnEnemy({ ref: 'cheval' }, 'horse', { x: 6, y: 5 });
  horse.traits = [{ id: 'nerveux' }, { id: 'taille', arg: 'Grande' }] as never; // Cheval ordinaire : Trait Nerveux, Taille Grande
  horse.size = 'grande';
  horse.mountable = true;
  horse.kind = 'hero'; // monture ALLIÉE (on n'enfourche que sa propre équipe)
  horse.initiative = 30;
  const other = spawnEnemy({ ref: 'brigand' }, 'other', { x: 1, y: 1 });
  other.initiative = 40;
  const battle = {
    combatants: [hero, horse, other], order: [hero.id, 'other', 'horse'], baseOrder: [hero.id, 'other', 'horse'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  useGame.setState({ battle, scene: testScene, party: [] });
  return { hero, horse, other };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [] });
  useGame.getState().seedRng(1);
});

describe('monture Nerveux chevauchée = pas de tour propre', () => {
  it('enfourcher un Cheval (Nerveux) le retire de l’ordre d’initiative', () => {
    const { hero } = setup();
    useGame.getState().battleMount();
    const b = useGame.getState().battle!;
    expect(hero.mountId).toBe('horse'); // appairage effectué
    expect(b.order).not.toContain('horse'); // la monture Nerveux quitte l'ordre
    expect(b.order[b.turn]).toBe(hero.id); // le cavalier reste l'actif (pointeur préservé)
  });

  it('descendre réintègre la monture dans l’ordre', () => {
    const { hero } = setup();
    useGame.getState().battleMount();
    // Le mouvement vient d'être dépensé par l'enfourchement → le remettre à 0 pour autoriser la descente.
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 0 } });
    useGame.getState().battleDismount();
    const b = useGame.getState().battle!;
    expect(hero.mountId).toBeFalsy();
    expect(b.order).toContain('horse');
    expect(b.order[b.turn]).toBe(hero.id);
  });
});
