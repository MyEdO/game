// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from '../state/store';
import { DisengageModal } from './DisengageModal';
import type { Combatant } from '../engine/types';
import { poserLayoutJsdom } from './layoutJsdom.testkit';

/**
 * Menu de Désengagement (LDB 15 l.45-49, l.61-68) : chaque option OFFERTE porte sa note d'enjeu dans
 * sa rangée ; celle du renoncement est hors des rangées. Focus initial : `focusTarget` (`Modal.tsx`).
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy'): Combatant => ({
  id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
  weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 12, max: 12 }, resilience: 0, fortune: 0,
  species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

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
  useGame.setState({ pendingDisengage: null, battle: null } as never);
});

const texte = (e: Element) => (e.textContent ?? '').replace(/\s+/g, ' ').trim();

function menu(canSacrifice: boolean, canEsquive: boolean) {
  useGame.setState({
    battle: { combatants: [mk('Héros', 'hero'), mk('Brute', 'enemy')] } as never,
    pendingDisengage: { moverId: 'Héros', foeId: 'Brute', canSacrifice, canEsquive, phase: 'choice', atk: null, def: null, result: null },
  } as never);
  act(() => root.render(<DisengageModal />));
  const corps = host.querySelector('.modal-body')!;
  return {
    /** Chaque case d'option : son bouton et SA note, appariés par la structure. */
    cases: [...corps.querySelectorAll('.rm-option')].map((c) => ({ option: texte(c.querySelector('button')!), note: texte(c.querySelector('.rm-stake')!) })),
    /** Les notes hors de toute case : celle du renoncement. */
    horsCase: [...corps.querySelectorAll('.rm-stake')].filter((n) => !n.closest('.rm-option')).map(texte),
  };
}

describe('Désengagement — chaque option offerte porte sa note', () => {
  it('Action dépensée : le sacrifice et sa note ; le renoncement a la sienne hors des cases', () => {
    const { cases, horsCase } = menu(true, false);
    expect(cases.map((c) => c.option)).toEqual(['Sacrifier l\'Avantage']);
    expect(cases[0].note).toMatch(/Avantage ramené à 0/);
    expect(horsCase).toEqual(['Sans désengagement, tu restes Engagé.']);
  });

  it('Avantage insuffisant : Esquiver et Fuir, chacun avec sa note, jamais celle du sacrifice', () => {
    const { cases, horsCase } = menu(false, true);
    expect(cases.map((c) => c.option.replace(/\s*\(\d+\)$/, ''))).toEqual(['Esquiver', 'Fuir (coup dans le dos)']);
    expect(cases[0].note).toMatch(/Test opposé d’Esquive/);
    expect(cases[1].note).toMatch(/attaque gratuite/);
    expect(horsCase).toHaveLength(1);
  });
});

describe('Désengagement — focus initial', () => {
  it('aucune option poussée (deux légales, aucune recommandation de règle) : le focus va à la PREMIÈRE option offerte, jamais à la jauge du bandeau', () => {
    const retirer = poserLayoutJsdom();
    try {
      menu(true, true);
      expect(host.querySelectorAll('.rm-loc-grid .btn-primary')).toHaveLength(0);
      expect(texte(document.activeElement!)).toBe('Sacrifier l\'Avantage');
    } finally {
      retirer();
    }
  });
});

describe('Désengagement — une RANGÉE par option', () => {
  it('la grille qui porte des notes passe en rangées (verbe | conséquence)', () => {
    menu(true, true);
    expect(host.querySelector('.rm-loc-grid')?.hasAttribute('data-notes')).toBe(true);
    expect([...host.querySelectorAll('.rm-loc-grid > *')].every((c) => c.matches('.rm-option'))).toBe(true);
  });
});
