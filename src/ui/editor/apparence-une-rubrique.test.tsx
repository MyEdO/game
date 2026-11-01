// @vitest-environment jsdom
/**
 * UNE rubrique « Apparence » par panneau (#1897) : l'hôte la nomme, les réglages de la brique
 * (`ReglagesApparence`, classe `.reglage-apparence`) se rangent dessous sans titre propre.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { Inspector } from './Inspector';
import { NarratifEditor, type ProjetEdite } from './NarratifEditor';
import { CodexEdit, dedicatedFieldKeys } from './codex/CodexEdit';
import { datasetArray } from '../../data/overrides';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(demonterRacines);

const REGLAGES_AUTEUR = ['Espèce', 'Sexe'] as const;

/** Texte PROPRE d'un titre (ses nœuds texte directs, sans le sous-titre `<small>` d'une `Band`). */
const texteDuTitre = (e: HTMLElement): string =>
  [...e.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();

/** Titres de rubrique : titre de `Fold`, libellé direct d'un `.ed-field`, titre de `Band`. */
const titres = (racine: HTMLElement, texte: string): HTMLElement[] =>
  [...racine.querySelectorAll<HTMLElement>('.fold-title, .ed-field > span, .creator-band-head h3')].filter((e) => texteDuTitre(e) === texte);

const reglage = (racine: HTMLElement, texte: string): HTMLElement | undefined =>
  [...racine.querySelectorAll<HTMLElement>('label.reglage-apparence')].find((l) => l.textContent?.trim().startsWith(texte));

function monterInspecteur(): HTMLElement {
  const scene: Scene = { ...emptyScene('scene-test', 4, 4), entities: [{ id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain' }] };
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
        narratif={emptyNarratif()}
        tool={{ mode: 'select' }}
        armZoneTiles={() => undefined}
        zoneFocusKey={null}
      />,
    ),
  );
  return montage.container;
}

function HarnaisNarratif() {
  const [p, setP] = useState<ProjetEdite>({ scenes: [], worldMap: null, narratif: emptyNarratif() });
  return <NarratifEditor projet={p} onChange={setP} onClose={() => {}} />;
}

function monterNarratif(): HTMLElement {
  const montage = monterRacine(null);
  act(() => montage.rendre(<HarnaisNarratif />));
  const bouton = (texte: string) =>
    [...montage.container.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(texte))!;
  act(() => { bouton('PNJ').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  act(() => { bouton('Ajouter un PNJ').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  const ongletApparence = [...montage.container.querySelectorAll<HTMLElement>('[aria-label="Rubriques du PNJ"] [role="tab"]')]
    .find((t) => t.textContent?.trim() === 'Apparence');
  expect(ongletApparence, 'onglet « Apparence » du PNJ absent').toBeTruthy();
  act(() => { ongletApparence!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  return montage.container;
}

function monterCodex(): HTMLElement {
  const creature = datasetArray('creatures').find((c) => (c as { appearance?: EntityAppearance }).appearance?.species) as { id: string; label: string };
  return monterRacine(<CodexEdit categoryKey="creatures" id={creature.id} onClose={() => {}} />).container;
}

/** La rubrique « Apparence » unique du panneau, et son conteneur. */
function rubriqueApparence(racine: HTMLElement, conteneur: (titre: HTMLElement) => HTMLElement): HTMLElement {
  const [titre, ...enTrop] = titres(racine, 'Apparence');
  expect(titre, 'titre « Apparence » absent').toBeTruthy();
  expect(enTrop).toHaveLength(0);
  return conteneur(titre);
}

describe('rubrique Apparence — un titre par panneau, les réglages de la brique dessous', () => {
  it('Inspector : UN titre « Apparence » (le Fold), Espèce/Sexe dans son corps', () => {
    const racine = monterInspecteur();
    const rubrique = rubriqueApparence(racine, (t) => t.closest('details')!);
    for (const r of REGLAGES_AUTEUR) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
    expect(titres(racine, 'Apparence aléatoire')).toHaveLength(0);
  });

  it('NarratifEditor : UN titre « Apparence » (le champ), Espèce/Sexe dans son groupe', () => {
    const racine = monterNarratif();
    const rubrique = rubriqueApparence(racine, (t) => t.parentElement!);
    for (const r of REGLAGES_AUTEUR) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
  });

  it('Codex (créature) : UN titre « Apparence » (le champ), Espèce/Sexe et l’armure visible dans son groupe', () => {
    const racine = monterCodex();
    const rubrique = rubriqueApparence(racine, (t) => t.parentElement!);
    for (const r of REGLAGES_AUTEUR) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
    expect(rubrique.textContent).toContain('Porter l’armure du profil');
  });

  it.each(['traits', 'mutations'] as const)('Codex (%s) : aucun champ « Apparence », le schéma de la catégorie le refuse', (categorie) => {
    const entree = datasetArray(categorie)[0] as { id: string };
    const racine = monterRacine(<CodexEdit categoryKey={categorie} id={entree.id} onClose={() => {}} />).container;
    expect(racine.querySelector('.codex-edit-form'), 'le formulaire est monté').not.toBeNull();
    expect(titres(racine, 'Apparence')).toHaveLength(0);
    expect(dedicatedFieldKeys(categorie).has('appearance')).toBe(false);
  });
});

