/**
 * LES DOMINOS par le SOCLE DE SÉQUENCE (#1279) — et son départage d'égalité CONTRE-INTUITIF, verbatim
 * NADJ 16 l.105 : « pour jouer, chaque joueur effectue un Test opposé de Pari Accessible (+20). En cas
 * d'égalité, les joueurs comparent le résultat de leur dé d'unités pour ce Test. Celui qui a le nombre
 * le plus bas gagne. »
 *
 * Le plus BAS gagne : c'est l'inverse du réflexe (« le plus haut l'emporte ») — d'où un test qui le
 * VERROUILLE, et une DONNÉE qui le déclare (`tieBreak` de l'entrée `tavernGames.json`), jamais un
 * branchement par id de jeu dans le moteur.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { findTavernGameById, TAVERN_GAMES } from '../engine/tavernGame';
import { resolveSequenceTie, closeSequenceRound, sequenceVolleyRounds, type SequenceState } from './sequenceCore';
import { TAVERN_SEQUENCE, TAVERN_ROUND_KIND, type TavernPayload, HABITUE } from './tavernFlow';
import type { Combatant } from '../engine/types';
import type { PendingCascade, CascadeStep } from './pendings';
import { pnjAuProfil } from './sceneNpc';

/** L'adversaire au profil standard, nommé comme `playTavernGame` le nomme (`opponentActor.label`). */
const NOM_HABITUE = pnjAuProfil('humain', HABITUE)!.label;

const get = useGame.getState.bind(useGame);

function heroes(): [Combatant, Combatant] {
  const all = makePregens();
  return [all[0] as Combatant, all[1] as Combatant];
}

/** Séquence de partie en cours, telle que `playTavernGame` la pose. */
function partie(tieBreak: string | undefined, challengerId: string): SequenceState<TavernPayload> {
  return {
    def: TAVERN_SEQUENCE, round: 1, cum: {},
    params: { ...(tieBreak ? { tieBreak } : {}) },
    payload: { gameId: 'dominos', challengerId, opponentValue: 40, opponentName: NOM_HABITUE, stakeBrass: 0 },
  };
}

/** Manche CLOSE : le jet du challenger et le jet adverse FIGÉ, tous deux à DR ÉGAL — seule reste
 *  l'égalité à départager (l.107). `roll` porte le dé d'unités. */
function doneRound(actorId: string, playerRoll: number, opponentRoll: number, sl: number): PendingCascade {
  const step: CascadeStep = {
    id: `${TAVERN_ROUND_KIND}-1`, kind: TAVERN_ROUND_KIND, actorId,
    label: fixtureText('Les dominos'), rollLabel: 'Pari', difficulty: 'intermediaire',
    base: 40, target: 40,
    result: { roll: playerRoll, target: 40, sl, success: true },
    meta: {
      gameId: 'dominos', opponentValue: 40, opponentName: NOM_HABITUE, stakeBrass: 0, round: 1,
      opposed: { aT: { roll: opponentRoll, target: 40, sl, success: true, isDouble: false, base: 40 }, attackerName: NOM_HABITUE },
    },
  };
  return { title: 't', purpose: 'sequence', participants: [step], cursor: 1, log: [] };
}

