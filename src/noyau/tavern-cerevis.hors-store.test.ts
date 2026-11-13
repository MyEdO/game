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
import { nomDe } from '../engine/nom';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { evaluateTest } from '../engine/tests';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { seedBattleRng } from './battleRng';
import { findTavernGameById, TAVERN_GAMES } from '../engine/tavernGame';
import { setDataset } from '../data/overrides';
import { effectiveTarget } from './rollSeam';
import { testValue } from '../engine/skills';
import { addCondition, COND } from '../engine/conditions';
import { closeSequenceRound } from './sequenceCore';
import { type EtatDeFamille, type MancheClose } from './sequenceContract';
import { TAVERN_SEQUENCE, TAVERN_ROUND_KIND, type TavernPayload, type TavernCombinedState, HABITUE } from './tavernFlow';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';
import { pnjAuProfil } from './monde/sceneNpc';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** L'adversaire au profil standard, nommé comme `jouerALaTaverne` le nomme (`opponentActor.label`). */
const NOM_HABITUE = nomDe(pnjAuProfil('humain', HABITUE)!);

const get = () => banc.getState();
const CEREVIS = findTavernGameById('cerevis')!;
const OPPONENT = 40;

function seul(): Combatant {
  const a = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
  banc.setState({ battle: null, party: [a], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
  return get().party[0];
}

/** Partie en cours, avec le compte que la table lui donne. Les MARQUES sont l'accumulateur du socle
 *  (`cumuls`), les échecs et effacements la charge utile du jeu. */
function partie(challengerId: string, etat?: Partial<TavernCombinedState>, marks?: Record<string, number>): EtatDeFamille<typeof TAVERN_SEQUENCE> {
  return {
    definition: TAVERN_SEQUENCE, manche: 2, cumuls: { ...marks },
    parametres: { combined: structuredClone(CEREVIS.combined!) },
    chargeUtile: {
      gameId: 'cerevis', challengerId, opponentValue: OPPONENT, opponentName: NOM_HABITUE, stakeBrass: 0,
      combined: { echecs: { joueur: 0, adversaire: 0 }, effacements: { joueur: 0, adversaire: 0 }, tour: 1, ...etat },
    },
  };
}

/** Tour CLOS : le jet du challenger (cible POSÉE, dé POSÉ) et le jet adverse FIGÉ. Le dé du
 *  challenger est le SEUL de son camp — la seconde lecture se fait dessus. */
function tour(actorId: string, mien: { roll: number; target: number; sl: number }, sien: { roll: number; sl: number }): MancheClose {
  const step: CascadeStep = {
    id: `${TAVERN_ROUND_KIND}-2`, kind: TAVERN_ROUND_KIND, actorId,
    label: fixtureText('Le Cerevis'), rollLabel: 'Pari', difficulty: 'accessible', base: mien.target, target: mien.target,
    result: { roll: mien.roll, target: mien.target, sl: mien.sl, success: evaluateTest(mien.roll, mien.target).success },
    meta: {
      gameId: 'cerevis', opponentValue: OPPONENT, opponentName: NOM_HABITUE, stakeBrass: 0, round: 2,
      opposed: {
        aT: { roll: sien.roll, target: OPPONENT + 20, sl: sien.sl, success: true, isDouble: false, base: OPPONENT },
        attackerName: NOM_HABITUE,
      },
    },
  };
  return { participants: [step] };
}

/** Le compte tenu par la partie en cours. */
const compte = (): TavernCombinedState => (get().sequence!.chargeUtile as TavernPayload).combined!;
/** Les MARQUES par camp, là où le socle les tient. */
const marques = (): Record<string, number> => get().sequence!.cumuls;

beforeEach(() => {
  seedBattleRng(5);
  banc.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
});

describe('Le Cerevis — la donnée porte la règle, et dit ce qui est maison', () => {
  it('Test combiné Initiative + Pari Accessible (+20), 3 échecs, 2 chouettes effacées, marque au perdant', () => {
    expect(CEREVIS.difficulty, '« Pari Accessible (+20) »').toBe('accessible');
    expect(CEREVIS.skill).toEqual({ id: 'pari' });
    expect(CEREVIS.combined?.second, '« un Test combiné d’Initiative et de… »').toEqual({ characteristic: 'initiative' });
    expect(CEREVIS.combined?.echecsParEcheance, '« Pour chaque 3 Tests d’Initiative auxquels vous échouez »').toBe(3);
    expect(CEREVIS.combined?.effacementsParEcheance, '« pour chaque 2 chouettes que vous effacez »').toBe(2);
    expect(CEREVIS.combined?.markLoser, '« Le joueur qui a obtenu le moins de DR […] doit marquer une chouette »').toBe(true);
    expect(CEREVIS.combined?.ops, 'le Tableau Ivre passe par l’op qui le porte (LDB 09 l.475)').toEqual([{ op: 'intoxicate' }]);
    // `NADJ 16 l.90` s'achève sur le Tableau Ivre : aucune fin de partie n'y est écrite. Le nombre
    // de tours vit donc en DONNÉE éditable, et ce test mesure qu'il y vit.
    expect(CEREVIS.combined?.tours, 'nombre de tours = donnée maison, jamais du RAW').toBe(6);
  });

  it('la partie s’ouvre sur le Test que la donnée déclare — Pari, à sa Difficulté propre', () => {
    const a = seul();
    get().jouerALaTaverne(a.id, { gameId: 'cerevis', opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
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
    get().jouerALaTaverne(a.id, { gameId: 'cerevis', opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const step = get().pendingCascade!.participants[0];
    const attendue = effectiveTarget(get().party[0], { characteristic: 'initiative' }, 'accessible');
    expect(step.second, 'aucun second Test caché : la rangée le DIT').toEqual({
      label: 'Initiative',
      base: testValue(get().party[0], { characteristic: 'initiative' }),
      target: attendue,
      difficulty: 'accessible',
    });
    // Avant le dé, la seconde lecture n'annonce que sa cible : aucune issue n'est posée sur l'étape.
    expect(step.result).toBeNull();
  });

  it('héros CONTRE héros : CHAQUE rangée de la bande porte SA seconde lecture', () => {
    const [a, b] = tousLesHerosDeScenario(idsDeTest) as Combatant[];
    banc.setState({ battle: null, party: [a, b], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
    get().jouerALaTaverne(a.id, { gameId: 'cerevis', opponent: { kind: 'heros', id: b.id } });
    const bande = get().pendingCascade!.participants[0];
    expect(bande.participants).toHaveLength(2);
    for (const r of bande.participants!) {
      const porteur = get().party.find((h) => h.id === r.id)!;
      expect(r.second, `la rangée de ${porteur.label} dit sa seconde cible`).toEqual({
        label: 'Initiative',
        base: testValue(porteur, { characteristic: 'initiative' }),
        target: effectiveTarget(porteur, { characteristic: 'initiative' }, 'accessible'),
        difficulty: 'accessible',
      });
    }
  });
});

describe('Le Cerevis — les deux lectures du MÊME dé', () => {
  it('LA PREMIÈRE : le plus BAS DR au Pari prend la chouette — à égalité, personne', () => {
    const a = seul();
    banc.setState({ sequence: partie(a.id) });
    closeSequenceRound(get, banc.setState, tour(a.id, { roll: 20, target: 90, sl: 1 }, { roll: 20, sl: 4 }));
    expect(marques().joueur, 'le challenger a le moins de DR : la chouette est pour lui').toBe(1);
    expect(marques().adversaire ?? 0).toBe(0);

    banc.setState({ tavernGames: null, sequence: partie(a.id) });
    closeSequenceRound(get, banc.setState, tour(a.id, { roll: 20, target: 90, sl: 3 }, { roll: 20, sl: 3 }));
    expect(marques().joueur ?? 0, 'DR égaux : la source ne désigne personne').toBe(0);
    expect(marques().adversaire ?? 0).toBe(0);
  });

  /**
   * LA SECONDE lecture est faite sur LE MÊME dé (LDB 12 l.202-208) : le cas qui la PROUVE est le dé
   * qui tombe ENTRE les deux cibles — réussite au Pari, échec à l'Initiative. Un dé sous les deux
   * cibles ne discriminerait rien (les deux lectures réussissent).
   */
  it('LA SECONDE : le même dé, sous le Pari mais au-dessus de l’Initiative, coûte la gorgée', () => {
    const a = seul();
    const cibleInit = effectiveTarget(a, { characteristic: 'initiative' }, 'accessible');
    banc.setState({ sequence: partie(a.id) });
    // Dé ENTRE les deux cibles : le Pari passe (cible 95), l'Initiative lâche.
    closeSequenceRound(get, banc.setState, tour(a.id, { roll: cibleInit + 1, target: 95, sl: 5 }, { roll: 10, sl: 1 }));
    expect(compte().echecs.joueur, 'l’échec de la seconde lecture est compté').toBe(1);
    expect(get().journal.some((l) => l.includes(a.label) && l.includes('grosse gorgée'))).toBe(true);

    banc.setState({ tavernGames: null, journal: [], sequence: partie(a.id) });
    // Dé sous les DEUX cibles : rien à boire.
    closeSequenceRound(get, banc.setState, tour(a.id, { roll: Math.max(1, cibleInit - 5), target: 95, sl: 5 }, { roll: 10, sl: 1 }));
    expect(compte().echecs.joueur, 'les deux lectures réussissent').toBe(0);
    expect(get().journal.some((l) => l.includes('grosse gorgée'))).toBe(false);
  });

  it('L’ÉCHÉANCE : le TROISIÈME échec d’Initiative appelle l’alcool, pas les deux premiers', () => {
    const a = seul();
    const cibleInit = effectiveTarget(a, { characteristic: 'initiative' }, 'accessible');
    const rate = (echecs: number): void => {
      banc.setState({ tavernGames: null, journal: [], sequence: partie(a.id, { echecs: { joueur: echecs, adversaire: 0 } }) });
      closeSequenceRound(get, banc.setState, tour(a.id, { roll: cibleInit + 1, target: 95, sl: 5 }, { roll: 10, sl: 1 }));
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
    get().jouerALaTaverne(a.id, { gameId: 'cerevis', opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    // Un tour PERDU met une chouette au tableau ; le tour SUIVANT s'ouvre alors sur la question de
    // l'effacement — c'est le cycle du socle qui l'ouvre, aucune fenêtre n'est forgée ici.
    const seq = get().sequence as EtatDeFamille<typeof TAVERN_SEQUENCE>;
    banc.setState({
      pendingCascade: null, // la fenêtre du 1ᵉʳ tour est remplacée par le tour POSÉ ci-dessous
      sequence: { ...seq, cumuls: { joueur: 1 }, chargeUtile: { ...seq.chargeUtile, combined: { echecs: { joueur: 0, adversaire: 0 }, effacements: { joueur: 0, adversaire: 0 }, tour: 1 } } },
    });
    closeSequenceRound(get, banc.setState, tour(a.id, { roll: 20, target: 90, sl: 1 }, { roll: 20, sl: 4 }));
    const etape = get().pendingCascade!.participants[0];
    expect(etape.kind, 'le joueur décide s’il boit pour effacer').toBe('taverneEffacement');
    expect(etape.options!.map((o) => o.key)).toEqual(['efface', 'garde']);
    get().jetRegler('cascade', 'choix', 'efface', etape.id);
    get().jetValider('cascade');
    expect(marques().joueur, 'une chouette de moins').toBe(1);
    expect(compte().effacements.joueur).toBe(1);
  });

  it('DEUX chouettes effacées appellent l’alcool (l.90) — une seule, non', () => {
    const a = seul();
    const poser = (effacements: number): void => {
      banc.setState({
        tavernGames: null, journal: [], pendingCascade: null,
        sequence: partie(a.id, { effacements: { joueur: effacements, adversaire: 0 } }, { joueur: 3 }),
      });
      const pc: MancheClose = {
        participants: [{
          id: 'taverneEffacement-2', kind: 'taverneEffacement', actorId: a.id, label: fixtureText('Effacer ?'),
          options: [{ key: 'efface', label: fixtureText('e') }, { key: 'garde', label: fixtureText('g') }], chosen: 'efface',
        }],
      };
      closeSequenceRound(get, banc.setState, pc);
    };
    poser(0);
    expect(compte().effacements.joueur, 'une chouette effacée').toBe(1);
    expect(get().journal.some((l) => l.includes('Ivresse') || l.includes('gorgée') || l.includes('alcool')), 'pas encore l’échéance').toBe(false);
    poser(1);
    expect(compte().effacements.joueur).toBe(2);
    expect(get().journal.length, 'la 2ᵉ effacée déclenche ce que la donnée déclare').toBeGreaterThan(1);
  });
});

describe('Le Cerevis — la fin de partie (arbitrage maison assumé)', () => {
  it('au dernier tour DÉCLARÉ, le MOINS de chouettes l’emporte', () => {
    const a = seul();
    banc.setState({
      sequence: partie(a.id, { tour: CEREVIS.combined!.tours! }, { joueur: 1, adversaire: 3 }),
    });
    closeSequenceRound(get, banc.setState, tour(a.id, { roll: 20, target: 90, sl: 5 }, { roll: 20, sl: 5 }));
    const res = get().tavernGames!.result!;
    expect(res.winner, '1 chouette contre 3 : le plus sobre gagne').toBe('joueur');
    expect([res.dr.joueur, res.dr.adversaire], 'ce qui se compte, ce sont les chouettes').toEqual([1, 3]);
    expect(get().sequence).toBeNull();
  });

  it('la ligne finale dit l’unité de score DÉCLARÉE par le jeu (`scoreUnit`), jamais un mot en dur', () => {
    const catalogue = [...TAVERN_GAMES];
    setDataset('tavernGames', catalogue.map((g) => (g.id === 'cerevis' ? { ...g, scoreUnit: 'marques', scoreUnitSingular: 'marque' } : g)));
    try {
      const a = seul();
      banc.setState({ sequence: partie(a.id, { tour: CEREVIS.combined!.tours! }, { joueur: 1, adversaire: 3 }) });
      closeSequenceRound(get, banc.setState, tour(a.id, { roll: 20, target: 90, sl: 5 }, { roll: 20, sl: 5 }));
      expect(get().tavernGames!.result!.detail).toContain('1 marque contre 3 en');
    } finally { setDataset('tavernGames', catalogue); }
  });

  it('un joueur SOUS LA TABLE arrête la partie avant terme (l.88)', () => {
    const a = seul();
    addCondition(a, COND.inconscient);
    banc.setState({ party: [a], sequence: partie(a.id, { tour: 1 }, { joueur: 0, adversaire: 1 }) });
    closeSequenceRound(get, banc.setState, tour(a.id, { roll: 20, target: 90, sl: 5 }, { roll: 20, sl: 5 }));
    expect(get().journal.some((l) => l.includes('sous la table'))).toBe(true);
    expect(get().tavernGames!.result!.winner, 'et le compte des chouettes tranche quand même').toBe('joueur');
  });
});
