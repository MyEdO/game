// @vitest-environment jsdom
/**
 * refs #1657 B2c (« unifier la forme du jet en donnée ») — le coup à l'ÉQUIPAGE d'un Critique de
 * coque s'édite à l'atelier et le document PARSE ENCORE son schéma.
 *
 * Contrat POSITIF, mesuré sur la donnée RÉELLE : on monte l'atelier sur « Gréement »
 * (`river-criticals.json`, un coup sous jet de Caractéristique), on change la Difficulté par le
 * select, on Enregistre — et on exige : aucun refus de schéma, et le porteur mémoire garde
 * `crewTarget` À CÔTÉ d'un nœud `{kind:'test', test, success, fail}` à la nouvelle Difficulté, ses
 * deux branches intactes.
 *
 * CE QU'IL MORD AUSSI : l'AFFORDANCE. `applyCrewHit` (`engine/shipCritical.ts`) n'applique que la
 * branche d'ÉCHEC — une branche « Si RÉUSSITE » offerte à l'auteur serait une case qui ne change
 * rien, et le schéma du porteur la refuse peuplée (`noeudTest`, option `echecSeulServi`). L'atelier
 * n'en rend donc QU'UNE ; la même primitive en rend DEUX pour une rangée de Blessure critique, qui
 * les sert (`engine/critical.ts`).
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

type Rangee = { id: string; label: string; crewHit?: { crewTarget: { poste?: true; stations?: string[]; role?: string }; test?: FlowTestNode; ops?: unknown[] } };
const CATEGORIE = 'riverCriticalsGreement';

let container: HTMLDivElement;
let root: Root;
/** Le dataset est muté EN PLACE par le save (preview mémoire) — on le repose à l'identique. */
let avant: unknown[];

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  setDataset(CATEGORIE, avant as never);
});

/** Change la valeur d'un `<select>` contrôlé React (setter natif + événement `change`). */
function choisir(select: HTMLSelectElement, valeur: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(select, valeur);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const rangee = (id: string) => (datasetArray(CATEGORIE) as unknown as Rangee[]).find((e) => e.id === id)!;

describe('atelier du Codex — le coup à l’équipage porte un nœud `test`, et n’offre que la branche servie', () => {
  it('changer la Difficulté puis Enregistrer : aucun refus de schéma, le nœud garde sa forme et `crewTarget` reste au porteur', async () => {
    avant = structuredClone(datasetArray(CATEGORIE) as unknown[]);
    const cible = rangee('greement-fluvial');
    expect(cible.crewHit?.test?.kind, 'la rangée mesurée ne porte pas de nœud `test`').toBe('test');
    expect(cible.crewHit!.test!.test.difficulty, 'difficulté de départ').toBe('intermediaire');
    expect(cible.crewHit!.crewTarget, 'MSRC 07 l.78 : « Toute personne présente sur le pont »').toEqual({ stations: ['pont'] });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<CodexEdit categoryKey={CATEGORIE} id={cible.id} onClose={() => {}} />);
    });

    // UNE seule branche rendue : celle de l'ÉCHEC (`applyCrewHit` n'applique que celle-là).
    const etiquettes = [...container.querySelectorAll('.codex-edit-form .branch-label')].map((e) => e.textContent);
    expect(etiquettes, 'l’atelier offre une branche que le moteur ne joue pas').toEqual(['Si ÉCHEC :']);

    const selects = [...container.querySelectorAll<HTMLSelectElement>('.codex-edit-form select')];
    const difficulte = selects.find((s) => s.value === 'intermediaire' && [...s.options].some((o) => o.value === 'tresDifficile'));
    expect(difficulte, 'aucun select de Difficulté monté — le champ `crewHit` n’expose pas son jet').toBeTruthy();
    choisir(difficulte!, 'difficile');

    const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    expect(enregistrer.disabled, 'le bouton Enregistrer est resté inerte — le save n’a pas été joué').toBe(false);
    await act(async () => { enregistrer.click(); });

    expect(
      container.querySelector('.codex-edit-errors')?.textContent ?? '',
      'le save a été REFUSÉ par le schéma — le champ ne rend pas la forme que `noeudTest` lit',
    ).toBe('');

    const apres = rangee('greement-fluvial');
    expect(apres.crewHit!.test!.kind, 'le nœud a perdu son `kind` (racine `FlowEditor` rebranchée ?)').toBe('test');
    expect(apres.crewHit!.test!.test.difficulty, 'la Difficulté choisie n’est pas descendue dans le nœud').toBe('difficile');
    expect(apres.crewHit!.test!.test.characteristic, 'le sujet du jet a été perdu').toBe('initiative');
    expect(apres.crewHit!.test!.success, 'la branche RÉUSSITE a été perdue').toEqual({ kind: 'seq', steps: [] });
    expect(apres.crewHit!.test!.fail, 'la branche ÉCHEC a été perdue').toEqual(cible.crewHit!.test!.fail);
    expect(apres.crewHit!.crewTarget, 'QUI encaisse a été perdu à l’édition').toEqual({ stations: ['pont'] });
    expect(apres.crewHit!.ops, 'le coup a basculé en effet certain').toBeUndefined();
  });
});

describe('atelier du Codex — la Caractéristique testée est ÉDITABLE (règle stricte 2)', () => {
  it('« Gréement » montre Initiative, la passer à Agilité puis Enregistrer : le document parse, le nœud porte `characteristic:agilite`', async () => {
    avant = structuredClone(datasetArray(CATEGORIE) as unknown[]);
    const cible = rangee('greement-fluvial');
    expect(cible.crewHit!.test!.test.characteristic, 'MSRC 07 l.78 : Test d’Initiative').toBe('initiative');
    expect(cible.crewHit!.test!.test.skill, 'ce jet n’a AUCUNE Compétence — seule la Caractéristique le porte').toBeUndefined();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<CodexEdit categoryKey={CATEGORIE} id={cible.id} onClose={() => {}} />);
    });

    const carac = container.querySelector<HTMLSelectElement>('.codex-edit-form select[aria-label="Caractéristique testée"]');
    expect(carac, 'aucun sélecteur de Caractéristique monté — le jet serait AUTHORÉ et INVISIBLE (règle stricte 2)').toBeTruthy();
    expect(carac!.value, 'le sélecteur ne MONTRE pas la Caractéristique authorée').toBe('initiative');
    choisir(carac!, 'agilite');

    const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    expect(enregistrer.disabled, 'le bouton Enregistrer est resté inerte — le save n’a pas été joué').toBe(false);
    await act(async () => { enregistrer.click(); });

    expect(
      container.querySelector('.codex-edit-errors')?.textContent ?? '',
      'le save a été REFUSÉ par le schéma après changement de Caractéristique',
    ).toBe('');
    expect(rangee('greement-fluvial').crewHit!.test!.test.characteristic, 'la Caractéristique choisie n’est pas descendue dans le nœud').toBe('agilite');
  });
});