describe('Les dominos — départage d’égalité au dé d’unités (NADJ 16 l.105)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    seedBattleRng(3);
  });

  it('LA DONNÉE le déclare : l’entrée `dominos` porte son `tieBreak`, et la partie ouvre avec', () => {
    expect(findTavernGameById('dominos')?.tieBreak).toBe('units-lowest');
    const [a] = heroes();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    expect(get().sequence?.params.tieBreak, 'le paramètre voyage de la donnée au socle').toBe('units-lowest');
  });

  /**
   * ZÉRO CÉRÉMONIE POUR LES SIMPLES (#1279) : un jeu en Test opposé n'a AUCUN code à lui — sa seule
   * déclaration est son entrée de `tavernGames.json`. Ce test le mesure sur TOUTES les entrées
   * `opposed` du catalogue : chacune ouvre la MÊME séquence, avec pour seuls paramètres ceux que sa
   * donnée porte. Un jeu N+1 à mécanismes connus n'ajoute donc pas une ligne de TypeScript.
   *
   * Les FAMILLES s'ajoutent ici à mesure qu'un jeu les exerce. Le jeu d'ÉQUIPE (Middenball, l.121)
   * déclare quatre paramètres de plus (formule de camp, seuil d'acquis, mi-temps, effets de manche) et
   * ouvre la MÊME séquence. Il a, lui, du code : la fabrique de tour d'équipe et son réducteur
   * (`tavernFlow.ts`), branchés sur la CAPACITÉ déclarée (`game.team`) — jamais sur son id.
   */
  it('ZÉRO CÉRÉMONIE : toute entrée `opposed` du catalogue ouvre la séquence, paramétrée par sa SEULE donnée', () => {
    const [a] = heroes();
    for (const jeu of TAVERN_GAMES.filter((g) => g.mode === 'opposed')) {
      useGame.setState({ party: [a], sequence: null, pendingCascade: null, tavernGames: null });
      get().playTavernGame({ gameId: jeu.id, challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' }, ...(jeu.team ? { allyProfil: 'elfe-haut-et-sylvain' } : {}) });
      const seq = get().sequence;
      expect(seq?.def, `${jeu.id} : même orchestrateur pour tous`).toBe(TAVERN_SEQUENCE);
      // Les paramètres ne viennent QUE de l'entrée — rien n'est câblé par id de jeu dans le moteur.
      expect(seq?.params, jeu.id).toEqual({
        ...(jeu.tieBreak ? { tieBreak: jeu.tieBreak } : {}),
        ...(jeu.drCap != null ? { drCap: jeu.drCap } : {}),
        ...(jeu.roundOps ? { rounds: jeu.roundOps } : {}),
        ...(jeu.phases ? { phases: jeu.phases } : {}),
        ...(jeu.scoreThreshold != null ? { scoreThreshold: jeu.scoreThreshold } : {}),
        ...(jeu.campScore ? { score: { player: jeu.campScore, opponent: jeu.campScore } } : {}),
        ...(jeu.table ? { table: jeu.table } : {}),
        ...(jeu.drBonus ? { drBonus: jeu.drBonus } : {}),
        ...(jeu.volley ? { volley: jeu.volley, maxRounds: sequenceVolleyRounds(jeu.volley, 2) } : {}),
        ...(jeu.sides ? { sides: jeu.sides } : {}),
        ...(jeu.combined ? { combined: jeu.combined } : {}),
        ...(jeu.throwerPenalty ? { throwerPenalty: jeu.throwerPenalty } : {}),
      });
    }
  });

  it('LE RÉDUCTEUR : à dé d’unités 3 contre 7, c’est le PLUS BAS qui gagne', () => {
    expect(resolveSequenceTie('units-lowest', { roll: 23, sl: 2 }, { roll: 47, sl: 2 })).toBe('a');
    expect(resolveSequenceTie('units-lowest', { roll: 47, sl: 2 }, { roll: 23, sl: 2 })).toBe('b');
    expect(resolveSequenceTie('units-lowest', { roll: 33, sl: 2 }, { roll: 63, sl: 2 }), 'mêmes unités : rien ne départage').toBe('tie');
    // Un d100 de 100 a 0 pour dé d'unités — le plus bas possible.
    expect(resolveSequenceTie('units-lowest', { roll: 100, sl: 0 }, { roll: 41, sl: 0 })).toBe('a');
  });

  it('LA PARTIE : à DR égal, le challenger au dé d’unités le plus BAS remporte la manche', () => {
    const [a] = heroes();
    useGame.setState({ party: [a], sequence: partie('units-lowest', a.id) });
    closeSequenceRound(get, useGame.setState, doneRound(a.id, 22, 27, 2)); // 2 contre 7
    expect(get().tavernGames?.result?.winner).toBe('player');

    useGame.setState({ party: [a], tavernGames: null, sequence: partie('units-lowest', a.id) });
    closeSequenceRound(get, useGame.setState, doneRound(a.id, 27, 22, 2)); // 7 contre 2
    expect(get().tavernGames?.result?.winner).toBe('opponent');
  });

  it('SANS départage déclaré, la même égalité reste une égalité (le socle n’invente rien)', () => {
    const [a] = heroes();
    useGame.setState({ party: [a], sequence: partie(undefined, a.id) });
    closeSequenceRound(get, useGame.setState, doneRound(a.id, 22, 27, 2));
    expect(get().tavernGames?.result?.winner).toBe('tie');
  });
});
