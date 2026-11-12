import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng, battleRng } from './battleRng';
import { d100 } from '../engine/dice';
import { evaluateTest } from '../engine/tests';
import { bonus, effectiveChar } from '../engine/characteristics';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { massBattleTrackHit, armyMight, armyStartMight, battleActivityById, peutTenterAction, type MassBattleState } from './massBattleFlow';
import { BATTLE_HAZARDS, type MassBattleSpec } from '../engine/massBattle';
import { t } from '../i18n';
import { initialNet } from './etat';
import { intentAllowedFor } from './netOwnership';
import { refusDuChoixNomme } from './choixDeFenetre';
import { fenetreDuJeu } from './combatAuto';
import type { PendingActivity } from './interludeFlow';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { addCondition } from '../engine/conditions';
import { blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { pratiquer } from './interlude.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Amorce une bataille avec un vrai groupe (pré-tirés) et le RNG seedé. Par défaut ouvre AUSSI un
 *  interlude doté du budget d'Activités (3 par héros) : c'est le budget UNIQUE dans lequel puise la
 *  préparation de bataille (ADE II 8 l.65 / LDB 23 l.5). `interludeLeft: 0` (ou absence) simule une
 *  bataille SANS interlude (aucune préparation possible → Round 1 direct). */
function start(
  spec: Partial<MassBattleSpec> = {},
  party = groupeDeScenario(idsDeTest, 'soldat', 'chasseur'),
  opts: { interludeLeft?: number } = {},
) {
  seedBattleRng(1234);
  const left = opts.interludeLeft ?? 3;
  const perHero = Object.fromEntries(party.map((h) => [h.id, { eventRoll: 1, left, revenueBrass: 0 }]));
  banc.setState({
    party, battle: null,
    interlude: left > 0 ? { weeks: 3, phase: 'activities', perHero } as any : null,
  });
  banc.getState().amorcerLaBataille({ puissanceAlliee: 50, puissanceEnnemie: 55, plannedRounds: 3, ...spec });
}

/** Le groupe doté de Savoir (Guerre) — Compétence Avancée que la Planification exige (LDB 09 l.30). */
function partyWithWarLore(party = groupeDeScenario(idsDeTest, 'soldat', 'chasseur')): Combatant[] {
  return party.map((h) =>
    h.skills.some((s) => s.id === 'savoir' && s.spec === 'guerre' && (s.advances ?? 0) > 0)
      ? h
      : { ...h, skills: [...h.skills, { id: 'savoir', spec: 'guerre', characteristic: 'intelligence' as const, advances: 5 }] });
}

/** Budget d'Activités d'interlude restant d'un héros. */
const leftOf = (heroId: string) => banc.getState().interlude?.perHero[heroId]?.left ?? 0;

/** Injecte un résultat de jet connu dans la modale d'Activité (canal UNIFIÉ) puis l'applique. */
function resolveBattleTest(over: { roll: number; success: boolean; sl: number } & Record<string, unknown>) {
  const pa = banc.getState().pendingActivity!;
  banc.setState({ pendingActivity: { ...pa, ...over } });
  banc.getState().jetValider('activite');
}

const mbState = (): MassBattleState => banc.getState().massBattle!;

/** La préparation close, la bataille engage son Round 1 sur son écran, comme la clôture de l'interlude l'engage. */
const auRound = () => {
  banc.getState().engagerLaBataille();
  banc.setState({ screen: 'massBattle' });
};
/** Poste chaque PJ `heroIds` au poste `posteId` (`batailleDeMasse.ajouterAuPoste`). */
const poster = (posteId: string, ...heroIds: string[]) => {
  for (const h of heroIds) banc.getState().fenetreChoisir('batailleDeMasse', 'ajouterAuPoste', posteId, h);
};

/** Le premier héros du groupe qui peut tenter la préparation `id` (`peutTenterAction`), à défaut le premier. */
const meneurCapable = (id: string): string => {
  const def = battleActivityById(id)!;
  const party = banc.getState().party;
  return (party.find((h) => peutTenterAction(h, def)) ?? party[0]).id;
};
/** Ouvre la préparation `id` MENÉE par `heroId`, par défaut `meneurCapable(id)`. */
const prep = (id: string, heroId = meneurCapable(id)) => banc.getState().menerLActionDeBataille(heroId, id);
const pending = () => banc.getState().pendingActivity;

describe('amorcerLaBataille / état', () => {
  it('interlude ouvert : la prépa reste DANS l\'interlude (« Interlude c\'est interlude ») — écran interlude, phase prep', () => {
    start(); // interlude ouvert (budget de préparation)
    const s = banc.getState();
    expect(s.screen).toBe('interlude'); // pas d'écran de bataille séparé : la prépa se joue dans l'interlude
    expect(armyMight(s.massBattle!.allie)).toBe(50);
    expect(armyMight(s.massBattle!.ennemi)).toBe(55);
    expect(s.massBattle?.phase).toBe('prep');
    expect(s.massBattle?.situation).toEqual([]); // composée seulement à `engagerLaBataille`
    expect(s.massBattle?.pool.length).toBeGreaterThan(0);
  });

  it('sans interlude : aucune préparation possible → bataille engagée directement (écran massBattle, phase round)', () => {
    start({}, groupeDeScenario(idsDeTest, 'soldat', 'chasseur'), { interludeLeft: 0 });
    const s = banc.getState();
    expect(s.screen).toBe('massBattle');
    expect(s.massBattle?.phase).toBe('round'); // Round 1 direct (pas de prep sans budget)
    expect(s.massBattle?.situation.length).toBeGreaterThan(0); // situation composée à l'engagement
  });

  it('refuse de s\'ouvrir en plein combat tactique', () => {
    banc.setState({ massBattle: null, battle: { combatants: [] } as any });
    banc.getState().amorcerLaBataille({ puissanceAlliee: 40, puissanceEnnemie: 40 });
    expect(banc.getState().massBattle).toBeNull();
  });

  it('TOUS les jets passent par le canal unifié `pendingActivity` (plus de `pendingBattleTest`)', () => {
    start();
    prep('inspire');
    const pa = pending()!;
    expect(pa.battle).toBe('prep');   // marqueur de bataille sur la PendingActivity
    expect(pa.kind).toBe('catalog');  // même canal que les Activités d'interlude
  });
});

describe('Situation par Round (l.114-116) — sous-ensemble, pas tout le catalogue', () => {
  it('une situation authorée est présentée telle quelle (≠ catalogue complet)', () => {
    start({ situations: [['motivation', 'ligne-de-mire']] });
    auRound();
    const mb = mbState();
    expect(mb.situation).toEqual(['motivation', 'ligne-de-mire']);
    expect(mb.situation.length).toBeLessThan(mb.pool.length);
  });

  it('sans situation authorée, un tirage borné compose la situation (situationSize)', () => {
    start({ situationSize: 2 });
    auRound();
    expect(mbState().situation.length).toBe(2);
  });
});

describe('Discours inspirant (l.71)', () => {
  it('un succès accorde +10 au Test de Puissance du premier Round', () => {
    start();
    prep('inspire');
    expect(pending()?.activityId).toBe('inspire');
    resolveBattleTest({ roll: 20, success: true, sl: 2 });
    expect(mbState().firstRoundBonus).toBe(10);
    expect(mbState().activitiesDone).toContain('inspire');
  });

  it('un échec ne donne aucun bonus', () => {
    start();
    prep('inspire');
    resolveBattleTest({ roll: 95, success: false, sl: -3 });
    expect(mbState().firstRoundBonus).toBe(0);
    expect(mbState().activitiesDone).toContain('inspire');
  });

  it('sa Difficulté est DÉRIVÉE de l’écart de Puissance (l.71), par le canal générique des Activités', () => {
    // Armée alliée devant de +30 → Test plus FACILE ; derrière de −30 → plus DUR. Le Discours n'a pas de
    // porte à lui : c'est l'entrée qui déclare `difficultyFrom`, lue à l'ouverture comme au pré-jet.
    start({ puissanceAlliee: 70, puissanceEnnemie: 40 });
    prep('inspire');
    expect(pending()?.difficulty).toBe('facile');

    start({ puissanceAlliee: 30, puissanceEnnemie: 60 });
    prep('inspire');
    expect(pending()?.difficulty).toBe('tresDifficile');
  });
});

describe('Activités de bataille pré-combat (l.79-106)', () => {
  it('Planification réussie : +10 permanent aux Tests de Puissance ; débloque l\'Infiltration', () => {
    start({}, partyWithWarLore());
    prep('planification');
    expect(pending()?.activityId).toBe('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 3 });
    const mb = mbState();
    expect(mb.modificateurAllie).toBe(10); // Succès (DR 3 < 6) → +10 (l.81)
    expect(mb.planned).toBe(true);
    expect(mb.activitiesDone).toContain('planification');
  });

  it('Planification Stupéfiante (DR ≥ 6) : +20 (l.89)', () => {
    start({}, partyWithWarLore());
    prep('planification');
    resolveBattleTest({ roll: 3, success: true, sl: 6 });
    expect(mbState().modificateurAllie).toBe(20);
  });

  it('Sabotage requiert le Repérage ; réduit la Puissance ennemie de départ (l.104-106)', () => {
    start();
    // Sans Repérage : refusé.
    prep('sabotage');
    expect(pending()).toBeNull();
    // Repérage réussi → `scouted` (Test combiné : full).
    prep('reperage');
    resolveBattleTest({ roll: 10, success: true, sl: 2, success2: true, sl2: 2, combinedLevel: 'full' });
    expect(mbState().scouted).toBe(true);
    // Sabotage maintenant possible : −5 sur la Puissance de DÉPART (wounds.max) ET la courante.
    prep('sabotage');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(armyStartMight(mbState().ennemi)).toBe(50); // 55 − 5
    expect(armyMight(mbState().ennemi)).toBe(50);
  });

  it('Rassembler des forces (l.96) : Stupéfiant → +10 de Puissance de DÉPART (le plafond suit)', () => {
    start({ puissanceAlliee: 50 });
    prep('rassembler-des-forces');
    resolveBattleTest({ roll: 3, success: true, sl: 6 });
    expect(armyStartMight(mbState().allie)).toBe(60);
    expect(armyMight(mbState().allie)).toBe(60);
  });

  it('budget UNIQUE : sans interlude ouvert, AUCUNE préparation possible (Round 1 direct)', () => {
    start({}, partyWithWarLore(), { interludeLeft: 0 });
    expect(banc.getState().interlude).toBeNull();
    prep('inspire');
    expect(pending()).toBeNull();
    prep('planification');
    expect(pending()).toBeNull();
  });
});

describe('Meneur qui ne peut pas tenter (LDB 09 l.30, ADE II 8 l.65, l.116) : refus NOMMÉ, jamais un remplaçant', () => {
  const lastLine = () => banc.getState().journal.slice(-1)[0];
  /** Met un héros hors d'action par la couture des États (LDB 16 l.113). */
  const ko = (h: Combatant): Combatant => { const c = structuredClone(h); addCondition(c, 'inconscient'); return c; };

  it('Planification (soutenable) : le meneur sans Savoir (Guerre) est refusé, budget intact', () => {
    start(); // soldat + chasseur, aucun n'a d'Augmentation en Savoir (Guerre)
    const [a, b] = banc.getState().party;
    prep('planification', a.id);
    expect(pending()).toBeNull();
    expect(lastLine()).toBe(`Aucun Personnage désigné (${a.label}) ne peut tenter « Planification ».`);
    expect([leftOf(a.id), leftOf(b.id)]).toEqual([3, 3]);
  });

  it('Planification : le meneur sans Savoir (Guerre) n’est pas remplacé par celui qui l’a', () => {
    const [soldat, chasseur] = groupeDeScenario(idsDeTest, 'soldat', 'chasseur');
    start({}, [partyWithWarLore([soldat])[0], chasseur]);
    prep('planification', chasseur.id);
    expect(pending()).toBeNull();
    expect(lastLine()).toBe(`Aucun Personnage désigné (${chasseur.label}) ne peut tenter « Planification ».`);
  });

  it('Activité SOLO : le meneur Inconscient n’est pas remplacé (Discours inspirant)', () => {
    const [soldat, chasseur] = groupeDeScenario(idsDeTest, 'soldat', 'chasseur');
    start({}, [ko(soldat), chasseur]);
    prep('inspire', soldat.id);
    expect(pending()).toBeNull();
    expect(lastLine()).toBe(`Aucun Personnage désigné (${soldat.label}) ne peut tenter « Discours inspirant ».`);
  });

  it('Activité COMBINÉE : le meneur hors d’état de la tenter → refus nommé (Repérage)', () => {
    const [soldat, chasseur] = groupeDeScenario(idsDeTest, 'soldat', 'chasseur').map(ko);
    start({}, [soldat, chasseur]);
    prep('reperage', soldat.id);
    expect(pending()).toBeNull();
    expect(lastLine()).toBe(`Aucun Personnage désigné (${soldat.label}) ne peut tenter « Repérage ».`);
  });

  it('Scène de Round : personne en état de la tenter → refus nommé (Motivation)', () => {
    start({ situations: [['motivation']] }, groupeDeScenario(idsDeTest, 'soldat', 'chasseur'), { interludeLeft: 0 });
    banc.setState({ party: banc.getState().party.map(ko) });
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'motivation');
    expect(pending()).toBeNull();
    expect(lastLine()).toBe('Personne dans le groupe ne peut tenter « Motivation ».');
  });
});

describe('Test combiné d\'Activité (l.75/102) — un jet vs deux compétences', () => {
  it('Repérage combiné : full réussit → +10 au bonus de Planification, scouted', () => {
    start();
    prep('reperage');
    const pa = pending()!;
    expect(pa.activityId).toBe('reperage');
    expect(pa.target2).toBeGreaterThan(0); // seconde cible = Test combiné
    resolveBattleTest({ roll: 10, success: true, sl: 3, success2: true, sl2: 2, combinedLevel: 'full' });
    expect(mbState().scouted).toBe(true);
    expect(mbState().planningBonus).toBe(10);
  });

  it('Infiltration combinée : partial (une seule) NE réussit PAS l\'Activité', () => {
    start({}, partyWithWarLore());
    prep('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    prep('infiltration');
    const pa = pending()!;
    expect(pa.activityId).toBe('infiltration');
    expect(pa.target2).toBeGreaterThan(0);
    const modBefore = mbState().modificateurAllie;
    resolveBattleTest({ roll: 40, success: true, sl: 1, success2: false, sl2: -1, combinedLevel: 'partial' });
    expect(mbState().modificateurAllie).toBe(modBefore); // aucun gain
    expect(mbState().activitiesDone).toContain('infiltration');
  });
});

describe('Scènes cinématiques — MULTI-PJ en Soutien (l.116-118)', () => {
  it('deux PJ résolvent deux Scènes ; les deltas se CUMULENT avant le clash', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    const first = pending()!.heroId;
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'compte-a-rebours');
    const second = pending()!.heroId;
    expect(second).not.toBe(first);
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    const mb = mbState();
    expect(armyMight(mb.ennemi)).toBe(55 - 10 - 10); // cumul (−10 Ligne de mire [succès → général tombe], −10 Compte à rebours)
    expect(mb.actedHeroes).toHaveLength(2);
    expect(mb.resolvedScenes).toEqual(expect.arrayContaining(['ligne-de-mire', 'compte-a-rebours']));
  });

  it('une fois tous les PJ engagés, plus aucune Scène de Test ne s\'ouvre', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours', 'motivation']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'compte-a-rebours');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'motivation');
    expect(pending()).toBeNull();
  });

  it('Ligne de mire : le général tombe sur un SUCCÈS (l.208, DR < 6 suffit) → −10', () => {
    start({ situations: [['ligne-de-mire']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    resolveBattleTest({ roll: 10, success: true, sl: 2 }); // succès simple
    expect(armyMight(mbState().ennemi)).toBe(55 - 10); // −5 (succès) −5 (général tombé)
  });

  it('Survol : le général ne tombe (−15) qu\'au Succès Stupéfiant (DR ≥ 6, l.217)', () => {
    start({ situations: [['survol'], ['survol']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'survol');
    resolveBattleTest({ roll: 5, success: true, sl: 2 }); // succès simple : pas d'approche au Corps à corps
    expect(armyMight(mbState().ennemi)).toBe(55 - 5); // −5 seulement, général debout
  });

  it('Survol : Échec Stupéfiant impose une Charge au Round suivant (l.217)', () => {
    start({ situations: [['survol'], ['motivation']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'survol');
    resolveBattleTest({ roll: 3, success: false, sl: -6 });
    expect(mbState().imposed).toContain('charge');
    seedBattleRng(7);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    banc.getState().fenetreValider('batailleDeMasse');
    expect(mbState().situation).toContain('charge');
  });
});

describe('Scène MENACE (Intrus l.219)', () => {
  it('applique −20 aux Tests des autres Scènes et est levée par le combat', () => {
    start({ situations: [['intrus', 'ligne-de-mire']], sceneEncounters: { intrus: 'enc-x' } });
    auRound();
    expect(mbState().activeThreats).toContain('intrus');
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    const pa = pending()!;
    expect(pa.target).toBe(Math.max(1, Math.min(99, pa.skillValue - 20)));
    banc.getState().jetValider('activite');
    const mb = mbState();
    banc.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'intrus', hits: 3, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Sanguinaire', count: 3 }] } as any,
      battle: null,
    });
    banc.getState().fenetreFermer('victoire');
    expect(mbState().activeThreats).not.toContain('intrus');
    expect(mbState().resolvedScenes).toContain('intrus');
  });
});

describe('Enchaînement de Scènes (l.169) : Compte à rebours échoué → Motivation imposée', () => {
  it('impose la Scène de Motivation au Round suivant', () => {
    start({ situations: [['compte-a-rebours'], ['ligne-de-mire']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'compte-a-rebours');
    resolveBattleTest({ roll: 95, success: false, sl: -2 });
    expect(mbState().imposed).toContain('motivation');
    seedBattleRng(7);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    banc.getState().fenetreValider('batailleDeMasse');
    expect(mbState().situation).toContain('motivation');
    expect(mbState().imposed).toEqual([]);
  });
});

describe('Scène de COMBAT — touches ET kills (l.139)', () => {
  it('massBattleTrackHit ne compte que les touches HÉROS → ENNEMI', () => {
    start({ situations: [['charge']] });
    auRound();
    const mb = mbState();
    banc.setState({ massBattle: { ...mb, combatScene: { sceneId: 'charge', hits: 0, hitters: [] } } });
    const hero = { id: 'h1', kind: 'heros', bodyShape: 'biped' } as unknown as Combatant;
    const foe = { id: 'e1', kind: 'ennemi', bodyShape: 'biped' } as unknown as Combatant;
    const other = { id: 'h2', kind: 'heros', bodyShape: 'biped' } as unknown as Combatant;
    const g = banc.getState; const s = banc.setState;
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
    auRound();
    const mb = mbState();
    banc.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'charge', hits: 5, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Mutant', count: 1 }] } as any,
      battle: null,
    });
    banc.getState().fenetreFermer('victoire');
    const after = mbState();
    expect(armyMight(after.ennemi)).toBe(55 - 7);
    expect(after.combatScene).toBeUndefined();
    expect(after.resolvedScenes).toContain('charge');
    expect(banc.getState().screen).toBe('massBattle');
  });
});

describe('Duel (l.225) — vraie Scène de combat + intervention', () => {
  it('solo (1 frappeur) : ennemi −20', () => {
    start({ situations: [['duel']] });
    auRound();
    const mb = mbState();
    banc.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 3, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Général', count: 1 }] } as any,
      battle: null,
    });
    banc.getState().fenetreFermer('victoire');
    expect(armyMight(mbState().ennemi)).toBe(55 - 20);
    expect(mbState().imposed).not.toContain('charge');
  });

  it('intervention (≥ 2 frappeurs) : ennemi −10 + Scène de Charge enchaînée', () => {
    start({ situations: [['duel']] });
    auRound();
    const mb = mbState();
    banc.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 4, hitters: ['h1', 'h2'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Général', count: 1 }] } as any,
      battle: null,
    });
    banc.getState().fenetreFermer('victoire');
    expect(armyMight(mbState().ennemi)).toBe(55 - 10);
    expect(mbState().imposed).toContain('charge');
  });

  it('DÉFAITE du duel (le champion allié perd) → ALLIÉ −20 et la bataille CONTINUE (l.223)', () => {
    start({ situations: [['duel']] });
    auRound();
    const mb = mbState();
    banc.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'duel', hits: 2, hitters: ['h1'] } },
      mode: 'battle', battle: { over: 'defaite', combatants: [] } as any,
    });
    banc.getState().fenetreFermer('repli');
    const after = mbState();
    expect(armyMight(after.allie)).toBe(50 - 20);
    expect(armyMight(after.ennemi)).toBe(55);
    expect(after.phase).toBe('round');
    expect(after.combatScene).toBeUndefined();
    expect(after.resolvedScenes).toContain('duel');
    expect(banc.getState().screen).toBe('massBattle');
    expect(banc.getState().party.every((h) => !h.dead)).toBe(true);
  });
});

