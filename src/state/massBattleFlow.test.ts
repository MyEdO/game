import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { seedBattleRng, battleRng } from './battleRng';
import { d100 } from '../engine/dice';
import { evaluateTest } from '../engine/tests';
import { bonus, effectiveChar } from '../engine/characteristics';
import { pregenParty, PREGEN } from '../data/pregens';
import { massBattleTrackHit, armyMight, armyStartMight, type MassBattleState } from './massBattleFlow';
import type { MassBattleSpec } from '../engine/massBattle';
import type { PendingActivity } from './interludeFlow';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

/** Amorce une bataille avec un vrai groupe (pré-tirés) et le RNG seedé. Par défaut ouvre AUSSI un
 *  interlude doté du budget d'Activités (3 par héros) : c'est le budget UNIQUE dans lequel puise la
 *  préparation de bataille (ADE II 8 l.65 / LDB 23 l.5). `interludeLeft: 0` (ou absence) simule une
 *  bataille SANS interlude (aucune préparation possible → Round 1 direct). */
function start(
  spec: Partial<MassBattleSpec> = {},
  party = pregenParty(PREGEN.soldat, PREGEN.chasseur),
  opts: { interludeLeft?: number } = {},
) {
  seedBattleRng(1234);
  const left = opts.interludeLeft ?? 3;
  const perHero = Object.fromEntries(party.map((h) => [h.id, { eventRoll: 1, left, revenueBrass: 0 }]));
  useGame.setState({
    party, battle: null,
    interlude: left > 0 ? { weeks: 3, phase: 'activities', perHero } as any : null,
  });
  useGame.getState().startMassBattle({ allyMight: 50, enemyMight: 55, plannedRounds: 3, ...spec });
}

/** Budget d'Activités d'interlude restant d'un héros. */
const leftOf = (heroId: string) => useGame.getState().interlude?.perHero[heroId]?.left ?? 0;

/** Injecte un résultat de jet connu dans la modale d'Activité (canal UNIFIÉ) puis l'applique. */
function resolveBattleTest(over: { roll: number; success: boolean; sl: number } & Record<string, unknown>) {
  const pa = useGame.getState().pendingActivity!;
  useGame.setState({ pendingActivity: { ...pa, ...over } });
  useGame.getState().activityConfirm();
}

const mbState = (): MassBattleState => useGame.getState().massBattle!;
const pending = () => useGame.getState().pendingActivity;

describe('startMassBattle / état', () => {
  it('interlude ouvert : la prépa reste DANS l\'interlude (« Interlude c\'est interlude ») — écran interlude, phase prep', () => {
    start(); // interlude ouvert (budget de préparation)
    const s = useGame.getState();
    expect(s.screen).toBe('interlude'); // pas d'écran de bataille séparé : la prépa se joue dans l'interlude
    expect(armyMight(s.massBattle!.ally)).toBe(50);
    expect(armyMight(s.massBattle!.enemy)).toBe(55);
    expect(s.massBattle?.phase).toBe('prep');
    expect(s.massBattle?.situation).toEqual([]); // composée seulement à `massBattleBegin`
    expect(s.massBattle?.pool.length).toBeGreaterThan(0);
  });

  it('sans interlude : aucune préparation possible → bataille engagée directement (écran massBattle, phase round)', () => {
    start({}, pregenParty(PREGEN.soldat, PREGEN.chasseur), { interludeLeft: 0 });
    const s = useGame.getState();
    expect(s.screen).toBe('massBattle');
    expect(s.massBattle?.phase).toBe('round'); // Round 1 direct (pas de prep sans budget)
    expect(s.massBattle?.situation.length).toBeGreaterThan(0); // situation composée à l'engagement
  });

  it('refuse de s\'ouvrir en plein combat tactique', () => {
    useGame.setState({ massBattle: null, battle: { combatants: [] } as any });
    useGame.getState().startMassBattle({ allyMight: 40, enemyMight: 40 });
    expect(useGame.getState().massBattle).toBeNull();
  });

  it('TOUS les jets passent par le canal unifié `pendingActivity` (plus de `pendingBattleTest`)', () => {
    start();
    useGame.getState().massBattleActivity('inspire');
    const pa = pending()!;
    expect(pa.battle).toBe('prep');   // marqueur de bataille sur la PendingActivity
    expect(pa.kind).toBe('catalog');  // même canal que les Activités d'interlude
  });
});

