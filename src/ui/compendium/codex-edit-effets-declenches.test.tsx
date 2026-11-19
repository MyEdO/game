// @vitest-environment jsdom
/**
 * #4056 — le Flow d'un effet déclenché n'enchaîne que des `ops` (`triggeredEffectSchema`) : l'atelier du
 * Codex n'y offre aucune autre feuille, ni à l'ajout ni au changement de type, et la feuille d'un autre
 * type y dit son refus.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { EFFECT_LABEL } from '../editor/EffectList';
import { entreeDe, menuDe, ouvrirMenu } from '../editor/AddMenu.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

/** Les types d'Effet qu'offre `menu` ouvert. */
async function offerts(menu: HTMLDetailsElement): Promise<string[]> {
  const boite = await ouvrirMenu(menu);
  const vus = Object.values(EFFECT_LABEL).filter((l) => entreeDe(boite, l));
  await act(async () => { menu.querySelector('summary')!.click(); });
  return vus;
}

describe('atelier du Codex — le Flow d’un effet déclenché n’offre que la feuille `ops`', () => {
  it('« + Bloc » et « Type : » d’un effet du Trait Constricteur n’offrent que les opérations', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CodexEdit categoryKey="traits" id="constricteur" onClose={() => {}} />); });
    const effet = container.querySelector('.trait-effect');
    expect(effet, 'aucun effet déclenché monté').toBeTruthy();
    for (const menu of [menuDe(effet!, '+ Bloc'), menuDe(effet!, /^Type :/)]) {
      expect(await offerts(menu)).toEqual([EFFECT_LABEL.ops]);
    }
  });
});