describe('Percée (l.173) — vraie Scène de COMBAT + enchaînement sur DÉFAITE', () => {
  it('VICTOIRE : allié +10 (plafonné au départ), pas de Charge imposée', () => {
    start({ situations: [['percee']], sceneEncounters: { percee: 'enc-x' } });
    auRound();
    const mb = mbState();
    banc.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'percee', hits: 4, hitters: ['h1'] } },
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [{ label: 'Garde', count: 3 }] } as any,
      battle: null,
    });
    banc.getState().fenetreFermer('victoire');
    expect(armyMight(mbState().allie)).toBe(Math.min(50 + 10, 50)); // plafonné à la Puissance de départ (l.135)
    expect(mbState().imposed).not.toContain('charge');
  });

  it('DÉFAITE : Scène de Charge imposée au Round suivant (combatLost), bataille continue', () => {
    start({ situations: [['percee'], ['motivation']], sceneEncounters: { percee: 'enc-x' } });
    auRound();
    const mb = mbState();
    banc.setState({
      massBattle: { ...mb, combatScene: { sceneId: 'percee', hits: 1, hitters: ['h1'] } },
      mode: 'battle', battle: { over: 'defaite', combatants: [] } as any,
    });
    banc.getState().fenetreFermer('repli');
    expect(mbState().imposed).toContain('charge');
    expect(armyMight(mbState().allie)).toBe(50);
    expect(mbState().phase).toBe('round');
    seedBattleRng(7);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    banc.getState().fenetreValider('batailleDeMasse');
    expect(mbState().situation).toContain('charge');
  });
});

