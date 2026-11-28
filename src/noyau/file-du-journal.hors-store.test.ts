import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { drainPendingLog, enfilerAuJournal } from './combatEffects';
import { ligneDeTexte } from '../engine/journal';

describe('file différée du journal (#4574) : elle transporte des entrées', () => {
  it('rend les entrées enfilées entières, dans l’ordre, attribuées à leur combattant, et se vide', () => {
    const banc = ouvrirLeBanc();
    const premiere = { ...ligneDeTexte('a', { ton: 'echec', icone: 'interface/fermer' }), deFixe: true as const };
    const seconde = ligneDeTexte('b', { ton: 'reussite' });
    enfilerAuJournal(banc.getState, banc.setState, [premiere], 'c1');
    enfilerAuJournal(banc.getState, banc.setState, [seconde], 'c2');
    const evenements = drainPendingLog(banc.getState, banc.setState);
    expect(evenements.map((e) => e.actorId)).toEqual(['c1', 'c2']);
    expect(evenements.map((e) => e.kind)).toEqual(['detail', 'detail']);
    expect(evenements.map((e) => e.entree)).toEqual([
      { sorte: 'ligne', texte: 'a', ton: 'echec', icone: 'interface/fermer', deFixe: true },
      { sorte: 'ligne', texte: 'b', ton: 'reussite' },
    ]);
    expect(banc.getState().pendingLogQueue).toEqual([]);
  });
});
