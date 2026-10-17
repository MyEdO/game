// @vitest-environment jsdom
/**
 * #1530 — un save REFUSÉ par le schéma ne laisse RIEN en mémoire.
 *
 * `CodexEdit.save` posait la preview mémoire (`src.persist`, mutation EN PLACE du dataset) AVANT de
 * valider la source entière : au refus, l'app gardait une donnée que le disque n'a jamais reçue, en
 * silence. La pose est désormais TRANSACTIONNELLE — le refus REPREND l'état d'avant.
 *
 * Le refus vient d'une DONNÉE RÉELLEMENT INVALIDE (`desc` vidée : `sea-shanties.ts` l'EXIGE et
 * l'enveloppe la ferme à `.min(1)`), jamais d'un mock de module — `vi.mock` sous `isolate: false`
 * lie par l'ORDRE des fichiers du worker (`src/vi-mock-isolate-guard.test.ts`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

/** Saisie utilisateur dans un champ contrôlé React (setter natif du prototype + événement `input`). */
function saisir(champ: HTMLInputElement | HTMLTextAreaElement, valeur: string) {
  const proto = champ instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('atelier du Codex — la pose mémoire est TRANSACTIONNELLE (#1530)', () => {
  it('un save REFUSÉ par le schéma laisse le dataset mémoire INTACT', async () => {
    const avant = structuredClone(datasetArray('seaShanties') as unknown[]);
    const cible = (avant[0] as { id: string; label: string; desc?: string });
    expect(cible.desc, 'l’entrée mesurée n’a pas de `desc` — le geste ne violerait rien').toBeTruthy();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<CodexEdit categoryKey="seaShanties" id={cible.id} onClose={() => {}} />);
    });

    // Violation la plus simple du zod RÉEL : `desc` vidée (`src/data/schemas/defs/sea-shanties.ts`
    // `exiges: ['desc', 'source']`, `src/data/schemas/grammaire/document.ts` `.min(1)`).
    const champDesc = [...container.querySelectorAll<HTMLLabelElement>('.codex-edit-form label.ed-field')]
      .find((l) => l.querySelector('span')?.textContent?.trim() === 'Description')
      ?.querySelector('textarea');
    expect(champDesc, 'aucun champ Description monté — le geste de saisie ne mesure rien').toBeTruthy();
    saisir(champDesc!, '');

    const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    expect(enregistrer.disabled, 'le bouton Enregistrer est resté inerte — le save n’a pas été joué').toBe(false);
    await act(async () => { enregistrer.click(); });

    expect(container.textContent, 'le refus du schéma n’est pas affiché — le save n’a pas suivi le chemin mesuré')
      .toContain('sea-shanties.json');
    expect(container.querySelector('.codex-edit-errors')?.textContent, 'le refus affiché ne nomme pas le champ violé')
      .toContain(`élément « ${cible.id} » › Description: texte vide.`);
    expect(
      datasetArray('seaShanties'),
      'le dataset mémoire a gardé une édition que le disque n’a jamais reçue',
    ).toEqual(avant);
  });
});
