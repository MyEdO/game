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

/** Graine 169, Reiklander : Doué en calcul aux tirages 0 et 1, Sixième sens au tirage 2. */
const fixture = () => rollDraftTalents(withCareer(withSpecies(newDraft(169), 'humains-reiklander'), 'soldat'));

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
    expect(avant.map((t) => [t.ref.id, t.rang, t.doublon])).toEqual([['doue-en-calcul', 0, false], ['doue-en-calcul', 0, true], ['sixieme-sens', 0, false]]);
    expect(relancer()).toHaveLength(1);
    act(() => { relancer()[0].click(); });
    const apres = speciesTalentRandomDrawn(draft);
    expect(apres.map((t) => [t.ref.id, t.rang, t.doublon])).toEqual([['doue-en-calcul', 0, false], ['doigts-de-fee', 1, false], ['sixieme-sens', 0, false]]);
    expect(draft.talentRerolls).toEqual({ [avant[1].adresse]: 1 });
    expect(relancer()).toHaveLength(0);
    expect(container.textContent).not.toContain('Déjà possédé');
  });
});

describe('Talents tirés — une unité par tirage, son utilisation au choix, sa relance nommée (LDB 05 l.484 ; LDB 10 l.17)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let draft: CreatorDraft;

  function mount(depart: CreatorDraft) {
    draft = depart;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const setD = (next: CreatorDraft) => {
      draft = next;
      act(() => { root.render(<SkillsScreen d={draft} setD={setD} skillsSub="talents" setSkillsSub={() => {}} />); });
    };
    act(() => { root.render(<SkillsScreen d={draft} setD={setD} skillsSub="talents" setSkillsSub={() => {}} />); });
  }
  const unites = () => Array.from(container.querySelectorAll<HTMLElement>('.skill-tags > [role="group"]'));
  const nomsDeRelance = () => Array.from(container.querySelectorAll('button')).flatMap((b) => (b.textContent?.trim() === 'Relancer' ? [b.getAttribute('aria-label')] : []));

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('graine 284, Reiklander : deux Résistance, chacune avec SON sélecteur ; la relance du doublon nomme le Talent et son tirage', () => {
    mount(rollDraftTalents(withCareer(withSpecies(newDraft(284), 'humains-reiklander'), 'soldat')));
    expect(unites().map((u) => u.getAttribute('aria-label'))).toEqual(['Résistance — tirage 1', 'Résistance — tirage 2', 'Fuite !']);
    expect(unites().map((u) => u.querySelectorAll('select').length)).toEqual([1, 1, 0]);
    expect(unites()[1].querySelector('select')?.getAttribute('aria-label')).toBe('Utilisation de Résistance — tirage 2');
    expect(unites()[1].querySelector('select option')?.textContent).toBe('— choisir —');
    expect(nomsDeRelance()).toEqual(['Relancer Résistance — tirage 2']);
    expect(unites()[1].querySelector('button')?.getAttribute('aria-label')).toBe('Relancer Résistance — tirage 2');
  });

  it('graine 169 : un Talent sans utilisation n\'a pas de sélecteur ; « Relancer Doué en calcul — tirage 2 »', () => {
    mount(fixture());
    expect(container.querySelectorAll('.skill-tags select')).toHaveLength(0);
    expect(nomsDeRelance()).toEqual(['Relancer Doué en calcul — tirage 2']);
  });

  it('graine 21, halflings : choisir l\'utilisation au sélecteur l\'écrit à l\'adresse du tirage', () => {
    mount(rollDraftTalents(withCareer(withSpecies(newDraft(21), 'halflings'), 'agitateur')));
    const [tirage] = speciesTalentRandomDrawn(draft);
    const select = unites()[0].querySelector('select')!;
    expect(select.getAttribute('aria-label')).toBe('Utilisation de Sens aiguisé');
    act(() => {
      select.value = 'odorat';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(draft.randomSpecPicks).toEqual({ [tirage.adresse]: 'odorat' });
    expect(unites()[0].querySelector('select')!.value).toBe('odorat');
  });
});
