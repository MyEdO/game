import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { poserLeSiegeMJ } from './sieges';
import { rollSansPilote } from './rollSeam';
import { makeRNG } from '../engine/dice';
import { setCadence } from '../engine/cadence';
import type { Combatant } from '../engine/types';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

/**
 * Porte de repli SANS-PILOTE du seam (#918 phase 2a) — l'invariant « un jet inline n'est permis QUE si
 * aucun humain ne pilote l'acteur » vit dans la primitive, plus dans chaque call-site. Prédicat
 * `humanControlled` (`netOwnership.ts`) : le MÊME que la surface M de `surfaceDeLEtape`.
 */
describe('rollSansPilote — porte de repli sans-pilote (#918)', () => {
  const rng = () => makeRNG(1234);

  const mk = (over: Partial<Combatant>): Combatant =>
    combattantDeTest({
      id: 'X', label: 'Sujet', kind: 'heros',
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
      skills: [], conditions: [], talents: [],
      ...over,
    });

  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const prendreLeSiegeMJ = (seat: number) => banc.setState({ net: poserLeSiegeMJ(banc.getState().net, seat) });

  it('acteur NON piloté (ennemi, aucun siège MJ) → le jet est rendu, sans bruit', () => {
    const e = mk({ id: 'E', label: 'Ennemi', kind: 'ennemi' });
    banc.setState({ party: [e] });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = rollSansPilote(banc.getState, e, 45, 'intermediaire', rng());
    expect(res.target).toBe(45);
    expect(typeof res.success).toBe('boolean');
    expect(spy).not.toHaveBeenCalled();
  });

  /** LE cas où l'invariant mord en jeu RÉEL : un ennemi n'est « piloté » que si un siège porte le rôle
   *  MJ (bac-à-sable, `netOwnership.pilotedByHuman`). Le même acteur bascule donc de repli légitime à
   *  jet silencieux par la seule prise du siège — sans que rien ne change côté combattant. */
  it('ennemi SOUS siège MJ, cadence manuelle → humanControlled : THROW en DEV', () => {
    const e = mk({ id: 'E', label: 'Ennemi', kind: 'ennemi' });
    banc.setState({ party: [e] });
    prendreLeSiegeMJ(0);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => rollSansPilote(banc.getState, e, 45, 'intermediaire', rng()))
      .toThrowError(/jet silencieux d'un acteur piloté/);
  });

  it('ennemi SOUS siège MJ mais cadence Auto → repli légitime (le MJ ne lance pas non plus)', () => {
    const e = mk({ id: 'E', label: 'Ennemi', kind: 'ennemi' });
    banc.setState({ party: [e] });
    prendreLeSiegeMJ(0);
    setCadence('auto');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(rollSansPilote(banc.getState, e, 45, 'intermediaire', rng()).target).toBe(45);
    expect(spy).not.toHaveBeenCalled();
  });

  it('SANS acteur (côté monde) → invariant vide, jet rendu', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = rollSansPilote(banc.getState, undefined, 30, 'intermediaire', rng());
    expect(res.target).toBe(30);
    expect(spy).not.toHaveBeenCalled();
  });

  it('héros PILOTÉ en cadence manuelle, en DEV → THROW avec le message de jet silencieux', () => {
    const h = mk({ id: 'H', label: 'Héros' });
    banc.setState({ party: [h] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => rollSansPilote(banc.getState, h, 45, 'intermediaire', rng()))
      .toThrowError(/jet silencieux d'un acteur piloté/);
  });

  it('héros PILOTÉ, en PROD simulée → aucun throw : console.error + jet rendu quand même', () => {
    vi.stubEnv('DEV', false);
    const h = mk({ id: 'H', label: 'Héros' });
    banc.setState({ party: [h] });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = rollSansPilote(banc.getState, h, 45, 'intermediaire', rng());
    expect(res.target).toBe(45);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toMatch(/jet silencieux d'un acteur piloté/);
  });

  it('CADENCE-AWARE : le MÊME héros piloté en cadence Auto est un repli LÉGITIME (ni erreur, ni throw)', () => {
    const h = mk({ id: 'H', label: 'Héros' });
    banc.setState({ party: [h] });
    setCadence('auto');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = rollSansPilote(banc.getState, h, 45, 'intermediaire', rng());
    expect(res.target).toBe(45);
    expect(spy).not.toHaveBeenCalled();
  });

  it('modificateur et difficulté sont passés tels quels à rollTest (forme de engine/tests)', () => {
    const e = mk({ id: 'E', label: 'Ennemi', kind: 'ennemi' });
    banc.setState({ party: [e] });
    expect(rollSansPilote(banc.getState, e, 40, 'facile', rng()).target).toBe(80); // +40
    expect(rollSansPilote(banc.getState, e, 40, 'intermediaire', rng(), -10).target).toBe(30);
  });
});
