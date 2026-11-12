import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { emptyScene, type Scene } from './monde/scene';
import { aiApproachPlan, approachFearTrigger, checkFocusInterruption, computeRunReach, displayedReach, openCombatEndCascade } from './combatFlow';
import { applyEffects } from './combatEffects';
import { lancerLeScenario } from './lancementDeScenario';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { mountUp } from './mount';
import type { Pt } from './monde/path';
import { chooseEnemyAction, type EnemyTurnInput } from './monde/ai';
import { gainCorruption } from './corruptionFlow';
import { fleeTouche } from './pendings';
import { planJump } from './monde/jumpMove';
import { testValue } from '../engine/skills';
import { clampTarget, rollTest } from '../engine/tests';
import { makeRNG } from '../engine/dice';
import { resolveRun } from '../engine/movement';
import { t } from '../i18n';
import { DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';
import { refLabel, regles } from '../data';
import { setDataset } from '../data/overrides';
import { testDeRegle } from '../engine/reglesChiffrees';
import { FICHE_DE_TEST, poserFicheDeTest, restaurerFiche, testDeFiche, testDuJeu } from '../engine/ficheDeTest.testkit';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { draineCascade } from './cascade.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';
import { pratiquer } from './interlude.testkit';

/**
 * CÂBLAGE des Tests nommés (#2779, #1173) : la compétence et la Difficulté d'un Test que nomme une règle
 * sont LUES dans sa fiche (`regles.json`, `tests`) par l'ouvreur réel, qui les pose sur le pending ou
 * l'étape ; le jet applique celles du pending. La fiche est posée par le seam (`setDataset('regles', …)`)
 * avec, pour CHAQUE Test, une compétence et une Difficulté autres que celles du jeu : un ouvreur qui
 * écrit l'une ou l'autre en dur rougit ici.
 */
const cible = (c: Combatant, regle: keyof typeof FICHE_DE_TEST, cle: string) => {
  const [skill, d] = (FICHE_DE_TEST[regle] as Record<string, [string, Difficulty]>)[cle];
  return clampTarget(testValue(c, { skill: { id: skill } }) + DIFFICULTY_MODIFIERS[d]).target;
};

let banc: Banc;
const g = () => banc.getState();

function heros(): Combatant {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1, talentsRolled: false });
  for (const k of ['agilite', 'force-mentale', 'endurance'] as const) h.characteristics[k] = 70;
  return h;
}

/** Combat de la scène de test, tour du héros, rien d'engagé. */
function auCombat(): { H: Combatant; E: Combatant } {
  banc.setState({ party: [heros()], pendingRun: null, pendingApproach: null, pendingDisengage: null, pendingCascade: null });
  g().lancerLaScene(testScene());
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const E = b.combatants.find((c) => c.kind === 'ennemi')!;
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 15, y: 10 };
  H.engagedWith = [];
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, acted: false, movementUsed: 0, movedPreAction: false } });
  return { H, E };
}

/** Le scénario `entrainement` (le banc de la recette : un cheval allié libre), au Tour de du Sorcier,
 *  Mouvement intact. `dejaEnSelle` : en selle avant son Tour (`mountUp`, comme une rencontre qui pose un
 *  cavalier), sinon le cheval attend à une case. */
function enSelle({ dejaEnSelle = true } = {}): { R: Combatant; monture: Combatant } {
  lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((sc) => sc.id === 'entrainement')!, idsDeTest));
  if (!g().battle) g().lancerLeCombat('enc-entrainement');
  if (g().pendingRoundStart) g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const monture = b.combatants.find((c) => c.mountable)!;
  const R = b.combatants.find((c) => c.id === 'sorcier-de-test')!;
  R.pos = { x: monture.pos!.x + 1, y: monture.pos!.y };
  if (dejaEnSelle) mountUp(R, monture);
  banc.setState({ battle: { ...b, turn: b.order.indexOf(R.id), action: null, acted: false, movementUsed: 0, movedPreAction: false, runBudget: null } });
  return { R, monture };
}

