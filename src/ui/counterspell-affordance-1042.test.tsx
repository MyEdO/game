// @vitest-environment jsdom
/**
 * #1042/#1059 — AFFORDANCE = GARDE dans la fenêtre de Contre-sort : les deux refus SILENCIEUX de
 * `counterspellEngage` (phase de déclaration encore ouverte ; une AUTRE rangée a déjà dissipé)
 * éteignent le CTA de la rangée AVEC leur raison visible (`GatedAction`), au lieu d'un bouton
 * cliquable qui ne fait rien (défaut mesuré en recette navigateur). Monté pour de VRAI (patron
 * `createRoot`/`act` du repo) : c'est l'ÉCRAN qui est jugé, pas le prédicat.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { seedBattleRng } from '../state/battleRng';
import { testScene } from '../scenes/test-fixture';
import { CastModal } from './CastModal';
import type { BattleState } from '../state/store';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy'): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [],
     skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 20 }], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: kind === 'hero' ? 0 : 1, y: 0 }, wounds: { current: 18, max: 18 },
     resilience: 2, fortune: 2, species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);

const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };
const ENEMY_CAST = { cast: true, roll: 20, target: 50, sl: 3, isCritical: false, isFumble: false, log: '' };
const DISSIPE = { dispelled: true, counter: { roll: 5, target: 60, sl: 4, success: true, isDouble: false }, casterNetSL: -1, log: 'DISSIPÉ' };

let host: HTMLDivElement;
let root: Root;

/** Fenêtre à deux contre-lanceurs héros contre un Sort ENNEMI figé ; `parts` = état des rangées. */
function monter(parts: unknown[]) {
  const A = mk('A', 'hero');
  const B = mk('B', 'hero');
  const E = mk('E', 'enemy');
  useGame.setState({
    battle: { combatants: [A, B, E], order: ['E', 'A', 'B'], baseOrder: ['E', 'A', 'B'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState,
    mode: 'battle', scene: testScene(), net: SOLO as never, party: [A, B],
    pendingDefense: null, pendingAttack: null, pendingCascade: null, pendingCastOpposition: null,
    pendingCast: { casterId: 'E', targetId: 'A', spellId: 'drain', missile: false, focused: false, counterspellRouted: true, result: ENEMY_CAST } as never,
    pendingCounterspell: { participants: parts } as never,
  });
  act(() => { root.render(<CastModal />); });
}

/** Le CTA « Contre-sort » de la rangée A, tel que le voit le joueur (bouton + son état). */
const ctaA = () => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Contre-sort'));
/** Raisons PORTÉES par les CTA éteints — leur copie hors écran (`aria-describedby`), le texte visible
 *  naissant au survol dans l'infobulle partagée (arbitrage user 2026-08-24). */
const raisons = () => [...host.querySelectorAll('.gated-action .hors-ecran, .gated-action-reason')].map((n) => n.textContent?.trim());

beforeEach(() => {
  seedBattleRng(7);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCast: null, pendingCounterspell: null, pendingCascade: null, battle: null, party: [] });
});

describe('#1042/#1059 — le CTA de Contre-sort ne ment jamais sur ce qu’il fera', () => {
  it('PHASE 1 (une rangée non déclarée) : bouton DÉSACTIVÉ, raison VISIBLE, et lié en a11y', () => {
    monter([
      { id: 'A', interactive: true, declared: 'solo', result: null },
      { id: 'B', interactive: true, result: null },
    ]);
    const btn = ctaA()!;
    expect(btn, 'la rangée déclarée montre bien son CTA').toBeTruthy();
    // Refusé par `aria-disabled` et non par `disabled` : le CTA garde le focus, donc sa raison reste
    // atteignable au clavier, à la manette et au doigt (arbitrage user 2026-08-24).
    expect(btn.getAttribute('aria-disabled'), 'le jet est refusé tant que la fenêtre n’a pas déclaré').toBe('true');
    expect(raisons()).toContain('En attente des déclarations de la fenêtre');
    const id = btn.getAttribute('aria-describedby');
    expect(id, 'la raison est LIÉE au bouton (lecteur d’écran)').toBeTruthy();
    expect(host.querySelector(`#${id}`)?.textContent).toContain('En attente des déclarations');
  });

  it('une AUTRE rangée a DISSIPÉ : bouton DÉSACTIVÉ, la raison NOMME le dissipateur', () => {
    monter([
      { id: 'A', interactive: true, declared: 'solo', result: null },
      { id: 'B', interactive: true, declared: 'solo', result: DISSIPE },
    ]);
    expect(ctaA()!.getAttribute('aria-disabled')).toBe('true');
    expect(raisons()).toContain('Déjà dissipé par B');
  });

  it('phase CLOSE et personne n’a dissipé : le bouton est ACTIF, sans raison affichée', () => {
    monter([
      { id: 'A', interactive: true, declared: 'solo', result: null },
      { id: 'B', interactive: true, declared: 'pass', result: null },
    ]);
    expect(ctaA()!.getAttribute('aria-disabled'), 'rien ne s’oppose au jet : le CTA est vivant').toBeNull();
    expect(ctaA()!.disabled).toBe(false);
    expect(raisons()).toEqual([]);
  });
});

describe('sous-ligne de rangée — une `.rr-note` porte du CONTENU (#1078)', () => {
  /** `RollPanel` ouvre `.rr-note` sur la TRUTHINESS de la note : une note toujours fournie (fragment
   *  vide compris) creuse une sous-ligne muette sous CHAQUE rangée de la fenêtre. */
  const notes = () => [...host.querySelectorAll('.rr-note')];

  it('la rangée QUI A QUELQUE CHOSE À DIRE a sa sous-ligne, l’autre n’en ouvre AUCUNE', () => {
    monter([
      // A : déclarée « contrer seul », pas encore lancée → rien à dire sous sa ligne de jet.
      { id: 'A', interactive: true, declared: 'solo', result: null },
      // B : déclarée « passe » → sa situation MOTIVE l'extinction, elle occupe la sous-ligne.
      { id: 'B', interactive: true, declared: 'pass', result: null },
    ]);
    const textes = notes().map((n) => n.textContent?.trim());
    expect(textes.filter((t) => t?.includes('passe')), 'la situation « passe » se lit sous la rangée B').toHaveLength(1);
    expect(textes.filter((t) => !t), 'une `.rr-note` vide = une sous-ligne fantôme sur chaque rangée').toEqual([]);
  });
});
