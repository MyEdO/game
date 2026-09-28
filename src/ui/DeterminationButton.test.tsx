// @vitest-environment jsdom
/**
 * Détermination en modale de jet (`LDB 17 l.59-61`) : le mini-picker des États présents s'affiche en
 * LIBELLÉS (`conditionLabel`) — un id de donnée (`inconscient`, `a-terre`) n'est pas du texte joueur
 * (doctrine « la LOGIQUE est keyée par id, le `label` est de l'AFFICHAGE », CLAUDE.md).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DeterminationButton } from './DeterminationButton';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

const heros = (): Combatant => ({
  id: 'h', label: 'H', kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: { current: 8, max: 12 }, advantage: 0, movement: 4, weapons: [], talents: [], skills: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  conditions: [{ id: 'inconscient', value: 1 }, { id: 'a-terre', value: 1 }],
  resolve: 1,
} as unknown as Combatant);

function monter(depenses: string[]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<DeterminationButton combatant={heros()} onSpend={(c) => depenses.push(c)} />); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

describe('DeterminationButton', () => {
  it('le picker nomme les États par leur LIBELLÉ, jamais par leur id, et dépense sur l’ID', () => {
    const depenses: string[] = [];
    monter(depenses);
    const ouvrir = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Détermination'))!;
    expect(ouvrir, 'le bouton d’ouverture porte le compte de Détermination').toBeTruthy();
    expect(ouvrir.textContent).toContain('×1');
    act(() => { ouvrir.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const html = container.innerHTML;
    expect(html).toContain('Inconscient');
    expect(html).toContain('À Terre');
    expect(html, 'aucun id de donnée à l’écran').not.toMatch(/>[^<]*\binconscient\b/);
    expect(html).not.toMatch(/>[^<]*\ba-terre\b/);

    const pion = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith('Inconscient'))!;
    act(() => { pion.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(depenses, 'la LOGIQUE reste keyée par id').toEqual(['inconscient']);
  });

  it('divulgation ouverte : la bulle Codex du bouton se retire et ne rouvre pas sur l’option révélée', () => {
    monter([]);
    const ouvrir = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Détermination'))!;
    const enveloppe = ouvrir.closest<HTMLElement>('.codex-ref')!;
    act(() => { enveloppe.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.querySelector('.infobulle'), 'survolé et fermé : la bulle de la règle s’affiche').not.toBeNull();
    act(() => { ouvrir.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(ouvrir.getAttribute('aria-expanded'), 'la divulgation est ouverte').toBe('true');
    expect(document.querySelector('.infobulle'), 'ouverte : aucune bulle sur les options révélées').toBeNull();
    act(() => { enveloppe.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    expect(document.querySelector('.infobulle'), 'le survol ne la rouvre pas tant que la divulgation est ouverte').toBeNull();
  });
});
