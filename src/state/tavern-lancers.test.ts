/**
 * LES JEUX DE LANCERS (#1279 S3) — la famille (7) VOLÉE du socle et la famille (8) CAMPS
 * ASYMÉTRIQUES, mesurées là où elles décident.
 *
 * Verbatim des règles en cause (`Source/…/16 - JEUX DE TAVERNE.md`) :
 *  · l.42 « vous avez droit à trois coups pour abattre les 16 quilles […] Le total est le nombre de
 *    quilles que vous abattez. Si vous obtenez un Critique, vous renversez toutes les quilles. » ;
 *  · l.65 « Un Critique vous permet à la place d'encercler la cible suivante sur la table, ce qui
 *    vous fait gagner plus de points. » ;
 *  · l.83 « Le but est de marquer un total d'exactement 501 points. Si vous marquez plus, votre tour
 *    est terminé, et les points marqués par votre dernière fléchette sont ignorés. » ;
 *  · l.57 « le joueur à qui appartient la boule qui a le plus de DR gagne » ;
 *  · l.27-28 « Si vous obtenez un Critique, vous remportez automatiquement la partie, pour peu qu'une
 *    des conditions suivantes soit remplie : vous êtes le joueur nain et le nombre obtenu sur le dé
 *    des unités est égal ou inférieur au nombre de pièces elfes que vous avez prises […]. Sinon, le
 *    premier camp à prendre plus de la moitié des pièces de son adversaire l'emporte. Si les deux
 *    équipes atteignent la condition gagnante dans le même tour, la partie se solde par un match nul. »
 *
 * Les jets sont POSÉS (aucun dé) : ce qui est mesuré est la règle, jamais le RNG — sauf le run à
 * GRAINE RÉELLE, qui déroule une partie entière sans rien poser.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { findTavernGameById } from '../engine/tavernGame';
import { bonus, effectiveChar } from '../engine/characteristics';
import {
  resolveSequenceThrow, sequenceThrowGain, sequenceThrowRow, sequenceVolleyRounds, sequenceScoreOf,
  registerSequenceTieBreak, closeSequenceRound, sequenceBoardOf, SEQUENCE_HARD_MAX_ROUNDS,
  type SequenceState, type SequenceThrowTurn, type SequenceVolleyRules,
} from './sequenceCore';
import { resolveTavernRound } from '../engine/tavernGame';
import { TAVERN_SEQUENCE, TAVERN_ROUND_KIND, type TavernPayload, HABITUE } from './tavernFlow';
import type { Combatant } from '../engine/types';
import type { CascadeStep, PendingCascade } from './pendings';
import { pnjAuProfil } from './sceneNpc';

/** L'adversaire au profil standard, nommé comme `playTavernGame` le nomme (`opponentActor.label`). */
const NOM_HABITUE = pnjAuProfil('humain', HABITUE)!.label;

const get = useGame.getState.bind(useGame);
const tick = (): Promise<void> => new Promise<void>((r) => { setTimeout(r, 0); });

const BETE = findTavernGameById('bete-tailleurs')!;
const ARENE = findTavernGameById('arene')!;
const FLECHETTES = findTavernGameById('flechettes')!;
const BOULES = findTavernGameById('boules')!;
const DOMINOS = findTavernGameById('dominos')!;
const ALVATAFL = findTavernGameById('alvatafl')!;

