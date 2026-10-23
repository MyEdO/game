/**
 * LES DOMINOS par le SOCLE DE SÉQUENCE — NADJ 16 l.105 : « pour jouer, chaque joueur effectue un Test
 * opposé de Pari Accessible (+20). En cas d'égalité, les joueurs comparent le résultat de leur dé
 * d'unités pour ce Test. Celui qui a le nombre le plus bas gagne. »
 *
 * La clause du jeu remplace le départage général (NADJ 16 l.105 ; #1921 c.6233078802) : à DR égal, la valeur ne départage pas.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from '../noyau/battleRng';
import { findTavernGameById, TAVERN_GAMES, TAVERN_FAST_RULE } from '../engine/tavernGame';
import { setRule, resetRule } from '../engine/policy';
import { resolveSequenceTie, closeSequenceRound, sequenceVolleyRounds } from '../noyau/sequenceCore';
import { type EtatDeFamille, type MancheClose } from '../noyau/sequenceContract';
import { TAVERN_SEQUENCE, TAVERN_ROUND_KIND, HABITUE } from '../noyau/tavernFlow';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from '../noyau/pendings';
import { pnjAuProfil } from '../noyau/monde/sceneNpc';
import type { DepartageDeSequence } from '../engine/sequenceVocab';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/** L'adversaire au profil standard, nommé comme `playTavernGame` le nomme (`opponentActor.label`). */
const NOM_HABITUE = pnjAuProfil('humain', HABITUE)!.label;

const get = useGame.getState.bind(useGame);

function heros(): Combatant {
  return makePregens(idNeufDeBanc)[0] as Combatant;
}

/** Séquence de partie en cours, telle que `playTavernGame` la pose. */
function partie(tieBreak: DepartageDeSequence | undefined, challengerId: string): EtatDeFamille<typeof TAVERN_SEQUENCE> {
  return {
    def: TAVERN_SEQUENCE, round: 1, cum: {},
    params: { ...(tieBreak ? { tieBreak } : {}) },
    payload: { gameId: 'dominos', challengerId, opponentValue: 40, opponentName: NOM_HABITUE, stakeBrass: 0 },
  };
}

/** Un camp de la manche close : son d100, sa valeur NUE (grandeur de LDB 12 l.160) et son DR. */
interface Camp { roll: number; nue: number; sl: number }

/** Manche CLOSE : le jet du challenger et le jet adverse FIGÉ, à la Difficulté des Dominos. */
function doneRound(actorId: string, mien: Camp, sien: Camp): MancheClose {
  const step: CascadeStep = {
    id: `${TAVERN_ROUND_KIND}-1`, kind: TAVERN_ROUND_KIND, actorId,
    label: fixtureText('Les dominos'), rollLabel: 'Pari', difficulty: 'accessible',
    base: mien.nue, target: mien.nue + 20,
    result: { roll: mien.roll, target: mien.nue + 20, sl: mien.sl, success: true },
    meta: {
      gameId: 'dominos', opponentValue: sien.nue, opponentName: NOM_HABITUE, stakeBrass: 0, round: 1,
      opposed: { aT: { roll: sien.roll, target: sien.nue + 20, sl: sien.sl, success: true, isDouble: false, base: sien.nue }, attackerName: NOM_HABITUE },
    },
  };
  return { participants: [step] };
}

/** L'issue de la manche close, sous la clause `tieBreak` (absente : aucune clause déclarée). */
function issue(tieBreak: DepartageDeSequence | undefined, mien: Camp, sien: Camp): string | undefined {
  const a = heros();
  useGame.setState({ party: [a], tavernGames: null, sequence: partie(tieBreak, a.id) });
  closeSequenceRound(get, useGame.setState, doneRound(a.id, mien, sien));
  return get().tavernGames?.result?.winner;
}

