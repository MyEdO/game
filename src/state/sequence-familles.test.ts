/**
 * LES FAMILLES DE VOCABULAIRE DU SOCLE (#1279) — chacune mesurée SUR LA STRUCTURE, par une instance
 * ÉTRANGÈRE (aucun jeu, aucune poursuite) : c'est le socle qui est en cause, pas ses clients.
 *  · (2) table de score par plage de DR — `findTableEntry` sur `params.table` ;
 *  · (4) effets par manche — `applyOps` DÉCLENCHÉ par le socle sur les porteurs que le verdict NOMME ;
 *  · (6) phases (mi-temps) — le découpage déclaré, et la BORNE qui en découle.
 * Le cumul (1) et les formules de camp (3) sont mesurés par `sequence-socle-naval.test.ts`.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { combatStakeRef } from '../data';
import { monoStep } from './rollSeam';
import { hasCondition, COND } from '../engine/conditions';
import {
  registerSequence, startSequence, sequenceTableRow, sequencePhaseOf,
  type SequenceParams, type SequenceRound, type SequenceVerdict,
} from './sequenceCore';

/* ── (2) TABLE DE SCORE PAR PLAGE DE DR ──────────────────────────────────────────────────────────*/

describe('Famille (2) — table de score par plage de DR', () => {
  const table = [
    { min: -99, max: 2, points: 1, label: 'jambe' },
    { min: 3, max: 5, points: 2, label: 'corps' },
    { min: 6, max: 99, points: 3, label: 'tête' },
  ];

  it('la plage COUVRANTE décide, aux bornes comprises', () => {
    expect(sequenceTableRow({ table }, 0)?.points).toBe(1);
    expect(sequenceTableRow({ table }, 2)?.label).toBe('jambe');
    expect(sequenceTableRow({ table }, 3)?.label).toBe('corps');
    expect(sequenceTableRow({ table }, 5)?.points).toBe(2);
    expect(sequenceTableRow({ table }, 6)?.label).toBe('tête');
  });

  it('sans table déclarée, aucune entrée — le socle n’invente pas de barème', () => {
    expect(sequenceTableRow({}, 4)).toBeUndefined();
    expect(sequenceTableRow({ table: [] }, 4)).toBeUndefined();
  });
});

/* ── (6) PHASES ──────────────────────────────────────────────────────────────────────────────────*/

describe('Famille (6) — phases (mi-temps)', () => {
  /** Deux phases de trois manches (forme du Middenball, NADJ 16 l.119). */
  const params: SequenceParams = { phases: { count: 2, rounds: 3 } };

  it('le rang de manche se traduit en phase et en rang INTERNE à la phase', () => {
    expect(sequencePhaseOf(params, 1)).toMatchObject({ phase: 1, roundInPhase: 1, total: 6, last: false });
    expect(sequencePhaseOf(params, 3)).toMatchObject({ phase: 1, roundInPhase: 3, last: false });
    expect(sequencePhaseOf(params, 4), 'la 4ᵉ manche ouvre la 2ᵉ phase').toMatchObject({ phase: 2, roundInPhase: 1 });
    expect(sequencePhaseOf(params, 6), 'la dernière manche prévue est DITE dernière').toMatchObject({ phase: 2, roundInPhase: 3, last: true });
  });

  it('sans phases déclarées : une seule phase, jamais de dernière manche annoncée', () => {
    expect(sequencePhaseOf({}, 12)).toMatchObject({ phase: 1, count: 1, total: 0, last: false });
  });
});

/* ── L'INSTANCE ÉTRANGÈRE : un tournoi à phases et à effets de manche ────────────────────────────
 * Charge utile SANS rapport avec un jeu de taverne ou une poursuite : un tournoi de joute, dont
 * chaque passe a un vainqueur. Il exerce (4) et (6) par le CYCLE du socle, pas par des appels. */

interface JoutePayload { lices: string[]; passes: number[] }

const JOUTE = 'test-tournoi-joute';

declare module './sequenceContract' {
  interface SequenceFamilies {
    [JOUTE]: JoutePayload;
    'test-joute-borne-attrition': JoutePayload;
    'test-joute-sans-fin': JoutePayload;
  }
}
const passes: number[] = [];

