// @vitest-environment jsdom
/**
 * Fenêtre de soin (`HealModal` → `useHealJetProps`) : le Test (Guérison / Dextérité) et les Bandages engagés, lus de
 * `fenetreDuSoin`, chaque option fermée avec sa raison ; la ligne du jet nomme le Test déclaré. LDB 74 l.41.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { HealModal } from './HealModal';
import type { Combatant } from '../engine/types';
import { itemFromTrappingById, unarmedWeapon } from '../engine/items';
import { garanti } from '../lib/garanti';
import { combatDeModale } from './combattantDeModale.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind: 'heros', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [unarmedWeapon()], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: blessuresDeBase(18, 12), resilience: 0, fortune: 0,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over }) as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;
const vide = { battle: null, party: [], pendingHeal: null, pendingSurgery: null, medic: null } as never;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState(vide);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState(vide);
});

const bouton = (texte: string) => garanti([...host.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === texte), texte, 'bouton');
const raison = (b: HTMLButtonElement) => document.getElementById(b.getAttribute('aria-describedby') ?? '')?.textContent ?? null;

function poser() {
  const doc = mk('Doc', { skills: [{ id: 'guerison', advances: 20, characteristic: 'intelligence' }] as never, items: [{ ...garanti(itemFromTrappingById('bandages', idsDeTest), 'bandages', 'Bandages'), uid: 'b1' }] });
  const al = mk('Al', { conditions: [{ id: 'hemorragique', value: 2 }] });
  useGame.setState({
    battle: combatDeModale([doc, al]), party: [doc, al],
    pendingHeal: {
      healerId: 'Doc', healerName: 'Doc', targetId: 'Al', mode: 'hemorragie', intBonus: 4, test: 'guerison', bandagesDe: null,
      skillValue: 60, difficulty: 'intermediaire', ligne: { base: 60, mods: [], target: 60, difficulty: 'intermediaire' }, target: 60, roll: null, success: false, sl: 0,
    },
  } as never);
  act(() => root.render(<HealModal />));
}

describe('fenêtre de soin — Test et Bandages', () => {
  it('sans Bandages engagés : Dextérité fermée avec sa raison ; Bandages de Doc offerts', () => {
    poser();
    const dex = bouton('Dextérité');
    expect(dex.getAttribute('aria-disabled')).toBe('true');
    expect(raison(dex)).toBe('La Dextérité exige des Bandages');
    expect(bouton('Guérison').getAttribute('aria-pressed')).toBe('true');
    expect(bouton('Sans Bandages').getAttribute('aria-pressed')).toBe('true');
    expect(bouton('Bandages de Doc').getAttribute('aria-disabled')).toBeNull();
  });

  it('Bandages engagés puis Dextérité choisie : la ligne nomme la Dextérité, « Sans Bandages » fermé avec sa raison', () => {
    poser();
    act(() => bouton('Bandages de Doc').click());
    act(() => bouton('Dextérité').click());
    expect(useGame.getState().pendingHeal!.test).toBe('dexterite');
    const sans = bouton('Sans Bandages');
    expect(sans.getAttribute('aria-disabled')).toBe('true');
    expect(raison(sans)).toBe('Les Bandages sont la condition du Test de Dextérité');
    expect(host.textContent).toContain('Dextérité');
    expect(host.textContent).toContain('Réussi : 1 État Hémorragique retiré. Réussi ou non : une unité de Bandages s’use, et le patient reçoit une Aide Médicale.');
  });
});
