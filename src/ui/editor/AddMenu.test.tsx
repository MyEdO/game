// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { AddMenu } from './AddMenu';
import { placerAncre, type PlacementAncre } from '../BoiteAncree';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** La vue de RÉFÉRENCE des recettes, lue à sa source unique (#1847) : la POSE du menu se juge dans
 *  la fenêtre où l'écran est jugé, jamais dans un viewport inventé au test. Chemin depuis la racine
 *  du dépôt : sous `@vitest-environment jsdom`, `import.meta.url` n'est pas une URL `file:`. */
const VUE = JSON.parse(readFileSync('scripts/recette/vues-recette.json', 'utf8'))
  .find((v: { nom: string }) => v.nom === 'bureau') as { largeur: number; hauteur: number };
const VP = { width: VUE.largeur, height: VUE.hauteur };
const MENU_W = 330;
const placer = (r: { top: number; bottom: number; left: number }) => placerAncre(r, VP.width, VP.height, MENU_W);
/** Bords verticaux de la boîte : ancrée par le haut (`top`) ou par le bas (`bottom`). */
const bords = (p: PlacementAncre) => (p.top != null
  ? { haut: p.top, bas: p.top + p.maxHeight }
  : { haut: VP.height - p.bottom! - p.maxHeight, bas: VP.height - p.bottom! });
/** Le menu tient-il ENTIER dans le viewport ? */
const tientAEcran = (p: PlacementAncre) => bords(p).haut >= 0 && bords(p).bas <= VP.height;

describe('AddMenu — le menu d’ajout se pose TOUJOURS entier à l’écran (`BoiteAncree`)', () => {
  it('un bouton au BAS du dock Logique ouvre le menu VERS LE HAUT, collé à son bouton', () => {
    // Mesure de recette sur La Diligence : le bouton « + Bloc » est au RAS du bas du panneau — ici
    // son HAUT à 48px du bord bas de la vue, donc son bas à 28px, quelle que soit la hauteur de
    // celle-ci : trop près pour qu'un menu de 300px s'ouvre vers le bas.
    const hautDuBouton = VP.height - 48;
    const p = placer({ top: hautDuBouton, bottom: hautDuBouton + 20, left: 322 });
    expect(p.top, 'ancré par le BAS : un menu court reste collé à son bouton').toBeUndefined();
    expect(bords(p).bas).toBeLessThanOrEqual(hautDuBouton); // au-dessus du bouton
    expect(p.maxHeight).toBeGreaterThan(300); // la place du dessus, bornée à 60 % de la vue
    expect(tientAEcran(p)).toBe(true);
  });

  it('un bouton en HAUT de panneau ouvre le menu vers le bas, entièrement visible', () => {
    const p = placer({ top: 120, bottom: 140, left: 322 });
    expect(p.top).toBeGreaterThanOrEqual(140);
    expect(tientAEcran(p)).toBe(true);
  });

  it('un bouton au MILIEU garde la hauteur bornée par la place réelle du côté choisi', () => {
    const p = placer({ top: 700, bottom: 720, left: 322 });
    expect(tientAEcran(p)).toBe(true);
    expect(p.maxHeight).toBeLessThanOrEqual(700 - 6 - 8);
  });

  it('un bouton près du bord DROIT rentre le menu dans la largeur (330px + marge)', () => {
    const p = placer({ top: 200, bottom: 220, left: 1500 });
    expect(p.left + MENU_W).toBeLessThanOrEqual(VP.width);
    expect(p.left).toBeGreaterThanOrEqual(8);
  });
});

const GROUPES = [
  { title: 'Narration', items: [{ key: 'journal', label: 'Journal', onPick: () => undefined }] },
];

describe('AddMenu — le menu ouvert reste SOLIDAIRE de son bouton', () => {
  it('suit son bouton quand le panneau qui le porte défile', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<AddMenu label="+ Effet" groups={GROUPES} />);
    });
    const details = container.querySelector('details.eff-add') as HTMLDetailsElement;
    const summary = details.querySelector('summary')!;
    /** Le bouton vit dans un panneau défilant : sa position à l'écran suit le défilement. */
    let hautDuBouton = 300;
    Object.defineProperty(summary, 'getBoundingClientRect', {
      value: () => ({ top: hautDuBouton, bottom: hautDuBouton + 20, left: 322 }),
    });
    const attendu = (top: number) => {
      const p = placerAncre({ top, bottom: top + 20, left: 322 }, window.innerWidth, window.innerHeight, MENU_W);
      return p.top != null ? `${p.top}px` : `bottom ${p.bottom}px`;
    };
    const posee = () => {
      const menu = document.querySelector<HTMLElement>('.eff-add-menu');
      expect(menu, 'le menu ouvert est à l’écran').not.toBeNull();
      const top = menu!.style.getPropertyValue('--ancre-top');
      return top !== 'auto' ? top : `bottom ${menu!.style.getPropertyValue('--ancre-bottom')}`;
    };

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    expect(posee()).toBe(attendu(300));

    hautDuBouton = 120; // le panneau a défilé de 180 px
    await act(async () => {
      container.dispatchEvent(new Event('scroll'));
    });
    expect(posee()).toBe(attendu(120));
    expect(attendu(120)).not.toBe(attendu(300));

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