describe('Situation par Round (l.114-116) — sous-ensemble, pas tout le catalogue', () => {
  it('une situation authorée est présentée telle quelle (≠ catalogue complet)', () => {
    start({ situations: [['motivation', 'ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    expect(mb.situation).toEqual(['motivation', 'ligne-de-mire']);
    expect(mb.situation.length).toBeLessThan(mb.pool.length);
  });

  it('sans situation authorée, un tirage borné compose la situation (situationSize)', () => {
    start({ situationSize: 2 });
    useGame.getState().massBattleBegin();
    expect(mbState().situation.length).toBe(2);
  });
});

describe('Discours inspirant (l.71)', () => {
  it('un succès accorde +10 au Test de Puissance du premier Round', () => {
    start();
    useGame.getState().massBattleActivity('inspire');
    expect(pending()?.activityId).toBe('inspire');
    resolveBattleTest({ roll: 20, success: true, sl: 2 });
    expect(mbState().firstRoundBonus).toBe(10);
    expect(mbState().activitiesDone).toContain('inspire');
  });

  it('un échec ne donne aucun bonus', () => {
    start();
    useGame.getState().massBattleActivity('inspire');
    resolveBattleTest({ roll: 95, success: false, sl: -3 });
    expect(mbState().firstRoundBonus).toBe(0);
    expect(mbState().activitiesDone).toContain('inspire');
  });

  it('sa Difficulté est DÉRIVÉE de l’écart de Puissance (l.71), par le canal générique des Activités', () => {
    // Armée alliée devant de +30 → Test plus FACILE ; derrière de −30 → plus DUR. Le Discours n'a pas de
    // porte à lui : c'est l'entrée qui déclare `difficultyFrom`, lue à l'ouverture comme au pré-jet.
    start({ allyMight: 70, enemyMight: 40 });
    useGame.getState().massBattleActivity('inspire');
    expect(pending()?.difficulty).toBe('facile');

    start({ allyMight: 30, enemyMight: 60 });
    useGame.getState().massBattleActivity('inspire');
    expect(pending()?.difficulty).toBe('tresDifficile');
  });
});

describe('Activités de bataille pré-combat (l.79-106)', () => {
  it('Planification réussie : +10 permanent aux Tests de Puissance ; débloque l\'Infiltration', () => {
    start();
    useGame.getState().massBattleActivity('planification');
    expect(pending()?.activityId).toBe('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 3 });
    const mb = mbState();
    expect(mb.allyMod).toBe(10); // Succès (DR 3 < 6) → +10 (l.81)
    expect(mb.planned).toBe(true);
    expect(mb.activitiesDone).toContain('planification');
  });

  it('Planification Stupéfiante (DR ≥ 6) : +20 (l.89)', () => {
    start();
    useGame.getState().massBattleActivity('planification');
    resolveBattleTest({ roll: 3, success: true, sl: 6 });
    expect(mbState().allyMod).toBe(20);
  });

  it('Sabotage requiert le Repérage ; réduit la Puissance ennemie de départ (l.104-106)', () => {
    start();
    // Sans Repérage : refusé.
    useGame.getState().massBattleActivity('sabotage');
    expect(pending()).toBeNull();
    // Repérage réussi → `scouted` (Test combiné : full).
    useGame.getState().massBattleActivity('reperage');
    resolveBattleTest({ roll: 10, success: true, sl: 2, success2: true, sl2: 2, combinedLevel: 'full' });
    expect(mbState().scouted).toBe(true);
    // Sabotage maintenant possible : −5 sur la Puissance de DÉPART (wounds.max) ET la courante.
    useGame.getState().massBattleActivity('sabotage');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(armyStartMight(mbState().enemy)).toBe(50); // 55 − 5
    expect(armyMight(mbState().enemy)).toBe(50);
  });

  it('Rassembler des forces (l.96) : Stupéfiant → +10 de Puissance de DÉPART (le plafond suit)', () => {
    start({ allyMight: 50 });
    useGame.getState().massBattleActivity('rassembler-des-forces');
    resolveBattleTest({ roll: 3, success: true, sl: 6 });
    expect(armyStartMight(mbState().ally)).toBe(60);
    expect(armyMight(mbState().ally)).toBe(60);
  });

  it('budget UNIQUE : sans interlude ouvert, AUCUNE préparation possible (Round 1 direct)', () => {
    start({}, pregenParty(PREGEN.soldat, PREGEN.chasseur), { interludeLeft: 0 });
    expect(useGame.getState().interlude).toBeNull();
    useGame.getState().massBattleActivity('inspire');
    expect(pending()).toBeNull();
    useGame.getState().massBattleActivity('planification');
    expect(pending()).toBeNull();
  });
});

describe('Test combiné d\'Activité (l.75/102) — un jet vs deux compétences', () => {
  it('Repérage combiné : full réussit → +10 au bonus de Planification, scouted', () => {
    start();
    useGame.getState().massBattleActivity('reperage');
    const pa = pending()!;
    expect(pa.activityId).toBe('reperage');
    expect(pa.target2).toBeGreaterThan(0); // seconde cible = Test combiné
    resolveBattleTest({ roll: 10, success: true, sl: 3, success2: true, sl2: 2, combinedLevel: 'full' });
    expect(mbState().scouted).toBe(true);
    expect(mbState().planningBonus).toBe(10);
  });

  it('Infiltration combinée : partial (une seule) NE réussit PAS l\'Activité', () => {
    start();
    useGame.getState().massBattleActivity('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().massBattleActivity('infiltration');
    const pa = pending()!;
    expect(pa.activityId).toBe('infiltration');
    expect(pa.target2).toBeGreaterThan(0);
    const modBefore = mbState().allyMod;
    resolveBattleTest({ roll: 40, success: true, sl: 1, success2: false, sl2: -1, combinedLevel: 'partial' });
    expect(mbState().allyMod).toBe(modBefore); // aucun gain
    expect(mbState().activitiesDone).toContain('infiltration');
  });
});

describe('Scènes cinématiques — MULTI-PJ en Soutien (l.116-118)', () => {
  it('deux PJ résolvent deux Scènes ; les deltas se CUMULENT avant le clash', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('ligne-de-mire');
    const first = pending()!.heroId;
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().massBattleScene('compte-a-rebours');
    const second = pending()!.heroId;
    expect(second).not.toBe(first);
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    const mb = mbState();
    expect(armyMight(mb.enemy)).toBe(55 - 10 - 10); // cumul (−10 Ligne de mire [succès → général tombe], −10 Compte à rebours)
    expect(mb.actedHeroes).toHaveLength(2);
    expect(mb.resolvedScenes).toEqual(expect.arrayContaining(['ligne-de-mire', 'compte-a-rebours']));
  });

  it('une fois tous les PJ engagés, plus aucune Scène de Test ne s\'ouvre', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours', 'motivation']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('ligne-de-mire');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().massBattleScene('compte-a-rebours');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().massBattleScene('motivation');
    expect(pending()).toBeNull();
  });

  it('Ligne de mire : le général tombe sur un SUCCÈS (l.208, DR < 6 suffit) → −10', () => {
    start({ situations: [['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('ligne-de-mire');
    resolveBattleTest({ roll: 10, success: true, sl: 2 }); // succès simple
    expect(armyMight(mbState().enemy)).toBe(55 - 10); // −5 (succès) −5 (général tombé)
  });

  it('Survol : le général ne tombe (−15) qu\'au Succès Stupéfiant (DR ≥ 6, l.217)', () => {
    start({ situations: [['survol'], ['survol']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('survol');
    resolveBattleTest({ roll: 5, success: true, sl: 2 }); // succès simple : pas d'approche au Corps à corps
    expect(armyMight(mbState().enemy)).toBe(55 - 5); // −5 seulement, général debout
  });

  it('Survol : Échec Stupéfiant impose une Charge au Round suivant (l.217)', () => {
    start({ situations: [['survol'], ['motivation']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('survol');
    resolveBattleTest({ roll: 3, success: false, sl: -6 });
    expect(mbState().imposed).toContain('charge');
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    expect(mbState().situation).toContain('charge');
  });
});

describe('Scène MENACE (Intrus l.219)', () => {
  it('applique −20 aux Tests des autres Scènes et est levée par le combat', () => {
    start({ situations: [['intrus', 'ligne-de-mire']], sceneEncounters: { intrus: 'enc-x' } });
    useGame.getState().massBattleBegin();
    expect(mbState().activeThreats).toContain('intrus');
    useGame.getState().massBattleScene('ligne-de-mire');
    const pa = pending()!;
    expect(pa.target).toBe(Math.max(1, Math.min(99, pa.skillValue - 20)));
    useGame.getState().activityConfirm();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'intrus', hits: 3, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Sanguinaire', count: 3 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    expect(mbState().activeThreats).not.toContain('intrus');
    expect(mbState().resolvedScenes).toContain('intrus');
  });
});

describe('Enchaînement de Scènes (l.169) : Compte à rebours échoué → Motivation imposée', () => {
  it('impose la Scène de Motivation au Round suivant', () => {
    start({ situations: [['compte-a-rebours'], ['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('compte-a-rebours');
    resolveBattleTest({ roll: 95, success: false, sl: -2 });
    expect(mbState().imposed).toContain('motivation');
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    expect(mbState().situation).toContain('motivation');
    expect(mbState().imposed).toEqual([]);
  });
});

describe('Scène de COMBAT — touches ET kills (l.139)', () => {
  it('massBattleTrackHit ne compte que les touches HÉROS → ENNEMI', () => {
    start({ situations: [['charge']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({ massBattle: { ...mb, combatScene: { sceneId: 'charge', hits: 0, hitters: [] } } });
    const hero = { id: 'h1', kind: 'hero', bodyShape: 'biped' } as unknown as Combatant;
    const foe = { id: 'e1', kind: 'enemy', bodyShape: 'biped' } as unknown as Combatant;
    const other = { id: 'h2', kind: 'hero', bodyShape: 'biped' } as unknown as Combatant;
    const { getState, setState } = useGame;
    const g = getState as any; const s = setState as any;
    massBattleTrackHit(g, s, hero, foe);
    massBattleTrackHit(g, s, hero, foe);
    massBattleTrackHit(g, s, other, foe);
    massBattleTrackHit(g, s, foe, hero); // ennemi → héros : ignoré
    const cs = mbState().combatScene!;
    expect(cs.hits).toBe(3);
    expect(cs.hitters).toEqual(['h1', 'h2']);
  });

  it('Charge (l.139) : réduction = −1/touche + −2/kill (5 touches + 1 kill = −7)', () => {
    start({ situations: [['charge']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'charge', hits: 5, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Mutant', count: 1 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    const after = mbState();
    expect(armyMight(after.enemy)).toBe(55 - 7);
    expect(after.combatScene).toBeUndefined();
    expect(after.resolvedScenes).toContain('charge');
    expect(useGame.getState().screen).toBe('massBattle');
  });
});

describe('Duel (l.225) — vraie Scène de combat + intervention', () => {
  it('solo (1 frappeur) : ennemi −20', () => {
    start({ situations: [['duel']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 3, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Général', count: 1 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    expect(armyMight(mbState().enemy)).toBe(55 - 20);
    expect(mbState().imposed).not.toContain('charge');
  });

  it('intervention (≥ 2 frappeurs) : ennemi −10 + Scène de Charge enchaînée', () => {
    start({ situations: [['duel']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 4, hitters: ['h1', 'h2'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Général', count: 1 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    expect(armyMight(mbState().enemy)).toBe(55 - 10);
    expect(mbState().imposed).toContain('charge');
  });

  it('DÉFAITE du duel (le champion allié perd) → ALLIÉ −20 et la bataille CONTINUE (l.223)', () => {
    start({ situations: [['duel']] });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 2, hitters: ['h1'] } },
      battle: { over: 'defeat', combatants: [] } as any,
    });
    useGame.getState().dismissDefeat();
    const after = mbState();
    expect(armyMight(after.ally)).toBe(50 - 20);
    expect(armyMight(after.enemy)).toBe(55);
    expect(after.phase).toBe('round');
    expect(after.combatScene).toBeUndefined();
    expect(after.resolvedScenes).toContain('duel');
    expect(useGame.getState().screen).toBe('massBattle');
    expect(useGame.getState().party.every((h) => !h.dead)).toBe(true);
  });
});

describe('Percée (l.173) — vraie Scène de COMBAT + enchaînement sur DÉFAITE', () => {
  it('VICTOIRE : allié +10 (plafonné au départ), pas de Charge imposée', () => {
    start({ situations: [['percee']], sceneEncounters: { percee: 'enc-x' } });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'percee', hits: 4, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Garde', count: 3 }] } as any,
      battle: null,
    });
    useGame.getState().dismissVictory();
    expect(armyMight(mbState().ally)).toBe(Math.min(50 + 10, 50)); // plafonné à la Puissance de départ (l.135)
    expect(mbState().imposed).not.toContain('charge');
  });

  it('DÉFAITE : Scène de Charge imposée au Round suivant (combatLost), bataille continue', () => {
    start({ situations: [['percee'], ['motivation']], sceneEncounters: { percee: 'enc-x' } });
    useGame.getState().massBattleBegin();
    const mb = mbState();
    useGame.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'percee', hits: 1, hitters: ['h1'] } },
      battle: { over: 'defeat', combatants: [] } as any,
    });
    useGame.getState().dismissDefeat();
    expect(mbState().imposed).toContain('charge');
    expect(armyMight(mbState().ally)).toBe(50);
    expect(mbState().phase).toBe('round');
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    expect(mbState().situation).toContain('charge');
  });
});

describe('Tenez votre position (l.161) — Point de rupture + bonus cumulatif', () => {
  it('tenir un Round : Puissance ennemie −2, Scène réimposée', () => {
    start({ situations: [['tenez-votre-position']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('tenez-votre-position');
    const pa = pending()!;
    expect(pa.battle).toBe('round');
    expect(pa.enemyValue).toBeGreaterThan(0); // jet opposé de l'ennemi figé
    resolveBattleTest({ roll: 10, success: true, sl: 3, enemySL: -2 });
    const mb = mbState();
    expect(armyMight(mb.enemy)).toBe(55 - 2);
    expect(mb.sceneState['tenez-votre-position'].held).toBe(1);
    expect(mb.sceneState['tenez-votre-position'].breakpoint).toBe(0);
    expect(mb.imposed).toContain('tenez-votre-position');
    expect(mb.resolvedScenes).toContain('tenez-votre-position');
  });

  it('le Point de rupture ≥ 10 conclut la Scène par une déroute (plus de réimposition)', () => {
    start({ situations: [['tenez-votre-position']] });
    useGame.getState().massBattleBegin();
    const mb0 = mbState();
    useGame.setState({ massBattle: { ...mb0, sceneState: { 'tenez-votre-position': { breakpoint: 8, held: 2, broken: false } } } });
    useGame.getState().massBattleScene('tenez-votre-position');
    resolveBattleTest({ roll: 60, success: false, sl: -1, enemySL: 4 }); // breakpoint 12 ≥ 10 → rupture
    const mb = mbState();
    expect(mb.sceneState['tenez-votre-position'].breakpoint).toBe(12);
    expect(mb.sceneState['tenez-votre-position'].broken).toBe(true);
    expect(mb.imposed).not.toContain('tenez-votre-position');
    expect(armyMight(mb.enemy)).toBe(55); // pas de −2 : la position n'a pas tenu
  });

  /** Ouvre la Scène de tenue APRÈS `heldRounds` Rounds déjà tenus. L'armée ennemie porte le solde de
   *  ces Rounds (ADE II 8 l.163 : « −2 de Puissance » par Round tenu) et son jet reçoit le bonus
   *  cumulatif de +10 par Round — la fixture est celle d'une partie réelle, pas un `held` posé nu. */
  function openHold(heldRounds: number): PendingActivity {
    start({ situations: [['tenez-votre-position']], enemyMight: 55 - 2 * heldRounds });
    useGame.getState().massBattleBegin();
    const mb0 = mbState();
    useGame.setState({ massBattle: { ...mb0, sceneState: { 'tenez-votre-position': { breakpoint: 0, held: heldRounds, broken: false } } } });
    useGame.getState().massBattleScene('tenez-votre-position');
    return pending()!;
  }

  /** Joue le 1ᵉʳ jet de tenue avec les DEUX camps à DR ÉGAL — la seule situation où le départage se
   *  voit (LDB 12 l.160). `pj.target` = la cible JETÉE, `pj.skillBase` = le Niveau de Compétence NU
   *  posé par l'opener (à défaut la cible : c'est le repli d'une opposition sans nue) ; le d100 FIGÉ
   *  de l'ennemi est calé sur le DR que la résolution va tirer (même graine, même appel). */
  function playHoldAtEqualSL(pa0: PendingActivity, pj: { target: number; skillBase?: number }, enemy: { enemyValue: number; enemyBase?: number }) {
    const SEED = 5;
    seedBattleRng(SEED);
    const pjRoll = d100(battleRng());
    const pjSL = evaluateTest(pjRoll, pj.target).sl;
    const enemyRoll = [...Array(100).keys()].map((i) => i + 1).find((r) => evaluateTest(r, enemy.enemyValue).sl === pjSL);
    expect(enemyRoll, 'un d100 ennemi de MÊME DR existe').toBeDefined();
    useGame.setState({
      pendingActivity: {
        ...pa0, skillValue: pj.target, target: pj.target, mod: undefined, support: undefined, roll: null,
        ...enemy, enemyRoll: enemyRoll!, skillBase: pj.skillBase ?? pj.target,
      },
    });
    seedBattleRng(SEED);
    useGame.getState().activityRoll();
    const pa = pending()!;
    expect(pa.sl).toBe(pjSL);
    expect(pa.enemySL).toBe(0); // DR strictement égaux : seul le départage tranche
    return pa;
  }

  it('DR ÉGAL : l\'ennemi l\'emporte par sa Puissance NUE supérieure (LDB 12 l.160) — la position NE tient pas', () => {
    const pa0 = openHold(0);
    expect(pa0.enemyValue).toBe(pa0.enemyBase); // aucun Round tenu : la cible du jet ennemi EST sa Puissance nue
    const pa = playHoldAtEqualSL(pa0, { target: 40 }, { enemyValue: 70, enemyBase: 70 });
    expect(pa.success).toBe(false); // Puissance nue 70 > Compétence nue 40, plus de fiat en faveur du PJ
  });

  it('DR ÉGAL, 2 Rounds déjà tenus : c\'est la Puissance NUE qui départage, pas la cible gonflée du bonus (l.163)', () => {
    const pa0 = openHold(2);
    expect(pa0.enemyBase).toBe(51); // Puissance NUE de l'armée après 2 Rounds tenus (55 − 2 − 2)
    expect(pa0.enemyValue).toBe(51 + 20); // +10 par Round tenu, fondu dans la CIBLE du jet ennemi
    // Compétence NUE du PJ : AU-DESSUS de la Puissance nue (51), EN DESSOUS de la cible bonifiée (71).
    const pa = playHoldAtEqualSL(pa0, { target: 60 }, { enemyValue: pa0.enemyValue!, enemyBase: pa0.enemyBase });
    expect(pa.success).toBe(true); // 60 > 51 → la position tient ; départager sur 60 vs 71 la ferait céder
  });

  it('DR ÉGAL et Puissance NUE ÉGALE à la Compétence : statu quo — l\'ennemi ne l\'emporte pas, la position TIENT', () => {
    const pa0 = openHold(2);
    const pa = playHoldAtEqualSL(pa0, { target: pa0.enemyBase! }, { enemyValue: pa0.enemyValue!, enemyBase: pa0.enemyBase });
    expect(pa.success).toBe(true); // `tie` : aucun vainqueur, l'ennemi ne l'emporte pas
  });

  // ── La nue du PJ est le NIVEAU DE COMPÉTENCE (`LDB 09 l.17`), pas sa valeur de Test : `testValue`
  //    y fond États/Encombrement/passifs, `skillBaseValue` non. Sondes G1 (la base ne bouge pas) et
  //    G2 (le départage suit la nue, États compris). ──

  /** Pose l'État `id` sur tout le groupe (l'opener choisit son acteur ; on veut qu'il soit affecté). */
  function afflictParty(id: string): void {
    useGame.setState({ party: useGame.getState().party.map((h) => ({ ...h, conditions: [...(h.conditions ?? []), { id, stacks: 1 }] })) as Combatant[] });
  }

  /** Rouvre la MÊME Scène de tenue dans la partie en cours (pending vidé, Scène non résolue). */
  function reopenHold(): PendingActivity {
    useGame.setState({ pendingActivity: null });
    useGame.getState().massBattleScene('tenez-votre-position');
    return pending()!;
  }

  it('G1 — un État mord la valeur de Test du PJ, JAMAIS le Niveau de Compétence nu posé (LDB 09 l.17)', () => {
    const clean = openHold(0);
    expect(clean.skillBase).toBeGreaterThan(0);
    expect(clean.skillBase).toBe(clean.skillValue); // sans État ni Soutien : la cible NUE et la valeur de Test coïncident
    afflictParty('empoisonne');
    const sick = reopenHold();
    expect(sick.heroId).toBe(clean.heroId); // même acteur : la comparaison porte sur le MÊME héros
    expect(sick.skillValue).toBeLessThan(clean.skillValue); // l'État pénalise le jet (LDB 16)…
    expect(sick.skillBase).toBe(clean.skillBase); // … et laisse le Niveau de Compétence INTACT
  });

  it('G2 — à DR égal, le PJ Empoisonné l\'emporte par sa Compétence NUE supérieure (LDB 12 l.160)', () => {
    const clean = openHold(0);
    afflictParty('empoisonne');
    const sick = reopenHold();
    const nue = sick.skillBase!;
    expect(sick.skillValue).toBeLessThan(nue - 1); // le PJ pénalisé JETTE sous la Puissance ennemie ci-dessous
    // Armée ennemie 1 point SOUS la Compétence nue du PJ, opposition bonifiée bien au-dessus de sa cible.
    const pa = playHoldAtEqualSL(sick, { target: sick.skillValue, skillBase: nue }, { enemyValue: nue + 19, enemyBase: nue - 1 });
    expect(pa.success).toBe(true); // nue 56 > 55 : la position tient malgré l'État
    expect(clean.skillBase).toBe(nue); // (l'État n'a rien changé à la nue — G1 rappelée sur le même couple)
  });
});

describe('Affectation explicite d\'un PJ à une action (poste ≠ auto « meilleur »)', () => {
  function otherThanSuggested(_actionId: string, opener: () => void): { suggested: string; other: string } {
    opener();
    const suggested = pending()!.heroId;
    useGame.setState({ pendingActivity: null });
    const other = useGame.getState().party.find((h) => !h.dead && h.id !== suggested)!.id;
    return { suggested, other };
  }

  it('(a) poster un PJ NON suggéré à une Scène de Test → CE PJ (meneur) résout la Scène, seul', () => {
    start({ situations: [['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    const { suggested, other } = otherThanSuggested('ligne-de-mire', () => useGame.getState().massBattleScene('ligne-de-mire'));
    expect(other).not.toBe(suggested);
    useGame.getState().setMassBattleHero('ligne-de-mire', [other]);
    useGame.getState().massBattleScene('ligne-de-mire');
    const pa = pending()!;
    expect(pa.heroId).toBe(other);
    expect(pa.heroIds).toEqual([other]);
    expect(pa.support).toEqual({ count: 0, bonus: 0, ids: [] });
  });

  it('(a-bis) DEUX PJ postés → SOUTIEN (meneur + assistant), les DEUX consommés', () => {
    start({ situations: [['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    const [a, b] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('ligne-de-mire', [a, b]);
    useGame.getState().massBattleScene('ligne-de-mire');
    const pa = pending()!;
    expect(pa.heroIds).toEqual(expect.arrayContaining([a, b]));
    expect(pa.heroIds).toHaveLength(2);
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(mbState().actedHeroes).toEqual(expect.arrayContaining([a, b]));
    expect(mbState().actedHeroes).toHaveLength(2);
  });

  it('(b) sans affectation → SUGGESTION résout SEUL (pas de soutien)', () => {
    start({ situations: [['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('ligne-de-mire');
    const pa = pending()!;
    expect(mbState().assignment).toEqual({});
    expect(pa.skillValue).toBeGreaterThan(0);
    expect(pa.support).toEqual({ count: 0, bonus: 0, ids: [] });
    expect(pa.heroIds).toEqual([pa.heroId]);
  });

  it('(c) poster un PJ INDISPONIBLE (déjà engagé) → repli sur la suggestion', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('ligne-de-mire');
    const acted = pending()!.heroId;
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    useGame.getState().setMassBattleHero('compte-a-rebours', [acted]);
    useGame.getState().massBattleScene('compte-a-rebours');
    expect(pending()!.heroId).not.toBe(acted);
  });

  it('(d) poster un PJ à une Activité combinée → CE PJ résout SOLO', () => {
    start();
    const { suggested, other } = otherThanSuggested('reperage', () => useGame.getState().massBattleActivity('reperage'));
    expect(other).not.toBe(suggested);
    useGame.getState().setMassBattleHero('reperage', [other]);
    useGame.getState().massBattleActivity('reperage');
    const pa = pending()!;
    expect(pa.heroId).toBe(other);
    expect(pa.target2).toBeGreaterThan(0); // Test combiné
    expect(pa.support).toBeUndefined();
  });

  it('un nouveau Round efface les affectations', () => {
    start({ plannedRounds: 2, situations: [['motivation'], ['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    useGame.getState().setMassBattleHero('ligne-de-mire', [useGame.getState().party[0].id]);
    expect(Object.keys(mbState().assignment)).toHaveLength(1);
    seedBattleRng(3);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    expect(mbState().assignment).toEqual({});
  });
});

describe('Activité SOUTENABLE — Planification (l.81 : « peut aider au Test »)', () => {
  function partyWithWarLore(): Combatant[] {
    return pregenParty(PREGEN.soldat, PREGEN.chasseur).map((h) =>
      h.skills.some((s) => s.id === 'savoir' && s.spec === 'guerre')
        ? h
        : { ...h, skills: [...h.skills, { id: 'savoir', spec: 'guerre', characteristic: 'intelligence' as const, advances: 5 }] });
  }

  it('deux PJ postés → SOUTIEN (heroIds=2, support.count ≥ 1)', () => {
    start({}, partyWithWarLore());
    const [a, b] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('planification', [a, b]);
    useGame.getState().massBattleActivity('planification');
    const pa = pending()!;
    expect(pa.heroIds).toEqual(expect.arrayContaining([a, b]));
    expect(pa.heroIds).toHaveLength(2);
    expect(pa.support!.count).toBeGreaterThanOrEqual(1);
    expect(pa.support!.bonus).toBeGreaterThanOrEqual(10);
    expect(pa.target2).toBeUndefined(); // Test simple (pas combiné)
  });

  it('un seul PJ posté → meneur SEUL', () => {
    start();
    const [a] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('planification', [a]);
    useGame.getState().massBattleActivity('planification');
    const pa = pending()!;
    expect(pa.heroId).toBe(a);
    expect(pa.heroIds).toEqual([a]);
    expect(pa.support).toEqual({ count: 0, bonus: 0, ids: [] });
  });

  it('une Activité SOLO (Repérage) reste solo — pas de Soutien', () => {
    start();
    const [a, b] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('reperage', [a, b]);
    useGame.getState().massBattleActivity('reperage');
    const pa = pending()!;
    expect(pa.activityId).toBe('reperage');
    expect(pa.support).toBeUndefined();
    expect(pa.heroId).toBe(a);
  });

  // #257 — RAW muet (LDB 12 l.189 « apporter son soutien » / ADE II 8 l.81) : le coût d'Activité de
  // l'assistant est un arbitrage éditable (flag `interlude-assist-costs-activity`, policy.ts).
  it('assistant GRATUIT par défaut : seul le meneur perd un créneau', () => {
    resetRule('interlude-assist-costs-activity');
    start({}, partyWithWarLore());
    const [a, b] = useGame.getState().party.map((h) => h.id);
    useGame.getState().setMassBattleHero('planification', [a, b]);
    useGame.getState().massBattleActivity('planification');
    const leader = pending()!.heroId; // meneur soutenu = meilleure compétence (pas forcément a)
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(leftOf(a) + leftOf(b)).toBe(5); // un SEUL créneau consommé (3+3 → 5)
    expect(leftOf(leader)).toBe(2); // le meneur, lui, a bien payé
  });

  it('flag activé : chaque assistant doté d’un créneau en dépense un', () => {
    setRule('interlude-assist-costs-activity', true);
    try {
      start({}, partyWithWarLore());
      const [a, b] = useGame.getState().party.map((h) => h.id);
      useGame.getState().setMassBattleHero('planification', [a, b]);
      useGame.getState().massBattleActivity('planification');
      resolveBattleTest({ roll: 10, success: true, sl: 2 });
      expect(leftOf(a)).toBe(2); // meneur : −1
      expect(leftOf(b)).toBe(2); // assistant : −1 aussi
    } finally {
      resetRule('interlude-assist-costs-activity');
    }
  });
});

describe('Rassemblement (ADE II 8 l.122)', () => {
  /** Ouvre un Round avec le premier PJ à 1 Blessure, puis déclenche le Rassemblement. */
  function rallyBlesse() {
    start({ situations: [['motivation']] });
    const party = useGame.getState().party.map((h, i) => i === 0 ? { ...h, wounds: { ...h.wounds, current: 1 } } : h);
    useGame.setState({ party });
    useGame.setState({ massBattle: { ...mbState(), phase: 'round', awaitingNext: true } });
    useGame.getState().massBattleRally();
    const pa = pending()!;
    expect(pa.activityId).toBe('rassemblement');
    const hero = useGame.getState().party.find((h) => h.id === pa.heroId)!;
    return { pa, hero, be: bonus(effectiveChar(hero, 'endurance')) };
  }

  it('Test réussi : le PJ regagne EXACTEMENT DR + Bonus d’Endurance Blessures', () => {
    const { pa, hero, be } = rallyBlesse();
    const sl = 3;
    expect(be).toBeGreaterThan(0); // le pré-tiré a bien un BE — sinon la somme ne mesurerait que le DR
    expect(1 + sl + be).toBeLessThanOrEqual(hero.wounds.max); // sous le plafond : la somme est lisible telle quelle
    resolveBattleTest({ roll: 10, success: true, sl });
    expect(useGame.getState().party.find((h) => h.id === pa.heroId)!.wounds.current).toBe(1 + sl + be);
    expect(mbState().ralliedHeroes).toContain(pa.heroId);
  });

  it('Test échoué : aucune Blessure regagnée, et le PJ a consommé son Rassemblement du Round', () => {
    const { pa } = rallyBlesse();
    resolveBattleTest({ roll: 90, success: false, sl: -2 });
    expect(useGame.getState().party.find((h) => h.id === pa.heroId)!.wounds.current).toBe(1);
    expect(mbState().ralliedHeroes).toContain(pa.heroId);
  });

  it('le soin est BORNÉ par le maximum de Blessures', () => {
    const { pa, hero, be } = rallyBlesse();
    const sl = hero.wounds.max; // DR délibérément énorme : 1 + DR + BE dépasse le plafond
    expect(1 + sl + be).toBeGreaterThan(hero.wounds.max);
    resolveBattleTest({ roll: 1, success: true, sl });
    expect(useGame.getState().party.find((h) => h.id === pa.heroId)!.wounds.current).toBe(hero.wounds.max);
  });
});

describe('Budget PARTAGÉ (C2b) — ADE II 8 l.65 : « comme à l\'accoutumée, ils ne peuvent participer qu\'à un maximum de trois Activités »', () => {
  it('une préparation de bataille DÉCRÉMENTE `interlude.perHero.left` (budget UNIQUE)', () => {
    start();
    const hero = useGame.getState().party[0].id;
    useGame.getState().setMassBattleHero('planification', [hero]);
    expect(leftOf(hero)).toBe(3);
    useGame.getState().massBattleActivity('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(leftOf(hero)).toBe(2); // une Activité de préparation = une Activité d'interlude
  });

  it('un héros ne peut faire que 3 Activités AU TOTAL (mix prépa bataille + interlude normale) — la 4ᵉ est REFUSÉE', () => {
    // GROUPE À UN SEUL HÉROS : son budget d'interlude (3) est le SEUL budget de préparation → l'épuiser
    // épuise toute la préparation (le budget est UNIQUE, l.65). Repérage réussi débloque le Sabotage.
    start({}, pregenParty(PREGEN.soldat));
    const [hero] = useGame.getState().party.map((h) => h.id);
    expect(leftOf(hero)).toBe(3);

    // Activité #1 : préparation de bataille (Planification) → left 3→2.
    useGame.getState().massBattleActivity('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(leftOf(hero)).toBe(2);

    // Activité #2 : préparation de bataille (Repérage) → left 2→1, débloque le Sabotage.
    useGame.getState().massBattleActivity('reperage');
    resolveBattleTest({ roll: 10, success: true, sl: 2, success2: true, sl2: 2, combinedLevel: 'full' });
    expect(leftOf(hero)).toBe(1);
    expect(mbState().scouted).toBe(true);

    // Activité #3 : Activité d'interlude NORMALE (Revenus) → left 1→0.
    useGame.getState().interludeActivity(hero, 'revenus');
    const pa = pending()!;
    expect(pa.battle).toBeUndefined(); // Activité d'interlude ordinaire (pas de bataille)
    useGame.setState({ pendingActivity: { ...pa, roll: 50, success: true, sl: 1 } });
    useGame.getState().activityConfirm();
    expect(leftOf(hero)).toBe(0);

    // 4ᵉ Activité : budget épuisé → la préparation de bataille (Sabotage) est REFUSÉE (l.65).
    useGame.getState().massBattleActivity('sabotage');
    expect(pending()).toBeNull();
    // …et une Activité d'interlude normale l'est aussi (source de budget UNIQUE).
    useGame.getState().interludeActivity(hero, 'revenus');
    expect(pending()).toBeNull();
  });

  it('les Scènes de Round (`battle === \'round\'`) ne consomment PAS le budget d\'interlude', () => {
    start({ situations: [['ligne-de-mire']] });
    const hero = useGame.getState().party[0].id;
    useGame.getState().setMassBattleHero('ligne-de-mire', [hero]);
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('ligne-de-mire');
    const pa = pending()!;
    expect(pa.battle).toBe('round');
    const before = leftOf(pa.heroId);
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(leftOf(pa.heroId)).toBe(before); // Scène de Round hors budget downtime (illimitée par Round)
  });
});

describe('Test spectaculaire, avancement & issue (l.120/124)', () => {
  it('le clash réduit les deux Puissances d\'au moins 5 sans faire avancer le Round', () => {
    start({ plannedRounds: 3 });
    useGame.getState().massBattleBegin();
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    const mb = mbState();
    expect(mb.awaitingNext).toBe(true);
    expect(mb.round).toBe(1);
    expect(armyMight(mb.ally)).toBeLessThanOrEqual(50 - 5);
    expect(armyMight(mb.enemy)).toBeLessThanOrEqual(55 - 5);
  });

  it('massBattleAdvance passe au Round suivant et réinitialise l\'état par-Round', () => {
    start({ plannedRounds: 2, situations: [['motivation'], ['ligne-de-mire']] });
    useGame.getState().massBattleBegin();
    seedBattleRng(3);
    useGame.getState().massBattleClash();
    useGame.getState().massBattleAdvance();
    const mb = mbState();
    expect(mb.round).toBe(2);
    expect(mb.awaitingNext).toBe(false);
    expect(mb.resolvedScenes).toEqual([]);
    expect(mb.actedHeroes).toEqual([]);
    expect(mb.situation).toEqual(['ligne-de-mire']);
    useGame.getState().massBattleClash();
    expect(mbState().phase).toBe('over');
  });

  it('une armée réduite à 0 est détruite immédiatement', () => {
    start({ plannedRounds: 5, enemyMight: 5 });
    useGame.getState().massBattleBegin();
    seedBattleRng(9);
    useGame.getState().massBattleClash();
    const mb = mbState();
    expect(armyMight(mb.enemy)).toBe(0);
    expect(mb.phase).toBe('over');
    expect(mb.outcome).toBe('ally');
  });
});

describe('Modèle Combattant-armée (Blessures = Puissance)', () => {
  it('l\'armée est un Combattant INANIMÉ : PB courantes = Puissance, PB max = départ, inerte', () => {
    start({ allyMight: 50, enemyMight: 55 });
    const ally = mbState().ally.combatant;
    expect(ally.wounds.current).toBe(50);
    expect(ally.wounds.max).toBe(50);
    expect(ally.inert).toBe(true);
    expect(ally.psychImmune).toBe(true);
  });

  it('un gain de Scène est plafonné NATURELLEMENT à la Puissance de départ (l.135)', () => {
    start({ allyMight: 50, situations: [['motivation']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('motivation');
    resolveBattleTest({ roll: 10, success: true, sl: 4 }); // +4 tenté, déjà à 50/50
    expect(armyMight(mbState().ally)).toBe(50);
  });

  it('après une perte, un gain de Scène ne remonte pas au-delà du départ', () => {
    start({ allyMight: 50, plannedRounds: 3, situations: [['motivation'], ['motivation']] });
    useGame.getState().massBattleBegin();
    seedBattleRng(7);
    useGame.getState().massBattleClash();
    const afterClash = armyMight(mbState().ally);
    expect(afterClash).toBeLessThan(50);
    useGame.getState().massBattleAdvance();
    useGame.getState().massBattleScene('motivation');
    resolveBattleTest({ roll: 10, success: true, sl: 6 });
    expect(armyMight(mbState().ally)).toBeLessThanOrEqual(50);
    expect(armyMight(mbState().ally)).toBeGreaterThan(afterClash);
  });
});

describe('Aléa & fermeture', () => {
  it('massBattleHazard pose un facteur environnemental (1d10)', () => {
    start();
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleHazard(10);
    expect(mbState().hazard?.label).toBe('Peur');
  });

  it('endMassBattle ferme la bataille', () => {
    start();
    useGame.getState().endMassBattle();
    expect(useGame.getState().massBattle).toBeNull();
  });

  it('endMassBattle REFUSE de clore sous un Test de bataille en cours, en le nommant (#1906)', () => {
    start();
    useGame.getState().massBattleActivity('inspire');
    const pa = pending()!;
    useGame.getState().endMassBattle();
    expect(useGame.getState().massBattle, 'le Test lit la bataille jusqu’à son issue').not.toBeNull();
    expect(pending()).toEqual(pa);
    expect(useGame.getState().journal.slice(-1)[0]).toBe(`Le Test « ${pa.label} » est en cours : terminez-le avant de clore la bataille.`);
  });
});

describe('Flux `activity` — défauts RAW corrigés (combiné partiel · Menace · tenue +1 DR)', () => {
  /** Dote le héros ACTEUR du pending courant de points de ressource (Chance/Résilience). */
  function grant(res: { fortune?: number; resilience?: number }) {
    const id = pending()!.heroId;
    useGame.setState({ party: useGame.getState().party.map((h) => (h.id === id ? { ...h, ...res } : h)) });
  }

  it('(i) Test combiné PARTIEL : la Chance est OFFERTE (`failed` regarde le NIVEAU, pas skill-1)', () => {
    start();
    useGame.getState().massBattleActivity('reperage');
    const pa0 = pending()!;
    expect(pa0.target2).toBeGreaterThan(0); // vrai Test combiné
    // skill-1 réussie, skill-2 ratée → `partial` = ÉCHEC GLOBAL RAW (LDB 12 l.202-206).
    useGame.setState({ pendingActivity: { ...pa0, roll: 40, success: true, sl: 1, success2: false, sl2: -1, combinedLevel: 'partial' } });
    grant({ fortune: 1 });
    seedBattleRng(99);
    useGame.getState().activityReroll();
    expect(pending()!.rerolled).toBe(true); // `failed` true pour un partiel → la relance de Chance a lieu
  });

  it('(i-bis) Test combiné PARTIEL : la Résilience le RATTRAPE en `full` (garde forcé = activityWon)', () => {
    start();
    useGame.getState().massBattleActivity('reperage');
    const pa0 = pending()!;
    useGame.setState({ pendingActivity: { ...pa0, roll: 40, success: true, sl: 1, success2: false, sl2: -1, combinedLevel: 'partial' } });
    grant({ resilience: 1 });
    useGame.getState().activityForceSuccess();
    const pa = pending()!;
    expect(pa.combinedLevel).toBe('full');
    expect(pa.success2).toBe(true);
  });

  it('(i-ter) Test combiné FULL : la Résilience ne dépense RIEN (déjà gagné)', () => {
    start();
    useGame.getState().massBattleActivity('reperage');
    const pa0 = pending()!;
    useGame.setState({ pendingActivity: { ...pa0, roll: 10, success: true, sl: 2, success2: true, sl2: 2, combinedLevel: 'full' } });
    grant({ resilience: 1 });
    const id = pending()!.heroId;
    useGame.getState().activityForceSuccess();
    expect(useGame.getState().party.find((h) => h.id === id)!.resilience).toBe(1); // non dépensée (activityWon → null)
  });

  it('(ii) Scène sous MENACE : le 1ᵉʳ jet CONSERVE la cible pré-cuite (mod −20 non relâché)', () => {
    start({ situations: [['intrus', 'ligne-de-mire']], sceneEncounters: { intrus: 'enc-x' } });
    useGame.getState().massBattleBegin();
    expect(mbState().activeThreats).toContain('intrus');
    useGame.getState().massBattleScene('ligne-de-mire');
    const pa0 = pending()!;
    expect(pa0.mod).toBe(-20); // pénalité de Menace Intrus (l.219)
    expect(pa0.target).toBe(Math.max(1, Math.min(99, pa0.skillValue - 20))); // mod fondu par l'opener
    seedBattleRng(5);
    useGame.getState().activityRoll();
    expect(pending()!.target).toBe(pa0.target); // la résolution NE l'écrase PAS par une cible sans mod
  });

  it('(iii) Tenez votre position + Chance « +1 DR » : `success` reste cohérent avec `enemySL`', () => {
    start({ situations: [['tenez-votre-position']] });
    useGame.getState().massBattleBegin();
    useGame.getState().massBattleScene('tenez-votre-position');
    const pa0 = pending()!;
    expect(pa0.enemyValue).toBeGreaterThan(0); // jet ennemi opposé figé
    // DR de l'ennemi RECALCULÉ de son d100 figé : le pending est calé DESSUS (l'ennemi mène de 3 DR
    // avant la Chance). Un `enemySL` forgé sans lien avec `enemyRoll`/`enemyValue` ne serait jamais relu.
    const enemySL0 = evaluateTest(pa0.enemyRoll!, pa0.enemyValue!).sl;
    const pjSL = enemySL0 - 3;
    // PJ « réussi » numériquement (roll ≤ cible) MAIS l'ennemi l'emporte à l'opposition (enemySL 3 > 0).
    useGame.setState({ pendingActivity: { ...pa0, roll: 20, target: 50, sl: pjSL, success: false, enemySL: 3 } });
    grant({ fortune: 1 });
    useGame.getState().activityBonusSL();
    const pa = pending()!;
    expect(pa.sl).toBe(pjSL + 1);
    expect(pa.enemySL).toBe(2); // +1 DR au PJ → −1 au DR net de l'ennemi
    expect(pa.success).toBe(pa.enemySL! <= 0); // success RE-DÉRIVÉ de la marge (pas du jet numérique)
    expect(pa.success).toBe(false); // l'ennemi tient encore le dessus (enemySL 2 > 0)
  });
});