registerSequence(JOUTE, {
  round: (get, seq): SequenceRound<JoutePayload> | undefined => {
    const h = get().party[0];
    if (!h) return undefined;
    passes.push(seq.round);
    const step = monoStep({
      id: `passe-${seq.round}`, kind: 'testJoute', label: fixtureText(`Passe ${seq.round}`), actor: h,
      difficulty: 'intermediaire', montee: { base: 50, target: 50 },
      stake: combatStakeRef('pursuitMove', { values: { distance: 1, evasion: 10 } }),
    });
    return step ? { title: fixtureText(`Joute — passe ${seq.round}`), steps: [step], immediate: true, payload: { ...seq.payload, passes: [...seq.payload.passes, seq.round] } } : undefined;
  },
  close: ({ get, seq }): SequenceVerdict<JoutePayload> => {
    const h = get().party[0];
    const dernier = sequencePhaseOf(seq.params, seq.round).last;
    // Le vainqueur de la passe est NOMMÉ par le verdict : c'est le socle qui applique ses ops.
    const roundActors = { winners: [h.id], all: [h.id] };
    return dernier ? { go: 'end', outcome: 'fini', roundActors } : { go: 'continue', roundActors };
  },
});

describe('Famille (4)+(6) — le socle DÉCLENCHE les ops de manche, et s’arrête au bout de ses phases', () => {
  beforeEach(() => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Jouteur', seed: 1 });
    h.advantage = 0;
    useGame.setState({ battle: null, party: [h], journal: [], pendingCascade: null, sequence: null });
    useGame.getState().seedRng(9);
    passes.length = 0;
  });

  it('deux mi-temps de trois passes : SIX manches, pas une de plus', () => {
    startSequence<JoutePayload>(useGame.getState, useGame.setState, {
      def: JOUTE,
      params: { phases: { count: 2, rounds: 3 } },
      payload: { lices: ['nord', 'sud'], passes: [] },
    });
    expect(passes).toEqual([1, 2, 3, 4, 5, 6]);
    expect(useGame.getState().sequence, 'la séquence est retirée au bout de ses phases').toBeNull();
  });

  it('les ops DÉCLARÉES tombent sur les porteurs NOMMÉS : +1 Avantage par passe gagnée', () => {
    startSequence<JoutePayload>(useGame.getState, useGame.setState, {
      def: JOUTE,
      params: {
        phases: { count: 1, rounds: 3 },
        rounds: { winner: [{ op: 'gainAdvantage', amount: 1 }] },
      },
      payload: { lices: [], passes: [] },
    });
    // `gainAdvantage` pose un PLANCHER (l'Avantage ne se cumule pas au-delà de ce qu'il octroie) :
    // ce qui est mesuré est qu'il a été DÉCLENCHÉ par le socle, une fois par manche gagnée.
    expect(useGame.getState().party[0].advantage).toBeGreaterThanOrEqual(1);
  });

  it('l’ATTRITION d’intervalle ne tombe qu’aux manches multiples de l’intervalle déclaré', () => {
    startSequence<JoutePayload>(useGame.getState, useGame.setState, {
      def: JOUTE,
      params: {
        phases: { count: 1, rounds: 2 },
        rounds: { attrition: [{ op: 'condition', id: 'extenue', value: 1 }], attritionEvery: 3 },
      },
      payload: { lices: [], passes: [] },
    });
    expect(passes).toEqual([1, 2]);
    expect(hasCondition(useGame.getState().party[0], COND.extenue), 'intervalle 3, deux manches : rien').toBe(false);

    // Intervalle 3 sur QUATRE manches : la 3ᵉ échoit ET n'est PAS la dernière — la manche qui compte
    // est une manche qui PASSE. (La forme précédente mesurait une 3ᵉ manche À LA FOIS échéante et
    // TERMINALE : elle serait restée verte avec l'attrition frappant la manche conclusive.)
    passes.length = 0;
    startSequence<JoutePayload>(useGame.getState, useGame.setState, {
      def: JOUTE,
      params: {
        phases: { count: 2, rounds: 2 },
        rounds: { attrition: [{ op: 'condition', id: 'extenue', value: 1 }], attritionEvery: 3 },
      },
      payload: { lices: [], passes: [] },
    });
    expect(passes).toEqual([1, 2, 3, 4]);
    expect(hasCondition(useGame.getState().party[0], COND.extenue), 'la 3ᵉ manche, qui PASSE, échoit').toBe(true);
  });

  /**
   * INVARIANT DE LA FAMILLE (NADJ 16 l.34, verbatim) : « Pour chaque Bonus d'Endurance **tours qui
   * passent sans que personne n'ait gagné**, vous gagnez + 1 État *Exténué* ». L'attrition est le prix
   * des manches qui PASSENT : la manche qui CONCLUT la séquence n'en est pas une, même si son rang
   * tombe pile sur l'intervalle. Tenu par le SOCLE — aucun client n'a à s'en souvenir.
   */
  it('la manche qui CONCLUT n’inflige PAS l’attrition, même à un rang multiple de l’intervalle', () => {
    startSequence<JoutePayload>(useGame.getState, useGame.setState, {
      def: JOUTE,
      params: {
        phases: { count: 1, rounds: 3 }, // la 3ᵉ manche est la DERNIÈRE : elle conclut
        rounds: { attrition: [{ op: 'condition', id: 'extenue', value: 1 }], attritionEvery: 3 },
      },
      payload: { lices: [], passes: [] },
    });
    expect(passes, 'trois manches jouées, la 3ᵉ conclut').toEqual([1, 2, 3]);
    expect(hasCondition(useGame.getState().party[0], COND.extenue), 'le tour gagné n’est pas un tour qui passe').toBe(false);
  });

  /** Même invariant à la BORNE : une séquence qui s'arrête faute de conclusion s'arrête AUSSI sur une
   *  manche qui ne « passe » plus — l'attrition ne la frappe pas non plus. */
  it('la manche de BORNE n’inflige pas non plus l’attrition', () => {
    registerSequence('test-joute-borne-attrition', {
      round: (get, seq) => {
        const h = get().party[0];
        passes.push(seq.round);
        const step = monoStep({
          id: `b-${seq.round}`, kind: 'testJoute', label: fixtureText('Passe'), actor: h,
          difficulty: 'intermediaire', montee: { base: 50, target: 50 },
          stake: combatStakeRef('pursuitMove', { values: { distance: 1, evasion: 10 } }),
        });
        return step ? { title: fixtureText('Joute'), steps: [step], immediate: true } : undefined;
      },
      close: ({ get }) => ({ go: 'continue', roundActors: { all: [get().party[0].id] } }),
    });
    startSequence<JoutePayload>(useGame.getState, useGame.setState, {
      def: 'test-joute-borne-attrition',
      params: {
        phases: { count: 1, rounds: 2 },
        rounds: { attrition: [{ op: 'condition', id: 'extenue', value: 1 }], attritionEvery: 2 },
      },
      payload: { lices: [], passes: [] },
    });
    expect(passes).toEqual([1, 2]);
    expect(hasCondition(useGame.getState().party[0], COND.extenue)).toBe(false);
  });

  it('sans déclaration d’ops, le socle n’applique RIEN (aucun effet par défaut)', () => {
    startSequence<JoutePayload>(useGame.getState, useGame.setState, {
      def: JOUTE, params: { phases: { count: 1, rounds: 3 } }, payload: { lices: [], passes: [] },
    });
    const h = useGame.getState().party[0] as { advantage?: number };
    expect(h.advantage ?? 0).toBe(0);
    expect(hasCondition(useGame.getState().party[0], COND.extenue)).toBe(false);
  });
});

