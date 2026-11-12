// @vitest-environment jsdom
/**
 * #3059 L4b — les fenêtres Enfoncer la porte, Chanson de marin et Manœuvre annoncent la valeur, la
 * Difficulté et l'issue que le noyau applique (EDO 11 l.93, MDG 09 l.38, LDB 85 l.445).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { ForceDoorModal } from './ForceDoorModal';
import { ShantyModal } from './ShantyModal';
import { ManeuverModal } from './ManeuverModal';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { unarmedWeapon } from '../engine/items';
import type { Combatant, SkillInstance } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
const VIDE = { battle: null, party: [], pendingForceDoor: null, pendingShanty: null, pendingManeuver: null, pendingCascade: null } as never;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState(VIDE);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState(VIDE);
});

const ecran = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const cibles = () => [...host.querySelectorAll('.rm-roll-calc b')].map((e) => e.textContent);
const boutons = () => [...host.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());
const competence = (id: string, spec: string, characteristic: string, advances: number) => ({ id, spec, characteristic, advances } as SkillInstance);
const heros = (over: Partial<Combatant> = {}): Combatant => combattantDeTest({
  id: 'h', label: 'Gerhardt', kind: 'heros', wounds: blessuresDeBase(12), fortune: 0, resilience: 0,
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, sociabilite: 30 } as Combatant['characteristics'],
  weapons: [unarmedWeapon()], ...over,
});
const combat = (c: Combatant) => ({ combatants: [c], order: [c.id], turn: 0, round: 1, acted: false, log: [], action: null });

describe('ForceDoorModal', () => {
  const ouvrir = (degats: number[] | null) => {
    const h = heros({ skills: [competence('corps-a-corps', 'escrime', 'capacite-de-combat', 20)] });
    useGame.setState({ party: [h], pendingForceDoor: { label: 'Porte de la cave', doorBE: 4, doorB: 5, doorBmax: 5,
      participants: [{ id: h.id, interactive: true, result: degats ? { roll: 10, target: 40, sl: 3, damage: degats[0] } : null }] } } as never);
    act(() => root.render(<ForceDoorModal />));
  };

  it('annonce la cible de Corps à corps (Bagarre), pas celle de l’Escrime (EDO 11 l.93)', () => {
    ouvrir(null);
    expect(cibles()).toEqual(['40']);
  });

  it('dit que la porte cède quand le Round l’abat, et qu’elle tient sinon', () => {
    ouvrir([5]);
    expect(boutons()).toContain('Enfoncer !');
    expect(ecran()).toContain('la porte cède');
    act(() => root.unmount());
    root = createRoot(host);
    ouvrir([3]);
    expect(boutons()).toContain('Appliquer le Round');
    expect(ecran()).toContain('(reste 2)');
  });
});

describe('ForceDoorModal — arme choisie (EDO 11 l.93)', () => {
  it('le choix de la hache passe la ligne sur Corps à corps (Base) : Base +10, Escrime +20 → 50', () => {
    const hache = { ...unarmedWeapon(), unarmed: undefined, builtinId: undefined, qualities: [], uid: 'hache', label: 'Hache', subType: 'base', damage: { plusBF: true, flat: 4 } } as unknown as Combatant['weapons'][number];
    const h = heros({ skills: [competence('corps-a-corps', 'base', 'capacite-de-combat', 10), competence('corps-a-corps', 'escrime', 'capacite-de-combat', 20)], weapons: [hache, unarmedWeapon()] });
    useGame.setState({ party: [h], pendingForceDoor: { label: 'Porte', doorBE: 4, doorB: 5, doorBmax: 5, participants: [{ id: h.id, interactive: true, result: null }] } } as never);
    act(() => root.render(<ForceDoorModal />));
    expect(cibles()).toEqual(['40']);
    const bouton = [...host.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Hache')!;
    act(() => bouton.click());
    expect(cibles()).toEqual(['50']);
  });
});

describe('ShantyModal', () => {
  it('annonce la durée du noyau : DR 4 → 7 minutes (MDG 09 l.38)', () => {
    const h = heros({ skills: [competence('divertissement', 'chant', 'sociabilite', 10)], talents: [{ talentId: 'chanson-de-marin', spec: 'naviguons-tous-ensemble', times: 1 }] });
    useGame.setState({ battle: combat(h), pendingShanty: { shipId: 's', singerId: h.id, shantyId: 'naviguons-tous-ensemble',
      result: { roll: 2, target: 40, sl: 4, success: true } } } as never);
    act(() => root.render(<ShantyModal />));
    expect(ecran()).toContain('porte 7 minute(s)');
    expect(cibles()).toEqual(['40']);
  });
});

describe('ManeuverModal', () => {
  it('Vomissement : la ligne d’attaquant est Facile (+40) — CT 40 → cible 80 (LDB 85 l.445)', () => {
    const h = heros({ traits: [{ id: 'vomissement', value: 0 }] as Combatant['traits'] });
    useGame.setState({ battle: combat(h), pendingManeuver: { attackerId: h.id, kind: 'vomi', attaque: 'vomissement', avantageSpent: 0, result: null } } as never);
    act(() => root.render(<ManeuverModal />));
    expect(cibles()).toEqual(['80']);
    expect(ecran()).toContain('Facile');
  });
});
