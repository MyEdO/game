// @vitest-environment jsdom
/**
 * Course (LDB 15 l.41) et approche d'une source de Peur (LDB 21 l.27) : la ligne du jet porte la
 * compétence et la Difficulté du Test posé sur le pending, la Course son libellé en titre (#2779).
 * La fiche est celle de `ficheDeTest.testkit.ts`, posée au seam puis restaurée.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { RunModal } from './RunModal';
import { ApproachModal } from './ApproachModal';
import { refLabel } from '../data';
import { testDeRegle } from '../engine/reglesChiffrees';
import { difficultyText } from '../noyau/difficultyText';
import { poserFicheDeTest, restaurerFiche, testDeFiche } from '../state/ficheDeTest.testkit';
import { lignesDeJet } from './ligneDeJet.testkit';
import { combattantDeModale } from './combattantDeModale.testkit';
import { runFromTest } from '../engine/movement';
import { effectiveMovement } from '../engine/encumbrance';
import { t } from '../i18n';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});


let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  poserFicheDeTest();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, pendingRun: null, pendingApproach: null } as never);
  restaurerFiche();
});

const texte = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
const ligne = () => lignesDeJet(host)[0];

describe('modales des Tests nommés — compétence et Difficulté lues du pending', () => {
  it('Course : titre = libellé du Test, ligne = sa compétence et sa Difficulté', () => {
    const test = testDeRegle('course', 'courir');
    useGame.setState({ battle: { combatants: [combattantDeModale('H')] }, pendingRun: { combatantId: 'H', test, dest: { x: 3, y: 0 }, result: null } } as never);
    act(() => root.render(<RunModal />));
    const { skill, difficulty } = testDeFiche('course', 'courir');
    expect(ligne()).toEqual({ label: refLabel('skills', skill), diff: difficultyText(difficulty) });
    expect(texte(document.body)).toContain(test.label);
  });

  it('Course jetée : l’issue affiche les cases de Course que le moteur tire du jet (LDB 15 l.41)', () => {
    const test = testDeRegle('course', 'courir');
    const coureur = combattantDeModale('H');
    const result = runFromTest({ success: true, roll: 12, target: 60, sl: 5, isDouble: false }, effectiveMovement(coureur));
    useGame.setState({ battle: { combatants: [coureur], log: [] }, pendingRun: { combatantId: 'H', test, dest: { x: 3, y: 0 }, result } } as never);
    act(() => root.render(<RunModal />));
    expect(texte(document.body)).toContain(t('out.run', { label: t('out.runYes'), cases: result.bonusCases }));
  });

  it('Approche d’une Peur : ligne = compétence et Difficulté de `se-rapprocher`', () => {
    const test = testDeRegle('calme-d-approche', 'se-rapprocher');
    useGame.setState({
      battle: { combatants: [combattantDeModale('H'), combattantDeModale('Ogre', 'enemy')] },
      pendingApproach: { combatantId: 'H', test, sourceId: 'Ogre', sourceName: 'Ogre', intent: { kind: 'tile', pt: { x: 1, y: 0 } }, result: null },
    } as never);
    act(() => root.render(<ApproachModal />));
    const { skill, difficulty } = testDeFiche('calme-d-approche', 'se-rapprocher');
    expect(ligne()).toEqual({ label: refLabel('skills', skill), diff: difficultyText(difficulty) });
  });
});
