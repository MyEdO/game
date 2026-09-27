// @vitest-environment jsdom
/**
 * ÉTAPE À DÉ NU en fenêtre (#1508) — la coquille de cascade MONTÉE pour de vrai (`CascadeBody`,
 * patron `createRoot`/`act` du repo) sur une étape `de` : MÊME `RollShell`, MÊME rangée
 * `TableRollLine`, MÊME sélecteur de dé (`stepForcedDie`, gate `canFixDie`) qu'une table —
 * SANS grille de lignes, puisqu'il n'y a pas de table où choisir.
 *
 * Ce que ce fichier verrouille, et qui n'existe nulle part ailleurs : aucune fenêtre neuve, aucune
 * classe CSS neuve, et la POSE d'un dé nu gatée exactement comme celle d'une table.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { startCascade, registerCascadeApplier } from '../state/cascade';
import { dieStep } from '../state/rollSeam';
import type { SeuilDeSauvegarde } from '../state/pendings';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { CascadeBody } from './CascadeModal';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

/** Étape à DÉ NU du MONDE : 2d10 mètres de chute, +3 de modificateur pour lire l'opération à l'écran. */
const chute = (mod?: number) => dieStep({
  id: 'dn', kind: 'uiDieSpy', label: fixtureText('Hauteur de chute'), icon: 'nav/dice',
  spec: { n: 2, sides: 10 }, unite: 'm', worldOwner: true, ...(mod != null ? { mod } : {}),
})!;

