// @vitest-environment jsdom
/**
 * LDB 05 l.484 — le clic « Relancer » d'un Talent tiré doublon (`talentsZones`, `rerollDraftTalent`) :
 * geste réel, patron `createRoot`/`act` de `career-talent-roving.test.tsx`.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SkillsScreen } from './CharacterCreator';
import { newDraft, withSpecies, withCareer, rollDraftTalents, speciesTalentRandomDrawn, type CreatorDraft } from './draft';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Graine 1, Reiklander : Bonnes jambes aux tirages 0 et 1, Réflexes foudroyants au tirage 2. */
const fixture = () => rollDraftTalents(withCareer(withSpecies(newDraft(1), 'humains-reiklander'), 'soldat'));

describe('Talents tirés — relance d\'un doublon au clic (LDB 05 l.484)', () => {
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
  const relancer = () => Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Relancer');

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('le clic remplace CE SEUL tirage ; le nouveau tirage, non doublon, ne porte plus de relance', () => {
    mount();
    const avant = speciesTalentRandomDrawn(draft);
    expect(avant.map((t) => [t.ref.id, t.rang, t.doublon])).toEqual([['bonnes-jambes', 0, false], ['bonnes-jambes', 0, true], ['reflexes-foudroyants', 0, false]]);
    expect(relancer()).toHaveLength(1);
    act(() => { relancer()[0].click(); });
    const apres = speciesTalentRandomDrawn(draft);
    expect(apres.map((t) => [t.ref.id, t.rang, t.doublon])).toEqual([['bonnes-jambes', 0, false], ['chanceux', 1, false], ['reflexes-foudroyants', 0, false]]);
    expect(draft.talentRerolls).toEqual({ [avant[1].adresse]: 1 });
    expect(relancer()).toHaveLength(0);
    expect(container.textContent).not.toContain('Déjà possédé');
  });
});
