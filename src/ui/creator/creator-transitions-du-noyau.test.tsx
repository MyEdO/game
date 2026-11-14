// @vitest-environment jsdom
/**
 * Les gestes de l'écran du créateur passent par les transitions du brouillon du noyau (#3059) : réassignation des jets
 * (LDB 05 l.339), retrait du signe astral (ADE II 3 l.36), physique tiré.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CharScreen, StarScreen, DetailsScreen } from './CharacterCreator';
import {
  newDraft,
  withSpecies,
  withCareer,
  withCharMode,
  rollDraftChars,
  withStar,
  withStarTalentSpec,
  type CreatorDraft,
} from '../../noyau/creation/brouillon';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const pret = () => withCareer(withSpecies(newDraft(7), 'humains-reiklander'), 'soldat');
type Ecran = (p: { d: CreatorDraft; setD: (d: CreatorDraft) => void }) => ReactNode;

let container: HTMLDivElement;
let root: Root;
let draft: CreatorDraft;

/** Monte `Ecran` sur `depart` ; chaque `setD` re-rend sur le brouillon reçu. */
function monter(Ecran: Ecran, depart: CreatorDraft) {
  draft = depart;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const setD = (next: CreatorDraft) => {
    draft = next;
    act(() => { root.render(<Ecran d={draft} setD={setD} />); });
  };
  act(() => { root.render(<Ecran d={draft} setD={setD} />); });
}
const bouton = (texte: string) => {
  const b = Array.from(container.querySelectorAll('button')).find((x) => x.textContent?.includes(texte));
  if (!b) throw new Error(`bouton « ${texte} » absent`);
  return b;
};

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.unstubAllGlobals();
});

describe('Caractéristiques réassignées', () => {
  it('donner le 4ᵉ jet à la Capacité de Combat rend le 1ᵉʳ à l’Endurance', () => {
    monter(CharScreen, rollDraftChars(withCharMode(pret(), 'reassigne')));
    const selects = () => Array.from(container.querySelectorAll('select'));
    act(() => {
      const cc = selects()[0];
      cc.value = '3';
      cc.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(selects().slice(0, 4).map((s) => s.value)).toEqual(['3', '1', '2', '0']);
  });
});

describe('signe astral', () => {
  it('« Aucun signe » retire le signe et la spécialisation du Talent qu’il octroyait', () => {
    monter(StarScreen, withStarTalentSpec(withStar(pret(), 'les-deux-boeufs'), 1, 'alchimiste'));
    act(() => { bouton('Aucun signe').click(); });
    expect(draft.star).toBeUndefined();
    expect(draft.specChoices).toEqual({});
  });
});

describe('Détails', () => {
  it('« Aux dés » pose le physique tiré par le noyau (graine 7, Reiklander)', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(prefers-reduced-motion: reduce)', media: q, addEventListener() {}, removeEventListener() {} }));
    monter(DetailsScreen, pret());
    act(() => { bouton('Aux dés — tout d').click(); });
    const champ = (label: string) => (container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement).value;
    expect([champ('Âge'), champ('Taille (cm)'), champ('Yeux'), champ('Cheveux')]).toEqual(['25', '172', 'Gris', 'Brun clair']);
  });
});
