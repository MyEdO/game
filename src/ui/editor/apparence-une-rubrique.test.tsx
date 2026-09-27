// @vitest-environment jsdom
/**
 * UNE rubrique « Apparence » par panneau (#1897) : l'hôte la nomme, les réglages partagés
 * (`ReglagesApparence`) se rangent dessous sans titre propre ; « Mutations » reste une rubrique à part.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { Inspector } from './Inspector';
import { NarratifEditor } from './NarratifEditor';
import { emptyScene, type Scene } from '../../state/scene';
import { emptyNarratif, type NarratifBlock } from '../../state/campaignNarratif';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(demonterRacines);

const REGLAGES = ['Espèce', 'Sexe', 'Carrure', 'Coiffure'] as const;

/** Titres de rubrique du panneau : titre de `Fold` et libellé direct d'un `.ed-field`. */
const titres = (racine: HTMLElement, texte: string): HTMLElement[] =>
  [...racine.querySelectorAll<HTMLElement>('.fold-title, .ed-field > span')].filter((e) => e.textContent?.trim() === texte);

const reglage = (racine: HTMLElement, texte: string): HTMLElement | undefined =>
  [...racine.querySelectorAll<HTMLElement>('label.ed-subfield')].find((l) => l.textContent?.trim().startsWith(texte));

function monterInspecteur(): HTMLElement {
  const scene: Scene = { ...emptyScene(4, 4), entities: [{ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain' }] };
  const montage = monterRacine(null);
  act(() =>
    montage.rendre(
      <Inspector
        scene={scene}
        otherScenes={[]}
        worldMap={null}
        setScene={() => undefined}
        sel={{ type: 'entity', id: 'pnj' }}
        setSel={() => undefined}
        enemyCreatures={[{ id: 'humain', label: 'Humain' }]}
        openLogic={() => undefined}
        resizeScene={() => undefined}
        narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
        tool={{ mode: 'select' }}
        armZoneTiles={() => undefined}
        zoneFocusKey={null}
      />,
    ),
  );
  return montage.container;
}

function HarnaisNarratif() {
  const [n, setN] = useState<NarratifBlock>(emptyNarratif());
  return <NarratifEditor narratif={n} onChange={setN} onClose={() => {}} />;
}

function monterNarratif(): HTMLElement {
  const montage = monterRacine(null);
  act(() => montage.rendre(<HarnaisNarratif />));
  const bouton = (texte: string) =>
    [...montage.container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(texte))!;
  act(() => { bouton('PNJ').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  act(() => { bouton('Ajouter un PNJ').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  return montage.container;
}

describe('rubrique Apparence — un titre par panneau, les réglages dessous', () => {
  it('Inspector : UN titre « Apparence » (le Fold), Espèce/Sexe/Carrure/Coiffure dans son corps', () => {
    const racine = monterInspecteur();
    const [titre, ...enTrop] = titres(racine, 'Apparence');
    expect(titre, 'titre « Apparence » absent').toBeTruthy();
    expect(enTrop).toHaveLength(0);
    const rubrique = titre.closest('details')!;
    for (const r of REGLAGES) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
  });

  it('NarratifEditor : UN titre « Apparence » (le champ), Espèce/Sexe/Carrure/Coiffure dans son groupe, Mutations à part', () => {
    const racine = monterNarratif();
    const [titre, ...enTrop] = titres(racine, 'Apparence');
    expect(titre, 'titre « Apparence » absent').toBeTruthy();
    expect(enTrop).toHaveLength(0);
    const rubrique = titre.parentElement!;
    for (const r of REGLAGES) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
    const [mutations] = titres(racine, 'Mutations');
    expect(mutations).toBeTruthy();
    expect(rubrique.contains(mutations)).toBe(false);
  });
});
