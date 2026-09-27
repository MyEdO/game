// @vitest-environment jsdom
/**
 * LA TOUCHE APPARTIENT À LA COUCHE DU DESSUS (#1869 correctif 10) — un écran PAR SIÈGE ouvert
 * par-dessus une conversation (ici la relecture « Conversations », un `ScreenShell`) met en attente
 * les touches de CE joueur, par la pile des couches (`dismissStack`), jamais par l'état de jeu.
 *
 * Monté comme `CampaignView` le câble (fenêtre de conversation, tiroir-journal et son bouton
 * « Conversations », écran de relecture), sur le VRAI hook clavier : clic réel, `keydown` réel.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { campaignStart } from '../engine/clock';
import { dismissStackKinds } from '../state/dismissStack';
import type { Dialogue } from '../state/scene';
import { useGameKeyboard } from './useGameKeyboard';
import { DialogueBox } from './DialogueBox';
import { LogDrawer } from './LogDrawer';
import { DialogueHistoryScreen } from './DialogueHistoryScreen';
import { CodexRef } from './compendium/CodexRef';

const dlg: Dialogue = {
  id: 'd-couche', start: 'n1',
  nodes: [
    { id: 'n1', desc: 'Que faites-vous ?', choices: [{ label: 'Une', next: 'n2' }, { label: 'Deux', next: 'n3' }] },
    { id: 'n2', desc: 'Une.', choices: [] },
    { id: 'n3', desc: 'Deux.', choices: [] },
  ],
} as Dialogue;

function Campagne() {
  useGameKeyboard();
  const [historique, setHistorique] = useState(false);
  return (
    <>
      <DialogueBox />
      {/* Une puce du HUD (portrait, état) : un `CodexRef` réel, dont le survol pose un POPOVER. */}
      <CodexRef category="talents" id="affable" label="Affable" wrap>
        <button type="button">Affable ×2</button>
      </CodexRef>
      <LogDrawer battle={null} journal={[]} initialOpen onOpenHistory={() => setHistorique(true)} />
      {historique && <DialogueHistoryScreen onClose={() => setHistorique(false)} />}
    </>
  );
}

const frapper = (code: string) =>
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true })); });
const relacher = (code: string) =>
  act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true })); });
const bouton = (texte: string) =>
  Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes(texte))!;

let host: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
  useGame.setState({ dialogue: null });
});

function monterCampagne() {
  useGame.setState({
    screen: 'campaign', mode: 'exploration', battle: null, scene: null, flags: {}, gameTime: campaignStart(),
    party: [], journal: [], dialogueHistory: [], gameMenuOpen: false, merchant: null, document: null,
    dialogue: { dialogue: dlg, nodeId: 'n1', session: 1 },
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<Campagne />); });
}

describe('#1869 — un POPOVER au-dessus de la conversation ne lui prend pas les touches', () => {
  it('survol d’une puce du codex : le popover s’empile, et Digit2 choisit quand même la réponse 2', () => {
    monterCampagne();
    const puce = host.querySelector('.codex-ref') as HTMLElement;
    act(() => { puce.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(dismissStackKinds(), 'le survol pose un popover au-dessus de la conversation').toEqual(['dialogue', 'popover-codex']);
    frapper('Digit2');
    relacher('Digit2');
    expect(useGame.getState().dialogue?.nodeId, 'un popover ne rend rien inerte : la réponse 2 part').toBe('n3');
  });
});

describe('#1869 — un écran par siège au-dessus de la conversation lui prend les touches', () => {
  it('« Conversations » ouvert : Digit2 ne répond pas ; fermé : Digit2 choisit la réponse 2', () => {
    monterCampagne();
    expect(dismissStackKinds(), 'seule la conversation est à l’écran').toEqual(['dialogue']);

    act(() => { bouton('Conversations').click(); });
    expect(dismissStackKinds(), 'la relecture s’empile au-dessus').toEqual(['dialogue', 'ecran-plein-champ']);
    frapper('Digit2');
    relacher('Digit2');
    expect(useGame.getState().dialogue?.nodeId, 'la relecture a la main : la conversation attend').toBe('n1');

    act(() => { bouton('Fermer').click(); });
    expect(dismissStackKinds()).toEqual(['dialogue']);
    frapper('Digit2');
    relacher('Digit2');
    expect(useGame.getState().dialogue?.nodeId, 'la conversation a la main : la réponse 2 part').toBe('n3');
  });
});
