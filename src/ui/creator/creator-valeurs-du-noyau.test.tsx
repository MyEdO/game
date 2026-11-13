// @vitest-environment jsdom
/**
 * L'écran du créateur affiche les valeurs et les refus que le noyau applique (#3059) : PX offerts, bornes des compteurs
 * d'allocation, refus d'engagement (`refusDEngagement`).
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { CharacterCreator, CareerScreen, CharScreen, SkillsScreen } from './CharacterCreator';
import {
  newDraft,
  withSpecies,
  withCareer,
  withCompteur,
  rollDraftCareer,
  rollDraftChars,
  rerollDraftChars,
  speciesSkillRefs,
  careerSkillEntries,
  withSpeciesSkillTier,
} from '../../noyau/creation/brouillon';
import { memeSpecialisation } from '../../data/schemas/grammaire/ref';
import { createHero } from '../../engine/character';
import { useGame } from '../../state/store';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const pret = () => withCareer(withSpecies(newDraft(7), 'humains-reiklander'), 'soldat');
/** Le bouton « augmenter » du stepper `label` est-il fermé ? */
const incFerme = (html: string, label: string) => {
  const bouton = html.match(new RegExp(`<button[^>]*aria-label="${label} : augmenter"[^>]*>`))?.[0];
  if (!bouton) throw new Error(`stepper ${label} absent`);
  return /disabled=""/.test(bouton);
};

describe('PX offerts : ceux du noyau', () => {
  it('Caractéristiques : +50 / +25 / +0 avant relance, +0 après', () => {
    const html = renderToStaticMarkup(<CharScreen d={pret()} setD={() => {}} />);
    expect(html).toContain('Aux dés — garder le tirage <em class="hint" style="font-style:normal">+50 PX</em>');
    expect(html).toContain('Aux dés — réorganiser ensuite <em class="hint" style="font-style:normal">+25 PX</em>');
    expect(html).toContain('Répartir 100 points <em class="hint" style="font-style:normal">+0 PX</em>');
    const relance = renderToStaticMarkup(<CharScreen d={rerollDraftChars(rollDraftChars(pret()))} setD={() => {}} />);
    expect(relance).toContain('Aux dés — garder le tirage <em class="hint" style="font-style:normal">+0 PX</em>');
  });

  it('Carrière : +25 aux deux jets de plus, +0 à la relance libre', () => {
    const un = rollDraftCareer(withSpecies(newDraft(7), 'humains-reiklander'));
    const rendu = (d: typeof un) => renderToStaticMarkup(<CareerScreen d={d} setD={() => {}} />).split('<!-- -->').join('');
    expect(rendu(un)).toContain('Pas convaincu : 2 jets de plus (3 choix, +25 PX)');
    expect(rendu(rollDraftCareer(un))).toContain('Continuer à relancer (+0 PX)');
  });
});

describe('bornes des compteurs : celles du noyau', () => {
  it('Destin et Résilience : les 3 Points supplémentaires posés ferment les deux « augmenter »', () => {
    const d = withCompteur(withCompteur(rollDraftChars(pret()), { genre: 'destin', k: 'fate' }, 2), { genre: 'destin', k: 'resilience' }, 1);
    const html = renderToStaticMarkup(<CharScreen d={d} setD={() => {}} />);
    expect(incFerme(html, 'Destin')).toBe(true);
    expect(incFerme(html, 'Résilience')).toBe(true);
    expect(incFerme(renderToStaticMarkup(<CharScreen d={rollDraftChars(pret())} setD={() => {}} />), 'Destin')).toBe(false);
  });

  it('100 Points : 18 ferme « augmenter »', () => {
    const d = withCompteur({ ...pret(), charMode: 'repartition' }, { genre: 'points', k: 'capacite-de-combat' }, 18);
    expect(incFerme(renderToStaticMarkup(<CharScreen d={d} setD={() => {}} />), 'Capacité de Combat')).toBe(true);
  });
});

describe('palier d’espèce : celui du noyau', () => {
  it('une Compétence de carrière que l’espèce pose à +5 le dit sur sa rangée', () => {
    const d0 = pret();
    const ref = speciesSkillRefs(d0).find((r) => r.choix == null && careerSkillEntries(d0).some((c) => c.designee?.id === r.id && memeSpecialisation(c.designee.spec, r.spec)));
    if (!ref) throw new Error('le soldat humain partage une Compétence avec son espèce');
    const html = renderToStaticMarkup(<SkillsScreen d={withSpeciesSkillTier(d0, ref, 5)} setD={() => {}} skillsSub="career" setSkillsSub={() => {}} />);
    expect(html).toMatch(/\d · \+5 de race/);
  });
});

describe('engager : le refus du noyau au bouton', () => {
  const avant = useGame.getState();
  afterEach(() => {
    useGame.setState({ party: avant.party, editingHeroId: null });
    localStorage.clear();
  });

  /** Monte l'assistant et le remplit jusqu'à la Présentation par sa couture de recette. */
  function monterALaPresentation() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(<CharacterCreator />); });
    const w = window as unknown as { __wfrpCreator: { fill: () => string } };
    act(() => { w.__wfrpCreator.fill(); });
    return { container, fermer: () => { act(() => { root.unmount(); }); container.remove(); } };
  }

  it('groupe complet : le bouton dit « Le groupe est complet (4 héros). » ; groupe libre : le clic engage', () => {
    useGame.setState({ party: [1, 2, 3, 4].map((i) => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `M${i}`, seed: i })) });
    const plein = monterALaPresentation();
    expect(plein.container.querySelector('#creator-commit-reason')?.textContent).toBe('Le groupe est complet (4 héros).');
    plein.fermer();

    useGame.setState({ party: [] });
    const libre = monterALaPresentation();
    expect(libre.container.querySelector('#creator-commit-reason')).toBeNull();
    const bouton = [...libre.container.querySelectorAll('button')].find((b) => b.textContent === 'Engager ce héros →');
    act(() => { bouton?.click(); });
    expect(useGame.getState().party).toHaveLength(1);
    libre.fermer();
  });
});
