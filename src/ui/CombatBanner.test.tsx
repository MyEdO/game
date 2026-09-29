// @vitest-environment jsdom
/**
 * Bandeau de combat — région live du HUD (§14-4). Monté pour de VRAI (patron `createRoot`/`act`) sur
 * le VRAI store (`useGame.setState`) et de VRAIS événements de journal (`ev`, `src/state/combatLog`) :
 * la sélection du message passe par `combatFeed`/`narrateIntent` réels, aucun module n'est mocké
 * (`isolate: false` — cf. `src/vi-mock-isolate-guard.test.ts`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { ev, type CombatEvent } from '../state/combatLog';
import { REFUS_MS } from '../state/refusVisible';
import { CombatBanner } from './CombatBanner';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const com = (id: string, label: string, kind: 'hero' | 'enemy') =>
  ({ id, name: label, label, kind, conditions: [], traumas: [], engagedWith: [], advantage: 0 });

const GUNNAR = com('gunnar', 'Gunnar', 'hero');
const RAT = com('rat', 'Rat géant', 'enemy');

let host: HTMLDivElement;
let root: Root;

/** Combat en cours dont le journal porte `log`, puis montage du bandeau. */
function monter(log: CombatEvent[], racine: Record<string, unknown> = {}) {
  useGame.setState({
    battle: { combatants: [GUNNAR, RAT], order: ['gunnar', 'rat'], baseOrder: ['gunnar', 'rat'], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
      log, over: null } as unknown as BattleState,
    actorAim: null,
    refus: null,
    ...racine,
  } as never);
  act(() => { root.render(<CombatBanner />); });
}

/** La clé React de l'annonce affichée — c'est elle qui RÉ-ANIME l'entrée. Lue par l'identité du nœud :
 *  deux clés différentes = deux éléments distincts pour React (l'ancien est démonté). */
const noeudAnnonce = () => host.querySelector('.cb-ev');

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, actorAim: null });
});

describe('CombatBanner', () => {
  it('garde une région live vide pendant un combat sans annonce', () => {
    monter([]);
    expect(host.innerHTML).toBe('<div class="combat-feed" role="status" aria-live="polite" aria-atomic="true"></div>');
  });

  it('rend au plus une annonce dans la région live', () => {
    monter([
      ev('attack', 'Ancienne ligne', 'gunnar', 'rat'),
      ev('attack', 'Gunnar frappe Rat géant', 'gunnar', 'rat'),
    ]);
    const html = host.innerHTML;
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(host.querySelectorAll('.cb-ev').length).toBe(1);
    expect(html).toContain('Gunnar');
    expect(html).not.toContain('Ancienne ligne');
  });

  it('n’annonce ni le round ni l’ordre d’initiative — ils appartiennent à la frise', () => {
    monter([ev('attack', 'Gunnar frappe Rat géant', 'gunnar', 'rat')]);
    const html = host.innerHTML;
    expect(html).not.toContain('Round');
    expect(html).not.toContain('is-round');
    expect(html).not.toContain('initiative-strip');
    expect(html).not.toContain('is-cell');
  });

  // ── LE REFUS DE GESTE (spec HUD § ARBITRAGE 2026-08-19, « refus VISIBLE par construction ») ──────
  // C'est LA surface où un clic refusé se dit : le journal de partie n'est pas affiché en combat
  // (`LogDrawer` y rend `battle.log`), et le refus lui-même ne va pas dans `battle.log` — il ne
  // voyagerait pas jusqu'à un invité, et n'a rien à faire dans la trace des FAITS de jeu.
  it('le REFUS passe devant le télégraphe d’une IA en cours (sinon le clic reste sans réponse)', () => {
    monter([ev('attack', 'Gunnar frappe Rat géant', 'gunnar', 'rat')], {
      actorAim: { fromId: 'rat', toId: 'gunnar', kind: 'charge' },
      refus: { texte: 'Trop loin pour marcher — armez la Course.', nonce: 1 },
    });
    expect(host.innerHTML).toContain('armez la Course');
    expect(host.innerHTML, 'le télégraphe a avalé le refus').not.toContain('charge Gunnar');
  });

  it('deux refus IDENTIQUES d’affilée RÉ-ANIMENT la bannière (la clé porte le nonce)', () => {
    const texte = 'Trop loin pour marcher — armez la Course.';
    monter([], { refus: { texte, nonce: 1 } });
    const premier = noeudAnnonce();
    expect(premier).not.toBeNull();
    act(() => { useGame.setState({ refus: { texte, nonce: 2 } } as never); });
    expect(host.innerHTML).toContain('armez la Course');
    expect(noeudAnnonce(), 'le 2ᵉ refus n’a rien ré-animé : bannière figée sur un clic sans réponse').not.toBe(premier);
  });

  it('le refus S’ÉTEINT de lui-même après REFUS_MS (la bannière ne reste pas sur un clic ancien)', () => {
    vi.useFakeTimers();
    try {
      monter([], { refus: { texte: 'Trop loin pour marcher — armez la Course.', nonce: 7 } });
      expect(host.innerHTML, 'témoin : le refus n’a jamais été affiché').toContain('armez la Course');
      act(() => { vi.advanceTimersByTime(REFUS_MS); }); // la minuterie de la bannière (`scheduleFlowTimer`)
      expect(useGame.getState().refus, 'la minuterie n’a pas éteint le refus').toBeNull();
      expect(host.innerHTML, 'la bannière tient encore un refus éteint').not.toContain('armez la Course');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sans refus, le télégraphe de l’IA garde sa place (la priorité ne le supprime pas)', () => {
    monter([ev('attack', 'Gunnar frappe Rat géant', 'gunnar', 'rat')], {
      actorAim: { fromId: 'rat', toId: 'gunnar', kind: 'charge' },
    });
    expect(host.innerHTML).toContain('charge');
  });
});
