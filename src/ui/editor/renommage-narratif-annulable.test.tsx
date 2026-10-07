// @vitest-environment jsdom
/**
 * #679 — un renommage d'entrée du narratif, propagé aux références de la scène, reste vrai à travers
 * « Annuler » : l'historique de la scène active est réécrit avec lui (`reecrireHistorique`), et le
 * renommage ne pose aucun instantané. Mesuré sur le chemin RÉEL de `<Editor>` jusqu'à la porte
 * (`parseProject`, au geste « Fichier → Enregistrer »).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { type SavedProject } from '../../state/projectLibrary';
import { __setFabriqueIdbForTest } from '../../lib/indexedDb';
import { brancherBasesSimulees } from '../../lib/indexedDb.testkit';
import { parseProject } from '../../state/worldMap';
import { emptyScene, type Scene } from '../../state/scene';
import { Editor } from './Editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  demonterRacines();
  __setFabriqueIdbForTest(null);
});

const relais = (): Scene => ({
  ...emptyScene(4, 4),
  id: 'relais',
  label: 'Le relais',
  triggers: [{ id: 't0', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true, flow: { kind: 'do', effect: { type: 'document', documentId: 'document-1' } } }],
});

function saisir(el: HTMLInputElement, valeur: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, valeur);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Éditeur — renommer une entrée du narratif, puis annuler', () => {
  it('l’annulation ramène l’édition de scène d’AVANT, jamais l’ancien id : la référence résout et la porte accepte', async () => {
    const base = brancherBasesSimulees().amorcer('wfrp4-library', { projects: { keyPath: 'id' } });
    const { container, rendre } = monterRacine(null);
    await act(async () => { rendre(<Editor initialScene={relais()} />); });
    const bouton = (texte: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(texte))!;
    const champ = (texte: string) => [...container.querySelectorAll('label')].filter((l) => l.textContent?.trim().startsWith(texte)).map((l) => l.querySelector('input')!);

    // Une édition de scène AVANT le renommage : un instantané qui porte encore l'ancien id.
    saisir(champ('Nom')[0], 'Le relais de poste');

    await act(async () => { bouton('Narratif').click(); });
    await act(async () => { bouton('Documents').click(); });
    await act(async () => { bouton('Ajouter un document').click(); });
    const texte = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Texte (verbatim'))!.querySelector('textarea')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(texte, 'VOYAGEURS');
      texte.dispatchEvent(new Event('input', { bubbles: true }));
    });
    saisir(champ('Identifiant (id stable)')[0], 'doc-lettre');

    await act(async () => { (container.querySelector('button[title="Annuler (Ctrl+Z)"]') as HTMLButtonElement).click(); });

    await act(async () => { bouton('Fichier').click(); });
    await act(async () => { bouton('Enregistrer…').click(); });
    const enregistrer = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Enregistrer')!;
    await act(async () => { enregistrer.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(container.querySelector('[role="alert"]')?.textContent ?? null).toBeNull();
    const ecrits = base.ecritures.filter((q) => q.geste === 'put').map((q) => q.valeur as SavedProject);
    expect(ecrits).toHaveLength(1);
    const relu = parseProject(ecrits[0].project);
    const scene = relu.scenes.find((s) => s.id === 'relais')!;
    expect(scene.label, 'l’annulation n’a pas défait l’édition de scène').toBe('Le relais');
    expect(scene.triggers[0].flow).toEqual({ kind: 'do', effect: { type: 'document', documentId: 'doc-lettre' } });
  });
});