/** Un héros seul à la table, face à un adversaire de la salle. */
function seul(): Combatant {
  const a = makePregens()[0] as Combatant;
  useGame.setState({ battle: null, party: [a], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  return get().party[0];
}

const courant = (): CascadeStep | undefined => {
  const pc = get().pendingCascade;
  return pc?.participants[pc.cursor];
};

/** POSE le jet du lancer ouvert, puis le commit. */
function poseLancer(roll: number, sl: number): void {
  const pc = get().pendingCascade!;
  const idx = pc.participants.findIndex((s) => s.kind === 'tavern-throw');
  expect(idx, 'un lancer est bien ouvert').toBeGreaterThanOrEqual(0);
  const band = pc.participants[idx];
  const row = band.participants![0];
  const participants = [...pc.participants];
  participants[idx] = {
    ...band,
    participants: [{ ...row, result: { roll, target: row.target!, sl, success: roll <= row.target! } }],
  };
  useGame.setState({ pendingCascade: { ...pc, participants, cursor: idx } });
  get().cascadeNext();
}

/** Tranche le CHOIX ouvert (ligne visée, gain), et le commit. */
function trancher(kind: string, cle: string): void {
  const cur = courant();
  expect(cur?.kind, `le choix « ${kind} » est ouvert`).toBe(kind);
  get().cascadeChoose(cur!.id, cle);
  get().cascadeNext();
}

/** SAISIT le nombre de l'étape « quantité » ouverte (gain libre, l.83), et le commit. */
function saisir(kind: string, n: number): void {
  const cur = courant();
  expect(cur?.kind, `la saisie « ${kind} » est ouverte`).toBe(kind);
  get().cascadeAmount(cur!.id, n);
  get().cascadeNext();
}

/** L'état de volée en cours. */
function volley(): NonNullable<TavernPayload['volley']> {
  return (get().sequence!.payload as TavernPayload).volley!;
}

beforeEach(() => {
  seedBattleRng(11);
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
});

// Plusieurs cas s'arrêtent partie EN COURS (c'est le point : on mesure ce qu'elle est devenue). Le
// store est PARTAGÉ entre fichiers de test (`isolate: false`) : la séquence se retire ici, sinon elle
// suivrait le voisin.
afterEach(() => {
  useGame.setState({ tavernGames: null, pendingCascade: null, sequence: null });
});

/* ── LE SOCLE : ce que RAPPORTE un lancer (famille 7) ────────────────────────────────────────────*/

describe('Famille (7) — les effets de lancer ENREGISTRÉS', () => {
  const tour = (p: Partial<SequenceThrowTurn>): SequenceThrowTurn => ({
    roll: 26, sl: 3, success: true, critique: false, maladresse: false, points: 0, rows: [], ...p,
  });

  /**
   * L'ÉCRÊTAGE est ce qui SÉPARE les deux jeux de lancers à DR (l.42 contre l.57) : l'un ne peut
   * abattre plus de quilles qu'il n'en reste, l'autre n'a rien à écrêter. Le cas mesuré est donc
   * celui qui les DISTINGUE — un DR supérieur à la réserve — et pas le cas commun où les deux
   * rendent la même chose.
   */
  it('`dr` et `dr-ecrete` divergent quand le DR DÉPASSE la réserve', () => {
    const gros = tour({ sl: 20, reserve: 6 });
    expect(resolveSequenceThrow({ throws: 3, gain: 'dr' }, gros).gain, 'sans écrêtage : le DR entier').toBe(20);
    expect(resolveSequenceThrow({ throws: 3, gain: 'dr-ecrete' }, gros).gain, 'écrêté à ce qu’il reste').toBe(6);
    // Un DR négatif ne prend rien (on ne relève pas de quilles) — les deux effets s'accordent là.
    expect(resolveSequenceThrow({ throws: 3, gain: 'dr' }, tour({ sl: -2 })).gain).toBe(0);
    expect(resolveSequenceThrow({ throws: 3, gain: 'dr-ecrete' }, tour({ sl: -2, reserve: 6 })).gain).toBe(0);
  });

  it('`toute-la-reserve` prend tout ce qui reste, `points-de-la-ligne` ne paie que la réussite', () => {
    expect(resolveSequenceThrow({ throws: 3, gain: 'toute-la-reserve' }, tour({ sl: 0, reserve: 11 })).gain).toBe(11);
    const rows = [{ points: 10, label: 'a' }, { points: 20, label: 'b' }];
    const vise = { throws: 5, gain: 'points-de-la-ligne', rows };
    expect(resolveSequenceThrow(vise, tour({ row: rows[0], rowIndex: 0, rows })).gain).toBe(10);
    expect(resolveSequenceThrow(vise, tour({ success: false, row: rows[0], rowIndex: 0, rows })).gain).toBe(0);
    // « encercler la cible SUIVANTE sur la table » (l.65) — et la dernière ligne rend la sienne.
    const suivante = { throws: 5, gain: 'points-de-la-ligne', critique: 'points-de-la-ligne-suivante', rows };
    expect(resolveSequenceThrow(suivante, tour({ critique: true, row: rows[0], rowIndex: 0, rows })).gain).toBe(20);
    expect(resolveSequenceThrow(suivante, tour({ critique: true, row: rows[1], rowIndex: 1, rows })).gain).toBe(20);
  });

  it('`chiffres-du-de` : la réussite OFFRE les quatre lectures, l’échec ne rend que les unités (l.83)', () => {
    const v: SequenceVolleyRules = { throws: 3, gain: 'chiffres-du-de' };
    // « un jet réussi de 26 peut vous donner 2, 6, 20 ou 60 points »
    expect(resolveSequenceThrow(v, tour({ roll: 26 })).choix).toEqual([2, 6, 20, 60]);
    // « un jet raté de 73 vous donne 3 points »
    expect(resolveSequenceThrow(v, tour({ roll: 73, success: false })).gain).toBe(3);
  });

  it('`gain-au-choix` rend la PLAGE déclarée (jamais 100 valeurs), `aucun-gain` ne rend rien (l.83)', () => {
    const v: SequenceVolleyRules = { throws: 3, gain: 'chiffres-du-de', critique: 'gain-au-choix', libre: { min: 1, max: 100 }, maladresse: 'aucun-gain' };
    const offre = resolveSequenceThrow(v, tour({ critique: true }));
    // « autant de points que vous le souhaitez, entre 1 et 100 » : une PLAGE, servie en saisie —
    // l'énumérer en ferait 100 options, et le socle ne l'énumère plus.
    expect(offre.libre).toEqual({ min: 1, max: 100 });
    expect(offre.choix, 'une plage n’est pas une liste de valeurs').toBeUndefined();
    expect(resolveSequenceThrow(v, tour({ success: false, maladresse: true })).gain).toBe(0);
  });

  it('le DÉPASSEMENT d’une cible EXACTE déclenche l’effet déclaré — et lui seul', () => {
    const v: SequenceVolleyRules = { throws: 3, gain: 'chiffres-du-de', exact: 501, depassement: 'termine-le-passage' };
    expect(sequenceThrowGain(v, tour({ points: 490 }), 10), 'sous la cible : rien de spécial').toEqual({ gain: 10 });
    expect(sequenceThrowGain(v, tour({ points: 490 }), 11), 'pile la cible').toEqual({ gain: 11 });
    expect(sequenceThrowGain(v, tour({ points: 490 }), 12), 'un point de trop').toEqual({ gain: 0, ends: true });
    expect(sequenceThrowGain(v, tour({ points: 500 }), 20)).toEqual({ gain: 0, ends: true });
    // Sans effet déclaré, le socle n'invente rien : le gain passe.
    expect(sequenceThrowGain({ throws: 3, gain: 'dr', exact: 501 }, tour({ points: 500 }), 20)).toEqual({ gain: 20 });
  });

  it('la LIGNE désignée par la réserve se lit par plage, la borne se dérive des passages déclarés', () => {
    const v = BETE.volley!;
    expect(sequenceThrowRow(v, 16).row?.difficulty, 'les 16 quilles debout : le premier coup (l.42)').toBe('tresFacile');
    expect(sequenceThrowRow(v, 11).row?.difficulty).toBe('facile');
    expect(sequenceThrowRow(v, 1).row?.difficulty, '« 6-7 ou 1 » : Intermédiaire').toBe('intermediaire');
    expect(sequenceThrowRow(v, 2).row?.difficulty).toBe('difficile');
    expect(sequenceVolleyRounds(v, 2), '2 lanceurs × 3 coups × 1 passage').toBe(6);
    expect(sequenceVolleyRounds(ARENE.volley!, 2), 'la cible CHOISIE coûte un tour de plus par lancer').toBe(20);
  });
});

/* ── LA BÊTE PARMI LES TAILLEURS (l.42) ─────────────────────────────────────────────────────────*/

describe('La Bête parmi les Tailleurs — l’écrêtage aux quilles restantes (l.42)', () => {
  it('la donnée porte la règle : trois coups, seize quilles, Bonus de CT, Critique = tout', () => {
    expect([BETE.volley!.throws, BETE.volley!.reserve]).toEqual([3, 16]);
    expect(BETE.drBonus, '« ajoutez votre Bonus de Capacité de Tir au nombre de DR obtenus »').toBe('capacite-de-tir');
    expect(BETE.volley!.gain).toBe('dr-ecrete');
    expect(BETE.volley!.critique, '« Si vous obtenez un Critique, vous renversez toutes les quilles »').toBe('toute-la-reserve');
  });

  it('un DR ÉNORME n’abat que les seize quilles — et le passage s’arrête, il n’y a plus rien à abattre', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'bete-tailleurs', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    poseLancer(5, 20); // réussite à +60, DR posé bien au-delà des 16 quilles
    const res = get().tavernGames!.result!;
    expect(res.playerSL, 'seize quilles, pas une de plus (l’écrêtage)').toBe(16);
    expect(get().sequence, 'la partie est close : plus rien à abattre des deux côtés').toBeNull();
  });

  it('un CRITIQUE renverse toutes les quilles, quel que soit le DR', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'bete-tailleurs', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    poseLancer(11, 0); // double sur une réussite = Critique (l.7), DR nul
    expect(get().tavernGames!.result!.playerSL).toBe(16);
  });
});

