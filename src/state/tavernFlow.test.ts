/**
 * Jeux de taverne (NADJ 16) — câblage store : une partie est une SÉQUENCE (socle `sequenceCore`,
 * #1279) dont chaque manche s'ouvre en fenêtre ; elle se joue de bout en bout via `drain()` (patron
 * `port-sell-cargo.test.ts`). DEUX MONTAGES : héros contre HÉROS → BANDE (une rangée par camp, chaque
 * siège joue son jet) ; héros contre la SALLE → mono à jet adverse FIGÉ dans `meta.opposed.aT` (#579),
 * dont la ré-opposition sous influence (Chance « +1 DR ») est vérifiée contre `resolveOpposed`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { toBrass } from '../engine/money';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { seedBattleRng } from './battleRng';
import { resolveOpposed } from '../engine/tests';
import { activeSequence } from './sequenceCore';
import { tavernPartieEnCours } from './tavernFlow';
import { TAVERN_GAMES } from '../engine/tavernGame';
import { addCondition, COND, hasCondition } from '../engine/conditions';
import { findTavernGameById } from '../engine/tavernGame';
import { bonus } from '../engine/characteristics';
import { skillBaseValue } from '../engine/skills';
import { tavernGameValue } from './tavernFlow';
import type { Combatant } from '../engine/types';

const get = useGame.getState.bind(useGame);

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
async function drain(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const p = get().pendingCascade;
    if (p) {
      const cur = p.participants[p.cursor];
      // Une manche héros-vs-héros est une BANDE : chaque rangée À JOUER se lance par son propre verbe.
      if (cur?.participants) {
        for (const row of cur.participants) if (row.interactive !== false && !row.result) get().cascadeBatchRoll(row.id);
      } else if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
      get().cascadeNext();
    }
    await tick();
  }
}

function twoHeroes(): [Combatant, Combatant] {
  const all = makePregens();
  return [all[0] as Combatant, all[1] as Combatant];
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null });
  seedBattleRng(3);
});

describe('playTavernGame', () => {
  it('HÉROS contre HÉROS : la manche s’ouvre en BANDE (une rangée par camp), jamais mono + jet figé', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().openTavernGames();
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 20 });
    expect(get().tavernGames?.result).toBeNull();
    expect(get().pendingCascade).not.toBeNull();
    const step = get().pendingCascade!.participants[0];
    expect(step.kind).toBe('tavern-round');
    expect(step.participants!.map((r) => r.id)).toEqual([a.id, b.id]);
    expect(step.participants!.every((r) => r.result === null), 'aucun camp n’est roulé d’avance').toBe(true);
    expect(step.meta?.opposed, 'plus AUCUN jet adverse figé : le second héros joue le sien').toBeUndefined();
    expect(step.groupOwner, 'deux porteurs : la fenêtre est partagée').toBe(true);
    expect(get().pendingCascade!.purpose).toBe('sequence');
    // L'état de séquence PORTE la partie (persisté avec la sauvegarde), la mise comprise.
    expect(get().sequence?.def).toBe('tavern');
  });

  it('partie entre compagnons : issue stockée après la cascade, gagnant cohérent, bourse inchangée', async () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    creditBourse(get, useGame.setState, a.id, { gold: 5, silver: 0, brass: 0 });
    const purseBefore = toBrass(partyMoneyTotal(get));
    get().openTavernGames();
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 20 });
    await drain();
    const res = get().tavernGames?.result;
    expect(res).toBeTruthy();
    expect(res!.gameLabel).toBe('Les dominos');
    expect(['player', 'opponent', 'tie']).toContain(res!.winner);
    // Mise ignorée entre compagnons (aucune bourse ne bouge).
    expect(res!.stakeBrass).toBe(0);
    expect(res!.netBrass).toBe(0);
    expect(toBrass(partyMoneyTotal(get))).toBe(purseBefore);
  });

  it('bras de fer (Test étendu) : plusieurs manches, premier à 10 DR cumulés', async () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    await drain();
    const res = get().tavernGames!.result!;
    expect(res.rounds).toBeGreaterThanOrEqual(1);
    expect(Math.max(res.playerSL, res.opponentSL)).toBeGreaterThanOrEqual(10); // cible atteinte
  });

  it('Test opposé RÉEL (#579) : contre la SALLE, le jet adverse est roulé et FIGÉ AVANT que le joueur ne lance', () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const step = get().pendingCascade!.participants[0];
    expect(step.result).toBeNull(); // le joueur n'a pas encore lancé SON jet
    expect(step.meta?.opposed?.aT).toBeTruthy(); // la salle, elle, a DÉJÀ un jet FIGÉ
    expect(step.meta?.opposed?.attackerName, 'le libellé de SA fiche').toBe('Elfe (haut et sylvain)');
    expect(step.actorId, 'un seul porteur JOUABLE : l’étape est la sienne').toBe(a.id);
  });

  it('habitué au profil standard : jet figé sans attackerId (aucun banc), sous le nom de sa fiche', () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'cerevis', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    const step = get().pendingCascade!.participants[0];
    expect(step.meta?.opposed?.aT).toBeTruthy();
    expect(step.meta?.opposed?.attackerId).toBeUndefined();
    expect(step.meta?.opposed?.attackerName).toBe('Humain');
  });

  it('ORACLE RAW : l’habitué joue la valeur de SON profil standard — Pari non acquis = Int (LDB 77 l.23 Nain 30, l.45 Elfe 40)', () => {
    const [a] = twoHeroes();
    const valeurAuProfil = (profil: string) => {
      useGame.setState({ party: [a], sequence: null, pendingCascade: null });
      get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: profil } });
      return activeSequence<{ opponentValue: number }>(get)!.payload.opponentValue;
    };
    expect(valeurAuProfil('nain')).toBe(30);
    expect(valeurAuProfil('elfe-haut-et-sylvain')).toBe(40);
  });

  it('jeu d’ÉQUIPE : les coéquipiers jouent LEUR profil ; sans lui, la partie est REFUSÉE en le nommant (#1882)', () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'torchon', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    expect(get().sequence, 'aucune partie sans profil de coéquipier').toBeNull();
    expect(get().journal.slice(-1)[0]).toContain('choisissez le profil de vos coéquipiers');
    get().playTavernGame({ gameId: 'torchon', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' }, allyProfil: 'elfe-haut-et-sylvain' });
    const p = activeSequence<{ opponentValue: number; allyValue: number }>(get)!.payload;
    expect([p.opponentValue, p.allyValue], 'Projectiles non acquis = CT : Humain 30 en face, Elfe 40 à vos côtés (LDB 77 l.13, l.45)').toEqual([30, 40]);
  });

  it('Chance « +1 DR » RÉ-OPPOSE le jet du joueur contre l’adversaire FIGÉ — jamais un second tirage', () => {
    const [a] = twoHeroes();
    a.fortune = 3;
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const stepId = get().pendingCascade!.participants[0].id;
    get().cascadeRoll(stepId);
    const before = get().pendingCascade!.participants[0];
    const aT = before.meta!.opposed!.aT;
    get().cascadeBonusSL(stepId);
    const after = get().pendingCascade!.participants[0].result!;
    // Le DR propre du défenseur monte de +1 (Chance, LDB 17 l.24) — jamais un nouveau jet de l'adversaire.
    expect(after.sl).toBe(before.result!.sl + 1);
    expect(after.roll).toBe(before.result!.roll); // même dé, la Chance n'en tire pas un autre
    // L'issue exposée (`success`) recalcule l'opposition contre le MÊME `aT` figé (calque `disengage`).
    const recomposed = resolveOpposed(aT, { roll: after.roll, target: after.target, sl: after.sl, success: after.roll <= after.target, isDouble: false });
    expect(after.success).toBe(recomposed.winner !== 'attacker');
  });

  /**
   * #1153 L2 — DÉPARTAGE HOMOGÈNE. `LDB 12 l.160` (verbatim `12 - Tests.md`) : « Si les deux
   * participants obtiennent le même DR, c'est le groupe avec la Compétence ou la Caractéristique la
   * plus élevée qui l'emporte. » Les DEUX camps doivent donc opposer une COMPÉTENCE : depuis #1279 S1
   * les deux rangées de la BANDE la portent, chacune posée par le monteur canonique (`step.base` =
   * `skillBaseValue`). L'État (−10 d'Empoisonné, LDB 16) est un modificateur : il vit dans la CIBLE.
   */
  it('DR égal : les DEUX rangées opposent leur Compétence NUE — l’État ne vole pas la manche (LDB 12 l.160)', () => {
    const [a, b] = twoHeroes();
    addCondition(a, COND.empoisonne);
    addCondition(b, COND.empoisonne);
    useGame.setState({ party: [a, b] });
    const game = findTavernGameById('dominos')!;
    // Le défiant est le PLUS FAIBLE des deux — mais sa Compétence NUE dépasse la valeur de Test
    // EMPOISONNÉE de son vis-à-vis. C'est le piège du mixte, et il ne tient que si les deux nues
    // diffèrent : l'assertion le VERROUILLE au lieu de le supposer.
    const nue = (h: Combatant): number => skillBaseValue(h, game.skill!.id, game.skill!.spec);
    const [faible, fort] = nue(a) <= nue(b) ? [a, b] : [b, a];
    expect(nue(faible), 'les deux nues diffèrent, sinon rien ne trancherait').toBeLessThan(nue(fort));
    expect(tavernGameValue(faible, game), 'l’État n’entre pas dans la NUE').toBe(nue(faible) - 10);
    expect(tavernGameValue(fort, game)).toBe(nue(fort) - 10);
    get().playTavernGame({ gameId: 'dominos', challengerId: faible.id, opponent: { kind: 'hero', id: fort.id } });
    const pc = get().pendingCascade!;
    const band = pc.participants[0];
    const rb = band.participants!.find((r) => r.id === faible.id)!;
    const ra = band.participants!.find((r) => r.id === fort.id)!;
    expect(rb.base).toBe(nue(faible)); // Compétence NUE de chaque camp, posée par le monteur…
    expect(ra.base).toBe(nue(fort));
    expect(rb.target).toBe(nue(faible) - 10); // …et l'État dans la CIBLE, des deux côtés (invariante)
    expect(ra.target).toBe(nue(fort) - 10);
    // DR ÉGAL POSÉ sur les deux rangées : seule la Compétence NUE peut trancher.
    const pose = (r: typeof rb) => ({ ...r, result: { roll: 11, target: r.target, sl: 2, success: true } });
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: [pose(rb), pose(ra)] }] } });
    get().cascadeNext();
    expect(get().tavernGames!.result!.winner, 'la nue la plus haute l’emporte').toBe('opponent');
  });

  it('zéro divergence de maths avec `resolveTavernRound` : le verdict final recompose EXACTEMENT depuis le meta figé', async () => {
    const [a] = twoHeroes();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const step = get().pendingCascade!.participants[0];
    const aT = step.meta!.opposed!.aT;
    await drain();
    const res = get().tavernGames!.result!;
    // Recompose le verdict SEUL depuis le jet adverse figé + le DR final connu du joueur (`res.playerSL`) —
    // même comparaison que `resolveOpposed` côté moteur (`engine/tavernGame.resolveTavernRound`).
    const opp = resolveOpposed({ roll: 0, target: 0, sl: res.playerSL, success: res.playerSL > 0, isDouble: false }, aT);
    const expectedWinner = opp.winner === 'attacker' ? 'player' : opp.winner === 'defender' ? 'opponent' : 'tie';
    expect(res.winner).toBe(expectedWinner);
    expect(res.opponentSL).toBe(aT.sl); // aucun plafond déclaré : le DR adverse passe entier
  });
});

