// @vitest-environment jsdom
/**
 * Récap de fin de chapitre (#717) — contrats POSITIFS : la chronique se rend par le renderer PARTAGÉ
 * (`RecapLineSections`), les zones vides le disent dignement, et le formulaire de fin de séance est
 * le MÊME que celui du menu système : en APERÇU inerte au volet 1, interactif au volet 2.
 *
 * Rendu CLIENT (`createRoot`) : en SSR, zustand sert l'état INITIAL (`getInitialState`) — l'écran y
 * rendrait toujours son cas vide.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChapterRecapScreen } from './ChapterRecapScreen';
import { SessionEndModal } from './SessionEndModal';
import { useGame } from '../state/store';
import { applyEffects } from '../state/combatEffects';
import type { ChapterRecap } from '../state/chapitreRecap';
import { emptyNarratif, type NarratifBlock } from '../state/campaignNarratif';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(id: string, label: string): Combatant {
  return {
    id, label, kind: 'hero',
    characteristics: {} as Combatant['characteristics'],
    items: [], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
}

const recap: ChapterRecap = {
  titre: 'Chapitre 1 — la route d’Altdorf',
  sousTitre: 'Ce que la compagnie emporte',
  px: 120,
  chronique: [{ text: 'Atteindre Altdorf', tone: 'ok' }],
  tombes: [],
  lieux: ['Auberge La Diligence', 'Altdorf'],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useGame.setState({ pendingChapterRecap: recap, pendingOuverture: null, party: [hero('h1', 'Magnus')] });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useGame.setState({
    pendingChapterRecap: null, party: [], objectifsSoldes: [], chapitreDepuis: null,
    clotureConsommee: false, campaignNarratif: null, flags: {},
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0 },
  });
});

/** Campagne dont la CLÔTURE est vraie — le cas où le récap vient de s'armer, et où la Condition
 *  restera vraie après la séance close (un drapeau ne se retire pas). */
const narratifClos: NarratifBlock = {
  ...emptyNarratif(),
  cloture: { when: { kind: 'flag', expr: 'chapitre-clos' }, titre: 'Chapitre 1 — accompli' },
};

async function mount(el: React.ReactElement = <ChapterRecapScreen />) {
  await act(async () => { root.render(el); });
}

/** Contrôles ATTEIGNABLES du formulaire de séance (ni désactivés, ni hors flux de lecture). */
function inputs(): HTMLInputElement[] {
  return [...container.querySelectorAll('input')];
}

