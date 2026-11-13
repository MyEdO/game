/**
 * L'INTENTION DU CLIC VOYAGE AVEC LE GESTE (#1411, P0-A) — liaison web : le commit clavier
 * (`combatCursor.commitCursor`) passe par les actions de store, que `transmettreLesIntentions` (`noyau/reseau.ts`)
 * remplace chez l'invité. La règle (ré-entrée, intention jointe aux args et jugée, refus local) se joue au banc
 * du noyau, `src/noyau/geste-arme-voyage.hors-store.test.ts`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

const get = () => useGame.getState();

/** Combat témoin : un héros au tour ENTIER, un ennemi placé à distance de Charge (hors d'Allonge). */
function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  get().lancerLaScene(testScene());
  get().lancerLeCombat('enc-mutants');
  get().fenetreValider('debutDuRound');
  vi.clearAllTimers();
  const b = get().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const E = b.combatants.find((c) => c.kind === 'ennemi')!;
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id)) e.pos = { x: 25 + i++, y: 25 };
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 13, y: 10 }; // distance 3 : hors d'Allonge, dans la portée de Charge (2×M)
  const turn = b.order.indexOf(H.id);
  useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false, preview: null }, localIntent: null, refus: null });
  return { H, E };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllTimers();
  useGame.setState({ battle: null, pendingApproach: null, pendingAttack: null, localIntent: null, refus: null });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('(B) COOP — l’intention part de l’ÉMETTEUR dans les args', () => {
  it('CLAVIER : `commitCursor` commet par l’ACTION DE STORE — donc par le wrapper d’invité', () => {
    const { E } = setup();
    // L'invité n'émet ses gestes que parce que `transmettreLesIntentions` (`noyau/reseau.ts`) REMPLACE les actions de
    // l'allowlist DANS le store. Un commit clavier qui appellerait le chemin interne au lieu de
    // `get().cliquerLaCase` sortirait du réseau sans un bruit : chez l'invité, le clavier ne jouerait
    // plus. On installe le substitut par le MÊME moyen que le wrapper (`useGame.setState`).
    const originales = { cliquerLaCase: get().cliquerLaCase };
    const emis: { action: string; args: unknown[] }[] = [];
    useGame.setState({
      cliquerLaCase: (...args: unknown[]) => { emis.push({ action: 'cliquerLaCase', args }); },
    } as never);
    try {
      useGame.setState({ combatCursor: { tile: { ...E.pos! }, snappedId: E.id } } as never);
      get().commitCursor();
      useGame.setState({ combatCursor: { tile: { x: 11, y: 10 } } } as never);
      get().commitCursor();
    } finally {
      useGame.setState(originales as never);
      useGame.setState({ combatCursor: null } as never);
    }
    expect(emis, 'le commit clavier a court-circuité les actions de store (invisible au réseau)').toEqual([
      { action: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] },
      { action: 'cliquerLaCase', args: [{ x: 11, y: 10 }, undefined, { confirm: true }] },
    ]);
  });
});
