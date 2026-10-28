// @vitest-environment jsdom
/**
 * Atelier du Codex — les Compétences d'une créature (format livre, une par ligne) se tiennent en
 * brouillon (`SaisieEnBrouillon`) qui ne grise pas « Enregistrer » : le clic sur le bouton pose le
 * texte tapé au blur qu'il provoque, puis l'enregistre, en UN seul clic.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray, setDataset } from '../../data/overrides';
import type { SkillRef } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

type Creature = { id: string; skills: SkillRef[] };

function saisir(champ: HTMLTextAreaElement, valeur: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
/** Première ligne du champ, Valeur augmentée de `pas`. */
const premiereLigneAPlus = (texte: string, pas: number): string => {
  const [premiere, ...reste] = texte.split('\n');
  return [premiere.replace(/\d+$/, (n) => String(Number(n) + pas)), ...reste].join('\n');
};

describe('atelier du Codex — Compétences d’une créature', () => {
  it('taper puis un seul clic sur « Enregistrer » enregistre le texte tapé', async () => {
    const avant = (datasetArray('creatures') as Creature[]).slice();
    const cible = avant.find((c) => c.skills.length && /\d+$/.test(String(c.skills[0].value ?? '')))!;
    try {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      act(() => { root.render(<CodexEdit categoryKey="creatures" id={cible.id} onClose={() => {}} />); });
      const champ = [...container.querySelectorAll<HTMLLabelElement>('.codex-edit-form label.ed-field')]
        .find((l) => l.querySelector('span')?.textContent?.trim() === 'Compétences')!.querySelector('textarea')!;
      const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;

      // Une première édition posée rend l'entrée modifiée : le bouton est actif.
      act(() => { champ.focus(); });
      saisir(champ, premiereLigneAPlus(champ.value, 1));
      act(() => { champ.blur(); });
      expect(enregistrer.disabled, 'l’édition posée n’a rien rendu modifié').toBe(false);

      // Seconde frappe, non posée : le bouton reste actif, et le clic la pose (blur) puis l'enregistre.
      act(() => { champ.focus(); });
      saisir(champ, premiereLigneAPlus(champ.value, 1));
      expect(enregistrer.disabled, 'le brouillon a grisé « Enregistrer »').toBe(false);
      act(() => { enregistrer.focus(); });
      await act(async () => { enregistrer.click(); });

      const posee = (datasetArray('creatures') as Creature[]).find((c) => c.id === cible.id)!;
      expect(posee.skills[0].value).toBe(Number(cible.skills[0].value) + 2);
    } finally {
      setDataset('creatures', avant as never);
    }
  });
});
