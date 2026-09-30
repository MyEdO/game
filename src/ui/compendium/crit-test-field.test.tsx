// @vitest-environment jsdom
/**
 * #1657 B2a / #1682 — le champ `test` d'une rangée de Blessure critique s'édite à l'atelier et le
 * document PARSE ENCORE son schéma.
 *
 * Contrat POSITIF, mesuré sur la donnée RÉELLE : on monte l'atelier sur « Perte d'équilibre »
 * (`aa-jambe-11`, la seule rangée dont le nœud nomme une Compétence), on change la Difficulté par le
 * select, on Enregistre — et on exige DEUX choses : aucun refus de schéma, et la rangée mémoire porte
 * un nœud `{kind:'test', test, success, fail}` à la nouvelle Difficulté.
 *
 * CE QU'IL MORD : la racine `FlowEditor` normalise ce qu'elle rend en `{kind:'seq', steps}`
 * (`asSteps`/`seqOf`, `src/ui/editor/FlowEditor.tsx`) — montée sur ce champ, le premier geste
 * d'édition ferait perdre son `kind` au nœud et le save serait refusé (issues `invalid_value` sur
 * `kind`, `unrecognized_keys` sur `steps`). Le champ compose donc `NoeudTestField`, le SOUS-éditeur de nœud
 * `test` (`TestFields` + un `FlowEditor` par branche servie), celui-là même que `FlowEditor` monte
 * à l'intérieur d'un Flow de sort ; une rangée de Critique SERT ses deux branches (`critical.ts`),
 * elle les édite donc toutes les deux.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray, setDataset } from '../../data/overrides';
import type { CritTestNode } from '../../data/criticals';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

type Rangee = { id: string; label: string; test?: CritTestNode };

let container: HTMLDivElement;
let root: Root;
/** Le dataset est muté EN PLACE par le save (preview mémoire) — on le repose à l'identique. */
let avant: unknown[];

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  setDataset('aaCriticalsJambe', avant as never);
});

/** Change la valeur d'un `<select>` contrôlé React (setter natif + événement `change`). */
function choisir(select: HTMLSelectElement, valeur: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(select, valeur);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const rangee = (id: string) => (datasetArray('aaCriticalsJambe') as unknown as Rangee[]).find((e) => e.id === id)!;

describe('atelier du Codex — le nœud `test` d’une rangée de Critique reste un nœud `test` (#1682)', () => {
  it('changer la Difficulté puis Enregistrer : aucun refus de schéma, le nœud garde sa forme', async () => {
    avant = structuredClone(datasetArray('aaCriticalsJambe') as unknown[]);
    const cible = rangee('aa-jambe-11');
    expect(cible.test?.kind, 'la rangée mesurée ne porte pas de nœud `test` — le geste ne mesurerait rien').toBe('test');
    expect(cible.test!.test.difficulty, 'difficulté de départ').toBe('intermediaire');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<CodexEdit categoryKey="aaCriticalsJambe" id={cible.id} onClose={() => {}} />);
    });

    // Le select de Difficulté du nœud : celui dont la valeur courante EST la difficulté de la rangée
    // (les autres selects du champ portent la Menace et le Soutien).
    const selects = [...container.querySelectorAll<HTMLSelectElement>('.codex-edit-form select')];
    const difficulte = selects.find((s) => s.value === 'intermediaire' && [...s.options].some((o) => o.value === 'tresDifficile'));
    expect(difficulte, 'aucun select de Difficulté monté — le champ `test` n’expose pas son jet').toBeTruthy();
    choisir(difficulte!, 'difficile');

    const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    expect(enregistrer.disabled, 'le bouton Enregistrer est resté inerte — le save n’a pas été joué').toBe(false);
    await act(async () => { enregistrer.click(); });

    expect(
      container.querySelector('.codex-edit-errors')?.textContent ?? '',
      'le save a été REFUSÉ par le schéma — le champ ne rend pas la forme que `noeudTest` lit',
    ).toBe('');

    const apres = rangee('aa-jambe-11');
    expect(apres.test!.kind, 'le nœud a perdu son `kind` (racine `FlowEditor` rebranchée ?)').toBe('test');
    expect(apres.test!.test.difficulty, 'la Difficulté choisie n’est pas descendue dans le nœud').toBe('difficile');
    expect(apres.test!.test.skill, 'la Compétence du nœud a été perdue').toEqual({ id: 'athletisme' });
    expect(apres.test!.success, 'la branche RÉUSSITE a été perdue').toEqual({ kind: 'seq', steps: [] });
    expect(apres.test!.fail, 'la branche ÉCHEC a été perdue').toEqual(cible.test!.fail);
    expect((apres.test as unknown as { steps?: unknown }).steps, 'le nœud a été aplati en `seq`').toBeUndefined();
  });
});
