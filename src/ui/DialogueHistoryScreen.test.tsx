// @vitest-environment jsdom
/** Relecture de l'historique de dialogue (#718 dernier lot) — contrats POSITIFS : deux conversations
 *  distinctes (deux `session`) donnent deux rangées maître, la plus récente en tête ; la sélection
 *  affiche `nodeText` (verbatim) ET `choiceText` (la réponse) ; le regroupement pur démarre un
 *  nouveau groupe à chaque changement de `session` (#1869) ; l'état vide s'affiche. */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DialogueHistoryScreen, groupConversations } from './DialogueHistoryScreen';
import { useGame } from '../state/store';
import type { DialogueTurn } from '../state/dialogueHistory';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const turns: DialogueTurn[] = [
  { speaker: 'Le meunier', nodeText: 'On m’a volé mon grain.', choiceText: 'Je vais enquêter.', at: 100, sceneId: 'scene-1', dialogueId: 'dlg-1', session: 1 },
  { speaker: 'Le meunier', nodeText: 'Merci, aventurier.', choiceText: 'De rien.', at: 105, sceneId: 'scene-1', dialogueId: 'dlg-1', session: 1 },
  { speaker: 'La tavernière', nodeText: 'Une bière ?', choiceText: 'Volontiers.', at: 200, sceneId: 'scene-2', dialogueId: 'dlg-2', session: 2 },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useGame.setState({ dialogueHistory: [] });
});

async function mount() {
  await act(async () => {
    root.render(<DialogueHistoryScreen onClose={() => {}} />);
  });
}

describe('groupConversations — regroupement pur (#718)', () => {
  it('des tours de même `session` forment UN groupe', () => {
    const groups = groupConversations(turns);
    expect(groups).toHaveLength(2);
    expect(groups[0].turns).toHaveLength(2);
    expect(groups[0].dialogueId).toBe('dlg-1');
    expect(groups[1].turns).toHaveLength(1);
    expect(groups[1].dialogueId).toBe('dlg-2');
  });

  it('un changement de `session` démarre un NOUVEAU groupe', () => {
    const t2: DialogueTurn[] = [
      { nodeText: 'a', choiceText: 'x', at: 1, sceneId: 's', dialogueId: 'd1', session: 1 },
      { nodeText: 'b', choiceText: 'y', at: 2, sceneId: 's', dialogueId: 'd2', session: 2 },
      { nodeText: 'c', choiceText: 'z', at: 3, sceneId: 's2', dialogueId: 'd2', session: 3 },
    ];
    const groups = groupConversations(t2);
    expect(groups).toHaveLength(3);
  });

  it('DEUX visites au MÊME PNJ, dans la MÊME scène, sont DEUX conversations', () => {
    const t3: DialogueTurn[] = [
      { nodeText: 'a', choiceText: 'x', at: 1, sceneId: 's', dialogueId: 'd1', session: 4 },
      { nodeText: 'a', choiceText: 'y', at: 9, sceneId: 's', dialogueId: 'd1', session: 5 }, // on rouvre le même dialogue
    ];
    const groups = groupConversations(t3);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.session)).toEqual([4, 5]);
  });
});

describe('DialogueHistoryScreen — rendu (#718)', () => {
  it('deux conversations distinctes → deux rangées maître, la plus RÉCENTE en tête', async () => {
    useGame.setState({ dialogueHistory: turns });
    await mount();
    const rows = Array.from(container.querySelectorAll('button.listrow'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('La tavernière'); // dlg-2 (at:200) avant dlg-1 (at:100)
    expect(rows[1].textContent).toContain('Le meunier');
  });

  it('sélectionner une conversation affiche ses tours : le texte dit ET la réponse choisie', async () => {
    useGame.setState({ dialogueHistory: turns });
    await mount();
    const rows = Array.from(container.querySelectorAll('button.listrow'));
    const meunierRow = rows.find((r) => r.textContent?.includes('Le meunier')) as HTMLButtonElement;
    expect(meunierRow).toBeTruthy();
    await act(async () => meunierRow.click());
    const txt = container.textContent ?? '';
    expect(txt).toContain('On m’a volé mon grain.');
    expect(txt).toContain('Je vais enquêter.');
    expect(txt).toContain('Merci, aventurier.');
    expect(txt).toContain('De rien.');
  });

  it('la date se range SOUS le nom, dans la colonne du nom — jamais en méta concurrente du libellé', async () => {
    useGame.setState({ dialogueHistory: turns });
    await mount();
    const row = container.querySelector('button.listrow')!;
    expect(row.querySelector('.lr-name .game-date'), 'la date est dans la colonne du nom').not.toBeNull();
    expect(Array.from(row.children).map((c) => c.className), 'la rangée ne porte que la colonne du nom').toEqual(['lr-name']);
  });

  it('état vide : aucune conversation enregistrée affiche le message dédié', async () => {
    useGame.setState({ dialogueHistory: [] });
    await mount();
    expect(container.textContent ?? '').toContain('Aucune conversation enregistrée');
  });
});
