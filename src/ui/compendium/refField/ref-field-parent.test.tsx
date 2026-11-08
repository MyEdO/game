// @vitest-environment jsdom
/**
 * `locations.parent` désigne un Lieu par `ref('location')` (`data/schemas/defs/locations.ts`) : le Codex
 * l'édite par la route de `CodexEdit.tsx` (`ObjectField`, puis `Field` sur la feuille `idDe` de son `id`,
 * `cfgDeLaFeuille`). Le sélecteur affiche un parent existant par son libellé et écrit l'id choisi.
 */
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RefField, cfgDeLaFeuille, refFieldCfg } from './RefField';
import { datasetArray } from '../../../data/overrides';
import { inferFields } from '../../../noyau/codex/editFields';
import { metaPourFichier, noeudObjet, schemaForFile } from '../../../data/schemas/validate';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const lieux = datasetArray('locations') as { id: string; label: string; parent: { id: string } | null }[];
const enfant = lieux.find((l) => l.parent !== null)!;
const parent = lieux.find((l) => l.id === enfant.parent?.id)!;
const autre = lieux.find((l) => l.id !== enfant.id && l.id !== parent.id)!;

/** Le champ `parent` tel que le Codex l'infère, puis le champ `id` de son sous-formulaire. */
const champParent = inferFields(lieux, { meta: metaPourFichier('locations.json'), noeud: noeudObjet(schemaForFile('locations.json')) }).find((f) => f.key === 'parent');
const champId = champParent && inferFields([enfant.parent!], { niveau: 'profondeur', noeud: noeudObjet(champParent.noeud) }).find((f) => f.key === 'id');
const cfg = champId?.kind === 'text' ? cfgDeLaFeuille(champId.noeud) : undefined;

/** Monte le sélecteur de l'`id` du parent, rend son `<select>` et la valeur émise après `choix` (s'il y en a un). */
function monter(valeur: string, choix?: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const emises: unknown[] = [];
  act(() => { root.render(<RefField cfg={cfg!} noeud={champId!.noeud} value={valeur} onChange={(v) => { emises.push(v); }} />); });
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

describe('RefField — `locations.parent` est un `ref(\'location\')`', () => {
  it('la donnée porte un parent par `{ id }`, le Codex l’édite en sous-formulaire (témoin)', () => {
    expect(parent, `parent « ${enfant.parent?.id} » introuvable par id`).toBeDefined();
    expect(champParent?.kind).toBe('object');
    expect(refFieldCfg('locations', 'parent'), 'aucune config à part : la feuille `idDe` du `ref` route le sélecteur').toBeUndefined();
    expect(cfg).toEqual({ ds: 'locations', single: true });
  });

  it('un parent existant s’affiche par son libellé, jamais « (inconnu) »', () => {
    const { affiche, inconnu } = monter(parent.id);
    expect(inconnu).toBe(false);
    expect(affiche).toBe(parent.label);
  });

  it('choisir un parent écrit son id', () => {
    expect(monter(parent.id, autre.id).emises).toEqual([autre.id]);
  });
});
