import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { emptyScene } from '../noyau/monde/scene';
import { advanceTurn, etatDeTourNeuf } from './combatFlow';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';

/**
 * Un Tour qui commence remet à neuf l'état de Tour de la bataille par UNE source (`etatDeTourNeuf`) :
 * rien de ce que le combattant précédent a armé ou parcouru ne survit dans le Tour du suivant.
 */
const g = () => useGame.getState();

/** `BA` : B ouvre le Round, A le ferme (E, hors de l'ordre, garde le combat ouvert). */
function deuxHeros(ordre: 'AB' | 'BA' = 'AB', turn = 0): { A: Combatant; B: Combatant } {
  const A = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
  const B = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
  A.pos = { x: 2, y: 2 };
  B.pos = { x: 2, y: 8 };
  const E = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'E', seed: 3 }), kind: 'enemy', pos: { x: 18, y: 18 } } as Combatant;
  const battle: BattleState = {
    combatants: [A, B, E], order: ordre === 'AB' ? [A.id, B.id, E.id] : [B.id, A.id], turn, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  };
  useGame.setState({ party: [A, B], mode: 'battle', battle, scene: emptyScene(20, 20), pendingRoundStart: null });
  return { A, B };
}

describe('Tour neuf — `etatDeTourNeuf`, source unique du début de Tour', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null, party: [], pendingRun: null, pendingRoundStart: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('`advanceTurn` : le sort et l’attaque armés par le précédent ne passent pas au suivant', () => {
    deuxHeros();
    useGame.setState({ battle: { ...g().battle!, action: 'cast', selectedSpellId: 'fleche-magique', selectedAttack: 'feinte' } });
    advanceTurn(g, useGame.setState);
    const b = g().battle!;
    expect(b.selectedSpellId).toBeNull();
    expect(b.selectedAttack).toBeUndefined();
  });

  it('`advanceTurn` : le suivant qui a perdu son Mouvement n’annule pas le déplacement du précédent', () => {
    const { A, B } = deuxHeros();
    const depart = { ...A.pos! };
    g().battleClickTile({ x: depart.x + 2, y: depart.y }, { confirm: true });
    const arrivee = { ...g().battle!.combatants.find((c) => c.id === A.id)!.pos! };
    expect(arrivee).not.toEqual(depart);
    g().battle!.combatants.find((c) => c.id === B.id)!.loseNextMovement = true;
    advanceTurn(g, useGame.setState);
    expect(g().battle!.moveSnapshot ?? null, 'l’instantané du Tour de A ne survit pas').toBeNull();
    g().cancelMove();
    expect(g().battle!.combatants.find((c) => c.id === A.id)!.pos).toEqual(arrivee);
  });

  it('franchissement de Round : ni la pause ni le premier Tour du Round n’héritent du sort armé ni du déplacement du dernier', () => {
    const { A, B } = deuxHeros('BA', 1);
    const de = (id: string) => g().battle!.combatants.find((c) => c.id === id)!;
    const depart = { ...de(A.id).pos! };
    g().battleClickTile({ x: depart.x + 2, y: depart.y }, { confirm: true });
    const arrivee = { ...de(A.id).pos! };
    expect(arrivee).not.toEqual(depart);
    useGame.setState({ battle: { ...g().battle!, selectedSpellId: 'fleche-magique' } });
    de(B.id).loseNextMovement = true;
    advanceTurn(g, useGame.setState);
    expect(g().pendingRoundStart, 'le Round se franchit par sa pause').toBeTruthy();
    expect(g().battle!.selectedSpellId, 'pause').toBeNull();
    expect(g().battle!.moveSnapshot ?? null, 'pause').toBeNull();
    g().confirmRoundStart();
    const b = g().battle!;
    expect(b.round).toBe(2);
    expect(b.order[b.turn]).toBe(B.id);
    expect(b.movementUsed, 'B a perdu son Mouvement').toBeGreaterThan(0);
    expect(b.selectedSpellId).toBeNull();
    expect(b.moveSnapshot ?? null).toBeNull();
    g().cancelMove();
    expect(de(A.id).pos).toEqual(arrivee);
  });

  it('pause de début de Round : aucun geste du joueur n’y écrit l’état de Tour (personne n’est actif), le premier Tour l’ouvre à neuf', () => {
    const { A } = deuxHeros('BA', 1);
    advanceTurn(g, useGame.setState);
    expect(g().pendingRoundStart, 'la pause').toBeTruthy();
    const pause = g().battle!;
    // Les écrivains de l'état de Tour (`battleSelectAttack`, `battleClickTile` → aperçu/déplacement) exigent
    // un combattant ACTIF : sous la pause (aucun), ils ne posent rien — la remise à neuf d'`ouvrirLeRound`
    // part donc d'un état déjà neuf.
    g().battleSelectAttack('feinte');
    g().battleClickTile({ x: A.pos!.x + 2, y: A.pos!.y });
    g().battleClickTile({ x: A.pos!.x + 2, y: A.pos!.y }, { confirm: true });
    expect(g().battle, 'aucun geste n’a réécrit la bataille sous la pause').toBe(pause);
    g().confirmRoundStart();
    const b = g().battle!;
    expect({ selectedAttack: b.selectedAttack, preview: b.preview, action: b.action, moveSnapshot: b.moveSnapshot ?? null })
      .toEqual({ selectedAttack: undefined, preview: null, action: null, moveSnapshot: null });
  });

  it('la remise à neuf est une valeur neuve à chaque appel', () => {
    expect(etatDeTourNeuf().reachable).not.toBe(etatDeTourNeuf().reachable);
    expect(etatDeTourNeuf().stances).not.toBe(etatDeTourNeuf().stances);
  });
});