function openDie(mod?: number) {
  useGame.setState({
    battle: null, party: [], pendingCascade: null, suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
  startCascade(useGame.getState, useGame.setState, { title: 'Chute', purpose: 'test', steps: [chute(mod)] });
}

const render = () => act(() => { root.render(<CascadeBody />); });
const dieInput = () => host.querySelector('.rm-die-pick input[type="number"]') as HTMLInputElement | null;
const rowButtons = () => [...host.querySelectorAll('.rm-loc-grid button')] as HTMLButtonElement[];
const step = () => useGame.getState().pendingCascade!.participants[0];

function typeChar(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
function typeSlowly(value: string) {
  let acc = '';
  for (const ch of value) {
    acc += ch;
    const input = dieInput();
    expect(input, `le champ a disparu après « ${acc.slice(0, -1)} »`).not.toBeNull();
    typeChar(input!, acc);
  }
  act(() => { dieInput()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
}

beforeEach(() => {
  resetDesFixes();
  registerCascadeApplier('uiDieSpy', () => {});
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  resetDesFixes();
});

describe('Étape à DÉ NU en fenêtre (#1508) — la même coquille qu’une table, sans sa grille', () => {
  it('(vii) AVANT le dé : la rangée `TableRollLine` annonce CE qui se tire et AVEC QUOI — et aucune grille de lignes', () => {
    openDie();
    render();
    // La rangée de tirage porte le libellé de l'étape ET l'écriture canonique de ses dés.
    expect(host.querySelector('.rm-roll.table')?.textContent).toContain('Hauteur de chute (2d10)');
    expect(rowButtons(), 'un dé nu n’a pas de lignes à choisir : la grille de table ne s’ouvre pas').toEqual([]);
    expect(host.textContent).toContain('Lancer');
  });

  it('(vii bis) APRÈS le dé : la MÊME rangée porte le dé et le TOTAL avec son unité', () => {
    openDie(3);
    useGame.getState().cascadeDieSetForcedRoll('dn', 10);
    render();
    const ligne = host.querySelector('.rm-roll.table')!;
    expect(ligne.textContent).toContain('Hauteur de chute (2d10)');
    expect(ligne.querySelector('.rm-table-result')?.textContent, 'le total EST la conséquence, dans son unité').toBe('13 m');
    // Le dé EFFECTIF est affiché avec l'opération qui y mène (patron exact de la table).
    expect(ligne.textContent).toContain('13');
    expect(ligne.textContent).toContain('(10 + 3)');
  });

  it('(vi) l’option « Dés fixés » ÉTEINTE : aucun champ de pose — le « Lancer » reste servi', () => {
    setDesFixes(false);
    openDie();
    render();
    expect(dieInput(), 'sans l’option, le dé se lance mais ne se pose pas').toBeNull();
    expect(host.textContent).toContain('Lancer');
  });

  it('(vi bis) option ACTIVE + siège qui tient le monde : le champ est là, borné aux naturels des DÉS (2d10 → 2..20)', () => {
    setDesFixes(true);
    openDie();
    render();
    const input = dieInput();
    expect(input, 'la pose s’ouvre exactement comme pour une table').not.toBeNull();
    expect(input!.max, 'les faces seules mentiraient : un 2d10 monte à 20').toBe('20');
    typeSlowly('17');
    expect(step().de!.result).toEqual({ roll: 17, total: 17 });
    expect(step().fixed).toBe(true);
  });

  it('(vi ter) un dé POSÉ reste RÉ-ÉDITABLE tant que l’étape est courante', () => {
    setDesFixes(true);
    openDie();
    render();
    typeSlowly('17');
    render();
    expect(dieInput(), 'le champ reste servi après la pose').not.toBeNull();
    typeSlowly('4');
    expect(step().de!.result).toEqual({ roll: 4, total: 4 });
  });

  it('(E2) un dé nu SANS seuil ne montre aucune comparaison — il n’y a rien à battre', () => {
    openDie();
    render();
    expect(host.querySelector('.rm-roll.table .rm-table-result')?.textContent ?? '').toBe('');
    expect(host.textContent, 'une chute se lit en mètres, pas contre un Indice').not.toContain('≥');
  });

  it('aucune classe CSS neuve : le dé nu réutilise les sélecteurs de la table (`.rm-roll.table`, `.rm-die-pick`)', () => {
    setDesFixes(true);
    openDie();
    render();
    expect(host.querySelector('.rm-roll.table')).not.toBeNull();
    expect(host.querySelector('.rm-die-pick')).not.toBeNull();
    const inconnues = [...host.querySelectorAll<HTMLElement>('[class]')]
      .flatMap((el) => [...el.classList])
      .filter((c) => /^(rm-de|de-|die-)/.test(c));
    expect(inconnues, 'aucune classe propre au dé nu n’a été inventée').toEqual([]);
  });
});

/**
 * E — UN DÉ SE LIT COMME TOUT JET : ce qu'on joue, CONTRE QUOI, POUR QUI, AVANT de lancer.
 *
 * Une rangée de Test pré-jet dit sa cible dans sa cellule CENTRALE (`RollCalc`,
 * `RollLine.PendingRollLine`) ; une rangée de dé à SEUIL dit son Indice dans la MÊME cellule
 * (`TableRollLine.result`), et son porteur en Z1 (`stepSubtitle`, précédent
 * `jetProps/useFumbleJetProps.tsx`). La fenêtre de Sauvegarde annonce donc le seuil
 * et le porteur AVANT le lancer : la donnée est sur l'étape dès sa déclaration (`rollSeam.dieStep`).
 */
describe('Dé à SEUIL en fenêtre (#1508) — la rangée dit ce qu’on joue AVANT le lancer', () => {
  const DOME: SeuilDeSauvegarde = { indice: 6, source: { kind: 'trait', id: 'protection' }, dome: true };
  const NOM = 'Ilyanwe la Voilée';

  /** Ouvre la sauvegarde d'un héros NOMMÉ, telle que la porte la pousse (`combatFlow.pousserSauvegarde`). */
  function openSauvegarde() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: NOM, seed: 1 });
    useGame.setState({
      battle: null, party: [hero], suspendedCascades: [], journal: [], pendingCascade: null,
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
    });
    startCascade(useGame.getState, useGame.setState, {
      title: 'Sauvegarde', purpose: 'test',
      steps: [dieStep({
        id: 'sv', kind: 'uiDieSpy', label: fixtureText('Sauvegarde'), icon: 'journal/critical',
        spec: { n: 1, sides: 10 }, actorId: hero.id, seuil: DOME,
      })!],
    });
  }

  const lu = () => (host.textContent ?? '').replace(/\s+/g, ' ');

  it('(E1) AVANT le lancer : le PORTEUR et le SEUIL sont à l’écran, seuil dans la cellule centrale', () => {
    openSauvegarde();
    render();
    expect(lu(), 'pour QUI le dé tombe').toContain(NOM);
    expect(host.querySelector('.rm-roll.table .rm-table-result')?.textContent, 'contre QUOI — la cellule qui, sur une rangée de Test, porte la cible')
      .toBe('≥ Protection (6+) du Dôme');
    expect(lu(), 'et ce qu’on joue, avec quels dés').toContain('Sauvegarde (1d10)');
  });

  it('(E1) APRÈS le lancer : la MÊME cellule porte le total confronté, et Z1 nomme ENCORE le porteur', () => {
    openSauvegarde();
    useGame.getState().cascadeDieSetForcedRoll('sv', 6);
    render();
    expect(host.querySelector('.rm-roll.table .rm-table-result')?.textContent).toBe('6 ≥ Protection (6+) du Dôme');
    // Le nom ne disparaît pas à l'instant où l'on LIT le résultat et où l'on clique « Terminer » :
    // c'est la MÊME zone Z1 (`stepSubtitle`) qu'avant le lancer, servie par la branche qui rend
    // l'étape de dé RÉSOLUE (`stepInteraction` → `'affichage'`), pas une seconde surface.
    expect(host.querySelector('.rm-subtitle')?.textContent, 'pour QUI le dé est tombé, après comme avant').toBe(NOM);
    expect(lu()).toContain(NOM);
  });
});