/* ── L'ARÈNE (l.65) ─────────────────────────────────────────────────────────────────────────────*/

describe('L’Arène — la cible se CHOISIT, le Critique encercle la suivante (l.65)', () => {
  it('la table des cibles est en donnée : sept lignes, du nez à la gorge', () => {
    expect(ARENE.volley!.throws, '« après cinq lancers »').toBe(5);
    expect(ARENE.volley!.pick, '« avant de lancer un anneau, choisissez une cible »').toBe('choix');
    expect(ARENE.volley!.rows!.map((r) => [r.points, r.difficulty])).toEqual([
      [10, 'tresFacile'], [20, 'facile'], [30, 'accessible'], [40, 'intermediaire'],
      [50, 'complexe'], [75, 'difficile'], [100, 'tresDifficile'],
    ]);
  });

  it('la cible choisie règle la DIFFICULTÉ du lancer, et le Critique paie la ligne SUIVANTE', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'arene', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    trancher('tavern-throw-aim', '2'); // les Cornes : 30 points, Accessible (+20)
    const band = get().pendingCascade!.participants.find((s) => s.kind === 'tavern-throw')!;
    expect(band.participants![0].difficulty, 'la Difficulté vient de la ligne visée').toBe('accessible');
    poseLancer(11, 1); // Critique
    expect(volley().gains.player, 'la ligne SUIVANTE (40) au lieu des 30 visés').toEqual([40]);
  });

  it('sans Critique, la cible visée paie ses points — et un échec ne paie rien', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'arene', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    trancher('tavern-throw-aim', '2');
    poseLancer(12, 1);
    expect(volley().gains.player).toEqual([30]);
    trancher('tavern-throw-aim', '0'); // le nez : 10 points
    poseLancer(99, -2); // raté
    expect(volley().gains.player).toEqual([30, 0]);
  });
});

