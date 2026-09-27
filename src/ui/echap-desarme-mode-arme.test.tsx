// @vitest-environment jsdom
/**
 * ÉCHAP DÉSARME UN MODE ARMÉ NU (#1411, recette navigateur du 2026-08-20).
 *
 * Trouvaille : Dissiper armé (aucun curseur, aucune intention, aucun interlude apparié), Échap
 * ouvrait le MENU SYSTÈME et laissait le mode armé — le seul désarmement était le re-clic sur la
 * case. L'échelle d'Échap ne couvrait que `intent-cancel`/`cursor-cancel`/`clear-preview`/
 * `interlude-exit` puis `toggle-menu` : aucun barreau ne touchait `battle.action`.
 *
 * FRONTIÈRE mesurée : les modes à entrée d'interlude (bordée, téléportation) ont DÉJÀ leur sortie
 * déclarée au registre — `interlude-exit` la prend, et rien ne change pour eux. Les armés NUS
 * (Dissiper, Soigner, Incanter, Munition, Poussée) n'en ont aucune : `action-disarm` est la leur.
 *
 * Trois états, trois contrats : mode armé → Échap désarme (menu FERMÉ) ; plus rien d'armé → Échap
 * ouvre le menu ; siège qui ne contrôle pas l'actif → menu direct (pas de vol d'Échap). L'état est
 * un VRAI combat (héros pregen, ennemis spawnés, scène posée) et la touche passe par le hook RÉEL.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { KEYBINDINGS } from '../state/keybindings';
import { initialNet } from '../state/netFlow';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from '../state/spawn';
import { useGameKeyboard } from './useGameKeyboard';
import type { BattleActionMode } from '../state/actionRegistry';
import type { GameState } from '../state/store';

function Harness() {
  useGameKeyboard();
  return null;
}

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

const get = () => useGame.getState();

const arene = () => {
  const w = 16, h = 12;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

/**
 * TABLE À DEUX SIÈGES, état RÉEL : deux héros possédés (un par siège), deux ennemis. `turn` désigne
 * l'acteur actif, `mySeat` le siège de CE client — le couple des deux décide si ce client contrôle
 * l'actif (`controlsActive`), donc si la touche lui appartient.
 */
function table(action: BattleActionMode | null, { turn = 0, mySeat = 0, mode = 'local' as 'local' | 'guest' } = {}) {
  const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 6 };
  const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 6 };
  const e1 = spawnEnemy({ ref: 'capitaine-du-guet' }, 'e1', { x: 7, y: 6 });
  const e2 = spawnEnemy({ ref: 'capitaine-du-guet' }, 'e2', { x: 8, y: 6 });
  useGame.setState({
    screen: 'campaign', mode: 'battle', gameMenuOpen: false, dialogue: null,
    scene: arene(), party: [hero, ally],
    battle: {
      combatants: [hero, ally, e1, e2], order: ['h1', 'h2', 'e1', 'e2'], baseOrder: ['h1', 'h2', 'e1', 'e2'],
      turn, round: 1, action, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, preview: null,
    } as never,
    combatCursor: null, preemptAiming: null, localIntent: null, dispelCarrierId: null,
    pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null,
    pendingSiegeAim: null, pendingDispel: null,
    net: { ...initialNet(), mode, mySeat, ownership: { h1: 0, h2: 1 }, seatNames: { 0: 'Hôte', 1: 'Invité' } },
  } as never);
}

const échap = () => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); });
const relâcher = () => act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' })); });
/** Les barreaux d'Échap qui répondent à CET état, dans l'ordre du registre (le 1ᵉʳ gagne). */
const barreaux = (s: GameState) => KEYBINDINGS.filter((k) => k.codes.includes('Escape') && k.when(s)).map((k) => k.id);

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<Harness />));
});
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
  useGame.setState({ gameMenuOpen: false, battle: null, party: [], net: initialNet() } as never);
});

/** Les modes ARMABLES sans interlude apparié — la liste que la trouvaille de recette désigne. */
const ARMÉS_NUS: BattleActionMode[] = ['dispel', 'heal', 'cast', 'push'];

describe('Échap sur un mode armé NU (#1411)', () => {
  for (const action of ARMÉS_NUS) {
    it(`« ${action} » armé : Échap DÉSARME, et n’ouvre pas le menu système`, () => {
      table(action);
      expect(barreaux(get()), 'un seul barreau doit répondre — et ce n’est pas le menu').toEqual(['action-disarm']);
      échap();
      expect(get().battle!.action, 'le mode est resté armé après Échap').toBeNull();
      expect(get().gameMenuOpen, 'le menu système s’est ouvert par-dessus le mode armé').toBe(false);
    });
  }

  it('un appui NEUF, plus rien d’armé : Échap rend bien le menu système', () => {
    table('dispel');
    échap();
    relâcher();
    expect(get().battle!.action).toBeNull();
    échap();
    expect(get().gameMenuOpen, 'Échap n’atteint plus le menu une fois le mode désarmé').toBe(true);
  });

  it('bordée : rien ne change — sa SORTIE d’interlude garde la touche (aucun doublon)', () => {
    table('battery');
    expect(barreaux(get())).toEqual(['interlude-exit']);
  });

  it('téléportation : sortie qui COMMET (`exitSafe: false`) — Échap ne sélectionne toujours RIEN', () => {
    table('teleport');
    expect(barreaux(get())).toEqual([]);
  });

  it('COOP — le siège qui NE contrôle PAS l’actif garde le menu (pas de vol d’Échap)', () => {
    table('dispel', { turn: 0, mySeat: 1, mode: 'guest' }); // tour de h1 (siège 0), client au siège 1
    expect(barreaux(get())).toEqual(['toggle-menu']);
    échap();
    expect(get().gameMenuOpen, 'un siège sans geste à annuler serait enfermé').toBe(true);
    expect(get().battle!.action, 'le mode armé d’AUTRUI a été désarmé à distance').toBe('dispel');
  });

  it('COOP — le siège QUI tient le mode armé le désarme', () => {
    table('dispel', { turn: 1, mySeat: 1, mode: 'guest' }); // tour de h2, possédé par le siège 1
    expect(barreaux(get())).toEqual(['action-disarm']);
    échap();
    expect(get().battle!.action).toBeNull();
    expect(get().gameMenuOpen).toBe(false);
  });
});
