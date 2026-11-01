// @vitest-environment jsdom
/**
 * #3116 — le mode `polymorphe` de `RefField` restreint la fiche à la sous-liste que déclare la BRANCHE choisie :
 * `habille` (`defs/garde-robe.ts`), branche `tenue`, n'offre que les tenues de la garde-robe. Le nœud du
 * champ est celui que `inferFields` infère, route du Codex (`Field` de `CodexEdit.tsx`).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RefField, cfgDuNoeudType } from './RefField';
import { inferFields } from '../editFields';
import { datasetArray } from '../../../data/overrides';
import { metaPourFichier, noeudObjet, schemaForFile } from '../../../data/schemas/validate';
import { file } from '../../../data/schemas/defs/garde-robe';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Le nœud du champ `habille` de la garde-robe, tel que le Codex l'infère. */
function noeudDHabille(): unknown {
  const champ = inferFields(datasetArray('gardeRobe') as unknown as Record<string, unknown>[], { meta: metaPourFichier(file), noeud: noeudObjet(schemaForFile(file)) })
    .find((f) => f.key === 'habille');
  expect(champ, 'le Codex n’infère aucun champ `habille`').toBeDefined();
  return champ!.noeud;
}

/** Les valeurs d'option de la fiche d'un `habille` de type `type` (hors choix vide). */
function fiches(type: string): string[] {
  const noeud = noeudDHabille();
  const cfg = cfgDuNoeudType(noeud);
  expect(cfg, 'le nœud `habille` n’est pas une référence typée').toBeDefined();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(<RefField cfg={cfg!} noeud={noeud} label="Habille" value={{ id: '', type }} onChange={() => {}} />); });
  const fiche = host.querySelector<HTMLSelectElement>('select[aria-label="Habille — fiche"]');
  const valeurs = fiche ? [...fiche.options].map((o) => o.value).filter((v) => v !== '') : [];
  act(() => { root.unmount(); });
  host.remove();
  expect(fiche, 'aucun sélecteur de fiche').toBeTruthy();
  return valeurs;
}

describe('`habille` à l’atelier : la branche `tenue` se restreint à sa sous-liste (#3116)', () => {
  it('la fiche d’une tenue offre `uniforme-de-soldat` et refuse une pièce (`chemise`)', () => {
    const offertes = fiches('tenue');
    expect(offertes).toContain('uniforme-de-soldat');
    expect(offertes).not.toContain('chemise');
  });
});
