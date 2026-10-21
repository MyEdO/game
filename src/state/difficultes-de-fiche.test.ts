import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import { aiApproachPlan, approachFearTrigger, checkFocusInterruption, computeRunReach, displayedReach, openCombatEndCascade } from '../noyau/combatFlow';
import { applyEffects } from '../noyau/combatEffects';
import { buildApi } from './devtools';
import { mountUp } from '../noyau/mount';
import type { Pt } from '../noyau/monde/path';
import { chooseEnemyAction, type EnemyTurnInput } from '../noyau/monde/ai';
import { gainCorruption } from '../noyau/corruptionFlow';
import { fleeTouche } from '../noyau/pendings';
import { planJump } from '../noyau/monde/jumpMove';
import { testValue } from '../engine/skills';
import { clampTarget, rollTest } from '../engine/tests';
import { makeRNG } from '../engine/dice';
import { resolveRun } from '../engine/movement';
import { t } from '../i18n';
import { DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';
import { refLabel, regles } from '../data';
import { setDataset } from '../data/overrides';
import { testDeRegle } from '../engine/reglesChiffrees';
import { FICHE_DE_TEST, poserFicheDeTest, restaurerFiche, testDeFiche, testDuJeu } from './ficheDeTest.testkit';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { draineCascade } from './cascade.testkit';

/**
 * CÂBLAGE des Tests nommés (#2779, #1173) : la compétence et la Difficulté d'un Test que nomme une règle
 * sont LUES dans sa fiche (`regles.json`, `tests`) par l'ouvreur réel, qui les pose sur le pending ou
 * l'étape ; le jet applique celles du pending. La fiche est posée par le seam (`setDataset('regles', …)`)
 * avec, pour CHAQUE Test, une compétence et une Difficulté autres que celles du jeu : un ouvreur qui
 * écrit l'une ou l'autre en dur rougit ici.
 */
const cible = (c: Combatant, regle: keyof typeof FICHE_DE_TEST, cle: string) => {
  const [skill, d] = (FICHE_DE_TEST[regle] as Record<string, [string, Difficulty]>)[cle];
  return clampTarget(testValue(c, skill) + DIFFICULTY_MODIFIERS[d]).target;
};

const g = () => useGame.getState();

function heros(): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1, talentsRolled: false });
  for (const k of ['agilite', 'force-mentale', 'endurance'] as const) h.characteristics[k] = 70;
  return h;
}

/** Combat de la scène de test, tour du héros, rien d'engagé. */
function auCombat(): { H: Combatant; E: Combatant } {
  useGame.setState({ party: [heros()], pendingRun: null, pendingApproach: null, pendingDisengage: null, pendingCascade: null });
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 15, y: 10 };
  H.engagedWith = [];
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, acted: false, movementUsed: 0, movedPreAction: false } });
  return { H, E };
}

/** Le scénario `entrainement` (le banc de la recette : un cheval allié libre), au Tour de Wilhelmina,
 *  Mouvement intact. `dejaEnSelle` : en selle avant son Tour (`mountUp`, comme une rencontre qui pose un
 *  cavalier), sinon le cheval attend à une case. */
