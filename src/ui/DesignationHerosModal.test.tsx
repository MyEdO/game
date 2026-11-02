// @vitest-environment jsdom
/**
 * Câblage de la DÉSIGNATION d'un héros (Effet `designerHeros`, EDO 02 l.91) : l'Effet ouvre la modale, le
 * clic sur un portrait pose l'état ; un héros mort n'y figure pas ; aucun geste de sortie.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { DesignationHerosModal } from './DesignationHerosModal';
import { useGame } from '../state/store';
import { applyEffects, runFlow } from '../noyau/combatEffects';
import { createHero } from '../engine/character';
import { emptyNarratif } from '../noyau/monde/campaignNarratif';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';

afterEach(() => demonterRacines());

/** Le narratif de la campagne chargée déclare les états que désignent les Effets ci-dessous. */
const campaignNarratif = {
  ...emptyNarratif(),
  etats: [
    { id: 'campagne-sosie-heros', label: 'Le sosie du mort', source: { book: 'ennemi-dans-l-ombre', page: 26, note: 'EDO 02 l.91' }, forme: { kind: 'heros' as const } },
    { id: 'sosie', label: 'Le sosie', source: { book: 'ennemi-dans-l-ombre', page: 26, note: 'EDO 02 l.91' }, forme: { kind: 'heros' as const } },
  ],
};

const heros = (label: string, seed: number) => ({ ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed }), id: `h-${seed}` });

describe('DesignationHerosModal — clic sur un portrait → état posé', () => {
  it('l’Effet ouvre la modale ; le portrait du vivant pose l’état ; le mort n’est pas proposé', () => {
    useGame.setState({ party: [heros('Vivant', 1), { ...heros('Tombé', 2), dead: true }], etats: {}, campaignNarratif, pendingDesignationHeros: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'designerHeros', etat: 'campagne-sosie-heros' }]);
    const { container } = monterRacine(<DesignationHerosModal />);
    const portraits = [...document.querySelectorAll<HTMLButtonElement>('.portrait-picker button')];
    expect(portraits.map((b) => b.getAttribute('title'))).toEqual(['Vivant']);
    expect(document.querySelector('.cadre-pied button, .modal-close'), 'aucun geste de sortie').toBeNull();
    act(() => portraits[0].click());
    expect(useGame.getState().etats['campagne-sosie-heros']).toBe('h-1');
    expect(useGame.getState().pendingDesignationHeros).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('chaque héros proposé montre son NOM visible sous son portrait', () => {
    useGame.setState({ party: [heros('Aldric', 1), heros('Brunhilde', 2), heros('Konrad', 3), heros('Magda', 4)], etats: {}, campaignNarratif, pendingDesignationHeros: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'designerHeros', etat: 'campagne-sosie-heros' }]);
    monterRacine(<DesignationHerosModal />);
    const tuiles = [...document.querySelectorAll('.portrait-picker .frame-pick')];
    for (const tuile of tuiles) expect(tuile.querySelectorAll('.ptile-name')).toHaveLength(1);
    expect(tuiles.map((t) => [t.querySelector('button')?.getAttribute('title'), t.textContent]))
      .toEqual([['Aldric', 'Aldric'], ['Brunhilde', 'Brunhilde'], ['Konrad', 'Konrad'], ['Magda', 'Magda']]);
  });

  it('l’invite de l’Effet est rendue ; plus aucun vivant : « Continuer » clôt sans choix et la suite du Flow se joue', () => {
    useGame.setState({ party: [heros('Vivant', 1)], etats: {}, flags: {}, campaignNarratif, pendingDesignationHeros: null });
    runFlow(useGame.getState, useGame.setState, { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'designerHeros', etat: 'sosie', invite: 'Lequel d’entre vous ?' } },
      { kind: 'do', effect: { type: 'setFlag', flag: 'apres' } },
    ] });
    const { container } = monterRacine(<DesignationHerosModal />);
    expect(document.body.textContent).toContain('Lequel d’entre vous ?');
    act(() => useGame.setState({ party: useGame.getState().party.map((h) => ({ ...h, dead: true })) }));
    expect(document.querySelectorAll('.portrait-picker button')).toHaveLength(0);
    const continuer = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Continuer')!;
    act(() => continuer.click());
    expect(useGame.getState().pendingDesignationHeros).toBeNull();
    expect(useGame.getState().etats.sosie).toBeUndefined();
    expect(useGame.getState().flags.apres).toBe(true);
    expect(container.textContent).toBe('');
  });
});