describe('Les dominos — NADJ 16 l.105', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    seedBattleRng(3);
  });

  it('le Test est un Pari ACCESSIBLE (+20), des deux côtés de la table', () => {
    expect(findTavernGameById('dominos')?.difficulty, 'portée à la racine du jeu').toBe('accessible');
    const a = heros();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    const etape = get().pendingCascade!.participants[0];
    expect(etape.difficulty, 'le challenger').toBe('accessible');
    const aT = etape.meta!.opposed!.aT!;
    expect(aT.target - aT.base!, 'l’habitué : +20 sur sa valeur nue').toBe(20);
    expect(etape.meta!.opposed!.difficulty, 'la Difficulté de l’habitué, figée avec son jet').toBe('accessible');
  });

  it('LA DONNÉE déclare la clause : `tieBreak` voyage de l’entrée au socle', () => {
    expect(findTavernGameById('dominos')?.tieBreak).toBe('units-lowest');
    const a = heros();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    expect(get().sequence?.params.tieBreak).toBe('units-lowest');
  });

  it('à DR ÉGAL, le dé d’unités le plus BAS gagne — même contre la valeur la plus HAUTE', () => {
    expect(issue('units-lowest', { roll: 22, nue: 30, sl: 2 }, { roll: 27, nue: 60, sl: 2 }), '2 contre 7, valeur 30 contre 60').toBe('player');
    expect(issue('units-lowest', { roll: 27, nue: 60, sl: 2 }, { roll: 22, nue: 30, sl: 2 }), '7 contre 2, valeur 60 contre 30').toBe('opponent');
  });

  it('sans départage, le résultat dit les DR des deux camps', () => {
    expect(issue('units-lowest', { roll: 22, nue: 30, sl: 3 }, { roll: 27, nue: 60, sl: 1 })).toBe('player');
    expect(get().tavernGames?.result?.detail).toBe('DR 3 contre 1');
  });

  it('le départage se DIT : le résultat et le journal nomment le dé d’unités de chacun', () => {
    expect(issue('units-lowest', { roll: 22, nue: 30, sl: 2 }, { roll: 27, nue: 60, sl: 2 })).toBe('player');
    expect(get().tavernGames?.result?.detail).toBe('DR 2 contre 2 — À DR égal, dé d’unités 2 contre 7 : le plus bas l’emporte');
    expect(get().journal.some((l) => l.includes('dé d’unités 2 contre 7')), 'le journal le dit').toBe(true);
  });

  it('à DR ÉGAL et unités égales, la valeur ne départage pas : la manche reste nulle', () => {
    expect(issue('units-lowest', { roll: 23, nue: 60, sl: 2 }, { roll: 33, nue: 30, sl: 2 })).toBe('tie');
  });

  it('le DR décide AVANT la clause : le plus haut DR gagne, quelles que soient les unités', () => {
    expect(issue('units-lowest', { roll: 19, nue: 40, sl: 3 }, { roll: 30, nue: 40, sl: 2 })).toBe('player');
  });

  it('SANS clause (régime rapide, NADJ 16 l.11), le départage général s’applique : la valeur la plus haute (LDB 12 l.160)', () => {
    setRule(TAVERN_FAST_RULE, true);
    try {
      expect(findTavernGameById('dominos')?.tieBreak, 'le régime rapide ne joue pas la clause').toBeUndefined();
      expect(issue(undefined, { roll: 22, nue: 30, sl: 2 }, { roll: 27, nue: 60, sl: 2 })).toBe('opponent');
    } finally { resetRule(TAVERN_FAST_RULE); }
  });

  it('LE RÉDUCTEUR : à dé d’unités 3 contre 7, c’est le PLUS BAS qui gagne', () => {
    expect(resolveSequenceTie('units-lowest', { roll: 23, sl: 2 }, { roll: 47, sl: 2 })).toBe('a');
    expect(resolveSequenceTie('units-lowest', { roll: 47, sl: 2 }, { roll: 23, sl: 2 })).toBe('b');
    expect(resolveSequenceTie('units-lowest', { roll: 33, sl: 2 }, { roll: 63, sl: 2 }), 'mêmes unités : rien ne départage').toBe('tie');
    expect(resolveSequenceTie('units-lowest', { roll: 100, sl: 0 }, { roll: 41, sl: 0 }), 'un d100 de 100 a 0 pour dé d’unités').toBe('a');
  });

  /** Toute entrée `opposed` ouvre la MÊME séquence, paramétrée par sa SEULE donnée. */
  it('ZÉRO CÉRÉMONIE : toute entrée `opposed` du catalogue ouvre la séquence, paramétrée par sa SEULE donnée', () => {
    const a = heros();
    for (const jeu of TAVERN_GAMES.filter((g) => g.mode === 'opposed')) {
      useGame.setState({ party: [a], sequence: null, pendingCascade: null, tavernGames: null });
      get().playTavernGame({ gameId: jeu.id, challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, ...(jeu.team ? { allyProfil: 'elfe-haut-et-sylvain' } : {}) });
      const seq = get().sequence;
      expect(seq?.def, `${jeu.id} : même orchestrateur pour tous`).toBe(TAVERN_SEQUENCE);
      expect(seq?.params, jeu.id).toEqual({
        ...(jeu.tieBreak ? { tieBreak: jeu.tieBreak } : {}),
        ...(jeu.drCap != null ? { drCap: jeu.drCap } : {}),
        ...(jeu.roundOps ? { rounds: jeu.roundOps } : {}),
        ...(jeu.phases ? { phases: jeu.phases } : {}),
        ...(jeu.scoreThreshold != null ? { scoreThreshold: jeu.scoreThreshold } : {}),
        ...(jeu.campScore ? { score: { player: jeu.campScore, opponent: jeu.campScore } } : {}),
        ...(jeu.table ? { table: jeu.table } : {}),
        ...(jeu.drBonus ? { drBonus: jeu.drBonus } : {}),
        ...(jeu.avantage ? { avantage: true } : {}),
        ...(jeu.volley ? { volley: jeu.volley, maxRounds: sequenceVolleyRounds(jeu.volley, 2) } : {}),
        ...(jeu.sides ? { sides: jeu.sides } : {}),
        ...(jeu.combined ? { combined: jeu.combined } : {}),
        ...(jeu.throwerPenalty ? { throwerPenalty: jeu.throwerPenalty } : {}),
      });
    }
  });
});
