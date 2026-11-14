/**
 * #2961 — teardown par défaut du verbe `annuler` d'un flux de jet (`rollFlowFactory`, `annuler`) : il ferme
 * le pending du flux, et la cascade seulement quand ce pending porte l'une de ses étapes-jets
 * (`PORTEURS_D_ETAPE`). Une cascade étrangère au flux reste ouverte.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const cascade = { purpose: 'combat', cursor: 0, participants: [] } as unknown as Jeu['pendingCascade'];

describe('cancel par défaut : la cascade se ferme avec le flux qu’elle héberge, jamais avec un autre', () => {
  it('flux NON hébergé (Rechargement) : son pending se ferme, la cascade ouverte à côté reste', () => {
    banc.setState({ pendingReload: { actorId: 'h1' } as unknown as Jeu['pendingReload'], pendingCascade: cascade });
    banc.getState().jetAnnuler('rechargement');
    expect(banc.getState().pendingReload).toBeNull();
    expect(banc.getState().pendingCascade).toBe(cascade);
  });

  it('flux hébergé (Test) : son pending et sa cascade-hôte se ferment ensemble', () => {
    banc.setState({ pendingTest: { actorId: 'h1', cancellable: true } as unknown as Jeu['pendingTest'], pendingCascade: cascade });
    banc.getState().jetAnnuler('test');
    expect(banc.getState().pendingTest).toBeNull();
    expect(banc.getState().pendingCascade).toBeNull();
  });
});
