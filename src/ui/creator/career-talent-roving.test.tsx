// @vitest-environment jsdom
/**
 * #519 — comportement clavier RÉEL du radiogroup « Talent de carrière » (`CharacterCreator.tsx`,
 * zone `talentsZones`) : flèches déplacent focus + sélection (selection-follows-focus), Home/End,
 * et le SAUT des cartes `disabled` (Maxi atteint) — l'angle mort signalé par le juge de réfutation,
 * NON couvert par les tests SSR (`CharacterCreator.test.tsx`, `renderToStaticMarkup`, aucun clavier).
 * Patron réel du repo pour les tests clavier interactifs (`@testing-library` n'est PAS une
 * dépendance du projet, vérifié — aucun `fireEvent` nulle part dans `src/`) :
 * `createRoot`/`act`/`element.dispatchEvent(new KeyboardEvent(...))`, cf. `MasterDetail.test.tsx`.
 *
 * Fixture déterministe (seed 27, espèce/carrière par défaut de `CharacterCreator.test.tsx`) :
 * après `rollDraftTalents`, les 4 talents de carrière niveau 1 de l'Agitateur sont Baratiner /
 * Faire la manche / Lire·Écrire (déjà possédé via le tirage aléatoire de race → MAXI atteint,
 * `talentMaxReached`) / Sociable — un cas réel, pas fabriqué.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SkillsScreen } from './CharacterCreator';
import { newDraft, withSpecies, withCareer, rollDraftTalents, type CreatorDraft } from './draft';
import { species as allSpecies, careersForSpecies } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const SP = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const CAREER = careersForSpecies(SP.refCareer)[0]!;
/** seed 27 — Lire/Écrire (index 2) est MAXI atteint (déjà possédé via le tirage aléatoire de race). */
const fixture = () => rollDraftTalents(withCareer(withSpecies(newDraft(27), SP.id), CAREER.id));

describe('CharacterCreator — roving clavier du radiogroup « Talent de carrière » (#519)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let draft: CreatorDraft;

  function mount() {
    draft = fixture();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const setD = (next: CreatorDraft) => {
      draft = next;
      act(() => { root.render(<SkillsScreen d={draft} setD={setD} skillsSub="talents" setSkillsSub={() => {}} />); });
    };
    act(() => { root.render(<SkillsScreen d={draft} setD={setD} skillsSub="talents" setSkillsSub={() => {}} />); });
  }

  function group() {
    return container.querySelector('[aria-label="Talent de carrière"]')!;
  }
  function radios() {
    return Array.from(group().querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
  }
  function press(el: Element, key: string) {
    act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('fixture : 4 entrées, « Lire/Écrire » (index 2) MAXI atteint et disabled', () => {
    mount();
    const rs = radios();
    expect(rs.length).toBe(4);
    expect(rs.map((r) => r.textContent?.includes('Lire') ?? false)).toEqual([false, false, true, false]);
    expect(rs[2].disabled).toBe(true);
    expect(rs[0].disabled).toBe(false);
  });

  it('ArrowRight/ArrowDown avance le focus ET la sélection (selection-follows-focus) — saute l’entrée disabled', () => {
    mount();
    let rs = radios();
    expect(rs[0].tabIndex).toBe(0); // rien d'élu au montage → 1ʳᵉ entrée FOCALISABLE par défaut
    press(rs[0], 'ArrowRight');
    rs = radios();
    expect(draft.careerTalent).toEqual({ id: 'faire-la-manche' }); // index 1, sélection suit le focus
    expect(rs[1].tabIndex).toBe(0);
    expect(document.activeElement).toBe(rs[1]);
    // 2ᵉ ArrowRight : l'index 2 (Lire/Écrire) est DISABLED — le roving doit le SAUTER, jamais s'y arrêter.
    press(rs[1], 'ArrowRight');
    rs = radios();
    expect(draft.careerTalent).toEqual({ id: 'sociable' }); // saute Lire/Écrire (maxed), atterrit sur l'entrée suivante
    expect(rs[3].tabIndex).toBe(0);
    expect(document.activeElement).toBe(rs[3]); // le focus RÉEL atterrit sur l'entrée suivante, jamais l'entrée disabled
    expect(rs[2].getAttribute('tabindex')).toBeNull(); // l'entrée disabled ne reçoit AUCUN tabindex du roving
  });

  it('ArrowLeft/ArrowUp recule le focus ET la sélection — saute l’entrée disabled dans l’autre sens', () => {
    mount();
    let rs = radios();
    press(rs[0], 'ArrowLeft'); // recule depuis le début → boucle en fin de liste (Sociable, index 3)
    rs = radios();
    expect(draft.careerTalent).toEqual({ id: 'sociable' });
    press(rs[3], 'ArrowLeft');
    rs = radios();
    // recule depuis Sociable (3) : l'index 2 (Lire/Écrire) est disabled → saute à Faire la manche (1)
    expect(draft.careerTalent).toEqual({ id: 'faire-la-manche' });
    expect(rs[1].tabIndex).toBe(0);
  });

  it('Home/End vont à la 1ʳᵉ/dernière entrée FOCALISABLE (jamais une entrée disabled)', () => {
    mount();
    let rs = radios();
    press(rs[0], 'End');
    rs = radios();
    expect(draft.careerTalent).toEqual({ id: 'sociable' }); // dernière entrée ACTIVABLE (index 3, jamais Lire/Écrire)
    expect(rs[3].tabIndex).toBe(0);
    press(rs[3], 'Home');
    rs = radios();
    expect(draft.careerTalent).toEqual({ id: 'baratiner' });
    expect(rs[0].tabIndex).toBe(0);
  });

  it('le clic direct reste possible et gate toujours l’entrée disabled (`onClick`, indépendant du roving)', () => {
    mount();
    const rs = radios();
    act(() => { rs[2].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(draft.careerTalent).toBeUndefined(); // le bouton disabled n'émet pas de click (comportement natif)
  });
});
