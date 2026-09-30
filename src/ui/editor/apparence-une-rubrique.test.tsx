// @vitest-environment jsdom
/**
 * UNE rubrique « Apparence » par panneau (#1897) : l'hôte la nomme, les réglages de la brique
 * (`ReglagesApparence`, classe `.reglage-apparence`) se rangent dessous sans titre propre ; « Mutations »
 * est une rubrique sœur.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { Inspector } from './Inspector';
import { NarratifEditor } from './NarratifEditor';
import { ReglagesApparence } from './MonsterPartsFields';
import { CodexEdit } from '../compendium/CodexEdit';
import { DetailsScreen } from '../creator/CharacterCreator';
import { newDraft, withSpecies, withCareer, type CreatorDraft } from '../creator/draft';
import { species as allSpecies, careersForSpecies } from '../../data';
import { datasetArray } from '../../data/overrides';
import { hairstylesForSex } from '../../gameIso/rig/parts/hairstyles';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { emptyScene, type Scene } from '../../state/scene';
import { emptyNarratif, type NarratifBlock } from '../../state/campaignNarratif';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(demonterRacines);

const REGLAGES_AUTEUR = ['Espèce', 'Sexe', 'Morphologie', 'Coiffure'] as const;

/** Texte PROPRE d'un titre (ses nœuds texte directs, sans le sous-titre `<small>` d'une `Band`). */
const texteDuTitre = (e: HTMLElement): string =>
  [...e.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();

/** Titres de rubrique : titre de `Fold`, libellé direct d'un `.ed-field`, titre de `Band`. */
const titres = (racine: HTMLElement, texte: string): HTMLElement[] =>
  [...racine.querySelectorAll<HTMLElement>('.fold-title, .ed-field > span, .creator-band-head h3')].filter((e) => texteDuTitre(e) === texte);

const reglage = (racine: HTMLElement, texte: string): HTMLElement | undefined =>
  [...racine.querySelectorAll<HTMLElement>('label.reglage-apparence')].find((l) => l.textContent?.trim().startsWith(texte));

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

function monterCodex(): HTMLElement {
  const creature = datasetArray('creatures').find((c) => (c as { appearance?: EntityAppearance }).appearance?.species) as { id: string; label: string };
  return monterRacine(<CodexEdit categoryKey="creatures" id={creature.id} onClose={() => {}} />).container;
}

const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const brouillonPret = (): CreatorDraft => withCareer(withSpecies(newDraft(7), SP.id), careersForSpecies(SP.refCareer)[0]!.id);

function HarnaisDetails({ depart }: { depart: CreatorDraft }) {
  const [d, setD] = useState(depart);
  return <DetailsScreen d={d} setD={setD} />;
}

function monterDetails(): HTMLElement {
  return monterRacine(<HarnaisDetails depart={brouillonPret()} />).container;
}

/** La rubrique « Apparence » unique du panneau, et son conteneur. */
function rubriqueApparence(racine: HTMLElement, conteneur: (titre: HTMLElement) => HTMLElement): HTMLElement {
  const [titre, ...enTrop] = titres(racine, 'Apparence');
  expect(titre, 'titre « Apparence » absent').toBeTruthy();
  expect(enTrop).toHaveLength(0);
  return conteneur(titre);
}

describe('rubrique Apparence — un titre par panneau, les réglages de la brique dessous', () => {
  it('Inspector : UN titre « Apparence » (le Fold), Espèce/Sexe/Morphologie/Coiffure/Visage dans son corps', () => {
    const racine = monterInspecteur();
    const rubrique = rubriqueApparence(racine, (t) => t.closest('details')!);
    for (const r of [...REGLAGES_AUTEUR, 'Visage']) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
    expect(titres(racine, 'Apparence aléatoire')).toHaveLength(0);
  });

  it('NarratifEditor : UN titre « Apparence » (le champ), Espèce/Sexe/Morphologie/Coiffure dans son groupe, Mutations à part', () => {
    const racine = monterNarratif();
    const rubrique = rubriqueApparence(racine, (t) => t.parentElement!);
    for (const r of REGLAGES_AUTEUR) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
    const [mutations] = titres(racine, 'Mutations');
    expect(mutations).toBeTruthy();
    expect(rubrique.contains(mutations)).toBe(false);
  });

  it('Codex (créature) : UN titre « Apparence » (le champ), Espèce/Sexe/Morphologie/Coiffure et l’armure visible dans son groupe, Mutations à part', () => {
    const racine = monterCodex();
    const rubrique = rubriqueApparence(racine, (t) => t.parentElement!);
    for (const r of REGLAGES_AUTEUR) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
    expect(rubrique.textContent).toContain('Armure du profil visible sur la figurine');
    const [mutations] = titres(racine, 'Mutations');
    expect(mutations).toBeTruthy();
    expect(rubrique.contains(mutations)).toBe(false);
  });

  it('Créateur, écran Détails : UN titre « Apparence » (la bande), Coiffure/Morphologie/Visage dans son corps, aucun Sexe dans la brique', () => {
    const racine = monterDetails();
    const rubrique = rubriqueApparence(racine, (t) => t.closest<HTMLElement>('.creator-band')!);
    for (const r of ['Coiffure', 'Morphologie', 'Visage']) expect(rubrique.contains(reglage(racine, r) ?? null), r).toBe(true);
    expect(reglage(racine, 'Sexe')).toBeUndefined();
    expect(reglage(racine, 'Espèce')).toBeUndefined();
  });
});

/** Patron `propRefPatch` (`ui/editor/propDefaults.ts`) : le geste de la brique passe par `apparenceSuivante`. */
describe('ReglagesApparence — la coiffure retombe quand le sexe change', () => {
  it('coiffure M puis sexe F : la valeur émise n’a plus de coiffure', () => {
    const onChange = vi.fn();
    const coiffureM = hairstylesForSex('M')[0].id;
    const { container } = monterRacine(
      <ReglagesApparence appearance={{ sex: 'M', hairstyle: coiffureM } satisfies EntityAppearance} onChange={onChange} reglages={['sex', 'hairstyle']} />,
    );
    const sexe = reglage(container, 'Sexe')!.querySelector('select')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sexe, 'F');
      sexe.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith({ sex: 'F' });
  });
});