/* ── LES FLÉCHETTES (l.83) ──────────────────────────────────────────────────────────────────────*/

describe('Les fléchettes — le total EXACT, et le dépassement qui TERMINE LE TOUR (l.83)', () => {
  /** Amène la partie à `points` marqués pour le challenger, sa première fléchette en main. */
  function aDeuxDoigts(points: number): Combatant {
    const a = seul();
    get().playTavernGame({ gameId: 'flechettes', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    const seq = get().sequence as SequenceState<TavernPayload>;
    // Le lanceur du tour est le challenger : l'ordre est tiré au sort (l.83), on le fixe pour mesurer.
    const throwers = [...(seq.payload.throwers ?? [])].sort((x) => (x.camp === 'player' ? -1 : 1));
    useGame.setState({
      sequence: {
        ...seq,
        cum: { player: points, opponent: 0 },
        payload: {
          ...seq.payload, throwers,
          volley: { seat: 0, jet: 1, manche: 1, gains: {} },
        },
      },
    });
    return a;
  }

  /** « jetez une pièce de monnaie pour déterminer qui joue en premier » (l.83) : l'ordre est TIRÉ, pas
   *  posé. Le témoin est l'existence des DEUX ordres sur un balayage de graines — un ordre figé
   *  (challenger toujours premier) n'en produirait qu'un. */
  it('l’ORDRE de passage est TIRÉ AU SORT : les deux ordres sortent sur un balayage de graines', () => {
    const vus = new Set<string>();
    for (let graine = 1; graine <= 30 && vus.size < 2; graine++) {
      useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
      seedBattleRng(graine);
      const a = seul();
      get().playTavernGame({ gameId: 'flechettes', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
      const payload = get().sequence!.payload as TavernPayload;
      vus.add(payload.throwers![0].camp);
    }
    expect([...vus].sort(), 'le challenger ouvre parfois, son vis-à-vis parfois').toEqual(['opponent', 'player']);
  });

  it('la donnée porte la règle : trois fléchettes, 501 pile, le dépassement termine le passage', () => {
    expect(FLECHETTES.volley!.throws).toBe(3);
    expect(FLECHETTES.volley!.exact, '« un total d’exactement 501 points »').toBe(501);
    expect(FLECHETTES.volley!.depassement, '« votre tour est terminé »').toBe('termine-le-passage');
    expect(FLECHETTES.volley!.critique, '« marquez autant de points que vous le souhaitez, entre 1 et 100 »').toBe('gain-au-choix');
    expect(FLECHETTES.volley!.libre).toEqual({ min: 1, max: 100 });
    expect(FLECHETTES.volley!.maladresse, '« En cas d’Échec critique, vous ratez complètement la cible »').toBe('aucun-gain');
  });

  it('DÉPASSER 501 annule le lancer ET TERMINE LE TOUR : les fléchettes restantes ne sont pas lancées', () => {
    aDeuxDoigts(500);
    poseLancer(26, 2); // réussite : 2, 6, 20 ou 60 au choix
    trancher('tavern-throw-gain', '20'); // 520 > 501
    // Le passage du lanceur s'arrête là : la main passe au vis-à-vis, qui joue le sien d'office — la
    // manche se clôt donc dans la foulée. Ce que l'on mesure est ce qu'il en RESTE : le score n'a
    // pas bougé, et le héros rouvre au PREMIER lancer de la manche SUIVANTE (jamais à sa 2ᵉ
    // fléchette de celle-ci, qui aurait dû être lancée si le tour ne s'était pas terminé).
    expect(sequenceBoardOf(get)?.camps[0].score, 'le lancer ne rapporte rien : 500, pas 520').toBe(500);
    expect(volley().manche, 'la manche a été jouée jusqu’au bout et la suivante s’ouvre').toBe(2);
    expect(volley().jet, 'ses deux fléchettes restantes n’ont pas été lancées').toBe(1);
    expect(volley().seat).toBe(0);
    expect(get().journal.some((l) => l.includes('son tour est terminé'))).toBe(true);
  });

  it('marquer EXACTEMENT 501 remporte la partie — le gain libre se SAISIT (l.83)', () => {
    aDeuxDoigts(500);
    poseLancer(11, 2); // Critique : le gain est libre (1..100)
    // Le gain libre n'est plus 100 boutons : c'est la 6ᵉ interaction de la coquille (saisie bornée).
    const gain = courant()!;
    expect(gain.kind).toBe('tavern-throw-gain');
    expect(gain.quantity, '« entre 1 et 100 points »').toEqual({ min: 1, max: 100, unit: 'points' });
    expect(gain.options, 'aucune liste d’options : une plage se saisit').toBeUndefined();
    // Valeur d'OUVERTURE = la politique du jeu : ce qu'il faut pile pour toucher 501.
    expect(gain.amount).toBe(1);
    saisir('tavern-throw-gain', 1);
    const res = get().tavernGames!.result!;
    expect([res.winner, res.playerSL]).toEqual(['player', 501]);
    expect(get().sequence).toBeNull();
  });

  it('un ÉCHEC CRITIQUE ne marque rien, là où un échec simple marque son dé des unités', () => {
    aDeuxDoigts(0);
    poseLancer(99, -3); // 99 : double sur un échec = Échec critique
    expect(volley().gains.player).toEqual([0]);
    poseLancer(73, -1); // échec simple : « un jet raté de 73 vous donne 3 points »
    expect(volley().gains.player).toEqual([0, 3]);
  });
});

/* ── LES BOULES (l.57) ──────────────────────────────────────────────────────────────────────────*/

describe('Les boules — la MEILLEURE boule décide, plafonnée à 6 DR (l.57)', () => {
  it('la donnée porte la règle : trois boules, plafond 6 DR, meilleure boule, égalité = nul', () => {
    expect(BOULES.volley!.throws, '« chaque joueur dispose de trois boules »').toBe(3);
    expect(BOULES.drCap, '« Le DR maximal est de 6 DR »').toBe(6);
    expect(BOULES.campScore, '« la boule qui a le plus de DR gagne »').toBe('max');
    expect(BOULES.tieBreak, '« en cas d’égalité, la partie se solde par un match nul »').toBe('nul');
  });

  it('le score du camp est sa MEILLEURE boule, jamais la somme des trois', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    poseLancer(12, 2);
    poseLancer(13, 5);
    expect(volley().gains.player).toEqual([2, 5]);
    poseLancer(14, 1);
    const res = get().tavernGames!.result!;
    expect(res.playerSL, 'la meilleure des trois (5), pas leur somme (8)').toBe(5);
  });

  it('une boule RATÉE est hors-jeu (elle ne compte pas), et le DR est plafonné à 6', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    poseLancer(99, -4); // hors-jeu
    poseLancer(12, 9); // DR brut 9 : le plafond mord
    expect(volley().gains.player).toEqual([0, 6]);
  });

  it('PARTIE ENTIÈRE à graine réelle : elle conclut sans borne, et le score annoncé est celui du tableau', async () => {
    const a = seul();
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const vus: number[] = [];
    for (let i = 0; i < 60 && get().pendingCascade; i++) {
      const board = sequenceBoardOf(get);
      expect(board?.camps, 'le tableau de marque dit les deux camps').toHaveLength(2);
      const cur = courant();
      if (cur?.kind === 'tavern-throw') {
        vus.push(board!.camps[0].score);
        for (const row of cur.participants ?? []) if (row.interactive !== false && !row.result) get().cascadeBatchRoll(row.id);
      }
      get().cascadeNext();
      await tick();
    }
    const res = get().tavernGames!.result!;
    expect(get().sequence, 'la partie s’est close d’elle-même').toBeNull();
    expect(get().journal.some((l) => l.includes('sur sa borne')), 'aucune coupure par l’anti-boucle').toBe(false);
    expect(vus.length, 'les trois boules du héros ont bien été jouées une à une').toBe(3);
    expect(res.playerSL, 'le score final est le dernier montré au tableau').toBeGreaterThanOrEqual(0);
    expect(res.playerSL).toBeLessThanOrEqual(6);
    expect(['player', 'opponent', 'tie']).toContain(res.winner);
  });
});

/* ── L'ALVATAFL (l.27-28) ───────────────────────────────────────────────────────────────────────*/

describe('L’Alvatafl — les camps asymétriques et la victoire au Critique (l.27-28)', () => {
  /** Partie en cours, le challenger menant le camp `side`, avec les prises déjà faites. */
  function partie(side: string, cum: Record<string, number>, challengerId: string): SequenceState<TavernPayload> {
    return {
      def: TAVERN_SEQUENCE, round: 2, cum,
      params: { drBonus: 'intelligence', sides: ALVATAFL.sides! },
      payload: { gameId: 'alvatafl', challengerId, opponentValue: 40, opponentName: NOM_HABITUE, stakeBrass: 0, side },
    };
  }

  /** Manche close : le jet du challenger et le jet adverse FIGÉ. */
  function manche(actorId: string, mien: { roll: number; sl: number }, sien: { roll: number; sl: number }): PendingCascade {
    const step: CascadeStep = {
      id: `${TAVERN_ROUND_KIND}-2`, kind: TAVERN_ROUND_KIND, actorId,
      label: fixtureText('L\'Alvatafl'), rollLabel: 'Savoir', difficulty: 'intermediaire', base: 40, target: 40,
      result: { roll: mien.roll, target: 40, sl: mien.sl, success: true },
      meta: {
        gameId: 'alvatafl', opponentValue: 40, opponentName: NOM_HABITUE, stakeBrass: 0, round: 2,
        opposed: { aT: { roll: sien.roll, target: 40, sl: sien.sl, success: true, isDouble: false, base: 40 }, attackerName: NOM_HABITUE },
      },
    };
    return { title: 'Alvatafl', purpose: 'sequence', participants: [step], cursor: 1, log: [] };
  }

  it('la donnée porte les deux camps : 48 pièces naines, 12 elfes, et leurs conversions', () => {
    expect(ALVATAFL.sides!.map((s) => [s.id, s.pieces, s.div, s.mult])).toEqual([
      ['nain', 48, 4, 1], // « Le total obtenu par le joueur nain est divisé par quatre »
      ['elfe', 12, 1, 4], // « le nombre obtenu sur le dé des unités, multiplié par quatre »
    ]);
    expect(ALVATAFL.drBonus, '« ajoutez ensuite votre Bonus d’Intelligence au nombre de DR »').toBe('intelligence');
  });

  it('le CRITIQUE emporte la partie quand la condition du camp est remplie — et PAS quand elle ne l’est pas', () => {
    const a = seul();
    const bonusInt = bonus(effectiveChar(a, 'intelligence'));
    // Camp NAIN : ses prises sont son total DIVISÉ PAR QUATRE, et sa condition compare le dé des
    // unités (3, sur un 33) à ce qu'il a pris.
    const prises = (sl: number): number => Math.ceil((sl + bonusInt) / 4);
    const assez = 12 - bonusInt; // prises ≥ 3
    expect(prises(assez), 'ce DR donne bien trois prises').toBe(3);
    useGame.setState({ tavernGames: null, sequence: partie('nain', {}, a.id) });
    closeSequenceRound(get, useGame.setState, manche(a.id, { roll: 33, sl: assez }, { roll: 41, sl: 0 }));
    expect(get().tavernGames?.result?.winner, '3 ≤ 3 prises : la partie est emportée').toBe('player');

    const trop = 4 - bonusInt; // prises = 1, condition 3 ≤ 1 fausse
    expect(prises(trop)).toBe(1);
    useGame.setState({ tavernGames: null, sequence: partie('nain', {}, a.id) });
    closeSequenceRound(get, useGame.setState, manche(a.id, { roll: 33, sl: trop }, { roll: 41, sl: 0 }));
    expect(get().tavernGames, '3 > 1 prise : rien n’est emporté, la partie continue').toBeNull();
    expect(get().sequence, 'la séquence tient toujours').not.toBeNull();
  });

  /**
   * LE ×4 DU CAMP ELFE (l.28, verbatim) : « vous êtes le joueur elfe et le nombre obtenu sur le dé des
   * unités, multiplié par quatre (c'est-à-dire qu'un jet réussi de 33 compterait pour 12, puisque
   * 4 × 3 = 12) est égal ou inférieur au nombre de pièces naines que vous avez prises ». Le cas
   * NÉGATIF est celui qui compte : à 11 pièces prises, un multiplicateur de 1 ferait passer la
   * victoire (3 ≤ 11) là où le RAW la refuse (12 > 11).
   */
  it('CRITIQUE du camp ELFE : le dé des unités ×4 décide — 12 ≤ 12 emporte, 12 > 11 non', () => {
    const a = seul();
    const bonusInt = bonus(effectiveChar(a, 'intelligence'));
    // Camp ELFE : ses prises sont son total ENTIER (div 1) ; l'exemple du RAW donne 4 × 3 = 12.
    useGame.setState({ tavernGames: null, sequence: partie('elfe', {}, a.id) });
    closeSequenceRound(get, useGame.setState, manche(a.id, { roll: 33, sl: 12 - bonusInt }, { roll: 41, sl: 0 }));
    expect(get().tavernGames?.result?.winner, '12 ≤ 12 pièces naines prises : partie emportée').toBe('player');
    expect(get().tavernGames?.result?.playerSL, 'et ce sont bien 12 pièces').toBe(12);

    useGame.setState({ tavernGames: null, sequence: partie('elfe', {}, a.id) });
    closeSequenceRound(get, useGame.setState, manche(a.id, { roll: 33, sl: 11 - bonusInt }, { roll: 41, sl: 0 }));
    expect(get().tavernGames, '12 > 11 : rien n’est emporté — un ×1 aurait laissé passer').toBeNull();
    expect((get().sequence!.cum as Record<string, number>).player).toBe(11);
  });

  it('sans Critique, c’est PLUS DE LA MOITIÉ des pièces d’en face qui emporte la partie', () => {
    const a = seul();
    const bonusInt = bonus(effectiveChar(a, 'intelligence'));
    // Camp NAIN à 6 pièces elfes prises (la moitié pile) : il lui en faut UNE de plus.
    useGame.setState({ tavernGames: null, sequence: partie('nain', { player: 6, opponent: 0 }, a.id) });
    closeSequenceRound(get, useGame.setState, manche(a.id, { roll: 41, sl: 1 - bonusInt }, { roll: 42, sl: 0 }));
    expect(get().tavernGames?.result?.winner, '7 > 6 : plus de la moitié des 12 pièces elfes').toBe('player');
    expect(get().tavernGames?.result?.playerSL, 'le score annoncé est le compte de PIÈCES prises').toBe(7);

    useGame.setState({ tavernGames: null, sequence: partie('nain', { player: 4, opponent: 0 }, a.id) });
    closeSequenceRound(get, useGame.setState, manche(a.id, { roll: 41, sl: 1 - bonusInt }, { roll: 42, sl: 0 }));
    expect(get().tavernGames, '5 ≤ 6 : la partie continue').toBeNull();
  });

  it('les DEUX camps au but le MÊME tour : match nul (l.28)', () => {
    const a = seul();
    const bonusInt = bonus(effectiveChar(a, 'intelligence'));
    useGame.setState({ tavernGames: null, sequence: partie('nain', { player: 6, opponent: 24 }, a.id) });
    // Le camp elfe prend son total ENTIER (div 1) : +1 pièce naine lui suffit pour passer 24.
    closeSequenceRound(get, useGame.setState, manche(a.id, { roll: 41, sl: 1 - bonusInt }, { roll: 42, sl: 1 - bonusInt }));
    expect(get().tavernGames?.result?.winner).toBe('tie');
  });
});

/* ── LE PLAFOND DE DR SUR LE JUGE OPPOSÉ, ET LE DÉPARTAGE D'UNE VOLÉE ───────────────────────────*/

describe('Plafond de DR et départage — les deux juges', () => {
  /**
   * Le plafond DÉCLARÉ (« Le DR maximal est de 6 DR », l.57) mord sur le juge de manche OPPOSÉE
   * (`resolveTavernRound`) comme sur la volée. Ce témoin-ci est celui du chemin opposé : il a perdu sa
   * fixture quand le jeu qui le déclare est passé en volée, il se repose donc sur le juge lui-même.
   */
  it('le juge de manche OPPOSÉE écrête le DR au plafond DÉCLARÉ par l’entrée', () => {
    const gros = (sl: number) => ({ roll: 11, target: 60, sl, success: true, isDouble: false, base: 60 });
    const avec = resolveTavernRound(BOULES, gros(9), gros(8));
    expect([avec.playerSL, avec.opponentSL], 'les deux camps sont ramenés à 6').toEqual([6, 6]);
    expect(avec.winner, 'et l’écart disparaît avec l’écrêtage').toBe('tie');
    const sans = resolveTavernRound(DOMINOS, gros(9), gros(8));
    expect([sans.playerSL, sans.opponentSL], 'sans plafond déclaré, les DR passent entiers').toEqual([9, 8]);
    expect(sans.winner).toBe('player');
  });

  /** Une volée n'oppose pas deux jets mais deux SCORES : à égalité, c'est le départage DÉCLARÉ qui
   *  tranche (famille 1bis) — sans quoi un jeu de lancers N+1 verrait son `tieBreak` ignoré. */
  it('à SCORE ÉGAL, la volée passe par le départage DÉCLARÉ (jamais une égalité recodée)', () => {
    registerSequenceTieBreak('test-le-defiant-gagne', () => 'a');
    const [a, b] = makePregens().slice(0, 2) as Combatant[];
    useGame.setState({ battle: null, party: [a, b], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    useGame.setState({ sequence: { ...get().sequence!, params: { ...get().sequence!.params, tieBreak: 'test-le-defiant-gagne' } } });
    for (let i = 0; i < 6; i++) poseLancer(12, 4); // six boules à 4 DR : les deux camps à égalité
    const res = get().tavernGames!.result!;
    expect([res.playerSL, res.opponentSL], 'même score des deux côtés').toEqual([4, 4]);
    expect(res.winner, 'le départage déclaré tranche l’égalité').toBe('player');
  });

  it('le départage RAW des boules reste le match nul (l.57)', () => {
    const [a, b] = makePregens().slice(0, 2) as Combatant[];
    useGame.setState({ battle: null, party: [a, b], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    get().playTavernGame({ gameId: 'boules', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    for (let i = 0; i < 6; i++) poseLancer(12, 4);
    expect(get().tavernGames!.result!.winner).toBe('tie');
  });
});

/* ── LA SONDE N+1 : un jeu de lancers INCONNU, en DONNÉE PURE ───────────────────────────────────*/

/**
 * LA PREUVE PERMANENTE de la directive utilisateur (2026-08-13, verbatim au ticket #1279) : « Comme
 * les games iOS [GameOps], rendre le vocabulaire le plus générique et parametrable possible ». Un jeu
 * de lancers N+1 dont les mécanismes existent déjà ne doit coûter AUCUNE ligne de TypeScript : ses
 * règles sont une FIXTURE de données (jamais une entrée de catalogue — le jeu n'existe pas), et le
 * socle les joue de bout en bout. Si ce test cesse de compiler ou de passer sans qu'on ait touché à la
 * donnée, c'est que la famille a repris la forme de ses premiers clients.
 */
describe('Sonde N+1 — un jeu de lancers inconnu ne coûte que sa donnée', () => {
  /** « Le lancer de fer à cheval de Bögenhafen » : 4 lancers, réserve de 10 anneaux écrêtée, Critique
   *  qui rafle la réserve, cible exacte à 30 qui coupe le passage, deux passages. Rien de tout cela
   *  n'existe au catalogue : ce sont des PARAMÈTRES. */
  const FICTIF: SequenceVolleyRules = {
    throws: 4,
    reserve: 10,
    pick: 'reserve',
    rows: [
      { min: 6, max: 10, difficulty: 'facile', label: 'six anneaux ou plus' },
      { min: 1, max: 5, difficulty: 'complexe', label: 'cinq anneaux ou moins' },
    ],
    gain: 'dr-ecrete',
    critique: 'toute-la-reserve',
    exact: 30,
    depassement: 'termine-le-passage',
    manches: 2,
  };

  it('ses quatre verbes sont DÉJÀ enregistrés : la donnée seule les nomme', () => {
    const tour = (over: Partial<SequenceThrowTurn>): SequenceThrowTurn => ({
      roll: 24, sl: 3, success: true, critique: false, maladresse: false, points: 0, rows: FICTIF.rows ?? [], ...over,
    });
    expect(resolveSequenceThrow(FICTIF, tour({ sl: 4, reserve: 10 })).gain).toBe(4);
    expect(resolveSequenceThrow(FICTIF, tour({ sl: 40, reserve: 10 })).gain, 'écrêté à la réserve').toBe(10);
    expect(resolveSequenceThrow(FICTIF, tour({ critique: true, reserve: 7 })).gain).toBe(7);
    expect(sequenceThrowGain(FICTIF, tour({ points: 28 }), 5), 'la cible exacte coupe le passage').toEqual({ gain: 0, ends: true });
    expect(sequenceThrowRow(FICTIF, 3).row?.difficulty, 'la ligne se lit sur la réserve restante').toBe('complexe');
  });

  it('sa BORNE se dérive de ses passages, sous le plafond du contrat — aucune partie légitime coupée', () => {
    const borne = sequenceVolleyRounds(FICTIF, 2);
    expect(borne, '2 passages × 2 lanceurs × 4 lancers').toBe(16);
    expect(borne <= SEQUENCE_HARD_MAX_ROUNDS, 'la borne reste sous le plafond absolu').toBe(true);
    // Une partie ENTIÈRE de ce jeu tient dans sa borne : 16 lancers, jamais un de plus.
    let joues = 0;
    let acquis = 0;
    for (let passage = 1; passage <= (FICTIF.manches ?? 1); passage++) {
      let reserve = FICTIF.reserve ?? 0;
      const gains: number[] = [];
      for (let jet = 1; jet <= FICTIF.throws && reserve > 0; jet++) {
        joues += 1;
        const turn: SequenceThrowTurn = {
          roll: 24, sl: 2, success: true, critique: false, maladresse: false,
          points: acquis, reserve, rows: FICTIF.rows ?? [], ...sequenceThrowRow(FICTIF, reserve),
        };
        const brut = resolveSequenceThrow(FICTIF, turn).gain ?? 0;
        const fin = sequenceThrowGain(FICTIF, turn, brut);
        gains.push(fin.gain ?? 0);
        reserve -= fin.gain ?? 0;
        if (fin.ends) break;
      }
      acquis += sequenceScoreOf(undefined, gains); // formule de camp par DÉFAUT : la somme
    }
    expect(joues).toBeLessThanOrEqual(borne);
    expect(acquis, 'quatre lancers à 2, deux passages').toBe(16);
  });
});
