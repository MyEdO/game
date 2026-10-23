/**
 * Contrecoups d'incantation — câblage store (LDB 46/40) : gate des actions
 * d'incantation/Focalisation, purge par l'horloge (advanceTime), persistance.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pregen, PREGEN } from '../data/pregens';
import { carryOverState } from '../engine/persistence';
import type { Combatant } from '../engine/types';
import { idNeufDeBanc } from '../lib/entityId.testkit';

function priest() {
  const p = pregen(idNeufDeBanc, PREGEN.pretre);
  const sk = p.skills.find((s) => s.id === 'priere');
  if (sk) sk.advances = Math.max(sk.advances, 5);
  else p.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 });
  return p;
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingFocus: null, gameTime: 8 * 60 });
  useGame.getState().seedRng(5);
});

describe('gates d\'incantation', () => {
  it('blocage de Prière actif → oocCastSpell refuse (pas de modale), journal explicite', () => {
    const p = priest();
    p.castPenalties = [{ label: 'Vous abusez de ma patience', skill: 'priere', blocked: true, roundsLeft: 5 }];
    useGame.setState({ party: [p] as Combatant[] });
    useGame.getState().oocCastSpell(p.id, 'benediction-de-guerison', p.id);
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/ne peut pas prier/);
  });

  it('blocage de Focalisation → oocFocusSpell refuse', () => {
    const wiz = pregen(idNeufDeBanc, PREGEN.sorcier);
    wiz.spells = ['arme-aethyrique'];
    wiz.skills.push({ id: 'focalisation', characteristic: 'force-mentale', advances: 5 } as never);
    wiz.castPenalties = [{ label: 'Vue assombrie', skill: 'focalisation', blocked: true, roundsLeft: 3 }];
    useGame.setState({ party: [wiz] as Combatant[] });
    useGame.getState().oocFocusSpell(wiz.id, 'arme-aethyrique');
    expect(useGame.getState().pendingFocus).toBeNull();
  });
});

describe('purge par l\'horloge (advanceTime)', () => {
  it('un contrecoup à untilTime expiré est purgé et journalisé', () => {
    const p = priest();
    const now = useGame.getState().gameTime;
    p.castPenalties = [{ label: 'Drain de puissance', skill: 'langue', blocked: true, untilTime: now + 10 }];
    useGame.setState({ party: [p] as Combatant[] });
    useGame.getState().advanceTime(5);
    expect(useGame.getState().party[0].castPenalties).toHaveLength(1); // pas encore
    useGame.getState().advanceTime(10);
    expect(useGame.getState().party[0].castPenalties).toHaveLength(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/Drain de puissance se dissipe/);
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