describe('Tenez votre position (l.161) — Point de rupture + bonus cumulatif', () => {
  it('tenir un Round : Puissance ennemie −2, Scène réimposée', () => {
    start({ situations: [['tenez-votre-position']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'tenez-votre-position');
    const pa = pending()!;
    expect(pa.battle).toBe('round');
    expect(pa.enemyValue).toBeGreaterThan(0); // jet opposé de l'ennemi figé
    resolveBattleTest({ roll: 10, success: true, sl: 3, enemySL: -2 });
    const mb = mbState();
    expect(armyMight(mb.ennemi)).toBe(55 - 2);
    expect(mb.sceneState['tenez-votre-position'].held).toBe(1);
    expect(mb.sceneState['tenez-votre-position'].breakpoint).toBe(0);
    expect(mb.imposed).toContain('tenez-votre-position');
    expect(mb.resolvedScenes).toContain('tenez-votre-position');
  });

  it('le Point de rupture ≥ 10 conclut la Scène par une déroute (plus de réimposition)', () => {
    start({ situations: [['tenez-votre-position']] });
    auRound();
    const mb0 = mbState();
    banc.setState({ massBattle: { ...mb0, sceneState: { 'tenez-votre-position': { breakpoint: 8, held: 2, broken: false } } } });
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'tenez-votre-position');
    resolveBattleTest({ roll: 60, success: false, sl: -1, enemySL: 4 }); // breakpoint 12 ≥ 10 → rupture
    const mb = mbState();
    expect(mb.sceneState['tenez-votre-position'].breakpoint).toBe(12);
    expect(mb.sceneState['tenez-votre-position'].broken).toBe(true);
    expect(mb.imposed).not.toContain('tenez-votre-position');
    expect(armyMight(mb.ennemi)).toBe(55); // pas de −2 : la position n'a pas tenu
  });

  /** Ouvre la Scène de tenue APRÈS `heldRounds` Rounds déjà tenus. L'armée ennemie porte le solde de
   *  ces Rounds (ADE II 8 l.163 : « −2 de Puissance » par Round tenu) et son jet reçoit le bonus
   *  cumulatif de +10 par Round — la fixture est celle d'une partie réelle, pas un `held` posé nu. */
  function openHold(heldRounds: number): PendingActivity {
    start({ situations: [['tenez-votre-position']], puissanceEnnemie: 55 - 2 * heldRounds });
    auRound();
    const mb0 = mbState();
    banc.setState({ massBattle: { ...mb0, sceneState: { 'tenez-votre-position': { breakpoint: 0, held: heldRounds, broken: false } } } });
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'tenez-votre-position');
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
    banc.setState({
      pendingActivity: {
        ...pa0, skillValue: pj.target, target: pj.target, mod: undefined, support: undefined, roll: null,
        ...enemy, enemyRoll: enemyRoll!, skillBase: pj.skillBase ?? pj.target,
      },
    });
    seedBattleRng(SEED);
    banc.getState().jetLancer('activite');
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
    banc.setState({ party: banc.getState().party.map((h) => ({ ...h, conditions: [...(h.conditions ?? []), { id, stacks: 1 }] })) as Combatant[] });
  }

  /** Rouvre la MÊME Scène de tenue dans la partie en cours (pending vidé, Scène non résolue). */
  function reopenHold(): PendingActivity {
    banc.setState({ pendingActivity: null });
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'tenez-votre-position');
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
    banc.setState({ pendingActivity: null });
    const other = banc.getState().party.find((h) => !h.dead && h.id !== suggested)!.id;
    return { suggested, other };
  }

  it('(a) poster un PJ NON suggéré à une Scène de Test → CE PJ (meneur) résout la Scène, seul', () => {
    start({ situations: [['ligne-de-mire']] });
    auRound();
    const { suggested, other } = otherThanSuggested('ligne-de-mire', () => banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire'));
    expect(other).not.toBe(suggested);
    poster('ligne-de-mire', other);
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    const pa = pending()!;
    expect(pa.heroId).toBe(other);
    expect(pa.heroIds).toEqual([other]);
    expect(pa.support).toEqual({ count: 0, bonus: 0, ids: [] });
  });

  it('(a-bis) DEUX PJ postés → SOUTIEN (meneur + assistant), les DEUX consommés', () => {
    start({ situations: [['ligne-de-mire']] });
    auRound();
    const [a, b] = banc.getState().party.map((h) => h.id);
    poster('ligne-de-mire', a, b);
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    const pa = pending()!;
    expect(pa.heroIds).toEqual(expect.arrayContaining([a, b]));
    expect(pa.heroIds).toHaveLength(2);
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(mbState().actedHeroes).toEqual(expect.arrayContaining([a, b]));
    expect(mbState().actedHeroes).toHaveLength(2);
  });

  it('(b) sans affectation → SUGGESTION résout SEUL (pas de soutien)', () => {
    start({ situations: [['ligne-de-mire']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    const pa = pending()!;
    expect(mbState().assignment).toEqual({});
    expect(pa.skillValue).toBeGreaterThan(0);
    expect(pa.support).toEqual({ count: 0, bonus: 0, ids: [] });
    expect(pa.heroIds).toEqual([pa.heroId]);
  });

  it('(c) poster un PJ INDISPONIBLE (déjà engagé) est refusé → repli sur la suggestion', () => {
    start({ situations: [['ligne-de-mire', 'compte-a-rebours']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    const acted = pending()!.heroId;
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(refusDuChoixNomme(banc.getState(), 'batailleDeMasse', 'ajouterAuPoste', 'compte-a-rebours', acted)).toBe(t('choix.refus.valeur'));
    poster('compte-a-rebours', acted);
    expect(mbState().assignment).toEqual({});
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'compte-a-rebours');
    expect(pending()!.heroId).not.toBe(acted);
  });

  it('(d) une Activité combinée n’est pas un poste, et le héros NOMMÉ la mène seul', () => {
    start();
    const [a, b] = banc.getState().party.map((h) => h.id);
    expect(refusDuChoixNomme(banc.getState(), 'batailleDeMasse', 'ajouterAuPoste', 'reperage', a)).toBe(t('choix.refus.valeur'));
    poster('reperage', a);
    expect(mbState().assignment).toEqual({});
    prep('reperage', b);
    const pa = pending()!;
    expect(pa.heroId).toBe(b);
    expect(pa.target2).toBeGreaterThan(0); // Test combiné
    expect(pa.support).toBeUndefined();
  });

  it('un nouveau Round efface les affectations', () => {
    start({ plannedRounds: 2, situations: [['motivation'], ['ligne-de-mire']] });
    auRound();
    poster('motivation', banc.getState().party[0].id);
    expect(Object.keys(mbState().assignment)).toHaveLength(1);
    seedBattleRng(3);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    banc.getState().fenetreValider('batailleDeMasse');
    expect(mbState().assignment).toEqual({});
  });
});

describe('Activité SOUTENABLE — Planification (l.81 : « peut aider au Test »)', () => {
  it('le meneur NOMMÉ + un PJ posté → SOUTIEN (heroIds=2, support.count ≥ 1)', () => {
    start({}, partyWithWarLore());
    const [a, b] = banc.getState().party.map((h) => h.id);
    poster('planification', a, b);
    prep('planification', b);
    const pa = pending()!;
    expect(pa.heroId).toBe(b);
    expect(pa.heroIds).toEqual(expect.arrayContaining([a, b]));
    expect(pa.heroIds).toHaveLength(2);
    expect(pa.support!.count).toBeGreaterThanOrEqual(1);
    expect(pa.support!.bonus).toBeGreaterThanOrEqual(10);
    expect(pa.target2).toBeUndefined(); // Test simple (pas combiné)
  });

  it('en préparation, l’interlude tient la main : la fenêtre de la bataille y poste le Soutien, mais ne s’y termine pas', () => {
    start({}, partyWithWarLore());
    const [a, b] = banc.getState().party.map((h) => h.id);
    expect(fenetreDuJeu(banc.getState())?.cle).toBe('interlude');
    expect(refusDuChoixNomme(banc.getState(), 'batailleDeMasse', 'ajouterAuPoste', 'planification', a)).toBeNull();
    poster('planification', a);
    banc.getState().fenetreChoisir('batailleDeMasse', 'retirerDuPoste', 'planification', a);
    poster('planification', b);
    expect(mbState().assignment).toEqual({ planification: [b] });
    banc.getState().fenetreFermer('batailleDeMasse');
    expect(banc.getState().massBattle).not.toBeNull();
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('jet.ferme.preparationDeBataille'));
    banc.getState().fenetreValider('batailleDeMasse');
    expect([mbState().phase, banc.getState().journal.slice(-1)[0]]).toEqual(['prep', t('jet.ferme.preparationDeBataille')]);
  });

  it('aucun autre PJ posté → meneur SEUL', () => {
    start({}, partyWithWarLore());
    const [a] = banc.getState().party.map((h) => h.id);
    prep('planification', a);
    const pa = pending()!;
    expect(pa.heroId).toBe(a);
    expect(pa.heroIds).toEqual([a]);
    expect(pa.support).toEqual({ count: 0, bonus: 0, ids: [] });
  });

  it('une Activité SOLO (Repérage) n’est pas un poste et reste solo — pas de Soutien', () => {
    start();
    const [a, b] = banc.getState().party.map((h) => h.id);
    poster('reperage', a, b);
    expect(mbState().assignment).toEqual({});
    const meneur = meneurCapable('reperage');
    prep('reperage', meneur);
    const pa = pending()!;
    expect(pa.activityId).toBe('reperage');
    expect(pa.support).toBeUndefined();
    expect(pa.heroId).toBe(meneur);
  });

  // #257 — RAW muet (LDB 12 l.189 « apporter son soutien » / ADE II 8 l.81) : le coût d'Activité de
  // l'assistant est un arbitrage éditable (flag `interlude-assister-coute-un-creneau`, policy.ts).
  it('assistant GRATUIT par défaut : seul le meneur perd un créneau', () => {
    resetRule('interlude-assister-coute-un-creneau');
    start({}, partyWithWarLore());
    const [a, b] = banc.getState().party.map((h) => h.id);
    poster('planification', a, b);
    prep('planification', b);
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(leftOf(a)).toBe(3); // l'assistant : gratuit
    expect(leftOf(b)).toBe(2); // le meneur nommé, lui, a bien payé
  });

  it('flag activé : chaque assistant doté d’un créneau en dépense un', () => {
    setRule('interlude-assister-coute-un-creneau', true);
    try {
      start({}, partyWithWarLore());
      const [a, b] = banc.getState().party.map((h) => h.id);
      poster('planification', a, b);
      prep('planification', a);
      resolveBattleTest({ roll: 10, success: true, sl: 2 });
      expect(leftOf(a)).toBe(2); // meneur : −1
      expect(leftOf(b)).toBe(2); // assistant : −1 aussi
    } finally {
      resetRule('interlude-assister-coute-un-creneau');
    }
  });
});

describe('Rassemblement (ADE II 8 l.122)', () => {
  /** Ouvre un Round avec le premier PJ à 1 Blessure, puis déclenche le Rassemblement. */
  function rallyBlesse() {
    start({ situations: [['motivation']] });
    const party = banc.getState().party.map((h, i) => i === 0 ? blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 1 } }) : h);
    banc.setState({ party });
    banc.setState({ massBattle: { ...mbState(), phase: 'round', awaitingNext: true }, screen: 'massBattle' });
    banc.getState().fenetreChoisir('batailleDeMasse', 'rallier', true);
    const pa = pending()!;
    expect(pa.activityId).toBe('rassemblement');
    const hero = banc.getState().party.find((h) => h.id === pa.heroId)!;
    return { pa, hero, be: bonus(effectiveChar(hero, 'endurance')) };
  }

  it('Test réussi : le PJ regagne EXACTEMENT DR + Bonus d’Endurance Blessures', () => {
    const { pa, hero, be } = rallyBlesse();
    const sl = 3;
    expect(be).toBeGreaterThan(0); // le pré-tiré a bien un BE — sinon la somme ne mesurerait que le DR
    expect(1 + sl + be).toBeLessThanOrEqual(hero.wounds.max); // sous le plafond : la somme est lisible telle quelle
    resolveBattleTest({ roll: 10, success: true, sl });
    expect(banc.getState().party.find((h) => h.id === pa.heroId)!.wounds.current).toBe(1 + sl + be);
    expect(mbState().ralliedHeroes).toContain(pa.heroId);
  });

  it('Test échoué : aucune Blessure regagnée, et le PJ a consommé son Rassemblement du Round', () => {
    const { pa } = rallyBlesse();
    resolveBattleTest({ roll: 90, success: false, sl: -2 });
    expect(banc.getState().party.find((h) => h.id === pa.heroId)!.wounds.current).toBe(1);
    expect(mbState().ralliedHeroes).toContain(pa.heroId);
  });

  it('le soin est BORNÉ par le maximum de Blessures', () => {
    const { pa, hero, be } = rallyBlesse();
    const sl = hero.wounds.max; // DR délibérément énorme : 1 + DR + BE dépasse le plafond
    expect(1 + sl + be).toBeGreaterThan(hero.wounds.max);
    resolveBattleTest({ roll: 1, success: true, sl });
    expect(banc.getState().party.find((h) => h.id === pa.heroId)!.wounds.current).toBe(hero.wounds.max);
  });

  it('« tous les Personnages » (l.122) : un PJ NON blessé ouvre aussi son Rassemblement', () => {
    start({ situations: [['motivation']] });
    banc.setState({ massBattle: { ...mbState(), phase: 'round', awaitingNext: true }, screen: 'massBattle' });
    const premier = banc.getState().party[0];
    expect(premier.wounds.current).toBe(premier.wounds.max);
    banc.getState().fenetreChoisir('batailleDeMasse', 'rallier', true);
    expect(pending()?.activityId).toBe('rassemblement');
    expect(pending()?.heroId).toBe(premier.id);
  });
});

describe('Budget PARTAGÉ (C2b) — ADE II 8 l.65 : « comme à l\'accoutumée, ils ne peuvent participer qu\'à un maximum de trois Activités »', () => {
  it('une préparation de bataille DÉCRÉMENTE `interlude.perHero.left` (budget UNIQUE)', () => {
    start({}, partyWithWarLore());
    const hero = banc.getState().party[0].id;
    expect(leftOf(hero)).toBe(3);
    prep('planification', hero);
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(leftOf(hero)).toBe(2); // une Activité de préparation = une Activité d'interlude
  });

  it('un héros ne peut faire que 3 Activités AU TOTAL (mix prépa bataille + interlude normale) — la 4ᵉ est REFUSÉE', () => {
    // GROUPE À UN SEUL HÉROS : son budget d'interlude (3) est le SEUL budget de préparation → l'épuiser
    // épuise toute la préparation (le budget est UNIQUE, l.65). Repérage réussi débloque le Sabotage.
    start({}, partyWithWarLore(groupeDeScenario(idsDeTest, 'soldat')));
    const [hero] = banc.getState().party.map((h) => h.id);
    expect(leftOf(hero)).toBe(3);

    // Activité #1 : préparation de bataille (Planification) → left 3→2.
    prep('planification');
    resolveBattleTest({ roll: 10, success: true, sl: 2 });
    expect(leftOf(hero)).toBe(2);

    // Activité #2 : préparation de bataille (Repérage) → left 2→1, débloque le Sabotage.
    prep('reperage');
    resolveBattleTest({ roll: 10, success: true, sl: 2, success2: true, sl2: 2, combinedLevel: 'full' });
    expect(leftOf(hero)).toBe(1);
    expect(mbState().scouted).toBe(true);

    // Activité #3 : Activité d'interlude NORMALE (Revenus) → left 1→0.
    pratiquer(banc.getState, hero, 'revenus');
    const pa = pending()!;
    expect(pa.battle).toBeUndefined(); // Activité d'interlude ordinaire (pas de bataille)
    banc.setState({ pendingActivity: { ...pa, roll: 50, success: true, sl: 1 } });
    banc.getState().jetValider('activite');
    expect(leftOf(hero)).toBe(0);

    // 4ᵉ Activité : budget épuisé → la préparation de bataille (Sabotage) est REFUSÉE (l.65).
    prep('sabotage');
    expect(pending()).toBeNull();
    // …et une Activité d'interlude normale l'est aussi (source de budget UNIQUE), refus dit.
    pratiquer(banc.getState, hero, 'revenus');
    expect(pending()).toBeNull();
    expect(banc.getState().journal.slice(-1)[0]).toBe(`${banc.getState().party[0].label} n’a plus d’Activité d’interlude.`);
  });

  it('les Scènes de Round (`battle === \'round\'`) ne consomment PAS le budget d\'interlude', () => {
    start({ situations: [['ligne-de-mire']] });
    const hero = banc.getState().party[0].id;
    poster('ligne-de-mire', hero);
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
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
    auRound();
    seedBattleRng(7);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    const mb = mbState();
    expect(mb.awaitingNext).toBe(true);
    expect(mb.round).toBe(1);
    expect(armyMight(mb.allie)).toBeLessThanOrEqual(50 - 5);
    expect(armyMight(mb.ennemi)).toBeLessThanOrEqual(55 - 5);
  });

  it('la validation de la bataille passe au Round suivant et réinitialise l\'état par-Round', () => {
    start({ plannedRounds: 2, situations: [['motivation'], ['ligne-de-mire']] });
    auRound();
    seedBattleRng(3);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    banc.getState().fenetreValider('batailleDeMasse');
    const mb = mbState();
    expect(mb.round).toBe(2);
    expect(mb.awaitingNext).toBe(false);
    expect(mb.resolvedScenes).toEqual([]);
    expect(mb.actedHeroes).toEqual([]);
    expect(mb.situation).toEqual(['ligne-de-mire']);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    expect(mbState().phase).toBe('over');
  });

  it('une armée réduite à 0 est détruite immédiatement', () => {
    start({ plannedRounds: 5, puissanceEnnemie: 5 });
    auRound();
    seedBattleRng(9);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    const mb = mbState();
    expect(armyMight(mb.ennemi)).toBe(0);
    expect(mb.phase).toBe('over');
    expect(mb.outcome).toBe('allie');
  });
});

describe('Modèle Combattant-armée (Blessures = Puissance)', () => {
  it('l\'armée est un Combattant INANIMÉ : PB courantes = Puissance, PB max = départ, inerte', () => {
    start({ puissanceAlliee: 50, puissanceEnnemie: 55 });
    const ally = mbState().allie.combatant;
    expect(ally.wounds.current).toBe(50);
    expect(ally.wounds.max).toBe(50);
    expect(ally.inert).toBe(true);
    expect(ally.psychImmune).toBe(true);
  });

  it('un gain de Scène est plafonné NATURELLEMENT à la Puissance de départ (l.135)', () => {
    start({ puissanceAlliee: 50, situations: [['motivation']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'motivation');
    resolveBattleTest({ roll: 10, success: true, sl: 4 }); // +4 tenté, déjà à 50/50
    expect(armyMight(mbState().allie)).toBe(50);
  });

  it('après une perte, un gain de Scène ne remonte pas au-delà du départ', () => {
    start({ puissanceAlliee: 50, plannedRounds: 3, situations: [['motivation'], ['motivation']] });
    auRound();
    seedBattleRng(7);
    banc.getState().fenetreChoisir('batailleDeMasse', 'engager', true);
    const afterClash = armyMight(mbState().allie);
    expect(afterClash).toBeLessThan(50);
    banc.getState().fenetreValider('batailleDeMasse');
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'motivation');
    resolveBattleTest({ roll: 10, success: true, sl: 6 });
    expect(armyMight(mbState().allie)).toBeLessThanOrEqual(50);
    expect(armyMight(mbState().allie)).toBeGreaterThan(afterClash);
  });
});

describe('Aléa & fermeture', () => {
  /** La bataille sans interlude : le Round 1 s'ouvre sur son écran, où la fenêtre tient la main. */
  const enRound = () => start({}, undefined, { interludeLeft: 0 });

  it('l’aléa `null` tire le facteur environnemental au RNG de la partie : même graine, même facteur (ADE II 08 l.309)', () => {
    const tire = (): string | undefined => {
      enRound();
      seedBattleRng(41);
      banc.getState().fenetreChoisir('batailleDeMasse', 'alea', null);
      return mbState().hazard?.label;
    };
    const premier = tire();
    expect(BATTLE_HAZARDS.map((h) => h.label)).toContain(premier);
    expect(tire()).toBe(premier);
  });

  it('le facteur se choisit par l’id de sa ligne (`fenetreChoisir`, ADE II 08 l.309)', () => {
    enRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'alea', 'peur');
    expect(mbState().hazard?.label).toBe('Peur');
  });

  it.each([
    ['un id hors de la table', () => banc.getState().fenetreChoisir('batailleDeMasse', 'alea', 'grele'), () => t('choix.refus.valeur')],
    ['un choix sur l’aléa déjà posé', () => banc.getState().fenetreChoisir('batailleDeMasse', 'alea', 'tempete'), () => t('mbf.aleaDejaPose', { label: 'Peur' })],
    ['un tirage sur l’aléa déjà posé', () => banc.getState().fenetreChoisir('batailleDeMasse', 'alea', null), () => t('mbf.aleaDejaPose', { label: 'Peur' })],
  ] as const)('refuse et le dit : %s', (_cas, geste, raison) => {
    enRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'alea', 'peur');
    geste();
    expect([mbState().hazard?.label, banc.getState().journal.slice(-1)[0]]).toEqual(['Peur', raison()]);
  });

  it('coop : le choix de l’aléa est à l’hôte, refusé à l’invité, dans son état comme à la route', () => {
    enRound();
    banc.setState({ net: { ...initialNet(), mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: {}, slots: [0, 1, 0, 0] } });
    const args = ['batailleDeMasse', 'alea', 'peur'];
    expect([intentAllowedFor(banc.getState(), 0, 'fenetreChoisir', args), intentAllowedFor(banc.getState(), 1, 'fenetreChoisir', args)]).toEqual([true, false]);
    banc.setState({ net: { ...banc.getState().net, mode: 'invite', mySeat: 1 } });
    expect(refusDuChoixNomme(banc.getState(), 'batailleDeMasse', 'alea', 'peur')).toBe(t('choix.refus.hoteSeul'));
  });

  it('refuse et le dit : un tirage hors Round', () => {
    start();
    banc.getState().fenetreChoisir('batailleDeMasse', 'alea', null);
    expect([mbState().hazard, banc.getState().journal.slice(-1)[0]]).toEqual([undefined, t('mbf.aleaHorsRound')]);
  });

  it('la sortie de la bataille de masse la ferme', () => {
    start({}, groupeDeScenario(idsDeTest, 'soldat', 'chasseur'), { interludeLeft: 0 });
    banc.getState().fenetreFermer('batailleDeMasse');
    expect(banc.getState().massBattle).toBeNull();
  });

  it('la sortie de la bataille de masse REFUSE de clore sous un Test de bataille en cours, en le nommant (#1906)', () => {
    start({ situations: [['motivation']] }, groupeDeScenario(idsDeTest, 'soldat', 'chasseur'), { interludeLeft: 0 });
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'motivation');
    const pa = pending()!;
    expect(pa?.battle, 'un Test de Scène est ouvert').toBeTruthy();
    banc.getState().fenetreFermer('batailleDeMasse');
    expect(banc.getState().massBattle, 'le Test lit la bataille jusqu’à son issue').not.toBeNull();
    expect(pending()).toEqual(pa);
    expect(banc.getState().journal.slice(-1)[0]).toBe(`Le Test « ${pa.label} » est en cours : terminez-le avant de clore la bataille.`);
  });
});

