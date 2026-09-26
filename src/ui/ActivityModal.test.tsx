// @vitest-environment jsdom
/**
 * Modale d'Activité — rangée TÉMOIN de l'ennemi d'une Scène « Tenez votre position » (ADE II 08
 * l.161-163). L'écran doit montrer la grandeur qui TRANCHE à DR égal (LDB 12 l.160) : la Puissance
 * NUE en base, le bonus cumulatif des Rounds tenus en LIGNE DE MOD nommée — sans quoi la modale
 * affiche 75 pendant que le verdict compare 55.
 * Rendu jsdom (`createRoot`) et non `renderToStaticMarkup` : `ActivityModal` lit le store, et le
 * rendu SSR d'un store zustand sert l'état INITIAL (cf. en-tête d'`InterludeScreen.test.tsx`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { ActivityModal } from './ActivityModal';
import type { PendingActivity } from '../state/interludeFlow';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; });

const ARMEE = 'Horde du Chaos';

/** Pending de tenue DÉJÀ jeté (la rangée témoin de l'ennemi n'est montrée que post-jet). */
function holdPending(over: Partial<PendingActivity> = {}): PendingActivity {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', rng: makeRNG(42) });
  useGame.setState({ party: [hero], battle: null, massBattle: null, interlude: null, journal: [] });
  useGame.getState().startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3, enemyName: ARMEE });
  return {
    heroId: hero.id, kind: 'catalog', activityId: 'tenez-votre-position', battle: 'round',
    label: 'Tenez votre position', skillLabel: 'Corps à corps', skillValue: 42, difficulty: 'intermediaire',
    roll: 31, target: 42, sl: 1, success: true,
    enemyValue: 75, enemyRoll: 34, enemyBase: 55, skillBase: 42, enemySL: 0,
    ...over,
  } as PendingActivity;
}

/** Texte rendu de la modale, pending posé dans le store. */
function renderWith(pa: PendingActivity): string {
  useGame.setState({ pendingActivity: pa });
  const container = document.createElement('div');
  root = createRoot(container);
  act(() => root!.render(<ActivityModal />));
  return container.textContent ?? '';
}

describe('ActivityModal — rangée de l’ennemi d’une Scène « Tenez votre position »', () => {
  it('la Puissance NUE est la BASE affichée et le bonus cumulatif une ligne de mod NOMMÉE (ADE II 08 l.163)', () => {
    const txt = renderWith(holdPending());
    expect(txt).toContain('Puissance');
    expect(txt).toContain('Rounds tenus'); // le bonus de tenue est NOMMÉ, pas fondu en silence
    expect(txt).toContain('+20');
    expect(txt).toContain('55'); // base = la Puissance nue, celle qui départage à DR égal
    expect(txt).toContain('75'); // … et la cible réellement jetée reste montrée
  });

  it('sans Puissance nue posée (opposition d’avant le champ) : la base reste la cible, aucune ligne de mod inventée', () => {
    const txt = renderWith(holdPending({ enemyBase: undefined }));
    expect(txt).toContain('Puissance');
    expect(txt).not.toContain('Rounds tenus');
  });

  it('la rangée de l’ennemi porte le NOM de l’armée adverse, jamais un libellé de repli (#1906)', () => {
    const txt = renderWith(holdPending());
    expect(txt).toContain(`${ARMEE} · Puissance`);
    expect(txt).not.toContain('Ennemi ·');
  });

  it('une opposition de tenue SANS bataille ouverte est un bogue du jeu, dit — jamais un « Ennemi » anonyme (#1906)', () => {
    const pa = holdPending();
    useGame.setState({ massBattle: null });
    const err = console.error;
    console.error = () => {};
    try { expect(() => renderWith(pa)).toThrow('sans bataille de masse ouverte'); } finally { console.error = err; }
  });
});
