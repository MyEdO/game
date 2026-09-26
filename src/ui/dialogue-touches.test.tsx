// @vitest-environment jsdom
/**
 * LA TOUCHE N CHOISIT LA RÉPONSE NUMÉROTÉE N (#1869) — mesuré sur le VRAI hook et de vrais
 * `KeyboardEvent` (patron `raccourcis-modificateurs.test.tsx`), parce que la loi « pendant une
 * conversation, seuls les raccourcis de la COUCHE dialogue répondent » vit dans le hook.
 *
 * Contrats POSITIFS :
 *  · la touche adresse le RANG affiché (une réponse masquée par son `when` ne décale pas les
 *    suivantes) et passe à `chooseDialogue` l'INDEX de la donnée ;
 *  · une réponse FERMÉE (bourse trop courte) est inerte à la touche comme au clic, et un rang ABSENT
 *    ne fait rien ;
 *  · le siège qui ne décide pas (coop) ne déclenche rien — ni la réponse, ni le raccourci voisin ;
 *  · en COMBAT, un dialogue ouvert donne les chiffres à la conversation, pas à la grille de
 *    capacités — qui les reprend dès la conversation close (la garde n'est pas devenue muette).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import type { GameState } from '../state/store';
import { hotbar } from '../state/hotbarBridge';
import { campaignStart } from '../engine/clock';
import type { Dialogue, DialogueNode } from '../state/scene';
import { useGameKeyboard } from './useGameKeyboard';

function Harness() {
  useGameKeyboard();
  return null;
}

const frapper = (code: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  });

/** Trois réponses en DONNÉE, la 2ᵉ masquée : à l'écran, « Deux » est au rang 2 et à l'index 2. */
const dlg: Dialogue = {
  id: 'd-touches', start: 'n1',
  nodes: [{ id: 'n1', desc: 'Que faites-vous ?', choices: [
    { label: 'Une', next: 'n2' },
    { label: 'Cachée', when: { kind: 'flag', expr: 'jamais' }, next: 'n2' },
    { label: 'Deux', next: 'n2' },
  ] }, { id: 'n2', desc: 'Suite.', choices: [] }],
} as Dialogue;

const scene = { id: 'scn', nom: 'Scène', desc: '', size: [4, 4], entities: [], dialogues: [dlg], triggers: [], encounters: [] } as never;

let host: HTMLDivElement;
let root: Root;
let choisis: number[];

function monter(over: Partial<GameState> = {}) {
  choisis = [];
  useGame.setState({
    screen: 'campaign', mode: 'exploration', scene, flags: {}, gameTime: campaignStart(), party: [],
    battle: null, gameMenuOpen: false, merchant: null,
    net: { mode: 'local', mySeat: 0, seatNames: {}, presence: {}, connection: 'ok', hostAway: false, ownership: {}, slots: [0, 0, 0, 0] } as GameState['net'],
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
    // Espion posé SUR l'action du store : ce qui est mesuré est l'ARGUMENT reçu, pas une closure.
    chooseDialogue: (i: number) => { choisis.push(i); },
    ...over,
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<Harness />); });
}

describe('#1869 — les touches 1-9 choisissent la réponse NUMÉROTÉE', () => {
  const vrai = useGame.getState();
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  beforeEach(() => { hotbar.capacites = []; });
  afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
    useGame.setState({ dialogue: null, battle: null, chooseDialogue: vrai.chooseDialogue });
  });

  it('la touche 2 choisit la 2ᵉ réponse VISIBLE, par son INDEX de donnée', () => {
    monter();
    frapper('Digit2');
    expect(choisis).toEqual([2]); // rang 2 à l'écran = index 2 dans `choices` (la 2ᵉ est masquée)
  });

  it('un rang ABSENT (9 réponses attendues, 2 offertes) ne fait rien', () => {
    monter();
    frapper('Digit9');
    expect(choisis).toEqual([]);
  });

  it('réponse FERMÉE (bourse trop courte) : la touche est inerte, comme le clic', () => {
    const payant = { ...dlg, nodes: [{ ...dlg.nodes[0], choices: [{ label: 'Payer', cost: { gold: 5 } }] as DialogueNode['choices'] }, dlg.nodes[1]] } as Dialogue;
    monter({ dialogue: { dialogue: payant, nodeId: 'n1', session: 1 } });
    frapper('Digit1');
    expect(choisis).toEqual([]);
  });

  it('coop, siège qui ne DÉCIDE pas : la touche ne fait RIEN (et ne retombe sur aucun autre raccourci)', () => {
    monter({ net: { mode: 'guest', mySeat: 1, seatNames: {}, presence: {}, connection: 'ok', hostAway: false, ownership: {}, slots: [0, 0, 0, 0] } as GameState['net'] });
    frapper('Digit1');
    expect(choisis).toEqual([]);
  });

  it('EN COMBAT, le chiffre va à la conversation — pas à la grille de capacités', () => {
    const tire = vi.fn();
    hotbar.capacites = [{ actionId: 'attaquer', run: tire }];
    monter({
      mode: 'battle',
      battle: { over: null, order: ['h1'], turn: 0, combatants: [{ id: 'h1', kind: 'hero' }] } as never,
    });
    frapper('Digit1');
    expect(choisis).toEqual([0]);
    expect(tire).not.toHaveBeenCalled();
  });

  it('pendant la conversation, AUCUN autre raccourci ne répond — même en plein combat', () => {
    // La couche DIALOGUE est bloquante : `I` (inspection, `when: inBattle`) se tait tant que la
    // fenêtre est là. C'est la loi du hook (`coucheDialogue`), pas un privilège des chiffres.
    monter({
      mode: 'battle', inspectEnabled: false,
      battle: { over: null, order: ['h1'], turn: 0, combatants: [{ id: 'h1', kind: 'hero' }] } as never,
    });
    frapper('KeyI');
    expect(useGame.getState().inspectEnabled).toBe(false);
  });

  it('conversation CLOSE : le même chiffre reprend la grille de capacités (la garde n’est pas muette)', () => {
    const tire = vi.fn();
    hotbar.capacites = [{ actionId: 'attaquer', run: tire }];
    monter({
      mode: 'battle', dialogue: null,
      battle: { over: null, order: ['h1'], turn: 0, combatants: [{ id: 'h1', kind: 'hero' }] } as never,
    });
    frapper('Digit1');
    expect(tire).toHaveBeenCalledTimes(1);
    expect(choisis).toEqual([]);
  });
});
