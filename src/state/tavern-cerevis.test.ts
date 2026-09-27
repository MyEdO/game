/**
 * LE CEREVIS (#1279 S3) — la famille (9) du socle : UN SEUL DÉ, DEUX LECTURES, chacune sa conséquence.
 *
 * Verbatim `NADJ 16 l.90` : « à chaque tour de Cerevis, chaque joueur effectue un Test combiné
 * d'**Initiative** et de **Pari Accessible (+20)**. Le joueur qui a obtenu le moins de DR à son Test
 * de **Pari** perd le tour, et doit marquer une chouette. En cas d'échec du Test d'Initiative, le
 * joueur utilise accidentellement le nom correct d'une des cartes et doit prendre une grosse gorgée.
 * Pour chaque 3 Tests d'Initiative auxquels vous échouez et pour chaque 2 chouettes que vous effacez,
 * faites un Test de **Résistance à l'alcool Intermédiaire (+0)**. »
 * Verbatim `l.88` : « chaque chouette est effacé lorsque le joueur boit une demi-chope de bière ».
 * `LDB 12 l.202-208` (Tests Combinés) : « Faire un seul Test, en comparant donc un unique jet de
 * pourcentage avec la valeur de ces deux Compétences. »
 *
 * CE QUI EST ARBITRÉ MAISON (le RAW est muet, et cela se mesure ici comme tel) : le NOMBRE DE TOURS
 * (donnée éditable `combined.tours`) et le vainqueur = le MOINS de chouettes. La source ne nomme
 * aucune fin de partie ; elle nomme en revanche l'image de celui qui « roule sous la table » (l.88),
 * d'où l'arrêt anticipé sur un joueur Inconscient.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { findTavernGameById } from '../engine/tavernGame';
import { effectiveTarget } from './rollSeam';
import { testValue } from '../engine/skills';
import { addCondition, COND } from '../engine/conditions';
import { closeSequenceRound, type SequenceState } from './sequenceCore';
import { TAVERN_SEQUENCE, TAVERN_ROUND_KIND, type TavernPayload, type TavernCombinedState, HABITUE } from './tavernFlow';
import type { Combatant } from '../engine/types';
import type { CascadeStep, PendingCascade } from './pendings';
import { pnjAuProfil } from './sceneNpc';

/** L'adversaire au profil standard, nommé comme `playTavernGame` le nomme (`opponentActor.label`). */
const NOM_HABITUE = pnjAuProfil('humain', HABITUE)!.label;

const get = useGame.getState.bind(useGame);
const CEREVIS = findTavernGameById('cerevis')!;
const OPPONENT = 40;

