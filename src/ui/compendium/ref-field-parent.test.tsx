// @vitest-environment jsdom
/**
 * `locations.parent` porte un `LocationData.id` (`data/schemas/defs/locations.ts`) : le sélecteur du
 * Codex (`RefField`, mode `single`) écrit l'id choisi et affiche un parent existant par son libellé.
 */
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RefField, refFieldCfg } from './RefField';
import { datasetArray } from '../../data/overrides';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const lieux = datasetArray('locations') as { id: string; label: string; parent?: string | null }[];
const enfant = lieux.find((l) => typeof l.parent === 'string')!;
const parent = lieux.find((l) => l.id === enfant.parent)!;
const autre = lieux.find((l) => l.id !== enfant.id && l.id !== parent.id)!;

/** Monte le champ `parent` d'un lieu, rend son `<select>` et la valeur émise après `choix` (s'il y en a un). */
function monter(valeur: unknown, choix?: string) {
  const cfg = refFieldCfg('locations', 'parent');
  expect(cfg, 'config `locations.parent` absente').toBeDefined();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const emises: unknown[] = [];
  act(() => { root.render(<RefField cfg={cfg!} value={valeur} onChange={(v) => { emises.push(v); }} nullable />); });
  const select = host.querySelector('select')!;
  const affiche = select.selectedOptions[0]?.textContent;
  const inconnu = host.textContent?.includes('(inconnu)');
  if (choix !== undefined) {
    act(() => {
      select.value = choix;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  act(() => { root.unmount(); });
  host.remove();
  return { affiche, inconnu, emises };
}

describe('RefField — `locations.parent` est une réf id', () => {
  it('la donnée porte un parent par id (témoin de la fixture)', () => {
    expect(enfant).toBeDefined();
    expect(parent, `parent « ${enfant.parent} » introuvable par id`).toBeDefined();
  });

  it('un parent existant s’affiche par son libellé, jamais « (inconnu) »', () => {
    const { affiche, inconnu } = monter(enfant.parent);
    expect(inconnu).toBe(false);
    expect(affiche).toBe(parent.label);
  });

  it('choisir un parent écrit son id', () => {
    expect(monter(enfant.parent, autre.id).emises).toEqual([autre.id]);
  });
});
