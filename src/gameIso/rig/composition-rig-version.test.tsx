// @vitest-environment jsdom
/** #2967 ; #2113 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CharacterPreview } from '../../ui/CharacterPreview';
import { setDataset } from '../../data/overrides';
import { creatures, trappings, findTrappingById } from '../../data';
import { CreaturePreview } from '../../ui/compendium/CreaturePreview';
import { WEAPON_DEFS } from './parts/weapons/_registry.generated';
import { createHero } from '../../engine/character';
import { buildWeapon, itemFromTrappingById, weaponFromItem } from '../../engine/items';
import type { Combatant, Weapon } from '../../engine/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const slugs = new Set(WEAPON_DEFS.map((d) => d.slug));
const armeDeCatalogue = trappings.find((t) => t.shape && slugs.has(t.shape.id))!;
const autreForme = [...slugs].find((s) => s !== armeDeCatalogue.shape?.id)!;
const catalogueDOrigine = trappings.slice();
const bestiaireDOrigine = creatures.slice();

/** Héros qui porte `arme`, rendu par la poupée depuis son état (`CharacterPreview hero`). */
function héros(arme: Weapon): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 4 });
  h.weapons = [arme];
  return h;
}
const éditerLaForme = (id: string, shape: string) => setDataset('trappings', trappings.map((t) => (t.id === id ? { ...t, shape: { id: shape } } : t)));

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

describe('surface React montée : la forme d’un objet reste celle de sa naissance', () => {
  const PORTEURS: [string, () => Combatant, () => void][] = [
    [
      'arme invoquée (`form`)',
      () => héros(buildWeapon({ label: 'x', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [], shape: findTrappingById(armeDeCatalogue.id)!.shape })),
      () => éditerLaForme(armeDeCatalogue.id, autreForme),
    ],
    ['Possession portée (`trappingId`)', () => héros(weaponFromItem(itemFromTrappingById('arbalete')!, 'main')), () => éditerLaForme('arbalete', 'hache_lancer')],
  ];
  for (const [nom, porteur, éditer] of PORTEURS)
    it(`${nom} : l’édition de fiche affecte les nouvelles naissances et conserve le dessin de l’objet porté`, () => {
      hôte = document.createElement('div');
      document.body.appendChild(hôte);
      root = createRoot(hôte);
      act(() => root!.render(<CharacterPreview hero={porteur()} />));
      const avant = hôte.innerHTML;
      expect(avant, 'PRÉMISSE : l’aperçu dessine un rig').toContain('data-bone="arme"');

      act(éditer);

      expect(hôte.innerHTML, 'la forme de l’objet né est conservée').toBe(avant);
      act(() => root!.render(<CharacterPreview hero={porteur()} />));
      expect(hôte.innerHTML, 'une nouvelle naissance prend la forme éditée').not.toBe(avant);
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
