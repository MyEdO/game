// @vitest-environment jsdom
/**
 * refs #1657 B2b (« unifier la forme du jet en donnée ») — le cycle d'un SYMPTÔME s'édite à l'atelier
 * et le document PARSE ENCORE son schéma.
 *
 * Contrat POSITIF, mesuré sur la donnée RÉELLE : on monte l'atelier sur « Blessé » (`symptoms.json`,
 * le cycle sous jet le plus simple), on change la Difficulté par le select, on Enregistre — et on
 * exige : aucun refus de schéma, et le porteur mémoire garde un nœud `{kind:'test', test, success,
 * fail}` à la nouvelle Difficulté, ses deux branches intactes.
 *
 * CE QU'IL MORD AUSSI : l'AFFORDANCE. Le canal du cycle (`registerNightBandApplier('diseaseTick')`,
 * `src/state/restFlow.ts`) rend une liste VIDE sur une réussite — une branche « Si RÉUSSITE » offerte
 * à l'auteur serait une case qui ne change rien, et le schéma du porteur la refuse peuplée
 * (`noeudTest`, option `echecSeulServi`). L'atelier n'en rend donc QU'UNE, celle de l'échec ; la même
 * primitive en rend DEUX pour une rangée de Blessure critique, qui les sert (`engine/critical.ts`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray, setDataset } from '../../data/overrides';
import type { FlowTestNode } from '../../engine/flowCore';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

type Symptome = { id: string; label: string; onTick?: { test?: FlowTestNode; ops?: unknown[] } };

let container: HTMLDivElement;
let root: Root;
/** Le dataset est muté EN PLACE par le save (preview mémoire) — on le repose à l'identique. */
let avant: unknown[];

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  setDataset('symptoms', avant as never);
});

/** Change la valeur d'un `<select>` contrôlé React (setter natif + événement `change`). */
function choisir(select: HTMLSelectElement, valeur: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(select, valeur);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const symptome = (id: string) => (datasetArray('symptoms') as unknown as Symptome[]).find((e) => e.id === id)!;

describe('atelier du Codex — le cycle d’un symptôme porte un nœud `test`, et n’offre que la branche servie', () => {
  it('changer la Difficulté puis Enregistrer : aucun refus de schéma, le nœud garde sa forme', async () => {
    avant = structuredClone(datasetArray('symptoms') as unknown[]);
    const cible = symptome('blesse');
    expect(cible.onTick?.test?.kind, 'le symptôme mesuré ne porte pas de nœud `test`').toBe('test');
    expect(cible.onTick!.test!.test.difficulty, 'difficulté de départ (LDB 20)').toBe('accessible');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<CodexEdit categoryKey="symptoms" id={cible.id} onClose={() => {}} />);
    });

    // UNE seule branche rendue : celle de l'ÉCHEC (le canal `diseaseTick` n'applique que celle-là).
    const etiquettes = [...container.querySelectorAll('.codex-edit-form .branch-label')].map((e) => e.textContent);
    expect(etiquettes, 'l’atelier offre une branche que le canal ne joue pas').toEqual(['Si ÉCHEC :']);

    const selects = [...container.querySelectorAll<HTMLSelectElement>('.codex-edit-form select')];
    const difficulte = selects.find((s) => s.value === 'accessible' && [...s.options].some((o) => o.value === 'tresDifficile'));
    expect(difficulte, 'aucun select de Difficulté monté — le champ `onTick` n’expose pas son jet').toBeTruthy();
    choisir(difficulte!, 'difficile');

    const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    expect(enregistrer.disabled, 'le bouton Enregistrer est resté inerte — le save n’a pas été joué').toBe(false);
    await act(async () => { enregistrer.click(); });

    expect(
      container.querySelector('.codex-edit-errors')?.textContent ?? '',
      'le save a été REFUSÉ par le schéma — le champ ne rend pas la forme que `noeudTest` lit',
    ).toBe('');

    const apres = symptome('blesse');
    expect(apres.onTick!.test!.kind, 'le nœud a perdu son `kind` (racine `FlowEditor` rebranchée ?)').toBe('test');
    expect(apres.onTick!.test!.test.difficulty, 'la Difficulté choisie n’est pas descendue dans le nœud').toBe('difficile');
    expect(apres.onTick!.test!.success, 'la branche RÉUSSITE a été perdue').toEqual({ kind: 'seq', steps: [] });
    expect(apres.onTick!.test!.fail, 'la branche ÉCHEC a été perdue').toEqual(cible.onTick!.test!.fail);
    expect(apres.onTick!.ops, 'le cycle a basculé en effet certain').toBeUndefined();
  });
});
