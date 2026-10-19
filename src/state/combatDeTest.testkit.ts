/**
 * Un héros à fiche réelle (`createHero`) face au premier ennemi de `enc-mutants`, au combat dans
 * `testScene`, au contact ((10,10)-(11,10)), les autres ennemis hors de combat, le tour au héros.
 * Partagé par les tests de flux de combat sous horloge factice (#2779).
 */
import { vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

export function heroFaceAUnEnnemi(): { H: Combatant; E: Combatant } {
  const g = useGame.getState;
  useGame.setState({ party: [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })] });
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
  H.pos = { x: 10, y: 10 }; E.pos = { x: 11, y: 10 };
  H.engagedWith = []; E.engagedWith = [];
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), acted: false, movementUsed: 0 }, pendingFrenzy: null });
  return { H, E };
}
