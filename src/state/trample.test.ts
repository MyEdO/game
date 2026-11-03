import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { availableAttacks } from '../noyau/combatManeuvers';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

// ---------------------------------------------------------------------------
// Piétinement (LDB 85 l.387 ; LDB 13 l.123), côté web : le chemin du joueur au clavier, curseur de combat
// (`snapCursorToTarget`, `commitCursor`). Le reste se joue au banc du noyau (`src/noyau/trample.hors-store.test.ts`).
// ---------------------------------------------------------------------------

describe('Piétinement en combat (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    E.wounds = blessuresDeBase(30, 30, E);
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, movementUsed: 0, acted: false } });
    return { H, E };
  }

  const advDe = (id: string): number => useGame.getState().battle!.combatants.find((c) => c.id === id)!.advantage;

  /** Le CHEMIN DU JOUEUR au clavier : l'option armée, Tab aimante la cible, Entrée commet. */
  const pietinerAuClavier = (): void => {
    useGame.getState().battleSelectAttack('pietinement');
    useGame.getState().snapCursorToTarget(1);
    useGame.getState().commitCursor();
    vi.runAllTimers();
  };

  // LDB 85 l.387 ; LDB 13 l.123. La cible se tient au bord de l'empreinte Énorme (`sizes.json` footprintSide).
  it('héros Énorme : Tab puis Entrée déclarent le Piétinement — jet opposé, option consommée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'enorme';
    H.advantage = 3;
    E.pos = { x: 13, y: 10 };
    pietinerAuClavier();
    const pa = useGame.getState().pendingAttack;
    expect(pa?.freeKind, 'Entrée ouvre le jet du Piétinement').toBe('pietinement');
    expect(useGame.getState().pendingCascade, 'la modale s’ouvre').toBeTruthy();
    useGame.getState().attackRoll();
    expect(useGame.getState().pendingAttack!.result!.defenderDetail, 'la cible oppose sa défense').toBeDefined();
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.pietinement).toBe(1);
    expect(availableAttacks(h, useGame.getState().battle!).some((o) => o.id === 'pietinement'), 'l’option disparaît').toBe(false);
  });

  it('héros Énorme : Annuler avant le jet rend l’Avantage et l’option', () => {
    const { H, E } = setup();
    H.size = 'enorme';
    H.advantage = 3;
    E.pos = { x: 13, y: 10 };
    pietinerAuClavier();
    expect(advDe(H.id), 'le coût est débité au commit').toBe(2);
    useGame.getState().attackCancel();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.advantage).toBe(3);
    expect(availableAttacks(h, useGame.getState().battle!).some((o) => o.id === 'pietinement')).toBe(true);
  });
});
