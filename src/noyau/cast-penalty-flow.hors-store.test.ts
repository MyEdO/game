/**
 * Contrecoups d'incantation — câblage du noyau (LDB 46/40) : gate des actions
 * d'incantation/Focalisation, purge par l'horloge (avancerLeTemps), persistance.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { carryOverState } from '../engine/persistence';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function priest() {
  const p = herosDeScenario(idsDeTest, 'pretre');
  const sk = p.skills.find((s) => s.id === 'priere');
  if (sk) sk.advances = Math.max(sk.advances, 5);
  else p.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 });
  return p;
}

beforeEach(() => {
  banc.setState({ gameTime: 8 * 60 });
  banc.getState().ensemencerLeTirage(5);
});

describe('gates d\'incantation', () => {
  it('blocage de Prière actif → incanterLeSort refuse (pas de modale), journal explicite', () => {
    const p = priest();
    p.castPenalties = [{ label: 'Vous abusez de ma patience', skill: 'priere', blocked: true, roundsLeft: 5 }];
    banc.setState({ party: [p] as Combatant[] });
    banc.getState().incanterLeSort(p.id, 'benediction-de-guerison', p.id);
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().journal.join('\n')).toMatch(/ne peut pas prier/);
  });

  it('blocage de Focalisation → focaliserLeSort refuse', () => {
    const wiz = herosDeScenario(idsDeTest, 'sorcier');
    wiz.spells = ['arme-aethyrique'];
    wiz.skills.push({ id: 'focalisation', characteristic: 'force-mentale', advances: 5 } as never);
    wiz.castPenalties = [{ label: 'Vue assombrie', skill: 'focalisation', blocked: true, roundsLeft: 3 }];
    banc.setState({ party: [wiz] as Combatant[] });
    banc.getState().focaliserLeSort(wiz.id, 'arme-aethyrique');
    expect(banc.getState().pendingFocus).toBeNull();
  });
});

describe('purge par l\'horloge (avancerLeTemps)', () => {
  it('un contrecoup à untilTime expiré est purgé et journalisé', () => {
    const p = priest();
    const now = banc.getState().gameTime;
    p.castPenalties = [{ label: 'Drain de puissance', skill: 'langue', blocked: true, untilTime: now + 10 }];
    banc.setState({ party: [p] as Combatant[] });
    banc.getState().avancerLeTemps(5);
    expect(banc.getState().party[0].castPenalties).toHaveLength(1); // pas encore
    banc.getState().avancerLeTemps(10);
    expect(banc.getState().party[0].castPenalties).toHaveLength(0);
    expect(banc.getState().journal.join('\n')).toMatch(/Drain de puissance se dissipe/);
  });
});

describe('persistance', () => {
  it('carryOverState transporte les castPenalties (durées d\'horloge survivent au combat)', () => {
    const p = priest();
    p.castPenalties = [{ label: 'Pensez à vos actes', skill: 'priere', maxZeroDR: true, untilTime: 99999 }];
    const carried = carryOverState(p);
    expect(carried.castPenalties).toHaveLength(1);
    expect(carried.castPenalties![0].label).toBe('Pensez à vos actes');
  });
});
