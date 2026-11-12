/**
 * La STATION à bord d'un marin (`affecterALaStation`, `shipCrew.ts`) : où il se trouve quand un Critique frappe une
 * présence (`MDG 13 l.680`). Contrat déclaré (`actionsDuNoyau.ts`) : épinglée sur `party` ET `battle.combatants`,
 * détachée par `null`, sans défaut.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { shipStations } from '../data';
import type { BattleState } from './etat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const marin = () => combattantDeTest({ id: 'm', label: 'M', kind: 'heros' });
const stationDe = (ou: 'party' | 'battle') => (ou === 'party' ? banc.getState().party : banc.getState().battle!.combatants).find((c) => c.id === 'm')!.shipStation;

describe('affecterALaStation — MDG 13 l.680', () => {
  it('épingle une station du catalogue sur le marin du groupe ET de la bataille, puis la détache', () => {
    const station = shipStations.find((s) => s.id === 'greement')!.id;
    const m = marin();
    banc.setState({ party: [m], battle: { combatants: [{ ...m }] } as unknown as BattleState });
    banc.getState().affecterALaStation('m', station);
    expect(stationDe('party')).toBe(station);
    expect(stationDe('battle')).toBe(station);
    banc.getState().affecterALaStation('m', null);
    expect(stationDe('party')).toBeUndefined();
    expect(stationDe('battle')).toBeUndefined();
  });

  it('hors bataille : seul le groupe est écrit, aucune bataille ne naît', () => {
    banc.setState({ party: [marin()], battle: null });
    banc.getState().affecterALaStation('m', 'cale');
    expect(stationDe('party')).toBe('cale');
    expect(banc.getState().battle).toBeNull();
  });
});
