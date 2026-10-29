/**
 * Jeux de taverne (NADJ 16) — câblage store : une partie est une SÉQUENCE (socle `sequenceCore`,
 * #1279) dont chaque manche s'ouvre en fenêtre ; elle se joue de bout en bout via `drain()` (patron
 * `port-sell-cargo.test.ts`). DEUX MONTAGES : héros contre HÉROS → BANDE (une rangée par camp, chaque
 * siège joue son jet) ; héros contre la SALLE → mono à jet adverse FIGÉ dans `meta.opposed.aT` (#579),
 * dont la ré-opposition sous influence (Chance « +1 DR ») est vérifiée contre `resolveOpposed`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from '../state/store';
import { makePregens } from '../data/pregens';
import { toBrass } from '../engine/money';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { seedBattleRng } from './battleRng';
import { resolveOpposed } from '../engine/tests';
import { jete } from '../engine/tests.testkit';
import { activeSequence, sequenceAbandonOf } from './sequenceCore';
import { advantageCapFor } from '../engine/advantage';
import { tavernPartieEnCours, tavernParams } from './tavernFlow';
import { TAVERN_GAMES, TAVERN_FAST_RULE } from '../engine/tavernGame';
import { setRule, resetRule } from '../engine/policy';
import { addCondition, COND, hasCondition } from '../engine/conditions';
import { findTavernGameById } from '../engine/tavernGame';
import { bonus } from '../engine/characteristics';
import { skillBaseValue } from '../engine/skills';
import { tavernGameValue } from './tavernFlow';
import type { Combatant } from '../engine/types';
import { ligneDe } from '../engine/modLine.testkit';
import { refDeRegle } from '../engine/reglesChiffrees';

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
  setRule('tavern-games', true); // la table s'ouvre sous l'option (`refusDOuvrirLaTaverne`)
});
afterEach(() => resetRule('tavern-games'));

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
    const after = jete(get().pendingCascade!.participants[0].result);
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
   * Au régime RAPIDE (NADJ 16 l.11) : les Dominos y jouent sans leur clause d'égalité (l.105), qui
   * remplace sinon le départage général.
   */
  it('DR égal : les DEUX rangées opposent leur Compétence NUE — l’État ne vole pas la manche (LDB 12 l.160)', () => {
    setRule(TAVERN_FAST_RULE, true);
    try { departageParLaNue(); } finally { resetRule(TAVERN_FAST_RULE); }
  });
  function departageParLaNue(): void {
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
  }

  /** Au régime RAPIDE (NADJ 16 l.11) : aucune clause d'égalité déclarée, `resolveOpposed` juge seul. */
  it('zéro divergence de maths avec `resolveTavernRound` : le verdict final recompose EXACTEMENT depuis le meta figé', async () => {
    setRule(TAVERN_FAST_RULE, true);
    try { await recomposeDepuisLeMetaFige(); } finally { resetRule(TAVERN_FAST_RULE); }
  });
  async function recomposeDepuisLeMetaFige(): Promise<void> {
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
  }
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

  it('+1 État Exténué tous les (Bonus d’Endurance) tours sans vainqueur (l.34)', () => {
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
   * qui PASSENT **sans que personne n'ait gagné** » (l.34). Le tour où quelqu'un GAGNE la partie n'est
   * pas un tour qui passe — même si son rang tombe pile sur l'intervalle d'Endurance.
   */
  it('la manche qui EMPORTE la partie n’inflige pas l’Exténué, même au rang du Bonus d’Endurance (l.34)', () => {
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
    expect(res.detail).toBe(`${res.playerSL} DR cumulés contre ${res.opponentSL} en 2 manches`);
  });

  it('une partie emportée en UNE manche le dit au singulier', () => {
    const [a, b] = twoHeroes();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    poseManche({ [a.id]: 10, [b.id]: 0 });
    const res = get().tavernGames!.result!;
    expect(res.detail).toBe(`${res.playerSL} DR cumulés contre ${res.opponentSL} en 1 manche`);
  });

  /**
   * L'AVANTAGE DU BRAS DE FER (NADJ 16 l.34 : « Le gagnant de chaque tour gagne +1 Avantage, pouvant
   * être utilisé dans le cadre de cette partie de bras de fer, en suivant les règles normales ») : un
   * stock qui S'ADDITIONNE (LDB 14 l.204-209), plafonné (l.195-198), +10 par pion sur la cible du Test
   * (l.215), perdu en entier au tour perdu (l.219) et à la fin de la partie (l.219).
   */
  const adv = (id: string): number => get().party.find((h) => h.id === id)!.advantage ?? 0;
  const rangee = (id: string) => get().pendingCascade!.participants[0].participants!.find((r) => r.id === id)!;
  /** Deux héros dont l'Exténué d'intervalle (l.34) ne tombe pas avant le 5ᵉ tour : un État fait perdre
   *  tout l'Avantage (LDB 16 l.7), il masquerait la règle mesurée. */
  function endurants(): [Combatant, Combatant] {
    const [a, b] = twoHeroes();
    for (const h of [a, b]) { h.characteristics.endurance = 50; h.advantage = 0; }
    return [a, b];
  }
  /** `x` emporte le tour sans faire avancer le cumul : score de manche 0 contre −2 (DR + Bonus de Force). */
  function gagne(x: Combatant, y: Combatant): void {
    poseManche({ [x.id]: -bonus(x.characteristics.force), [y.id]: -bonus(y.characteristics.force) - 2 });
  }

  it('+1 Avantage par tour gagné, CUMULÉ : trois tours gagnés d’affilée = 3 (LDB 14 l.204-209)', () => {
    const [a, b] = endurants();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    for (let i = 0; i < 3; i++) gagne(a, b);
    expect(get().sequence, 'la partie court encore').not.toBeNull();
    expect(adv(a.id)).toBe(3);
    expect(adv(b.id)).toBe(0);
  });

  it('le gain s’arrête au plafond d’Avantage (LDB 14 l.195-198)', () => {
    const [a, b] = endurants();
    const plafond = advantageCapFor(a);
    a.advantage = plafond - 1; b.advantage = 0;
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    gagne(a, b);
    gagne(a, b);
    expect(adv(a.id)).toBe(plafond);
  });

  it('l’Avantage entre dans la CIBLE du Test de Force, +10 par pion, ligne nommée (LDB 14 l.215)', () => {
    const [a, b] = endurants();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    const cibleA = rangee(a.id).target!;
    const cibleB = rangee(b.id).target!;
    gagne(a, b);
    gagne(a, b);
    expect(rangee(a.id).target, 'deux pions : +20').toBe(cibleA + 20);
    expect(ligneDe(rangee(a.id).mods, refDeRegle('avantage'))?.value).toBe(20);
    expect(rangee(b.id).target, 'le perdant n’a aucun pion').toBe(cibleB);
  });

  it('le tour PERDU fait perdre TOUS ses Avantages ; le tour sans gain en fait perdre 1 (LDB 14 l.219)', () => {
    // NADJ 16 l.34 « en suivant les règles normales » : la perte est la règle du socle, que le Test de
    // Force admet en déclarant l'Avantage.
    expect(tavernParams(findTavernGameById('bras-de-fer')!).avantage).toBe(true);
    const [a, b] = endurants();
    b.characteristics.force = a.characteristics.force; // départage par la valeur nue (LDB 12 l.160) : égal
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    gagne(a, b);
    gagne(a, b);
    expect(adv(a.id)).toBe(2);
    expect(rangee(a.id).base, 'mêmes valeurs nues').toBe(rangee(b.id).base);
    // Égalité parfaite : mêmes DR, mêmes Bonus de Force, mêmes valeurs nues. Personne ne gagne
    // d'Avantage ce tour : chacun en perd 1, plancher 0.
    poseManche({ [a.id]: -1, [b.id]: -1 });
    expect(adv(a.id), 'égalité : aucun Avantage gagné, 1 perdu').toBe(1);
    expect(adv(b.id), 'plancher 0').toBe(0);
    gagne(b, a);
    expect(adv(a.id), 'tour perdu : tout l’Avantage part').toBe(0);
    expect(adv(b.id)).toBe(1);
  });

  it('l’Avantage de la partie revient à 0 à son dénouement (LDB 14 l.219, NADJ 16 l.34)', () => {
    const [a, b] = endurants();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    gagne(a, b);
    expect(adv(a.id)).toBe(1);
    poseManche({ [a.id]: 10, [b.id]: -3 });
    expect(get().sequence, 'partie dénouée').toBeNull();
    expect(get().tavernGames!.result!.winner).toBe('player');
    expect(adv(a.id)).toBe(0);
  });

  it('ABANDON : la partie est perdue par celui qui renonce, et son Avantage revient à 0', () => {
    const [a, b] = endurants();
    useGame.setState({ party: [a, b] });
    get().openTavernGames();
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    gagne(a, b);
    expect(adv(a.id)).toBe(1);
    expect(sequenceAbandonOf(get)?.title, 'sans mise : la partie, rien d’autre').toBe('Renoncer à la partie : elle est perdue.');
    get().sequenceAbandon();
    expect(get().sequence).toBeNull();
    expect(get().pendingCascade).toBeNull();
    const res = get().tavernGames!.result!;
    expect(res.winner, 'abandonner, c’est perdre').toBe('opponent');
    expect(res.detail.startsWith(`${a.label} abandonne.`), res.detail).toBe(true);
    expect(adv(a.id)).toBe(0);
  });

  it('ABANDON : le résultat dit le cumul du tableau de marque, plancher 0, et les manches JOUÉES (LDB 12 l.174)', () => {
    const [a, b] = endurants();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    poseManche({ [a.id]: 1, [b.id]: 0 });
    poseManche({ [a.id]: -10, [b.id]: -9 });
    const cum = get().sequence!.cum as Record<string, number>;
    expect(cum.player, 'le total ne descend jamais sous 0').toBeGreaterThanOrEqual(0);
    get().sequenceAbandon();
    const res = get().tavernGames!.result!;
    expect([res.playerSL, res.opponentSL]).toEqual([cum.player, cum.opponent]);
    expect(res.detail).toBe(`${a.label} abandonne. ${cum.player} DR cumulés contre ${cum.opponent} en 2 manches`);
  });

  it('ABANDON avant toute manche jouée : le détail se réduit à l’abandon, et le journal dit le MÊME texte et l’issue', () => {
    const [a, b] = endurants();
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    get().sequenceAbandon();
    expect(get().tavernGames!.result!.detail).toBe(`${a.label} abandonne.`);
    expect(get().journal[get().journal.length - 1]).toBe(`Le bras de fer — ${a.label} contre ${b.label}, perdu : ${a.label} abandonne.`);
  });

  it('un État reçu en cours de partie fait perdre tout l’Avantage, et le journal le dit (LDB 16 l.7)', () => {
    const [a, b] = twoHeroes();
    for (const h of [a, b]) { h.characteristics.endurance = 15; h.advantage = 0; }
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    gagne(a, b);
    const heros = get().party.find((h) => h.id === a.id)!;
    expect(hasCondition(heros, COND.extenue), 'Bonus d’Endurance 1 : Exténué à chaque tour sans vainqueur (NADJ 16 l.34)').toBe(true);
    expect(adv(a.id)).toBe(0);
    expect(get().journal.some((l) => l.includes(`${a.label} perd tous ses Avantages.`))).toBe(true);
  });

  it('contre un HABITUÉ (sans fiche suivie) : son Avantage de camp entre dans SON jet figé, tenu par la même règle', () => {
    const [a] = endurants();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    const valeur = (get().sequence!.payload as { opponentValue: number }).opponentValue;
    const fige = () => get().pendingCascade!.participants[0].meta!.opposed!.aT!;
    expect(fige().target, 'aucun Avantage au premier tour').toBe(valeur);
    poseMono(-30); // l'habitué emporte le tour
    expect((get().sequence!.payload as { advantage?: { opponent: number } }).advantage?.opponent).toBe(1);
    expect(fige().target, '+10 pour son pion').toBe(valeur + 10);
    const cibleA = get().pendingCascade!.participants[0].target!;
    // Le héros emporte le tour d'un point de score : l'habitué perd tout, le héros gagne +1.
    poseMono(fige().sl + bonus(valeur) - bonus(a.characteristics.force) + 1);
    expect((get().sequence!.payload as { advantage?: { opponent: number } }).advantage?.opponent).toBe(0);
    expect(adv(a.id)).toBe(1);
    expect(fige().target).toBe(valeur);
    expect(get().pendingCascade!.participants[0].target, 'le pion du héros entre dans SA cible').toBe(cibleA + 10);
  });

  it('contre un HABITUÉ : son gain est le montant DÉCLARÉ par les ops `winner`, comme celui du héros (NADJ 16 l.34)', () => {
    const [a] = endurants();
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    const seq = get().sequence!;
    const declare = { ...seq.params.rounds, winner: [{ op: 'gainAdvantage' as const, amount: 2 }] };
    useGame.setState({ sequence: { ...seq, params: { ...seq.params, rounds: declare } } });
    const valeur = (get().sequence!.payload as { opponentValue: number }).opponentValue;
    const fige = () => get().pendingCascade!.participants[0].meta!.opposed!.aT!;
    poseMono(-30);
    expect((get().sequence!.payload as { advantage?: { opponent: number } }).advantage?.opponent).toBe(2);
    poseMono(fige().sl + bonus(valeur) - bonus(a.characteristics.force) + 1);
    expect(adv(a.id), 'le héros suit la même donnée').toBe(2);
  });

  it('contre un HABITUÉ, en Avantage de GROUPE : son gain de manche tombe, sa perte non (AA 11 l.12, l.42-44)', () => {
    setRule('combat-aa-avantage-groupe', true);
    try {
      const [a] = endurants();
      useGame.setState({ party: [a] });
      get().playTavernGame({ gameId: 'bras-de-fer', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
      const valeur = (get().sequence!.payload as { opponentValue: number }).opponentValue;
      const fige = () => get().pendingCascade!.participants[0].meta!.opposed!.aT!;
      const camp = () => (get().sequence!.payload as { advantage?: { opponent: number } }).advantage?.opponent;
      poseMono(-30);
      expect(camp(), 'l’habitué gagne la manche : sa réserve gagne').toBe(1);
      poseMono(fige().sl + bonus(valeur) - bonus(a.characteristics.force) + 1);
      expect(adv(a.id)).toBe(1);
      expect(camp(), 'aucune perte de manche en Avantage de groupe').toBe(1);
    } finally { resetRule('combat-aa-avantage-groupe'); }
  });

  /** Pose le DR du jet du challenger (manche MONO à jet adverse figé), puis la clôt. */
  function poseMono(sl: number): void {
    const pc = get().pendingCascade!;
    const step = pc.participants[0];
    const result = { roll: sl >= 0 ? 11 : 99, target: step.target!, sl, success: sl >= 0, isDouble: false };
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...step, result }] } });
    get().cascadeNext();
  }
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
