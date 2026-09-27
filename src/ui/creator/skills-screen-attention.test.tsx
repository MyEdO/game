// @vitest-environment jsdom
/**
 * #535 DoD (verbatim, `gh issue view 535`) : « même comportement pour les volets d'allocation de
 * l'étape 5 ». Étape 5 (Compétences & Talents) n'a PAS de cérémonie de tirage séquentielle comme
 * l'étape 3 (le geste « Répartition par défaut »/« +5 sur les huit » est instantané, sans
 * minuteur) — l'événement d'ARRIVÉE équivalent est le montage/la bascule de sous-onglet
 * (`SkillsScreen`, `sub` race/career). Le volet « c. Talents » n'a AUCUNE rangée d'ALLOCATION
 * (radiogroups « un au choix », #519) : explicitement HORS PÉRIMÈTRE du DoD, vérifié ci-dessous.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SkillsScreen } from './CharacterCreator';
import { newDraft, withSpecies, withCareer, type CreatorDraft } from './draft';
import { speciesSkillDefaults } from '../../engine/character';
import { species as allSpecies, careersForSpecies } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const CAREER = careersForSpecies(SP.refCareer)[0]!;

describe("SkillsScreen (étape 5) — auto-scroll de la 1ʳᵉ rangée d'allocation NON SOLDÉE à l'arrivée sur le volet (#535 DoD)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const scrollSpy = vi.fn();
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  function mount(sub: 'race' | 'career' | 'talents', preset?: (d: CreatorDraft) => CreatorDraft) {
    let d: CreatorDraft = withCareer(withSpecies(newDraft(7), SP.id), CAREER.id);
    if (preset) d = preset(d);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const setD = (next: CreatorDraft) => { d = next; act(() => { root.render(<SkillsScreen d={d} setD={setD} skillsSub={sub} setSkillsSub={() => {}} />); }); };
    act(() => { root.render(<SkillsScreen d={d} setD={setD} skillsSub={sub} setSkillsSub={() => {}} />); });
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    Element.prototype.scrollIntoView = originalScrollIntoView;
    scrollSpy.mockClear();
  });

  it("volet « a. Compétences de race », rien d'alloué : la 1ʳᵉ Compétence (Calme) est ramenée en vue au montage", () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount('race');
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const el = scrollSpy.mock.instances[0] as Element;
    expect(el.textContent).toContain('Calme');
  });

  it("volet « a. Compétences de race » DÉJÀ soldé (Répartition par défaut posée avant l'arrivée) : aucun scroll — rien à signaler", () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount('race', (d) => ({
      ...d,
      speciesPlus5: speciesSkillDefaults(SP).plus5,
      speciesPlus3: speciesSkillDefaults(SP).plus3,
    }));
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("volet « b. de carrière », rien d'alloué : la 1ʳᵉ Compétence de carrière est ramenée en vue au montage", () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount('career');
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const el = scrollSpy.mock.instances[0] as Element;
    expect(el.querySelector('.plaque-value')).toBeTruthy(); // une vraie rangée d'allocation (PlaqueRow)
  });

  it('volet « c. Talents » : AUCUN scroll au montage — pas de rangée d\'ALLOCATION à ce volet (radiogroups « un au choix », hors périmètre du DoD)', () => {
    Element.prototype.scrollIntoView = scrollSpy;
    mount('talents');
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
