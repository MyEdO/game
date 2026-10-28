// @vitest-environment jsdom
/**
 * #1765 — le bouton de la modale de MANŒUVRE dit ce qu'il fait : face à un défenseur SURFACÉ, rien
 * n'est appliqué, sa défense s'ouvre en cascade (`maneuverDefense`) — « Passer à la Défense » ;
 * sinon l'opposition se résout et s'applique — « Appliquer ». Le prédicat est celui de la résolution
 * (`maneuverDefensePending`, partagé avec `resolveManeuver`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { ManeuverModal } from './ManeuverModal';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Un héros au Souffle (Feu) déclare sa manœuvre sur le seul ennemi debout et lance son jet. */
function souffleLance(gmSeat: number | undefined): Combatant {
  useGame.getState().seedRng(2);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene());
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  useGame.setState({ net: { ...useGame.getState().net, gmSeat } });
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies[0];
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 11, y: 10 };
  E.wounds = { current: 30, max: 30, base: 30 } as Combatant['wounds'];
  E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
  H.traits = [{ id: 'souffle', value: 15, arg: 'feu' }] as Combatant['traits'];
  H.characteristics['capacite-de-tir'] = 90;
  H.advantage = 3;
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), movementUsed: 0, acted: false } });
  useGame.getState().battleSelectAttack('souffle');
  useGame.getState().battleClickEntity(E.id);
  useGame.getState().maneuverRoll();
  return E;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllTimers();
  useGame.setState({ battle: null, pendingManeuver: null, pendingCascade: null });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  useGame.setState({ battle: null, pendingManeuver: null, pendingCascade: null, party: [] });
});

const bouton = (libelle: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === libelle);

describe('Modale de manœuvre : le bouton suit le défenseur surfacé', () => {
  it('défenseur tenu par le siège MJ : « Passer à la Défense », aucune Blessure, la défense s’ouvre', () => {
    const E = souffleLance(0);
    act(() => root.render(<ManeuverModal />));
    expect(bouton('Appliquer'), 'le bouton ne promet pas une application').toBeUndefined();
    const passer = bouton(t('defense.passerLaMain'));
    expect(passer).toBeTruthy();
    act(() => passer!.click());
    const c = useGame.getState().pendingCascade;
    expect(c?.participants[c.cursor]?.kind, 'la défense du défenseur surfacé tient la main').toBe('maneuverDefense');
    expect(useGame.getState().battle!.combatants.find((x) => x.id === E.id)!.wounds.current, 'rien n’est appliqué').toBe(30);
  });

  it('défenseur conduit par l’IA : « Appliquer », l’opposition s’applique', () => {
    const E = souffleLance(undefined);
    act(() => root.render(<ManeuverModal />));
    expect(bouton(t('defense.passerLaMain'))).toBeUndefined();
    const appliquer = bouton('Appliquer');
    expect(appliquer).toBeTruthy();
    act(() => appliquer!.click());
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'maneuverDefense') ?? false).toBe(false);
    expect(useGame.getState().battle!.combatants.find((x) => x.id === E.id)!.wounds.current, 'le Souffle a porté').toBeLessThan(30);
  });
});
