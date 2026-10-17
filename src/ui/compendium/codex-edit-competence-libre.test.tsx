// @vitest-environment jsdom
/**
 * Atelier du Codex — Compétence libre d'une Activité (`freeSkill`, EDOC 8 l.172) : l'aide du champ se
 * lit au méta du schéma (`schemas/defs/activities.ts`), et la liste vidée retourne à l'absence (#1595).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray, setDataset } from '../../data/overrides';
import { metaPourFichier } from '../../data/schemas/validate';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

type Activite = { id: string; freeSkill?: { id: string; spec?: string }[] };
const ID = 'pratiquer-competence';

function monter() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey="activities" id={ID} onClose={() => {}} />); });
}

const meta = metaPourFichier('activities.json')!.freeSkill;
const champLibre = () => [...container.querySelectorAll<HTMLElement>('.ed-field')]
  .find((f) => f.firstElementChild?.textContent === `${meta.label} — ${meta.hint}`);

describe('atelier du Codex — Compétence libre d’une Activité', () => {
  it('l’aide du champ est le libellé et l’aide du méta du schéma', () => {
    monter();
    expect(champLibre(), 'aucun champ ne porte l’aide du méta `freeSkill`').toBeTruthy();
  });

  it('vidée, `freeSkill` retourne à l’absence : Enregistrer passe le schéma, l’entrée ne porte plus de `freeSkill`', async () => {
    const avant = (datasetArray('activities') as Activite[]).slice();
    expect(avant.find((a) => a.id === ID)?.freeSkill?.length, 'Pratiquer ne porte aucune Compétence libre').toBeGreaterThan(0);
    try {
      monter();
      const retirer = () => champLibre()!.querySelector<HTMLButtonElement>('button[title="Retirer"]');
      while (retirer()) act(() => { retirer()!.click(); });
      const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
      expect(enregistrer.disabled, 'le vidage n’a rien émis').toBe(false);
      await act(async () => { enregistrer.click(); });
      const posee = (datasetArray('activities') as Activite[]).find((a) => a.id === ID)!;
      expect(posee, 'l’enregistrement a été refusé').not.toBe(avant.find((a) => a.id === ID));
      expect(posee.freeSkill, '`freeSkill: []` posé au lieu de l’absence').toBeUndefined();
    } finally {
      setDataset('activities', avant as never);
    }
  });
});
