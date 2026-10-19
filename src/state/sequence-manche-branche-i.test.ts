/**
 * MANCHE NON `immediate` RÉSOLUE PAR LA PORTE EN BRANCHE I (#1595) — `openSequence` rend les étapes
 * qu'il a résolues sur place quand aucun siège ne tient leurs porteurs. La manche est alors close :
 * le socle de séquence la clôt (`closeSequenceRound`) au lieu de rester ouverte sans fenêtre ni suite.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { combatStakeRef } from '../data';
import { fixtureText } from '../i18n/fixtureText';
import { monoStep } from '../noyau/rollSeam';
import { registerCascadeApplier } from '../noyau/cascade';
import { registerSequence, startSequence, activeSequence } from './sequenceCore';

declare module './sequenceContract' {
  interface SequenceFamilies {
    'sonde-manche-branche-i': Record<string, never>;
  }
}

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

describe('#1595 — une manche résolue en branche I se clôt', () => {
  beforeEach(() => {
    set({ battle: null, pendingCascade: null, suspendedCascades: [], sequence: null, journal: [], partyWiped: false } as never);
    set({ net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined } } as never);
  });

  it('porteur sans siège (héros conduit par l’IA) : la manche s’ouvre, se résout ET se clôt', () => {
    const h = { ...createHero({ speciesId: 'humains-reiklander', careerId: 'garde', label: 'Otto', motivation: 'x', seed: 12, id: 'seq-otto' }), aiControlled: true };
    set({ party: [h] } as never);
    registerCascadeApplier('sondeMancheI', () => undefined);
    const closes: number[] = [];
    registerSequence('sonde-manche-branche-i', {
      round: (g, seq) => {
        const step = monoStep({
          id: `m-${seq.round}`, kind: 'sondeMancheI', label: fixtureText('Manche'), actor: g().party[0],
          difficulty: 'intermediaire', montee: { base: 50, target: 50 },
          stake: combatStakeRef('pursuitMove', { values: { distance: 1, evasion: 10 } }),
        });
        return step ? { title: fixtureText('Manche'), steps: [step] } : undefined;
      },
      close: ({ seq }) => { closes.push(seq.round); return { go: 'end', outcome: 'fin' }; },
    });
    startSequence(get, set, { def: 'sonde-manche-branche-i', payload: {} });
    expect(get().pendingCascade, 'aucun siège ne tient le porteur : aucune fenêtre').toBeNull();
    expect(closes, 'la manche résolue sur place est CLOSE par le socle').toEqual([1]);
    expect(activeSequence(get), 'issue atteinte : la séquence est retirée').toBeNull();
  });
});
