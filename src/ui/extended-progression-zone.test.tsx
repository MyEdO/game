// @vitest-environment jsdom
/**
 * #1078 LOT B1 (finition) — la PROGRESSION d'un Test étendu se lit à UNE seule place : la barre de DR
 * de la rangée (`RollRow.extendedDr` → `DrBar`). Contrat POSITIF mesuré à l'ÉCRAN (montage réel,
 * patron `createRoot`/`act` du repo) : la barre porte « cumul / cible », et le cadre d'issue ne le
 * répète pas — il ne s'ouvre que pour ce qu'aucune autre zone n'énonce (le total remis à zéro, le
 * sort qui cède). Le DR du Round, lui, vit sur la ligne de jet (`RollLine`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { DispelModal } from './DispelModal';
import { FocusModal } from './FocusModal';
import { RollShell } from './RollShell';
import { useExtendedTestJetProps } from './jetProps/useExtendedTestJetProps';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind: 'hero', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: blessuresDeBase(18), resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant);

function ExtendedTestHost() {
  const props = useExtendedTestJetProps();
  return props ? <RollShell {...props} /> : null;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState({ battle: null, pendingDispel: null, pendingExtendedTest: null, pendingFocus: null, party: [mk('mage')] } as never);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingDispel: null, pendingExtendedTest: null, pendingFocus: null, party: [] } as never);
});

/** Ce qu'un joueur LIT dans la fenêtre, espaces normalisés. */
const screen = () => (host.textContent ?? '').replace(/\s+/g, ' ');
/** Le cadre d'issue, s'il est ouvert. */
const outcomeFrame = () => host.querySelector('.rm-journal');
/** Occurrences de la forme « n / m » (progression) dans un texte. */
const progressions = (text: string) => text.match(/\d+\s*\/\s*\d+/g) ?? [];

const putDispel = (over: Partial<{ ni: number; sl: number }> = {}) => {
  const { ni = 3, sl = 1 } = over;
  useGame.setState({
    pendingDispel: {
      casterId: 'mage', spellId: 'malefice', spellCasterId: 'ennemi', label: 'Maléfice',
      ni, value: 60, result: { roll: 10, target: 60, sl, success: true },
    },
  } as never);
};

const putExtended = (over: Partial<{ total: number; targetDR: number; sl: number; success: boolean }> = {}) => {
  const { total = 2, targetDR = 5, sl = 2, success = true } = over;
  useGame.setState({
    pendingExtendedTest: {
      actorId: 'mage', label: 'Enfoncer la porte', skillLabel: 'Force', target: 45,
      targetDR, total, rounds: [{ id: 'round-1', interactive: true, result: { roll: 22, sl, success } }],
    },
  } as never);
};

describe('Dissipation — la progression est sur la BARRE, pas dans l’issue', () => {
  it('Round qui n’a pas encore atteint le NI : la barre porte « 1 / 3 DR », aucun cadre d’issue', () => {
    putDispel({ ni: 3, sl: 1 });
    act(() => root.render(<DispelModal />));
    expect(host.querySelector('.dr-bar-val')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1 / 3 DR');
    expect(outcomeFrame(), 'rien à dire que la barre ne dise déjà').toBeNull();
    expect(progressions(screen()), 'la forme « n / m » n’apparaît qu’UNE fois à l’écran').toHaveLength(1);
  });

  it('NI atteint : l’issue énonce le SORT QUI CÈDE — sans chiffre ni DR', () => {
    putDispel({ ni: 1, sl: 1 });
    act(() => root.render(<DispelModal />));
    const frame = outcomeFrame();
    expect(frame, 'le seul fait qu’aucune zone ne porte s’affiche').not.toBeNull();
    const text = (frame!.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Maléfice est dissipé !');
    expect(progressions(text), 'l’issue ne recopie pas la barre').toEqual([]);
    expect(text, 'ni le verdict de la ligne de jet').not.toContain('DR');
  });
});

describe('Test étendu — la progression est sur la BARRE, pas dans l’issue', () => {
  it('Round positif : la barre porte « 4 / 5 DR », aucun cadre d’issue', () => {
    putExtended({ total: 2, targetDR: 5, sl: 2, success: true });
    act(() => root.render(<ExtendedTestHost />));
    expect(host.querySelector('.dr-bar-val')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('4 / 5 DR');
    expect(outcomeFrame(), 'le cumul est déjà lisible sur la barre').toBeNull();
    expect(progressions(screen()), 'la forme « n / m » n’apparaît qu’UNE fois à l’écran').toHaveLength(1);
  });

  it('total repassé sous zéro : l’issue énonce la REMISE À ZÉRO — sans chiffre ni DR', () => {
    putExtended({ total: 1, targetDR: 5, sl: -3, success: false });
    act(() => root.render(<ExtendedTestHost />));
    const frame = outcomeFrame();
    expect(frame, 'ce que la barre à 0 ne distingue pas d’un départ à 0 s’écrit').not.toBeNull();
    const text = (frame!.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Le total repart de zéro !');
    expect(progressions(text), 'l’issue ne recopie pas la barre').toEqual([]);
    expect(text, 'ni le verdict de la ligne de jet').not.toContain('DR');
  });
});

describe('Focalisation — la progression est sur la BARRE, pas au sous-titre ni dans l’issue', () => {
  /** Sort de NI 6 (`attaques-en-chaine`, src/data/spells.json), déjà focalisé à 2 DR. */
  const putFocus = (dr: number, prev = 2) => {
    const mage = { ...mk('mage'), focus: { spell: 'attaques-en-chaine', dr: prev } } as never;
    useGame.setState({
      battle: null, party: [mage],
      pendingFocus: { casterId: 'mage', spellId: 'attaques-en-chaine', result: { roll: 22, target: 60, dr, success: dr >= 0, log: 'jet' } },
    } as never);
  };

  it('Round qui n’atteint pas le NI : « n / m » n’est à l’écran qu’UNE fois (la barre), aucune issue', () => {
    putFocus(1);
    act(() => root.render(<FocusModal />));
    expect(host.querySelector('.dr-bar-val')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 / 6 DR');
    expect(progressions(screen()), 'la forme « n / m » n’apparaît qu’UNE fois à l’écran').toHaveLength(1);
    expect(outcomeFrame(), 'rien à dire que la barre ne dise déjà').toBeNull();
  });

  it('NI atteint : l’issue énonce le FAIT — sans chiffre ni DR', () => {
    putFocus(5);
    act(() => root.render(<FocusModal />));
    const frame = outcomeFrame();
    expect(frame, 'le seul fait qu’aucune zone ne porte s’affiche').not.toBeNull();
    const text = (frame!.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Focalisation complète');
    expect(progressions(text), 'l’issue ne recopie pas la barre').toEqual([]);
    expect(text, 'ni le verdict de la ligne de jet').not.toContain('DR');
  });
});