describe('ChapterRecapScreen (#717)', () => {
  it('rend le titre de clôture, les PX du chapitre et la chronique par le renderer PARTAGÉ', async () => {
    await mount();
    const txt = container.textContent ?? '';
    expect(txt).toContain('Chapitre 1 — la route d’Altdorf');
    expect(container.querySelector('.xp-badge')?.textContent).toBe('+120 PX');
    expect(container.querySelector('.recap-lines .recap-line')?.textContent).toContain('Atteindre Altdorf');
    expect(txt).toContain('Auberge La Diligence');
  });

  it('les zones vides se DISENT (chronique, lieux, tombés) au lieu de disparaître', async () => {
    useGame.setState({ pendingChapterRecap: { ...recap, chronique: [], lieux: [], tombes: [] } });
    await mount();
    const txt = container.textContent ?? '';
    expect(txt).toContain('Aucune perte');
    expect(txt).toContain('Aucun lieu connu');
    expect(txt).toContain('sans qu’aucun objectif n’ait été soldé');
  });

  it('volet 1 : le formulaire de séance est en APERÇU inerte ; « Poursuivre » le rend vivant', async () => {
    await mount();
    const apercu = container.querySelector('[data-apercu]');
    expect(apercu).not.toBeNull();
    expect(apercu?.getAttribute('aria-hidden')).toBe('true');
    expect(inputs().length).toBeGreaterThan(0);
    expect(inputs().every((i) => i.disabled)).toBe(true);

    const poursuivre = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Poursuivre')!;
    await act(async () => poursuivre.click());
    expect(container.querySelector('[data-apercu]')).toBeNull();
    expect(inputs().some((i) => i.disabled)).toBe(false);
  });

  it('la MÊME fin de séance se monte en modale au menu système (source unique du formulaire)', async () => {
    await mount(<SessionEndModal onClose={() => {}} />);
    const txt = container.textContent ?? '';
    expect(txt).toContain('Terminer la séance');
    expect(txt).toContain('Ambitions de groupe');
    expect(container.querySelector('[data-apercu]')).toBeNull();
    expect(inputs().some((i) => i.disabled)).toBe(false);
  });

  it('« Plus tard » ajourne sans rien perdre : l’archive reste, le récap se re-posera', async () => {
    useGame.setState({ objectifsSoldes: [{ id: 'o', text: 'Atteindre Altdorf' }] });
    await mount();
    const plusTard = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Plus tard')!;
    await act(async () => plusTard.click());
    expect(useGame.getState().pendingChapterRecap).toBeNull();
    expect(useGame.getState().objectifsSoldes).toEqual([{ id: 'o', text: 'Atteindre Altdorf' }]);
    expect(container.textContent).toBe('');
  });

  it('« Terminer la séance » clôt le chapitre POUR DE BON : archive vidée, borne re-posée, plus aucun ré-armement', async () => {
    useGame.setState({
      objectifsSoldes: [{ id: 'o', text: 'Atteindre Altdorf' }], gameTime: 900,
      campaignNarratif: narratifClos, flags: { 'chapitre-clos': true },
    });
    await mount();
    const poursuivre = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Poursuivre')!;
    await act(async () => poursuivre.click());
    const terminer = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Terminer la séance')!;
    await act(async () => terminer.click());
    expect(useGame.getState().pendingChapterRecap).toBeNull();
    expect(useGame.getState().objectifsSoldes).toEqual([]);
    expect(useGame.getState().chapitreDepuis).toEqual({ xpParHeros: { h1: 0 }, vivants: ['h1'], gameTime: 900 });

    // DURÉE de la clôture : la Condition est restée vraie, et pourtant les lots d'effets suivants ne
    // rouvrent plus rien — sans le fait consommé, l'écran se ré-armerait VIDE à chaque lot.
    expect(useGame.getState().clotureConsommee).toBe(true);
    await act(async () => {
      applyEffects(useGame.getState, useGame.setState, [{ type: 'setFlag', flag: 'la-route-continue', value: true }]);
    });
    expect(useGame.getState().pendingChapterRecap).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('« Annuler » du volet interactif AJOURNE — il ne clôt rien (archive et borne intactes)', async () => {
    useGame.setState({
      objectifsSoldes: [{ id: 'o', text: 'Atteindre Altdorf' }],
      campaignNarratif: narratifClos, flags: { 'chapitre-clos': true },
    });
    await mount();
    const poursuivre = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Poursuivre')!;
    await act(async () => poursuivre.click());
    const annuler = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Annuler')!;
    await act(async () => annuler.click());
    expect(useGame.getState().pendingChapterRecap).toBeNull(); // ajourné, pas clos
    expect(useGame.getState().objectifsSoldes).toEqual([{ id: 'o', text: 'Atteindre Altdorf' }]);
    expect(useGame.getState().chapitreDepuis).toBeNull();
    expect(useGame.getState().clotureConsommee).toBe(false);

    // Le chapitre n'étant pas clos, le récap se re-pose au lot d'effets suivant.
    await act(async () => {
      applyEffects(useGame.getState, useGame.setState, [{ type: 'setFlag', flag: 'un-pas-de-plus', value: true }]);
    });
    expect(useGame.getState().pendingChapterRecap?.titre).toBe('Chapitre 1 — accompli');
  });

  it('COOP : l’invité LIT la chronique, mais « Poursuivre » porte son refus et le volet 2 reste fermé', async () => {
    useGame.setState({
      objectifsSoldes: [{ id: 'o', text: 'Atteindre Altdorf' }],
      net: { ...useGame.getState().net, mode: 'guest', mySeat: 1 },
    });
    await mount();
    expect(container.textContent).toContain('Atteindre Altdorf'); // la chronique se partage à la table
    const poursuivre = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Poursuivre')!;
    expect(poursuivre.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(poursuivre.getAttribute('aria-describedby')!)?.textContent)
      .toBe('L’hôte clôt le chapitre.');

    await act(async () => poursuivre.click());
    expect(container.querySelector('[data-apercu]')).not.toBeNull(); // le formulaire reste INERTE
    expect(inputs().every((i) => i.disabled)).toBe(true);

    // Sa fermeture est un MASQUE local : l'état partagé (snapshot de l'hôte) n'est pas touché.
    const masquer = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Masquer')!;
    await act(async () => masquer.click());
    expect(container.textContent).toBe('');
    expect(useGame.getState().pendingChapterRecap?.titre).toBe(recap.titre);
  });
});
