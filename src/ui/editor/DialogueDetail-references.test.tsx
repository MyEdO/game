// @vitest-environment jsdom
/**
 * #3059 — l'atelier de dialogue ne laisse jamais une référence que `validateScene` refuse : renommer un
 * dialogue suit ses ouvreurs (`dialogueId` d'entité, effet « Ouvrir un dialogue ») ; renommer un nœud
 * refuse un id déjà porté et suit chaque `next` ; supprimer un nœud coupe les `next` qui le visent et
 * refuse le nœud de départ. Les ids se posent au blur (`EntryRename`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LogicDock } from './LogicDock';
import { emptyScene, type Dialogue, type Scene, type SceneEntity } from '../../noyau/monde/scene';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';
import { validateScene } from '../../noyau/validateScene';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let sceneVue: Scene;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function Dock({ initiale }: { initiale: Scene }) {
  const [scene, setScene] = useState(initiale);
  const [dlgSel, setDlgSel] = useState<string | null>(initiale.dialogues[0]?.id ?? null);
  sceneVue = scene;
  return (
    <LogicDock
      scene={scene} otherScenes={[]} worldMap={null} narratif={emptyNarratif()} setScene={setScene}
      warnings={[]} onSelectWarning={() => undefined}
      tab="dialogues" setTab={() => undefined} height={400} setHeight={() => undefined}
      trigSel={null} setTrigSel={() => undefined} dlgSel={dlgSel} setDlgSel={setDlgSel} encSel={null} setEncSel={() => undefined}
      onSelectEntity={() => undefined} currentLayer={0}
    />
  );
}

function monter(scene: Scene) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Dock initiale={scene} />); });
}

/** Frappe `valeur` dans `champ`, puis le quitte. */
function renommer(champ: HTMLInputElement, valeur: string) {
  act(() => { champ.focus(); });
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => { champ.blur(); });
}

const champDuDialogue = () => [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Id du dialogue'))!.querySelector('input')!;
const champDuNoeud = () => container.querySelector<HTMLInputElement>('input.node-id, .node-id input')!;
const choisirNoeud = (id: string) => {
  const rangee = [...container.querySelectorAll<HTMLElement>('.dlg-nodes .listrow, .dlg-nodes [role="button"]')].find((x) => x.querySelector('b')?.textContent === id);
  expect(rangee, `aucune rangée pour le nœud ${id}`).toBeTruthy();
  act(() => { rangee!.click(); });
};
const supprimerLeNoeud = () => act(() => { container.querySelector<HTMLButtonElement>('button[title="Supprimer ce nœud"]')!.click(); });

/** Les fautes de `validateScene` qui portent sur un dialogue ou un ouvreur de dialogue. */
const fautesDeDialogue = (s: Scene) => validateScene([s]).filter((w) => w.level === 'error' && /dialogue/i.test(w.message)).map((w) => w.message);

const dialogue = (): Dialogue => ({
  id: 'd1', start: { id: 'n1' },
  nodes: [
    { id: 'n1', desc: 'un', choices: [{ id: 'choix-1', label: 'vers deux', next: { id: 'n2' } }] },
    { id: 'n2', desc: 'deux', choices: [{ id: 'choix-1', label: 'encore', next: { id: 'n2' } }, { id: 'choix-2', label: 'retour', next: { id: 'n1' } }] },
    { id: 'n3', desc: 'trois', choices: [] },
  ],
});
const scene = (): Scene => ({
  ...emptyScene('scene-test', 8, 8),
  entities: [{ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 }, label: 'Aubergiste', dialogueId: { id: 'd1' } } as SceneEntity],
  triggers: [{ id: 't1', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true, flow: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'startDialogue', dialogue: { id: 'd1' } } }] } }],
  dialogues: [dialogue()],
});

describe('atelier de dialogue — aucune référence pendante (#3059)', () => {
  it('renommer le dialogue suit l’entité qui le porte et l’effet qui l’ouvre', () => {
    monter(scene());
    expect(fautesDeDialogue(sceneVue), 'la scène de départ est valide').toEqual([]);
    renommer(champDuDialogue(), 'd-auberge');
    expect(sceneVue.dialogues.map((d) => d.id)).toEqual(['d-auberge']);
    expect(sceneVue.entities[0].dialogueId).toEqual({ id: 'd-auberge' });
    expect(sceneVue.triggers[0].flow).toEqual({ kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'startDialogue', dialogue: { id: 'd-auberge' } } }] });
    expect(fautesDeDialogue(sceneVue)).toEqual([]);
  });

  it('renommer un nœud vers un id déjà porté est refusé ; un id libre suit chaque `next`, la boucle comprise', () => {
    monter(scene());
    choisirNoeud('n2');
    renommer(champDuNoeud(), 'n1');
    expect(sceneVue.dialogues[0].nodes.map((n) => n.id), 'le doublon a été posé').toEqual(['n1', 'n2', 'n3']);
    renommer(champDuNoeud(), 'n-deux');
    const [n1, n2] = sceneVue.dialogues[0].nodes;
    expect(n2.id).toBe('n-deux');
    expect(n1.choices[0].next).toEqual({ id: 'n-deux' });
    expect(n2.choices.map((c) => c.next), 'la boucle du nœud sur lui-même pend').toEqual([{ id: 'n-deux' }, { id: 'n1' }]);
    expect(fautesDeDialogue(sceneVue)).toEqual([]);
  });

  it('supprimer un nœud coupe les `next` qui le visent ; le nœud de départ ne se supprime pas', () => {
    monter(scene());
    choisirNoeud('n2');
    supprimerLeNoeud();
    expect(sceneVue.dialogues[0].nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(sceneVue.dialogues[0].nodes[0].choices).toEqual([{ id: 'choix-1', label: 'vers deux' }]);
    expect(fautesDeDialogue(sceneVue)).toEqual([]);

    choisirNoeud('n1');
    supprimerLeNoeud();
    expect(sceneVue.dialogues[0].nodes.map((n) => n.id), 'le départ a été supprimé').toEqual(['n1', 'n3']);
    expect(fautesDeDialogue(sceneVue)).toEqual([]);
  });
});
