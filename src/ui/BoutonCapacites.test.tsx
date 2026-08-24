// @vitest-environment jsdom
/**
 * OUVREUR DU RAIL (spec HUD zone 6) — trois contrats, mesurés au DOM sur le vrai store :
 *  · OFFERT : le clic ouvre l'écran ;
 *  · REFUSÉ : le clic n'ouvre RIEN, le bouton n'est pas `disabled` (sa raison doit rester
 *    atteignable au clavier, au doigt et au pad) et sa raison est LISIBLE au SURVOL comme au FOCUS,
 *    dans l'infobulle partagée — c'est le grief de recette 2026-08-24 (« la raison n'existe qu'à
 *    l'arbre a11y ») ;
 *  · MUET par ailleurs : aucun `title` natif (proscrit par la charte).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import { BoutonCapacites } from './BoutonCapacites';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(id: string, label: string): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, rng: makeRNG(7) });
  h.id = id;
  h.pos = { x: 5, y: 5 };
  return h;
}

let host: HTMLDivElement;
let root: Root;

/** Combat en cours ; `turn` désigne l'acteur actif (0 = le héros du joueur, 1 = l'ennemi). */
function monter(turn: number) {
  const h = hero('h1', 'Gunnar');
  const e = hero('e1', 'Rat');
  e.kind = 'enemy';
  e.pos = { x: 8, y: 5 };
  act(() => {
    useGame.setState({
      party: [h], ecranCapacitesOuvert: false,
      battle: {
        combatants: [h, e], order: [h.id, e.id], baseOrder: [h.id, e.id], turn, round: 1,
        action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
        acted: false, log: [], over: null,
      } as unknown as BattleState,
    });
  });
  act(() => { root.render(<BoutonCapacites />); });
  return host.querySelector('button')!;
}

/** RAISON lue au SURVOL : l'infobulle partagée vit en PORTAL sur `document.body` ; `mouseover` est
 *  l'événement dont React dérive `onMouseEnter` (même voie qu'un vrai survol). */
function raisonAuSurvol(el: Element): string | null {
  const enveloppe = el.closest('.codex-ref');
  if (!enveloppe) return null;
  act(() => { enveloppe.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
  return document.body.querySelector('.codex-pop[role="tooltip"] [data-refus]')?.textContent ?? null;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, ecranCapacitesOuvert: false });
});

describe('ouvreur du rail — l’écran des capacités', () => {
  it('à SON tour : le bouton ouvre l’écran, et ne dit rien (il n’a rien à refuser)', () => {
    const btn = monter(0);
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    expect(btn.getAttribute('title'), 'infobulle native : proscrite').toBeNull();
    act(() => { btn.click(); });
    expect(useGame.getState().ecranCapacitesOuvert).toBe(true);
  });

  it('au tour d’un AUTRE : le clic n’ouvre rien, et la raison se LIT au survol', () => {
    const btn = monter(1);
    expect(btn.getAttribute('aria-disabled'), 'le refus n’est pas porté à l’arbre a11y').toBe('true');
    expect((btn as HTMLButtonElement).disabled, '`disabled` HTML : la raison deviendrait inatteignable').toBe(false);
    act(() => { btn.click(); });
    expect(useGame.getState().ecranCapacitesOuvert, 'le bouton refusé a quand même ouvert l’écran').toBe(false);
    // La RAISON, VISIBLE : l'infobulle partagée la porte (et pas seulement la copie hors écran).
    const attendue = host.querySelector('.hors-ecran')!.textContent;
    expect(attendue, 'aucune copie accessible de la raison').toBeTruthy();
    expect(raisonAuSurvol(btn), 'la raison n’existe qu’à l’arbre a11y : rien ne s’affiche au survol').toBe(attendue);
  });

  it('… et au FOCUS aussi (clavier, manette) : la raison naît sans survol', () => {
    const btn = monter(1);
    act(() => { btn.closest('.codex-ref')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    act(() => { btn.focus(); });
    expect(document.body.querySelector('.codex-pop[role="tooltip"] [data-refus]')?.textContent)
      .toBe(host.querySelector('.hors-ecran')!.textContent);
  });
});
