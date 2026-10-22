// @vitest-environment jsdom
/**
 * « Tenter le Test » (chute volontaire, LDB 15 l.82) consomme l'Action (LDB 13 l.86-88) :
 * Action déjà prise → l'option porte le refus de `fallChoose` (`refusDuTestDeChute`,
 * `noyau/gesteDArete.ts`), éteinte ; Action libre → offerte. Afficher = agir.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { FallModal } from './FallModal';
import { phaseDeChute } from '../noyau/fallMove';
import type { Combatant } from '../engine/types';
import { testDeRegle } from '../engine/reglesChiffrees';
import { difficultyText } from '../noyau/difficultyText';
import { refLabel } from '../data';
import { t } from '../i18n';
import { poserFicheDeTest, restaurerFiche, testDeFiche } from '../state/ficheDeTest.testkit';
import { lignesDeJet } from './ligneDeJet.testkit';
import { combattantDeModale } from './combattantDeModale.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const sauteur = combattantDeModale('S');

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingFall: null, battle: null, mode: 'exploration' } as never);
});

const texte = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
const tenter = (): HTMLElement => {
  const b = [...host.querySelectorAll('button')].find((x) => x.textContent?.includes('Tenter'));
  if (!b) throw new Error('l’option « Tenter » n’est pas rendue');
  return b;
};

function monter(acted: boolean): void {
  useGame.setState({
    mode: 'battle',
    battle: { combatants: [sauteur], order: [sauteur.id], turn: 0, acted, over: null },
    party: [sauteur],
    pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: sauteur.id, participants: [{ id: sauteur.id, interactive: true, attempt: null, result: null }] },
  } as never);
  act(() => root.render(<FallModal />));
}

describe('chute volontaire — l’option « Tenter » suit le verdict de `fallChoose`', () => {
  it('Action déjà prise : option éteinte (aria-disabled), clic inerte', () => {
    monter(true);
    expect(tenter().getAttribute('aria-disabled')).toBe('true');
    act(() => tenter().click());
    expect(phaseDeChute(useGame.getState().pendingFall!)).toBe('choice');
  });

  it('le refus SUIT le store sans nouveau rendu du parent : l’entrée en combat éteint l’option', () => {
    monter(true);
    act(() => { useGame.setState({ mode: 'exploration' } as never); });
    expect(tenter().getAttribute('aria-disabled')).not.toBe('true');
    act(() => { useGame.setState({ mode: 'battle' } as never); });
    expect(tenter().getAttribute('aria-disabled')).toBe('true');
  });

  it('Action libre : option offerte, le clic ouvre le jet', () => {
    monter(false);
    expect(tenter().getAttribute('aria-disabled')).not.toBe('true');
    act(() => tenter().click());
    expect(phaseDeChute(useGame.getState().pendingFall!)).toBe('roll');
  });
});

describe('chute du groupe en coop (EDO 01 l.231) — chaque rangée se déclare depuis le siège de SON héros', () => {
  const compagnon = { ...sauteur, id: 'K', name: 'K', label: 'Kurt' } as Combatant;
  afterEach(() => useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } }));

  it('le siège 1 déclare pour Kurt ; la rangée du héros de l’hôte attend, sans option', () => {
    useGame.setState({
      mode: 'exploration', battle: null, party: [sauteur, compagnon],
      net: { ...useGame.getState().net, mode: 'guest', mySeat: 1, ownership: { K: 1 } },
      pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: sauteur.id, participants: [
        { id: sauteur.id, interactive: true, attempt: null, result: null },
        { id: compagnon.id, interactive: true, attempt: null, result: null },
      ] },
    } as never);
    act(() => root.render(<FallModal />));
    const tenters = [...host.querySelectorAll('button')].filter((x) => x.textContent?.includes('Tenter'));
    expect(tenters, 'une seule rangée offre la déclaration : celle du siège').toHaveLength(1);
    expect(host.textContent).toContain('en attente de la déclaration de S');
    expect(host.textContent).not.toContain('en attente de la déclaration de Kurt');
  });
});

describe('chute volontaire — une rangée déclarée SANS Test n’a aucune ligne de jet (LDB 15 l.82)', () => {
  beforeEach(poserFicheDeTest);
  afterEach(restaurerFiche);
  const zonesDifficulte = () => lignesDeJet(host).map((l) => l.diff);
  const libelles = () => lignesDeJet(host).map((l) => l.label);
  const posee = testDeFiche('chute', 'tenter');
  const option = (texte: string): HTMLElement => {
    const b = [...host.querySelectorAll('button')].find((x) => x.textContent?.includes(texte));
    if (!b) throw new Error(`l’option « ${texte} » n’est pas rendue`);
    return b;
  };

  it('titre = libellé du Test de la fiche ; l’enjeu du choix ne redit ni la compétence ni la Difficulté de la ligne (#1072)', () => {
    monter(false);
    expect(texte(host.ownerDocument.querySelector('.modal-title'))).toContain(testDeRegle('chute', 'tenter').label);
    const enjeu = texte(host.ownerDocument.querySelector('.rm-stake'));
    expect(enjeu, 'l’enjeu dit la hauteur du pending').toContain(`${useGame.getState().pendingFall!.metres} m`);
    expect(enjeu, 'la compétence vit sur la ligne de jet').not.toContain(refLabel('skills', posee.skill));
    expect(enjeu, 'la Difficulté vit sur la ligne de jet').not.toContain(difficultyText(posee.difficulty));
  });

  it('« Tenter » déclaré, une autre rangée à déclarer : la rangée déclarée dit son choix', () => {
    const compagnon = { ...sauteur, id: 'K', name: 'K', label: 'Kurt' } as Combatant;
    useGame.setState({
      mode: 'exploration', battle: null, party: [sauteur, compagnon],
      pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: sauteur.id, participants: [
        { id: sauteur.id, interactive: true, attempt: null, result: null },
        { id: compagnon.id, interactive: true, attempt: null, result: null },
      ] },
    } as never);
    act(() => root.render(<FallModal />));
    act(() => option('Tenter').click());
    expect(useGame.getState().pendingFall!.participants.map((x) => x.attempt)).toEqual([true, null]);
    expect(texte(host)).toContain(t('fall.situation.tente', { metres: 4 }).replace(/\s+/g, ' '));
  });

  it('avant la déclaration, la rangée montre le Test de la fiche : compétence et Difficulté du pending', () => {
    monter(false);
    expect(zonesDifficulte()).toEqual([difficultyText(posee.difficulty)]);
    expect(libelles()).toEqual([refLabel('skills', posee.skill)]);
  });

  it('« Sauter » déclaré : sa rangée dit la chute pleine, sans Difficulté ni cible ; celle qui reste à déclarer garde la sienne', () => {
    const compagnon = { ...sauteur, id: 'K', name: 'K', label: 'Kurt' } as Combatant;
    useGame.setState({
      mode: 'exploration', battle: null, party: [sauteur, compagnon],
      pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: sauteur.id, participants: [
        { id: sauteur.id, interactive: true, attempt: null, result: null },
        { id: compagnon.id, interactive: true, attempt: null, result: null },
      ] },
    } as never);
    act(() => root.render(<FallModal />));
    act(() => option('Sauter').click());
    expect(useGame.getState().pendingFall!.participants.map((x) => x.attempt)).toEqual([false, null]);
    expect(host.textContent).toContain('saute sans Test');
    expect(zonesDifficulte(), 'une seule ligne de Test : celle de Kurt').toEqual([difficultyText(posee.difficulty)]);
    expect(host.querySelectorAll('.rm-roll-block')).toHaveLength(1);
  });
});

describe('chute du groupe — « Tenter » déclaré, une autre rangée encore à déclarer', () => {
  it('le « Lancer » de la barre est fermé avec sa raison, et son clic ne lance rien', () => {
    const compagnon = { ...sauteur, id: 'K', name: 'K', label: 'Kurt' } as Combatant;
    useGame.setState({
      mode: 'exploration', battle: null, party: [sauteur, compagnon],
      pendingFall: { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: sauteur.id, participants: [
        { id: sauteur.id, interactive: true, attempt: true, result: null },
        { id: compagnon.id, interactive: true, attempt: null, result: null },
      ] },
    } as never);
    act(() => root.render(<FallModal />));
    const lancer = [...document.querySelectorAll('button')].filter((b) => (b.textContent ?? '').trim() === 'Lancer');
    expect(lancer.length, 'un CTA « Lancer »').toBeGreaterThan(0);
    for (const b of lancer) expect(b.getAttribute('aria-disabled') ?? (b.disabled ? 'true' : null), 'CTA fermé').toBe('true');
    expect(document.body.textContent, 'sa raison est lisible').toContain(t('declaration.attenteFenetre'));
    act(() => lancer.forEach((b) => b.click()));
    expect(useGame.getState().pendingFall!.participants[0].result).toBeNull();
  });
});