function enSelle({ dejaEnSelle = true } = {}): { R: Combatant; monture: Combatant } {
  buildApi().scenario('entrainement', 1);
  if (!g().battle) g().startCombat('enc-entrainement');
  if (g().pendingRoundStart) g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const monture = b.combatants.find((c) => c.mountable)!;
  const R = b.combatants.find((c) => c.id === 'pregen-707')!;
  R.pos = { x: monture.pos!.x + 1, y: monture.pos!.y };
  if (dejaEnSelle) mountUp(R, monture);
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(R.id), action: null, acted: false, movementUsed: 0, movedPreAction: false, runBudget: null } });
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
    vi.useFakeTimers();
    poserFicheDeTest();
    useGame.setState({ battle: null, journal: [], pendingCorruption: null, pendingRenounce: null, corruptionQueue: [], pendingFall: null });
    g().seedRng(4);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    restaurerFiche();
  });

  it('Course : `battleRun` pose le Test de `course`, `runRoll` le jette', () => {
    const { H } = auCombat();
    g().battleRun({ x: 16, y: 10 });
    expect(g().pendingRun!.test).toMatchObject(testDeFiche('course', 'courir'));
    g().runRoll();
    expect(g().pendingRun!.result!.target).toBe(cible(H, 'course', 'courir'));
  });

  it('Course d’un cavalier : le clic de case au-delà de la Marche, Course armée, ouvre le Test de `course` sur Chevaucher (LDB 14 l.179), Difficulté de la fiche', () => {
    const { R } = enSelle();
    const cible = caseDeCourse();
    g().battleClickTile(cible, { courseArmee: true });
    g().battleClickTile(cible, { courseArmee: true });
    expect(g().pendingRun, 'la Course s’ouvre').toMatchObject({ combatantId: R.id, dest: cible });
    expect(g().pendingRun!.test).toMatchObject({ skill: { id: 'chevaucher' }, difficulty: testDeFiche('course', 'courir').difficulty });
  });

  it('Course d’un cavalier qui vient de monter : « Monter » a pris le Mouvement du Tour, la case de Course est refusée et le refus le dit', () => {
    const { R, monture } = enSelle({ dejaEnSelle: false });
    g().battleMount(monture.id);
    expect(g().battle!.combatants.find((c) => c.id === R.id)!.mountId).toBe(monture.id);
    g().battleClickTile({ x: R.pos!.x + 9, y: R.pos!.y }, { courseArmee: true });
    expect(g().pendingRun).toBeNull();
    expect(g().refus?.texte).toBe(t('cs.refusMouvementEpuise'));
  });

  it('Chute volontaire : `fallAcross` pose le Test de `chute`, `fallRoll` le jette', () => {
    const s = emptyScene('scene-test', 4, 4);
    s.layers[0].height = Array.from({ length: 16 }, (_, i) => (i === 2 ? 4 : 0));
    const hero = heros();
    useGame.setState({ party: [hero], mode: 'exploration', partyPos: { x: 2, y: 0 }, scene: s, pendingCascade: null });
    g().fallAcross({ x: 2, y: 0 }, { x: 2, y: 1 });
    expect(g().pendingFall!.test).toMatchObject(testDeFiche('chute', 'tenter'));
    g().fallChoose(hero.id, true);
    g().fallRoll(hero.id);
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

  it('Fuite : `disengageFlee` pose le Test de `fuite` sur le slot du fuyard, `fleeRoll` le jette', () => {
    const { H, E } = auCombat();
    E.characteristics['capacite-de-combat'] = 90;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    useGame.setState({
      battle: { ...g().battle! },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    g().disengageFlee();
    expect(fleeTouche(g().pendingDisengage!)!.test).toMatchObject(testDeFiche('fuite', 'touche-en-fuyant'));
    g().fleeRoll(H.id);
    expect(fleeTouche(g().pendingDisengage!)!.jet!.target).toBe(cible(H, 'fuite', 'touche-en-fuyant'));
  });

  it('Se rapprocher d’une Peur, clic-sol : le Test `se-rapprocher`, posé puis jeté', () => {
    const { H, E } = auCombat();
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    useGame.setState({ battle: { ...g().battle!, reachable: new Map([['11,10', 1]]) } });
    g().battleClickTile({ x: 11, y: 10 }, { confirm: true });
    expect(g().pendingApproach!.test).toMatchObject(testDeFiche('calme-d-approche', 'se-rapprocher'));
    g().approachRoll();
    expect(g().pendingApproach!.result!.target).toBe(cible(H, 'calme-d-approche', 'se-rapprocher'));
  });

  it('Se rapprocher d’une Peur, charge : le même Test `se-rapprocher`', () => {
    const { H, E } = auCombat();
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    E.pos = { x: 13, y: 10 };
    g().battleClickEntity(E.id, { confirm: true, approche: true });
    expect(g().pendingApproach!.test).toMatchObject(testDeFiche('calme-d-approche', 'se-rapprocher'));
  });

  it('La source de Peur se rapproche : la rangée du craintif porte le Test `source-se-rapproche`', () => {
    const { H, E } = auCombat();
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    approachFearTrigger(g, useGame.setState, E, { x: 15, y: 10 }, { x: 12, y: 10 });
    const rangee = g().pendingCascade!.participants.find((s) => s.kind === 'triggeredBatchTest')!.participants!.find((p) => p.id === H.id)!;
    const { skill, difficulty } = testDeFiche('calme-d-approche', 'source-se-rapproche');
    expect({ skillId: rangee.skillId, difficulty: rangee.difficulty }).toEqual({ skillId: skill.id, difficulty });
  });

  it('Focalisation interrompue : l’étape porte le Test de `interruption-de-focalisation`', () => {
    const { H } = auCombat();
    H.focus = { spell: 'armure-aethyrique', dr: 3 };
    checkFocusInterruption(g, useGame.setState, H);
    const etape = g().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const { skill, difficulty } = testDeFiche('interruption-de-focalisation', 'maintenir');
    expect({ rollLabel: etape.rollLabel, difficulty: etape.difficulty }).toEqual({ rollLabel: refLabel('skills', skill), difficulty });
  });

  it('Exposition d’un effet de scène : le Test de `influences-corruptrices` à la clé choisie, posé puis jeté', () => {
    const hero = heros();
    useGame.setState({ party: [hero] });
    applyEffects(g, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', heroId: hero.id }]);
    expect(g().pendingCorruption).toMatchObject({ nature: 'physique', test: testDeFiche('influences-corruptrices', 'physique') });
    g().corruptionSetNature('spirituelle');
    expect(g().pendingCorruption).toMatchObject({ nature: 'spirituelle', test: testDeFiche('influences-corruptrices', 'spirituelle') });
    g().corruptionRoll();
    expect(g().pendingCorruption!.target).toBe(cible(hero, 'influences-corruptrices', 'spirituelle'));
  });

  it('Exposition d’une Activité d’interlude : le même Test de `influences-corruptrices`', () => {
    const hero = heros();
    hero.items = [...(hero.items ?? []), { uid: 'art1', name: 'Amulette étrange', kind: 'trapping', qualities: [], enc: 0, equipped: false, identified: false } as never];
    useGame.setState({ party: [hero], interlude: null, bank: [], pendingOrders: [], pendingActivity: null });
    g().startScene(testScene());
    vi.clearAllTimers();
    useGame.setState({ worldMap: { id: 'w', label: 'Monde', places: [{ id: 'altdorf', label: 'Altdorf', pos: { x: 50, y: 50 }, scene: testScene().id }], routes: [] } });
    g().startInterlude(3);
    draineCascade(g);
    const itl = g().interlude!;
    itl.perHero[hero.id] = { ...itl.perHero[hero.id], fx: undefined, left: 3 };
    useGame.setState({ interlude: { ...itl } });
    g().interludeActivity(hero.id, 'tester-objets-magiques', { itemUid: 'art1' });
    g().activityRoll();
    useGame.setState({ pendingActivity: { ...g().pendingActivity!, roll: 98, success: false, sl: -5 } });
    g().activityConfirm();
    expect(g().pendingCorruption).toMatchObject({ nature: 'physique', test: testDeFiche('influences-corruptrices', 'physique') });
  });

  it('Exposition de fin de combat : la rangée porte le Test de `influences-corruptrices`', () => {
    const { H, E } = auCombat();
    E.traits = [...(E.traits ?? []), { id: 'corruption', arg: 'Mineure' }] as Combatant['traits'];
    openCombatEndCascade(g, useGame.setState);
    const bande = g().pendingCascade!.participants.find((s) => s.kind === 'combatEndCorruption')!;
    const rangee = bande.participants!.find((p) => p.id === H.id)!;
    const { skill, difficulty } = testDeFiche('influences-corruptrices', 'physique');
    expect({ label: rangee.label, difficulty: rangee.difficulty }).toEqual({ label: refLabel('skills', skill), difficulty });
  });

  it('Course de l’IA : `aiApproachPlan` jette le Test de `course`', () => {
    const scene = emptyScene('s', 30, 21);
    const C = (kind: 'hero' | 'enemy', id: string, x: number): Combatant => ({ id, name: id, label: id, kind, pos: { x, y: 10 }, movement: 4,
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
      conditions: [], skills: [{ id: 'esquive', characteristic: 'agilite', advances: 25 }], wounds: { current: 10, max: 10 }, advantage: 0, engagedWith: [], psychState: [] }) as unknown as Combatant;
    const [jeuSkill, jeuDiff] = testDuJeu('course', 'courir');
    const [skill, d] = FICHE_DE_TEST.course.courir;
    const ecarts = { competence: 0, difficulte: 0 };
    for (let graine = 1; graine <= 30; graine++) {
      const enemy = C('enemy', 'e', 2);
      const input: EnemyTurnInput = { enemy, heroes: [C('hero', 'h', 25)], scene, blocked: new Set(['25,10']), movement: 4, spells: [] };
      const budget = (s: string, x: Difficulty) => 4 + resolveRun(testValue(enemy, s), x, 4, makeRNG(graine)).bonusCases;
      expect(aiApproachPlan(input, enemy, chooseEnemyAction(input), makeRNG(graine)).ran?.budget, `graine ${graine}`).toBe(budget(skill, d));
      if (budget(jeuSkill, d) !== budget(skill, d)) ecarts.competence++;
      if (budget(skill, jeuDiff) !== budget(skill, d)) ecarts.difficulte++;
    }
    expect(ecarts.competence * ecarts.difficulte, 'les graines départagent compétence et Difficulté').toBeGreaterThan(0);
    const plan = (mountId?: string) => {
      const enemy = { ...C('enemy', 'e', 2), ...(mountId ? { mountId } : {}) };
      const input: EnemyTurnInput = { enemy, heroes: [C('hero', 'h', 25)], scene, blocked: new Set(['25,10']), movement: 4, spells: [] };
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
    const reussit = (graine: number, s: string, x: Difficulty) => rollTest(testValue(E, s), x, makeRNG(graine)).success;
    const ecarts = { competence: 0, difficulte: 0 };
    for (let graine = 1; graine <= 60; graine++) {
      E.corruption = 99;
      g().seedRng(graine);
      const lignes = gainCorruption(g, useGame.setState, E, 1);
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
    useGame.setState({ party: [hero] });
    gainCorruption(g, useGame.setState, hero, 1);
    expect(g().pendingCorruption).toMatchObject({ kind: 'seuil', test: testDeFiche('corrompu', 'contenir') });
    g().corruptionRoll();
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