describe('Flux `activity` — défauts RAW corrigés (combiné partiel · Menace · tenue +1 DR)', () => {
  /** Dote le héros ACTEUR du pending courant de points de ressource (Chance/Résilience). */
  function grant(res: { fortune?: number; resilience?: number }) {
    const id = pending()!.heroId;
    banc.setState({ party: banc.getState().party.map((h) => (h.id === id ? { ...h, ...res } : h)) });
  }

  it('(i) Test combiné PARTIEL : la Chance est OFFERTE (`failed` regarde le NIVEAU, pas skill-1)', () => {
    start();
    prep('reperage');
    const pa0 = pending()!;
    expect(pa0.target2).toBeGreaterThan(0); // vrai Test combiné
    // skill-1 réussie, skill-2 ratée → `partial` = ÉCHEC GLOBAL RAW (LDB 12 l.202-206).
    banc.setState({ pendingActivity: { ...pa0, roll: 40, success: true, sl: 1, success2: false, sl2: -1, combinedLevel: 'partial' } });
    grant({ fortune: 1 });
    seedBattleRng(99);
    banc.getState().jetRelancer('activite');
    expect(pending()!.rerolled).toBe(true); // `failed` true pour un partiel → la relance de Chance a lieu
  });

  it('(i-bis) Test combiné PARTIEL : la Résilience le RATTRAPE en `full` (garde forcé = activityWon)', () => {
    start();
    prep('reperage');
    const pa0 = pending()!;
    banc.setState({ pendingActivity: { ...pa0, roll: 40, success: true, sl: 1, success2: false, sl2: -1, combinedLevel: 'partial' } });
    grant({ resilience: 1 });
    banc.getState().jetForcerLaReussite('activite');
    const pa = pending()!;
    expect(pa.combinedLevel).toBe('full');
    expect(pa.success2).toBe(true);
  });

  it('(i-ter) Test combiné FULL : la Résilience ne dépense RIEN (déjà gagné)', () => {
    start();
    prep('reperage');
    const pa0 = pending()!;
    banc.setState({ pendingActivity: { ...pa0, roll: 10, success: true, sl: 2, success2: true, sl2: 2, combinedLevel: 'full' } });
    grant({ resilience: 1 });
    const id = pending()!.heroId;
    banc.getState().jetForcerLaReussite('activite');
    expect(banc.getState().party.find((h) => h.id === id)!.resilience).toBe(1); // non dépensée (activityWon → null)
  });

  it('(ii) Scène sous MENACE : le 1ᵉʳ jet CONSERVE la cible pré-cuite (mod −20 non relâché)', () => {
    start({ situations: [['intrus', 'ligne-de-mire']], sceneEncounters: { intrus: 'enc-x' } });
    auRound();
    expect(mbState().activeThreats).toContain('intrus');
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'ligne-de-mire');
    const pa0 = pending()!;
    expect(pa0.mod).toBe(-20); // pénalité de Menace Intrus (l.219)
    expect(pa0.target).toBe(Math.max(1, Math.min(99, pa0.skillValue - 20))); // mod fondu par l'opener
    seedBattleRng(5);
    banc.getState().jetLancer('activite');
    expect(pending()!.target).toBe(pa0.target); // la résolution NE l'écrase PAS par une cible sans mod
  });

  it('(iii) Tenez votre position + Chance « +1 DR » : `success` reste cohérent avec `enemySL`', () => {
    start({ situations: [['tenez-votre-position']] });
    auRound();
    banc.getState().fenetreChoisir('batailleDeMasse', 'scene', 'tenez-votre-position');
    const pa0 = pending()!;
    expect(pa0.enemyValue).toBeGreaterThan(0); // jet ennemi opposé figé
    // DR de l'ennemi RECALCULÉ de son d100 figé : le pending est calé DESSUS (l'ennemi mène de 3 DR
    // avant la Chance). Un `enemySL` forgé sans lien avec `enemyRoll`/`enemyValue` ne serait jamais relu.
    const enemySL0 = evaluateTest(pa0.enemyRoll!, pa0.enemyValue!).sl;
    const pjSL = enemySL0 - 3;
    // PJ « réussi » numériquement (roll ≤ cible) MAIS l'ennemi l'emporte à l'opposition (enemySL 3 > 0).
    banc.setState({ pendingActivity: { ...pa0, roll: 20, target: 50, sl: pjSL, success: false, enemySL: 3 } });
    grant({ fortune: 1 });
    banc.getState().jetAjouterUnDR('activite');
    const pa = pending()!;
    expect(pa.sl).toBe(pjSL + 1);
    expect(pa.enemySL).toBe(2); // +1 DR au PJ → −1 au DR net de l'ennemi
    expect(pa.success).toBe(pa.enemySL! <= 0); // success RE-DÉRIVÉ de la marge (pas du jet numérique)
    expect(pa.success).toBe(false); // l'ennemi tient encore le dessus (enemySL 2 > 0)
  });
});