/** Une case que la Course atteint et que la Marche n'atteint pas. */
function caseDeCourse(): Pt {
  const marche = displayedReach(g);
  const cle = [...computeRunReach(g).keys()].find((k) => !marche.has(k));
  if (!cle) throw new Error('aucune case de Course hors Marche sur la scène de test');
  const [x, y] = cle.split(',').map(Number);
  return { x, y };
}

describe('Tests nommés — compétence et Difficulté de la fiche, posées par l’ouvreur réel', () => {
  beforeEach(() => {
    banc = ouvrirLeBanc();
    poserFicheDeTest();
    banc.setState({ battle: null, journal: [], pendingCorruption: null, pendingRenounce: null, corruptionQueue: [], pendingFall: null });
    g().ensemencerLeTirage(4);
  });
  afterEach(() => {
    banc.abandonner();
    restaurerFiche();
  });

  it('Course : `ouvrirLaCourse` pose le Test de `course`, `jetLancer@course` le jette', () => {
    const { H } = auCombat();
    g().ouvrirLaCourse({ x: 16, y: 10 });
    expect(g().pendingRun!.test).toMatchObject(testDeFiche('course', 'courir'));
    g().jetLancer('course');
    expect(g().pendingRun!.result!.target).toBe(cible(H, 'course', 'courir'));
  });

  it('Course d’un cavalier : le clic de case au-delà de la Marche, Course armée, ouvre le Test de `course` sur Chevaucher (LDB 14 l.179), Difficulté de la fiche', () => {
    const { R } = enSelle();
    const cible = caseDeCourse();
    g().cliquerLaCase(cible, undefined, { intentionId: 'course' });
    g().cliquerLaCase(cible, undefined, { intentionId: 'course' });
    expect(g().pendingRun, 'la Course s’ouvre').toMatchObject({ combatantId: R.id, dest: cible });
    expect(g().pendingRun!.test).toMatchObject({ skill: { id: 'chevaucher' }, difficulty: testDeFiche('course', 'courir').difficulty });
  });

  it('Course d’un cavalier qui vient de monter : « Monter » a pris le Mouvement du Tour, la Course vient en plus (LDB 15 l.41) et s’ouvre sur Chevaucher', () => {
    const { R, monture } = enSelle({ dejaEnSelle: false });
    g().monterEnSelle(monture.id);
    expect(g().battle!.combatants.find((c) => c.id === R.id)!.mountId).toBe(monture.id);
    expect(displayedReach(g).size, 'témoin : la Marche est épuisée').toBe(0);
    const [cle] = [...computeRunReach(g)].sort((a, b) => b[1] - a[1])[0];
    const [x, y] = cle.split(',').map(Number);
    const cible = { x, y };
    g().cliquerLaCase(cible, undefined, { intentionId: 'course' });
    g().cliquerLaCase(cible, undefined, { intentionId: 'course' });
    expect(g().pendingRun, 'la Course s’ouvre').toMatchObject({ combatantId: R.id, dest: cible });
    expect(g().pendingRun!.test).toMatchObject({ skill: { id: 'chevaucher' } });
  });

  it('Chute volontaire : `franchirLArete` pose le Test de `chute`, `jetLancer@chute` le jette', () => {
    const s = emptyScene('scene-test', 4, 4);
    s.layers[0].height = Array.from({ length: 16 }, (_, i) => (i === 2 ? 4 : 0));
    const hero = heros();
    banc.setState({ party: [hero], mode: 'exploration', partyPos: { x: 2, y: 0 }, scene: s, pendingCascade: null });
    g().franchirLArete({ x: 2, y: 1 });
    expect(g().pendingFall!.test).toMatchObject(testDeFiche('chute', 'tenter'));
    g().jetRegler('chute', 'tenter', true, hero.id);
    g().jetLancer('chute', hero.id);
    expect(g().pendingFall!.participants[0].result!.target).toBe(cible(hero, 'chute', 'tenter'));
  });

  it('Saut : le Test du plan est celui de `saut` à la clé de l’élan', () => {
    const s: Scene = emptyScene('scene-test', 5, 3);
    s.layers.push({ z: 1, tiles: Array.from({ length: 15 }, (_, i) => (i % 5 === 2 ? 'vide' : 'plancher')), height: Array.from({ length: 15 }, (_, i) => (i % 5 === 2 ? 0 : 4)) });
    for (const [elan, cle] of [[0, 'sans-elan'], [2, 'avec-elan']] as const) {
      const plan = planJump(s, { x: 1, y: 1, z: 1 }, { x: 3, y: 1, z: 1 }, 4, elan);
      expect(plan.kind === 'test' && (plan.flow as Extract<Flow, { kind: 'test' }>).test, cle).toMatchObject(testDeFiche('saut', cle));
    }
  });

  it('Fuite : `jetRegler(\'desengagement\', \'fuir\')` pose le Test de `fuite` sur le slot du fuyard, `jetLancer@fuite` le jette', () => {
    const { H, E } = auCombat();
    E.characteristics['capacite-de-combat'] = 90;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    banc.setState({
      battle: { ...g().battle! },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choix', atk: null, def: null, result: null },
    });
    g().jetRegler('desengagement', 'fuir', true);
    expect(fleeTouche(g().pendingDisengage!)!.test).toMatchObject(testDeFiche('fuite', 'touche-en-fuyant'));
    g().jetLancer('fuite', H.id);
    expect(fleeTouche(g().pendingDisengage!)!.jet!.target).toBe(cible(H, 'fuite', 'touche-en-fuyant'));
  });

  it('Se rapprocher d’une Peur, clic-sol : le Test `se-rapprocher`, posé puis jeté', () => {
    const { H, E } = auCombat();
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    banc.setState({ battle: { ...g().battle!, reachable: new Map([['11,10', 1]]) } });
    g().cliquerLaCase({ x: 11, y: 10 }, undefined, { confirm: true });
    expect(g().pendingApproach!.test).toMatchObject(testDeFiche('calme-d-approche', 'se-rapprocher'));
    g().jetLancer('approche');
    expect(g().pendingApproach!.result!.target).toBe(cible(H, 'calme-d-approche', 'se-rapprocher'));
  });

  it('Se rapprocher d’une Peur, charge : le même Test `se-rapprocher`', () => {
    const { H, E } = auCombat();
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    E.pos = { x: 13, y: 10 };
    cliquerSurLeCombattant(g, E.id, { confirm: true, intentionId: 'charge' });
    expect(g().pendingApproach!.test).toMatchObject(testDeFiche('calme-d-approche', 'se-rapprocher'));
  });

  it('La source de Peur se rapproche : la rangée du craintif porte le Test `source-se-rapproche`', () => {
    const { H, E } = auCombat();
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    approachFearTrigger(g, banc.setState, E, { x: 15, y: 10 }, { x: 12, y: 10 });
    const rangee = g().pendingCascade!.participants.find((s) => s.kind === 'testDeclencheEnBande')!.participants!.find((p) => p.id === H.id)!;
    const { skill, difficulty } = testDeFiche('calme-d-approche', 'source-se-rapproche');
    expect({ skill: rangee.skill, difficulty: rangee.difficulty }).toEqual({ skill, difficulty });
  });

  it('Focalisation interrompue : l’étape porte le Test de `interruption-de-focalisation`', () => {
    const { H } = auCombat();
    H.focus = { spell: 'armure-aethyrique', dr: 3 };
    checkFocusInterruption(g, banc.setState, H);
    const etape = g().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    const { skill, difficulty } = testDeFiche('interruption-de-focalisation', 'maintenir');
    expect({ rollLabel: etape.rollLabel, difficulty: etape.difficulty }).toEqual({ rollLabel: refLabel('skills', skill), difficulty });
  });

  it('Exposition d’un effet de scène : le Test de `influences-corruptrices` à la clé choisie, posé puis jeté', () => {
    const hero = heros();
    banc.setState({ party: [hero] });
    applyEffects(g, banc.setState, [{ type: 'corruptionExposure', level: 'mineure', heroId: hero.id }]);
    expect(g().pendingCorruption).toMatchObject({ nature: 'physique', test: testDeFiche('influences-corruptrices', 'physique') });
    g().jetRegler('corruption', 'nature', 'spirituelle');
    expect(g().pendingCorruption).toMatchObject({ nature: 'spirituelle', test: testDeFiche('influences-corruptrices', 'spirituelle') });
    g().jetLancer('corruption');
    expect(g().pendingCorruption!.target).toBe(cible(hero, 'influences-corruptrices', 'spirituelle'));
  });

  it('Exposition d’une Activité d’interlude : le même Test de `influences-corruptrices`', () => {
    const hero = heros();
    hero.items = [...(hero.items ?? []), { uid: 'art1', name: 'Amulette étrange', kind: 'trapping', qualities: [], enc: 0, equipped: false, identified: false } as never];
    hero.skills.push({ id: 'recherche', characteristic: 'intelligence', advances: 5 }); // le Test de Recherche se tente (LDB 09 l.30)
    banc.setState({ party: [hero], interlude: null, bank: [], pendingOrders: [], pendingActivity: null });
    g().lancerLaScene(testScene());
    banc.abandonner();
    banc.setState({ worldMap: { id: 'w', label: 'Monde', places: [{ id: 'altdorf', label: 'Altdorf', pos: { x: 50, y: 50 }, scene: { id: testScene().id } }], routes: [] }, lieu: 'altdorf' });
    g().ouvrirLInterlude(3);
    draineCascade(g);
    const itl = g().interlude!;
    itl.perHero[hero.id] = { ...itl.perHero[hero.id], fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
    pratiquer(g, hero.id, 'tester-objets-magiques', { itemUid: 'art1' });
    g().jetLancer('activite');
    banc.setState({ pendingActivity: { ...g().pendingActivity!, roll: 98, success: false, sl: -5 } });
    g().jetValider('activite');
    expect(g().pendingCorruption).toMatchObject({ nature: 'physique', test: testDeFiche('influences-corruptrices', 'physique') });
  });

  it('Exposition de fin de combat : la rangée porte le Test de `influences-corruptrices`', () => {
    const { H, E } = auCombat();
    E.traits = [...(E.traits ?? []), { id: 'corruption', arg: 'mineure' }] as Combatant['traits'];
    openCombatEndCascade(g, banc.setState);
    const bande = g().pendingCascade!.participants.find((s) => s.kind === 'corruptionDeFinDeCombat')!;
    const rangee = bande.participants!.find((p) => p.id === H.id)!;
    const { skill, difficulty } = testDeFiche('influences-corruptrices', 'physique');
    expect({ label: rangee.label, difficulty: rangee.difficulty }).toEqual({ label: refLabel('skills', skill), difficulty });
  });

  it('Course de l’IA : `aiApproachPlan` jette le Test de `course`', () => {
    const scene = emptyScene('s', 30, 21);
    const C = (kind: 'heros' | 'ennemi', id: string, x: number): Combatant => (blessuresSurLeProfil({ id, name: id, label: id, kind, pos: { x, y: 10 }, movement: 4,
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
      conditions: [], skills: [{ id: 'esquive', characteristic: 'agilite', advances: 25 }], wounds: blessuresDeBase(10), advantage: 0, engagedWith: [], psychState: [] })) as unknown as Combatant;
    const [jeuSkill, jeuDiff] = testDuJeu('course', 'courir');
    const [skill, d] = FICHE_DE_TEST.course.courir;
    const ecarts = { competence: 0, difficulte: 0 };
    for (let graine = 1; graine <= 30; graine++) {
      const enemy = C('ennemi', 'e', 2);
      const input: EnemyTurnInput = { enemy, heroes: [C('heros', 'h', 25)], scene, blocked: new Set(['25,10']), movement: 4, spells: [] };
      const budget = (s: string, x: Difficulty) => 4 + resolveRun(testValue(enemy, { skill: { id: s } }), x, 4, makeRNG(graine)).bonusCases;
      expect(aiApproachPlan(input, enemy, chooseEnemyAction(input), makeRNG(graine)).ran?.budget, `graine ${graine}`).toBe(budget(skill, d));
      if (budget(jeuSkill, d) !== budget(skill, d)) ecarts.competence++;
      if (budget(skill, jeuDiff) !== budget(skill, d)) ecarts.difficulte++;
    }
    expect(ecarts.competence * ecarts.difficulte, 'les graines départagent compétence et Difficulté').toBeGreaterThan(0);
    const plan = (mountId?: string) => {
      const enemy = { ...C('ennemi', 'e', 2), ...(mountId ? { mountId } : {}) };
      const input: EnemyTurnInput = { enemy, heroes: [C('heros', 'h', 25)], scene, blocked: new Set(['25,10']), movement: 4, spells: [] };
      return aiApproachPlan(input, enemy, chooseEnemyAction(input), makeRNG(1)).ran?.test.skill;
    };
    expect(plan(), 'la compétence que le journal nomme').toEqual(testDeFiche('course', 'courir').skill);
    expect(plan('monture'), 'cavalier : LDB 14 l.179').toEqual({ id: 'chevaucher' });
  });

  it('Seuil « Corrompu » d’un PNJ : le repli auto-résolu jette le Test de `corrompu`', () => {
    const { E } = auCombat();
    E.characteristics.agilite = 50;
    E.characteristics.endurance = 85;
    const [jeuSkill, jeuDiff] = testDuJeu('corrompu', 'contenir');
    const [skill, d] = FICHE_DE_TEST.corrompu.contenir;
    const reussit = (graine: number, s: string, x: Difficulty) => rollTest(testValue(E, { skill: { id: s } }), x, makeRNG(graine)).success;
    const ecarts = { competence: 0, difficulte: 0 };
    for (let graine = 1; graine <= 60; graine++) {
      E.corruption = 99;
      g().ensemencerLeTirage(graine);
      const lignes = gainCorruption(g, banc.setState, E, 1);
      expect(g().pendingCorruption).toBeNull();
      expect(lignes.some((l) => String(l).includes(t('cor.contained', { name: E.label }))), `graine ${graine}`).toBe(reussit(graine, skill, d));
      if (reussit(graine, jeuSkill, d) !== reussit(graine, skill, d)) ecarts.competence++;
      if (reussit(graine, skill, jeuDiff) !== reussit(graine, skill, d)) ecarts.difficulte++;
    }
    expect(ecarts.competence * ecarts.difficulte, 'les graines départagent compétence et Difficulté').toBeGreaterThan(0);
  });

  it('Seuil « Corrompu » : le Test de `corrompu`, posé puis jeté', () => {
    const hero = heros();
    hero.corruption = 99;
    banc.setState({ party: [hero] });
    gainCorruption(g, banc.setState, hero, 1);
    expect(g().pendingCorruption).toMatchObject({ kind: 'seuil', test: testDeFiche('corrompu', 'contenir') });
    g().jetLancer('corruption');
    expect(g().pendingCorruption!.target).toBe(cible(hero, 'corrompu', 'contenir'));
  });
});

describe('fiche de test — l’origine se lit à la pose (modules partagés entre fichiers)', () => {
  const regleCourse = () => regles.find((r) => r.id === 'course')!;
  const testDeCourse = () => testDeRegle('course', 'courir');

  it('posée puis restaurée : la fiche du livre revient', () => {
    poserFicheDeTest();
    expect(testDeCourse()).toMatchObject(testDeFiche('course', 'courir'));
    restaurerFiche();
  });

  it('un test qui ne pose rien, après un test qui pose, lit la fiche du livre (LDB 15 l.41)', () => {
    expect(testDeCourse()).toMatchObject({ skill: { id: 'athletisme' }, difficulty: 'accessible' });
  });

  it('une fiche déjà reposée par un autre fichier est celle que la restauration rend', () => {
    const livre = structuredClone([...regles]);
    const autre = livre.map((r) => (r.id === 'course'
      ? { ...r, tests: r.tests!.map((x) => ({ ...x, test: { ...x.test, difficulty: 'facile' as const } })) }
      : r));
    try {
      setDataset('regles', autre);
      poserFicheDeTest();
      restaurerFiche();
      expect(regleCourse().tests![0].test.difficulty).toBe('facile');
    } finally {
      setDataset('regles', livre);
    }
  });
});