/**
 * LE BRAS DE FER, mécanique par mécanique (NADJ 16 l.34, verbatim) : « faites un Test opposé
 * étendu de Force Intermédiaire (+0) ; à chaque tour, ajoutez votre Bonus de Force au nombre de DR que
 * vous avez obtenus. Le gagnant de chaque tour gagne +1 Avantage […]. Le premier Personnage qui
 * atteint au moins 10 DR est le vainqueur. Pour chaque Bonus d'Endurance tours qui passent sans que
 * personne n'ait gagné, vous gagnez + 1 État *Exténué* […]. »
 *
 * Les manches sont POSÉES (aucun dé) : ce qui est mesuré est l'arithmétique de la partie, pas le RNG.
 */
describe('Bras de fer (NADJ 16 l.34)', () => {
  /** Pose le DR de chaque rangée de la manche ouverte, puis la clôt. */
  function poseManche(sl: Record<string, number>): void {
    const pc = get().pendingCascade!;
    const band = pc.participants[0];
    const rows = band.participants!.map((r) => ({
      ...r,
      result: { roll: sl[r.id] >= 0 ? 11 : 99, target: r.target!, sl: sl[r.id], success: sl[r.id] >= 0 },
    }));
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: rows }] } });
    get().cascadeNext();
  }

  const cum = () => (get().sequence?.cum ?? {}) as Record<string, number>;

  it('le DR d’une manche PERDUE se RETIRE du cumul (LDB 12 l.174) — le plancher PAR MANCHE est mort', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const bfA = bonus(a.characteristics.force);
    const bfB = bonus(b.characteristics.force);

    poseManche({ [a.id]: 3, [b.id]: 1 });
    const apres1 = cum().player;
    expect(apres1, 'DR de la manche + Bonus de Force (l.34)').toBe(3 + bfA);
    expect(cum().opponent).toBe(1 + bfB);

    // Manche PERDUE, DR NÉGATIF : « les DR obtenus à chaque Round sont additionnés » (LDB 12 l.174) —
    // le total BAISSE. Sous l'ancien plancher par manche (`Math.max(0, DR)`), il n'aurait pas bougé.
    poseManche({ [a.id]: -6, [b.id]: 2 });
    expect(cum().player, 'le cumul BAISSE').toBe(Math.max(0, apres1 + (-6 + bfA)));
    expect(cum().player).toBeLessThan(apres1);
  });

  it('le cumul est planché à 0 sur le TOTAL, jamais en dessous (LDB 12 l.174)', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    poseManche({ [a.id]: -20, [b.id]: 1 });
    expect(cum().player).toBe(0);
  });

  it('+1 Avantage au GAGNANT de chaque tour (l.34), et à lui seul', () => {
    const [a, b] = twoHeroes();
    a.advantage = 0; b.advantage = 0;
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    poseManche({ [a.id]: 4, [b.id]: 1 });
    expect(get().party.find((h) => h.id === a.id)!.advantage).toBe(1);
    expect(get().party.find((h) => h.id === b.id)!.advantage ?? 0).toBe(0);
  });

  it('+1 État Exténué tous les (Bonus d’Endurance) tours sans vainqueur (l.35)', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const beA = bonus(a.characteristics.endurance);
    expect(beA, 'le harnais n’a de sens qu’avec un intervalle réel').toBeGreaterThan(1);
    // Manches SANS personne à 10 DR : l'État tombe à la manche dont le rang est un multiple du BE.
    for (let manche = 1; manche < beA; manche++) {
      poseManche({ [a.id]: 0, [b.id]: 0 });
      expect(hasCondition(get().party.find((h) => h.id === a.id)!, COND.extenue), `manche ${manche}`).toBe(false);
    }
    poseManche({ [a.id]: 0, [b.id]: 0 });
    expect(hasCondition(get().party.find((h) => h.id === a.id)!, COND.extenue), `manche ${beA}`).toBe(true);
  });

  /**
   * L'AUTRE moitié de la même phrase, mesurée sur le jeu réel : « Pour chaque Bonus d'Endurance tours
   * qui PASSENT **sans que personne n'ait gagné** » (l.35). Le tour où quelqu'un GAGNE la partie n'est
   * pas un tour qui passe — même si son rang tombe pile sur l'intervalle d'Endurance.
   */
  it('la manche qui EMPORTE la partie n’inflige pas l’Exténué, même au rang du Bonus d’Endurance (l.35)', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const beA = bonus(a.characteristics.endurance);
    expect(beA).toBeGreaterThan(1);
    // Manches muettes jusqu'à l'avant-dernière, puis la manche du RANG D'INTERVALLE emporte les 10 DR.
    for (let manche = 1; manche < beA; manche++) poseManche({ [a.id]: 0, [b.id]: 0 });
    poseManche({ [a.id]: 10, [b.id]: 0 });
    expect(get().sequence, 'la partie est finie sur cette manche').toBeNull();
    expect(get().tavernGames!.result!.winner).toBe('player');
    expect(get().tavernGames!.result!.rounds).toBe(beA);
    expect(hasCondition(get().party.find((h) => h.id === a.id)!, COND.extenue), 'le vainqueur ne s’exténue pas du tour qu’il gagne').toBe(false);
    expect(hasCondition(get().party.find((h) => h.id === b.id)!, COND.extenue), 'ni le perdant : ce tour ne « passe » pas').toBe(false);
  });

  it('premier à 10 DR cumulés : la partie s’achève sur SON nom (l.34)', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    poseManche({ [a.id]: 5, [b.id]: 0 });
    expect(get().sequence, 'la partie continue sous la cible').not.toBeNull();
    poseManche({ [a.id]: 6, [b.id]: 0 });
    expect(get().sequence, 'cible atteinte : la séquence est retirée').toBeNull();
    const res = get().tavernGames!.result!;
    expect(res.winner).toBe('player');
    expect(res.playerSL).toBeGreaterThanOrEqual(10);
    expect(res.rounds).toBe(2);
  });
});

