// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from '../state/store';
import { FateSaveModal } from './FateSaveModal';
import type { Combatant } from '../engine/types';

/**
 * LDB 17 l.29 : sacrifier un Point de Destin, puis l'une des DEUX options (l.31, l.32). Le groupe de
 * choix du corps porte ces options, et elles seules ; refuser le sacrifice est la sortie de l'état
 * courant, au pied (`docs/charte-ui.md`, `.cadre-pied`).
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HERO = {
  id: 'H', name: 'H', label: 'Héros', kind: 'hero', fate: 2,
  characteristics: { endurance: 40 }, wounds: { current: 0, max: 12 }, advantage: 0,
  conditions: [], traumas: [], resilience: 2, fortune: 0, weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
} as unknown as Combatant;

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
  useGame.setState({ pendingFateSave: null, battle: null });
});

const texte = (e: Element) => (e.textContent ?? '').trim();

function monter(source: 'hit' | 'slow') {
  useGame.setState({ battle: { combatants: [HERO] } as never, pendingFateSave: { heroId: 'H', source } });
  act(() => root.render(<FateSaveModal />));
  const corps = host.querySelector('.modal-body')!;
  const pied = host.querySelector('.cadre-pied');
  return {
    options: [...corps.querySelectorAll('button')].map(texte).filter((t) => t),
    notes: [...corps.querySelectorAll('.rm-stake')].map(texte),
    /** Chaque case d'option : son bouton et SA note, appariés par la structure. */
    cases: [...corps.querySelectorAll('.rm-option')].map((c) => ({ option: texte(c.querySelector('button')!), note: texte(c.querySelector('.rm-stake')!) })),
    /** Les notes hors de toute case : celle du refus. */
    horsCase: [...corps.querySelectorAll('.rm-stake')].filter((n) => !n.closest('.rm-option')).map(texte),
    gestes: pied ? [...pied.querySelectorAll('button')] : [],
  };
}

describe('FateSave — LDB 17 l.29 : deux options au corps, le refus au pied', () => {
  it('coup fatal : les deux options dans l’ordre du livre (l.31 puis l.32), et la mort n’en est pas', () => {
    const { options, gestes } = monter('hit');
    expect(options).toEqual(['Meurs un autre jour', 'Comment ça a pu rater ?']);
    expect(gestes.map(texte)).toEqual(['Accepter le sort']);
    expect(gestes[0].classList.contains('btn-ghost')).toBe(true);
    expect(gestes[0].classList.contains('danger')).toBe(true);
  });

  it('coup fatal : chaque option porte SA note dans sa case, le refus a la sienne hors des cases, aucune ne redit un libellé', () => {
    const { notes, options, cases, horsCase } = monter('hit');
    expect(cases.map((c) => c.option)).toEqual(['Meurs un autre jour', 'Comment ça a pu rater ?']);
    expect(cases[0].note).toMatch(/ne prend plus part à la rencontre/);
    expect(cases[1].note).toMatch(/sans subir aucune pénalité/);
    expect(horsCase).toHaveLength(1);
    expect(horsCase[0]).toMatch(/le héros meurt/);
    for (const n of notes) for (const o of [...options, 'Accepter le sort']) expect(n, `« ${n} » redit « ${o} »`).not.toContain(o);
  });

  it('mort lente : pas de note pour l’option que la fenêtre n’offre pas', () => {
    const { cases, horsCase } = monter('slow');
    expect(cases.map((c) => c.option)).toEqual(['Meurs un autre jour']);
    expect(horsCase).toHaveLength(1);
  });

  it('le renvoi du titre est la règle de la fenêtre, quelle que soit l’offre', () => {
    const regle = (source: 'hit' | 'slow') => { monter(source); return host.querySelector('.modal-title .ab-codex-info')?.getAttribute('aria-label'); };
    const coup = regle('hit');
    expect(coup).toMatch(/Règle/);
    expect(regle('slow')).toBe(coup);
  });
});