function seul(): Combatant {
  const a = makePregens()[0] as Combatant;
  useGame.setState({ battle: null, party: [a], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  return get().party[0];
}

/** Partie en cours, avec le compte que la table lui donne. Les MARQUES sont l'accumulateur du socle
 *  (`cum`), les échecs et effacements la charge utile du jeu. */
function partie(challengerId: string, etat?: Partial<TavernCombinedState>, marks?: Record<string, number>): SequenceState<TavernPayload> {
  return {
    def: TAVERN_SEQUENCE, round: 2, cum: { ...marks },
    params: { combined: CEREVIS.combined! },
    payload: {
      gameId: 'cerevis', challengerId, opponentValue: OPPONENT, opponentName: NOM_HABITUE, stakeBrass: 0,
      combined: { fails: {}, erased: {}, tour: 1, ...etat },
    },
  };
}

/** Tour CLOS : le jet du challenger (cible POSÉE, dé POSÉ) et le jet adverse FIGÉ. Le dé du
 *  challenger est le SEUL de son camp — la seconde lecture se fait dessus. */
function tour(actorId: string, mien: { roll: number; target: number; sl: number }, sien: { roll: number; sl: number }): PendingCascade {
  const step: CascadeStep = {
    id: `${TAVERN_ROUND_KIND}-2`, kind: TAVERN_ROUND_KIND, actorId,
    label: fixtureText('Le Cerevis'), rollLabel: 'Pari', difficulty: 'accessible', base: mien.target, target: mien.target,
    result: { roll: mien.roll, target: mien.target, sl: mien.sl, success: mien.roll <= mien.target },
    meta: {
      gameId: 'cerevis', opponentValue: OPPONENT, opponentName: NOM_HABITUE, stakeBrass: 0, round: 2,
      opposed: {
        aT: { roll: sien.roll, target: OPPONENT + 20, sl: sien.sl, success: true, isDouble: false, base: OPPONENT },
        attackerName: NOM_HABITUE,
      },
    },
  };
  return { title: 'Cerevis', purpose: 'sequence', participants: [step], cursor: 1, log: [] };
}

/** Le compte tenu par la partie en cours. */
const compte = (): TavernCombinedState => (get().sequence!.payload as TavernPayload).combined!;
/** Les MARQUES par camp, là où le socle les tient. */
const marques = (): Record<string, number> => get().sequence!.cum;

beforeEach(() => {
  seedBattleRng(5);
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
});
afterEach(() => {
  useGame.setState({ tavernGames: null, pendingCascade: null, sequence: null });
});

describe('Le Cerevis — la donnée porte la règle, et dit ce qui est maison', () => {
  it('Test combiné Initiative + Pari Accessible (+20), 3 échecs, 2 chouettes effacées, marque au perdant', () => {
    expect(CEREVIS.options?.[0], '« Pari Accessible (+20) »').toEqual({ skill: { id: 'pari' }, difficulty: 'accessible' });
    expect(CEREVIS.combined?.second, '« un Test combiné d’Initiative et de… »').toEqual({ char: 'initiative' });
    expect(CEREVIS.combined?.failEvery, '« Pour chaque 3 Tests d’Initiative auxquels vous échouez »').toBe(3);
    expect(CEREVIS.combined?.eraseEvery, '« pour chaque 2 chouettes que vous effacez »').toBe(2);
    expect(CEREVIS.combined?.markLoser, '« Le joueur qui a obtenu le moins de DR […] doit marquer une chouette »').toBe(true);
    expect(CEREVIS.combined?.ops, 'le Tableau Ivre passe par l’op qui le porte (LDB 09 l.475)').toEqual([{ op: 'intoxicate' }]);
    // `NADJ 16 l.90` s'achève sur le Tableau Ivre : aucune fin de partie n'y est écrite. Le nombre
    // de tours vit donc en DONNÉE éditable, et ce test mesure qu'il y vit.
    expect(CEREVIS.combined?.tours, 'nombre de tours = donnée maison, jamais du RAW').toBe(6);
  });

  it('la partie s’ouvre sur le Test que la donnée déclare — Pari, à sa Difficulté propre', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'cerevis', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const step = get().pendingCascade!.participants[0];
    expect(step.kind).toBe(TAVERN_ROUND_KIND);
    expect(step.difficulty, '« Pari Accessible (+20) », pas le repli Intermédiaire du jeu rapide').toBe('accessible');
    expect(step.rollLabel ?? '').toContain('Pari');
  });

  /**
   * CE QUE LA FENÊTRE ANNONCE (#1279 Sf) : SES DEUX cibles. Le joueur ne doit pas découvrir le second
   * Test en le ratant — la seconde lecture est déclarée SUR l'étape, avant tout dé, et tranchée
   * ensuite sur le MÊME jet (`LDB 12 l.206` : « un unique jet de pourcentage »).
   */
  it('la fenêtre porte la SECONDE LECTURE (Initiative) dès l’ouverture, sur la MÊME cible que la clôture', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'cerevis', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const step = get().pendingCascade!.participants[0];
    const attendue = effectiveTarget(get().party[0], { char: 'initiative' }, 'accessible');
    expect(step.second, 'aucun second Test caché : la rangée le DIT').toEqual({
      label: 'Initiative',
      base: testValue(get().party[0], undefined, 'initiative'),
      target: attendue,
      difficulty: 'accessible',
    });
    // Avant le dé, la seconde lecture n'annonce que sa cible : aucune issue n'est posée sur l'étape.
    expect(step.result).toBeNull();
  });

  it('héros CONTRE héros : CHAQUE rangée de la bande porte SA seconde lecture', () => {
    const [a, b] = makePregens() as Combatant[];
    useGame.setState({ battle: null, party: [a, b], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    get().playTavernGame({ gameId: 'cerevis', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const bande = get().pendingCascade!.participants[0];
    expect(bande.participants).toHaveLength(2);
    for (const r of bande.participants!) {
      const porteur = get().party.find((h) => h.id === r.id)!;
      expect(r.second, `la rangée de ${porteur.label} dit sa seconde cible`).toEqual({
        label: 'Initiative',
        base: testValue(porteur, undefined, 'initiative'),
        target: effectiveTarget(porteur, { char: 'initiative' }, 'accessible'),
        difficulty: 'accessible',
      });
    }
  });
});

describe('Le Cerevis — les deux lectures du MÊME dé', () => {
  it('LA PREMIÈRE : le plus BAS DR au Pari prend la chouette — à égalité, personne', () => {
    const a = seul();
    useGame.setState({ sequence: partie(a.id) });
    closeSequenceRound(get, useGame.setState, tour(a.id, { roll: 20, target: 90, sl: 1 }, { roll: 20, sl: 4 }));
    expect(marques().player, 'le challenger a le moins de DR : la chouette est pour lui').toBe(1);
    expect(marques().opponent ?? 0).toBe(0);

    useGame.setState({ tavernGames: null, sequence: partie(a.id) });
    closeSequenceRound(get, useGame.setState, tour(a.id, { roll: 20, target: 90, sl: 3 }, { roll: 20, sl: 3 }));
    expect(marques().player ?? 0, 'DR égaux : la source ne désigne personne').toBe(0);
    expect(marques().opponent ?? 0).toBe(0);
  });

  /**
   * LA SECONDE lecture est faite sur LE MÊME dé (LDB 12 l.202-208) : le cas qui la PROUVE est le dé
   * qui tombe ENTRE les deux cibles — réussite au Pari, échec à l'Initiative. Un dé sous les deux
   * cibles ne discriminerait rien (les deux lectures réussissent).
   */
  it('LA SECONDE : le même dé, sous le Pari mais au-dessus de l’Initiative, coûte la gorgée', () => {
    const a = seul();
    const cibleInit = effectiveTarget(a, { char: 'initiative' }, 'accessible');
    useGame.setState({ sequence: partie(a.id) });
    // Dé ENTRE les deux cibles : le Pari passe (cible 95), l'Initiative lâche.
    closeSequenceRound(get, useGame.setState, tour(a.id, { roll: cibleInit + 1, target: 95, sl: 5 }, { roll: 10, sl: 1 }));
    expect(compte().fails.player, 'l’échec de la seconde lecture est compté').toBe(1);
    expect(get().journal.some((l) => l.includes(a.label) && l.includes('grosse gorgée'))).toBe(true);

    useGame.setState({ tavernGames: null, journal: [], sequence: partie(a.id) });
    // Dé sous les DEUX cibles : rien à boire.
    closeSequenceRound(get, useGame.setState, tour(a.id, { roll: Math.max(1, cibleInit - 5), target: 95, sl: 5 }, { roll: 10, sl: 1 }));
    expect(compte().fails.player ?? 0, 'les deux lectures réussissent').toBe(0);
    expect(get().journal.some((l) => l.includes('grosse gorgée'))).toBe(false);
  });

  it('L’ÉCHÉANCE : le TROISIÈME échec d’Initiative appelle l’alcool, pas les deux premiers', () => {
    const a = seul();
    const cibleInit = effectiveTarget(a, { char: 'initiative' }, 'accessible');
    const rate = (fails: number): void => {
      useGame.setState({ tavernGames: null, journal: [], sequence: partie(a.id, { fails: { player: fails } }) });
      closeSequenceRound(get, useGame.setState, tour(a.id, { roll: cibleInit + 1, target: 95, sl: 5 }, { roll: 10, sl: 1 }));
    };
    rate(0);
    expect(get().journal.some((l) => l.includes('tenir l’alcool')), '1er échec : rien').toBe(false);
    rate(1);
    expect(get().journal.some((l) => l.includes('tenir l’alcool')), '2e échec : rien').toBe(false);
    rate(2);
    expect(get().journal.some((l) => l.includes('tenir l’alcool')), '3e échec : le Test de Résistance').toBe(true);
  });
});

describe('Le Cerevis — les chouettes s’effacent au geste du joueur (l.88)', () => {
  it('avec des chouettes au tableau, la fenêtre OFFRE l’effacement — et l’effacer en retire une', () => {
    const a = seul();
    get().playTavernGame({ gameId: 'cerevis', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    // Un tour PERDU met une chouette au tableau ; le tour SUIVANT s'ouvre alors sur la question de
    // l'effacement — c'est le cycle du socle qui l'ouvre, aucune fenêtre n'est forgée ici.
    const seq = get().sequence as SequenceState<TavernPayload>;
    useGame.setState({
      pendingCascade: null, // la fenêtre du 1ᵉʳ tour est remplacée par le tour POSÉ ci-dessous
      sequence: { ...seq, cum: { player: 1 }, payload: { ...seq.payload, combined: { fails: {}, erased: {}, tour: 1 } } },
    });
    closeSequenceRound(get, useGame.setState, tour(a.id, { roll: 20, target: 90, sl: 1 }, { roll: 20, sl: 4 }));
    const etape = get().pendingCascade!.participants[0];
    expect(etape.kind, 'le joueur décide s’il boit pour effacer').toBe('tavern-erase');
    expect(etape.options!.map((o) => o.key)).toEqual(['efface', 'garde']);
    get().cascadeChoose(etape.id, 'efface');
    get().cascadeNext();
    expect(marques().player, 'une chouette de moins').toBe(1);
    expect(compte().erased.player).toBe(1);
  });

  it('DEUX chouettes effacées appellent l’alcool (l.97) — une seule, non', () => {
    const a = seul();
    const poser = (erased: number): void => {
      useGame.setState({
        tavernGames: null, journal: [], pendingCascade: null,
        sequence: partie(a.id, { erased: { player: erased } }, { player: 3 }),
      });
      const pc: PendingCascade = {
        title: 'Cerevis', purpose: 'sequence', cursor: 1, log: [],
        participants: [{
          id: 'tavern-erase-2', kind: 'tavern-erase', actorId: a.id, label: fixtureText('Effacer ?'),
          options: [{ key: 'efface', label: fixtureText('e') }, { key: 'garde', label: fixtureText('g') }], chosen: 'efface',
        }],
      };
      closeSequenceRound(get, useGame.setState, pc);
    };
    poser(0);
    expect(compte().erased.player, 'une chouette effacée').toBe(1);
    expect(get().journal.some((l) => l.includes('Ivresse') || l.includes('gorgée') || l.includes('alcool')), 'pas encore l’échéance').toBe(false);
    poser(1);
    expect(compte().erased.player).toBe(2);
    expect(get().journal.length, 'la 2ᵉ effacée déclenche ce que la donnée déclare').toBeGreaterThan(1);
  });
});

describe('Le Cerevis — la fin de partie (arbitrage maison assumé)', () => {
  it('au dernier tour DÉCLARÉ, le MOINS de chouettes l’emporte', () => {
    const a = seul();
    useGame.setState({
      sequence: partie(a.id, { tour: CEREVIS.combined!.tours! }, { player: 1, opponent: 3 }),
    });
    closeSequenceRound(get, useGame.setState, tour(a.id, { roll: 20, target: 90, sl: 5 }, { roll: 20, sl: 5 }));
    const res = get().tavernGames!.result!;
    expect(res.winner, '1 chouette contre 3 : le plus sobre gagne').toBe('player');
    expect([res.playerSL, res.opponentSL], 'ce qui se compte, ce sont les chouettes').toEqual([1, 3]);
    expect(get().sequence).toBeNull();
  });

  it('un joueur SOUS LA TABLE arrête la partie avant terme (l.88)', () => {
    const a = seul();
    addCondition(a, COND.inconscient);
    useGame.setState({ party: [a], sequence: partie(a.id, { tour: 1 }, { player: 0, opponent: 1 }) });
    closeSequenceRound(get, useGame.setState, tour(a.id, { roll: 20, target: 90, sl: 5 }, { roll: 20, sl: 5 }));
    expect(get().journal.some((l) => l.includes('sous la table'))).toBe(true);
    expect(get().tavernGames!.result!.winner, 'et le compte des chouettes tranche quand même').toBe('player');
  });
});