/**
 * RÉ-ENTRÉE (#1279 S4, audit « architecture à rebours ») — le slot de séquence est UNIQUE
 * (`state.sequence`) et `startSequence` l'ÉCRASE. Ouvrir une seconde partie pendant qu'une première
 * courait la faisait donc DISPARAÎTRE sans verdict : mise engagée perdue, étape orpheline restée
 * dans la fenêtre à côté de celle de la nouvelle (sonde : une partie de fléchettes évaporée par un
 * bras-de-fer). Ce n'est pas une friction d'écran — c'est une partie détruite en silence.
 */
describe('#1279 S4 — une partie de taverne ne peut pas en écraser une autre', () => {
  beforeEach(() => {
    useGame.setState(useGame.getInitialState(), true);
    useGame.setState({ party: makePregens().slice(0, 2) as Combatant[], battle: null, sequence: null, pendingCascade: null });
  });

  it('une seconde partie ouverte en pleine partie est REFUSÉE — la première survit intacte', () => {
    const g = useGame.getState.bind(useGame);
    const [a, b] = g().party;
    g().playTavernGame({ gameId: 'flechettes', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    expect(activeSequence<{ gameId: string }>(g)?.payload.gameId, 'la première partie doit être ouverte').toBe('flechettes');

    g().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });

    expect(activeSequence<{ gameId: string }>(g)?.payload.gameId, 'la partie en cours ne doit PAS être écrasée').toBe('flechettes');
  });

  it('une partie DÉNOUÉE rouvre la porte — le refus tient à la partie en cours, pas à un verrou', () => {
    const g = useGame.getState.bind(useGame);
    const [a, b] = g().party;
    g().playTavernGame({ gameId: 'flechettes', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    useGame.setState({ sequence: null, pendingCascade: null }); // dénouement : le socle vide le slot

    g().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    expect(activeSequence<{ gameId: string }>(g)?.payload.gameId).toBe('dominos');
  });
});

/**
 * LE MASQUE DU FORMULAIRE, sur TOUT le catalogue — pas sur le seul jeu dont on avait écrit le
 * prédicat. `tavernPartieEnCours` lit la SÉQUENCE, jamais le `kind` de l'étape surfacée : c'est ce
 * qui le rend vrai pour les familles de manche qui ne surfacent PAS `tavern-round` (choix d'option,
 * annonce de camp, effacement de marques, lancer de volée, tour de pot, Résistance à l'alcool). Le
 * prédicat par `kind` n'en couvrait qu'une sur onze — bouton « Jouer » vivant en pleine partie.
 */
describe('#1279 S4 — le formulaire est masqué pendant TOUTE partie, quel que soit le jeu', () => {
  beforeEach(() => {
    useGame.setState(useGame.getInitialState(), true);
    useGame.setState({ party: makePregens().slice(0, 2) as Combatant[], battle: null, sequence: null, pendingCascade: null });
  });

  it('hors partie, le formulaire est offert', () => {
    expect(tavernPartieEnCours(useGame.getState())).toBe(false);
  });

  // Une partie dont TOUTES les rangées naissent témoins se dénoue dans le même tick (il ne reste
  // rien à masquer) : on n'affirme donc le masque que sur les parties qui SURVIVENT à leur
  // ouverture, et on mesure à part que le lot n'est pas vide — sans quoi la boucle passerait par
  // vacuité, ce qui est précisément la façon dont ce défaut avait survécu.
  const survivantes: string[] = [];
  for (const jeu of TAVERN_GAMES.map((x) => x.id)) {
    it(`${jeu} : tant que la partie court, le formulaire est masqué`, () => {
      const g = useGame.getState.bind(useGame);
      const [a, b] = g().party;
      creditBourse(g, useGame.setState.bind(useGame), a.id, { gold: 0, silver: 5, brass: 0 });
      g().playTavernGame({ gameId: jeu, challengerId: a.id, opponent: { kind: 'hero', id: b.id }, stakeBrass: 24, tablePlayers: 2 });
      if (!activeSequence(g)) return; // partie dénouée dans le tick : plus rien à masquer
      survivantes.push(jeu);
      expect(tavernPartieEnCours(g()), `${jeu} : le bouton « Jouer » doit disparaître`).toBe(true);
    });
  }

  it('la boucle ci-dessus n’est PAS vide : plusieurs jeux laissent une partie en cours', () => {
    expect(survivantes.length).toBeGreaterThanOrEqual(6);
  });
});
