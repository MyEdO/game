// @vitest-environment jsdom
/**
 * #2097 A7 — une surface React montée recompose son rig à l'édition d'un catalogue : la forme de
 * l'arme invoquée (`form` → `shape` du trapping) éditée par `setDataset('trappings', …)` change son
 * dessin sans autre rendu de l'appelant (`useCompositionRig`, témoin `abonnerAuxDatasets`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CharacterPreview } from '../../ui/CharacterPreview';
import { setDataset } from '../../data/overrides';
import { creatures, trappings } from '../../data';
import { CreaturePreview } from '../../ui/compendium/CreaturePreview';
import { WEAPON_DEFS } from './parts/weapons/_registry.generated';
import { equipDe } from './parts/equipment';
import { asRigSpeciesId } from './appearance';
import type { Weapon } from '../../engine/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const slugs = new Set(WEAPON_DEFS.map((d) => d.slug));
const armeDeCatalogue = trappings.find((t) => t.shape && slugs.has(t.shape))!;
const autreForme = [...slugs].find((s) => s !== armeDeCatalogue.shape)!;
const catalogueDOrigine = trappings.slice();
const bestiaireDOrigine = creatures.slice();

const APPARENCE = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 4 } as const;
const EQUIPEMENT = equipDe([{ label: 'x', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [], form: armeDeCatalogue.id } as unknown as Weapon], []);

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  hôte?.remove();
  hôte = null;
  act(() => setDataset('trappings', catalogueDOrigine));
  act(() => setDataset('creatures', bestiaireDOrigine));
});

describe('surface React montée : l’édition d’un catalogue recompose son rig', () => {
  it('la forme de l’arme éditée au catalogue change le dessin de l’aperçu', () => {
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    act(() => root!.render(<CharacterPreview appearance={APPARENCE} equip={EQUIPEMENT} career="soldat" />));
    const avant = hôte.innerHTML;
    expect(avant, 'PRÉMISSE : l’aperçu dessine un rig').toContain('data-bone="arme"');

    act(() => setDataset('trappings', trappings.map((t) => (t.id === armeDeCatalogue.id ? { ...t, shape: autreForme } : t))));

    expect(hôte.innerHTML, 'l’aperçu n’a pas suivi l’édition du catalogue').not.toBe(avant);
  });
});

describe('aperçu de créature monté : l’édition du record de bestiaire le redessine (C6)', () => {
  it('`armurePortee` retirée au record : l’armure d’art quitte l’aperçu', () => {
    const id = 'capitaine-du-guet';
    expect(creatures.find((c) => c.id === id)?.appearance?.armurePortee, 'PRÉMISSE : le record porte son armure').toBe(true);
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    act(() => root!.render(<CreaturePreview label={id} />));
    const avant = hôte.innerHTML;
    expect(avant, 'PRÉMISSE : l’aperçu dessine un rig').toContain('data-bone=');

    act(() => setDataset('creatures', creatures.map((c) => (c.id === id ? { ...c, appearance: { ...c.appearance!, armurePortee: false } } : c))));

    expect(hôte.innerHTML, 'l’aperçu n’a pas suivi l’édition du bestiaire').not.toBe(avant);
  });
});