describe('la BORNE tient compte des phases déclarées', () => {
  beforeEach(() => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Jouteur', seed: 2 });
    useGame.setState({ battle: null, party: [h], journal: [], pendingCascade: null, sequence: null });
    useGame.getState().seedRng(4);
    passes.length = 0;
  });

  it('un réducteur qui ne conclut JAMAIS s’arrête quand même au total des phases', () => {
    registerSequence('test-joute-sans-fin', {
      round: (get, seq) => {
        const h = get().party[0];
        passes.push(seq.round);
        const step = monoStep({
          id: `p-${seq.round}`, kind: 'testJoute', label: fixtureText('Passe'), actor: h,
          difficulty: 'intermediaire', montee: { base: 50, target: 50 },
          stake: combatStakeRef('pursuitMove', { values: { distance: 1, evasion: 10 } }),
        });
        return step ? { title: fixtureText('Joute'), steps: [step], immediate: true } : undefined;
      },
      close: () => ({ go: 'continue' }),
    });
    startSequence<JoutePayload>(useGame.getState, useGame.setState, {
      def: 'test-joute-sans-fin', params: { phases: { count: 2, rounds: 2 } }, payload: { lices: [], passes: [] },
    });
    expect(passes.length, 'quatre manches, puis la borne').toBe(4);
    expect(useGame.getState().sequence).toBeNull();
  });
});
