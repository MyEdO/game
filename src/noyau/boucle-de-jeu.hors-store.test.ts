/**
 * La boucle de jeu au banc du noyau : scène, combat, avancement par PX, fouille et butin, consommables, Chance,
 * Détermination, munitions, Destin et Résilience, horloge, marchand. Ce que le store web y ajoute (clavier, curseur,
 * caméra, vue, inspection, gardes d'une partie à l'autre) se joue en `src/state/store.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseQualityInstance } from '../engine/qualities/normalize';
import { resetFields } from './stateFields';
import { acheterAuPanier } from './marchand.testkit';
import type { BattleState } from './etat';
import { avanceEtapeCascade, draineCascade, cascadeDeTest } from './cascade.testkit';
import { flowFromEffects, testFlow } from './monde/flow';
import { flowEffects, EMPTY_FLOW } from '../engine/flowCore';
import { buildAdvancementView } from './monde/advancement';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { emptyScene, type ActionAuthoree } from './monde/scene';
import { actionsDe, cleActionJouee } from './monde/usable';
import { DIFFICULTY_MODIFIERS, type Combatant, type ItemInstance, type Weapon } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';
import { CAP_GROUPE, capDuGroupe } from './monde/combatants';
import { fleeBackstab, fleeTouche } from './pendings';
import { applyAttackResult, computeMoveReach } from './combatFlow';
import { mountUp } from './mount';
import { combatValue, resolveMeleePassive } from '../engine/combat';
import { seedBattleRng } from './battleRng';
import type { AttackResult } from '../engine/combat';
import { campaignStart, MINUTES_PER_DAY } from '../engine/clock';
import { setRule, resetRule } from '../engine/policy';
import { loadWeapon, unloadWeapon, setReloadProgress, recomputeLoadout, itemFromTrappingById } from '../engine/items';
import { garanti } from '../lib/garanti';
import { loadRegister, weaponLoaded, reloadProgressOf } from '../engine/weaponLoad';
// L'état de charge vit sur l'ARME (chaque arme à distance gère son
// rechargement et sa munition) — raccourci de FIXTURE vers l'arme à distance du combattant.
const rangedOf = (c: Combatant): Weapon => c.weapons.find((w) => w.type === 'ranged')!;
import { FLOWS } from './rollFlowSpecs';
import { TIME_COST } from '../engine/timeCost';
import { toBrass, type Money } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { ensureBourse, bourseInstanceOf, withBourseMoney } from '../engine/bourse';
import { talentConcrete } from '../data';
import { baseWithTalents } from '../engine/talentEffects';
import { entityPickables, OPS_DIFFEREES, applyEffects, applyEffectsLoot, runFlow } from './combatEffects';
import { t } from '../i18n';
import { ligneDe } from '../engine/modLine.testkit';
import { refDeRegle } from '../engine/reglesChiffrees';
import { makeRNG } from '../engine/dice';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { poserLeGroupe } from './marcheDuGroupe';
import { combattantDeTest, blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { blessuresPosees } from '../engine/characteristics';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
});

/** Seede la Bourse d'un héros (défaut 'h', bénéficiaire des tests marchand) — la monnaie est portée par
 *  chaque héros (SOCLE POSSESSIONS §8, #531), donc un montant de test s'installe via `creditBourse`. */
function seedBourse(m: Money, id = 'h') {
  creditBourse(banc.getState, banc.setState, id, m);
}

function reset() {
  banc.setState({
    screen: 'menu',
    party: [],
    scene: null,
    mode: 'exploration',
    partyPos: { x: 0, y: 0 },
    flags: {},
    journal: [],
    dialogue: null,
    battle: null,
    pendingTest: null,
    pendingAttack: null,
    pendingDefense: null,
    pendingDisengage: null,
    pendingCast: null,
    pendingHeal: null,
    pendingRoundStart: null,
    pendingFateSave: null,
    pendingReload: null,
    pendingCascade: null,
    pendingLoot: null,
    pendingAppraise: null,
    document: null,
    merchant: null,
    merchantStocks: {},
  });
}

/** Résout la cascade de fin de combat (Tests de maladie et `influences-corruptrices`, influençables, ouverte AVANT
 *  l'écran de victoire quand un héros survivant est conscient et a affronté des créatures corrompues /
 *  porte un marqueur de maladie). Lance chaque étape puis valide, jusqu'à `finishCombatEnd` → victoire. */
function drainCombatEndCascade() {
  for (let guard = 0; guard < 30 && banc.getState().pendingCascade?.combatEndBoundary; guard++) avanceEtapeCascade(banc.getState);
}

describe('Boucle de jeu (store)', () => {
  beforeEach(() => {
    banc.abandonner(); // purge tout timer fuité d'un test précédent (startCombat arme maybeRunEnemyTurn)
    reset();
  });
  afterEach(() => {
    banc.abandonner(); // les setTimeout d'IA (resumeEnemyTurn, attackThenAdvance) ne fuient pas vers le test suivant
  });

  it('charge une scène et place le groupe au départ', () => {
    banc.getState().startScene(testScene());
    const st = banc.getState();
    expect(st.scene?.id).toBe('test-fixture');
    expect(st.partyPos).toEqual({ x: 6, y: 10 });
    expect(st.mode).toBe('exploration');
  });

  it('persiste Blessures + critiques + États persistants vers le groupe en fin de combat (victoire)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner(); // purge le timer d'IA armé par startCombat — on pilote l'ordre nous-mêmes

    const b = banc.getState().battle!;
    // Héros blessé + 1 État persistant + 1 transitoire + 1 critique ; tous les ennemis hors de combat.
    const combatants = b.combatants.map((c) =>
      c.kind === 'hero'
        ? blessuresSurLeProfil({ ...c, wounds: { ...c.wounds, current: 4 }, criticalWounds: 1,
            conditions: [{ id: 'hemorragique', value: 2 }, { id: 'surpris', value: 1 }] })
        : { ...c, dead: true },
    );
    const heroId = combatants.find((c) => c.kind === 'hero')!.id;
    const enemyIds = combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    // Ordre = ennemis puis héros ; on se place juste AVANT le héros pour que le prochain tour soit le sien
    // (évite un franchissement de Round, donc pas de tick Hémorragique pendant le test).
    const order = [...enemyIds, heroId];
    banc.setState({ battle: { ...b, combatants, order, turn: order.length - 2 } });

    banc.getState().battleEndTurn(); // → advanceTurn → prochain acteur = héros → checkBattleOver → cascade de fin de combat
    drainCombatEndCascade(); // mutants Corrompus → Test `influences-corruptrices` influençable AVANT victoire → on le résout

    const st = banc.getState();
    expect(st.battle?.over).toBe('victory');
    const h = st.party[0];
    expect(h.wounds.current).toBe(4);                                              // Blessures persistées
    expect(h.criticalWounds).toBe(1);                                             // critiques persistés
    expect(h.conditions.find((x) => x.id === 'hemorragique')?.value).toBe(2);    // persistant conservé
    expect(h.conditions.some((x) => x.id === 'surpris')).toBe(false);            // transitoire jeté
  });

  // ── Déviation Critique côté JOUEUR (LDB 63 l.30-32) : suspend re-entrant + choix Dévier/Subir ──
  // Un héros encaisse un Coup Critique à une localisation armurée → applyAttackResult SUSPEND
  // (étape de séquence 'deviation', AUCUN effet de bord) ; la décision rejoue l'application UNE seule fois.
  function mkDeviationSetup() {
    seedBattleRng(424242); // table des Critiques déterministe (branche « Subir »)
    const chars = { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
    const enemy = combattantDeTest({
      id: 'e1', label: 'Brute', kind: 'enemy', characteristics: chars, wounds: blessuresDeBase(20),
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 1, y: 0 },
      size: 'moyenne', weapons: [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
    });
    const hero = combattantDeTest({
      id: 'h1', label: 'Hardi', kind: 'hero', characteristics: chars, wounds: blessuresDeBase(15),
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 0, y: 0 },
      size: 'moyenne', weapons: [], items: [], criticalWounds: 0, fate: 0,
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 },
    });
    const battle: BattleState = {
      combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ battle, mode: 'battle' });
    const weapon: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
    const res: AttackResult = {
      hit: true, attackerRoll: 12, netSL: 4, location: 'corps', damage: 8, woundsLost: 3,
      // LDB 18 l.53-55 : un Coup Critique RE-TIRE la localisation (#80) ; on la PINNE à corps (le seul
      // emplacement blindé du héros) pour un test déterministe — la Déviation (LDB 63 l.30-32) sacrifie 1 PA
      // « à la localisation » du Critique, donc à corps. Sans pin, le re-tirage tomberait sur un emplacement nu.
      critLocation: 'corps',
      critical: true, advantageTo: null, defenderDefeated: false, log: 'Coup Critique (corps)',
    };
    const suspended = applyAttackResult(banc.getState, banc.setState, enemy, hero, weapon, res);
    return { enemy, hero, weapon, res, suspended };
  }

  /** L'étape UNIQUE de la Blessure critique (#1426) — le dé de sévérité s'y lance, PUIS les voies s'y
   *  tranchent. Rend l'étape relue (le pli post-dé y a posé le Critique et sa révélation). */
  function joueLaSeverite() {
    const st = banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(st, 'une seule étape porte le tirage ET la décision').toHaveLength(1);
    banc.getState().jetRoll('cascadeTirage', st[0].id);
    return banc.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!;
  }

  it('Blessure critique (héros) : applyAttackResult SUSPEND sur UNE étape — tirage puis décision, sans effet de bord', () => {
    const { suspended } = mkDeviationSetup();
    expect(suspended).toBe(OPS_DIFFEREES);
    const avant = banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(avant).toHaveLength(1);
    expect(avant[0].table, 'la sévérité se tire DANS cette fenêtre').toBeTruthy();
    expect(avant[0].table!.result, 'le dé n’est pas encore tombé').toBeUndefined();
    const dev = joueLaSeverite();
    expect(dev.deviation?.targetId).toBe('h1');
    expect(dev.reveal?.kind).toBe('critical'); // panneau riche porté par l'étape, sous la ligne de dé
    // Avant le choix : ni Blessure, ni Critique, ni PA consommée (early-return propre).
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(h.wounds.current).toBe(15);
    expect(h.criticalWounds ?? 0).toBe(0);
    expect(h.armour.corps).toBe(3);
  });

  it('Blessure critique (héros) : « Dévier » sacrifie 1 PA et IGNORE le Critique', () => {
    mkDeviationSetup();
    const dev = joueLaSeverite();
    banc.getState().jetRegler('cascade', 'choix', 'devier', dev.id);
    banc.getState().jetConfirm('cascade'); // valide le choix → applier 'deviation' → resolveDeviation
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(h.armour.corps).toBe(2);          // 1 PA sacrifiée (LDB 63 l.30-32)
    expect(h.criticalWounds ?? 0).toBe(0);   // Coup Critique ignoré
  });

  it('Blessure critique (héros) : « Subir » encaisse le Critique (criticalWounds +1, PA intacte)', () => {
    mkDeviationSetup();
    const dev = joueLaSeverite();
    banc.getState().jetRegler('cascade', 'choix', 'subir', dev.id);
    banc.getState().jetConfirm('cascade');
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(h.criticalWounds ?? 0).toBe(1);   // Coup Critique appliqué (table 18-Traumatisme)
    expect(h.armour.corps).toBe(3);          // PA intacte (rien dévié)
  });

  // ── Phase A — le JET d'attaque est l'ÉTAPE 0 de la séquence ──
  // L'attaque ouvre un pendingCascade purpose 'combat' dont l'étape 0 (`jet:'attack'`) est rendue par
  // CascadeModal via useAttackJetProps ; ses conséquences s'empilent DANS la même séquence (une fenêtre).
  function mkAttackSeq(res: AttackResult) {
    seedBattleRng(20260615);
    const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
    const hero = combattantDeTest({
      id: 'h1', label: 'Hardi', kind: 'hero', characteristics: chars, wounds: blessuresDeBase(15),
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 0, y: 0 },
      size: 'moyenne', weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }], items: [], fate: 0,
    });
    const enemy = combattantDeTest({
      id: 'e1', label: 'Brute', kind: 'enemy', important: true, characteristics: chars, wounds: blessuresDeBase(40),
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [], engagedWith: [], pos: { x: 1, y: 0 },
      size: 'moyenne', weapons: [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [], criticalWounds: 0,
    });
    const battle: BattleState = {
      combatants: [hero, enemy], order: [hero.id, enemy.id], baseOrder: [hero.id, enemy.id],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({
      battle, mode: 'battle',
      pendingAttack: { attackerId: 'h1', targetId: 'e1', location: null, result: res },
      pendingCascade: cascadeDeTest([{ id: 'attack-jet', kind: 'attackJet', jet: 'attack', actorId: 'h1' }], { title: 'Attaque', icon: 'action/attack', purpose: 'combat' }),
    });
  }

  it('Attaque (jet = étape 0) : une touche simple clôt la séquence (jet seul → resume)', () => {
    mkAttackSeq({ hit: true, attackerRoll: 23, netSL: 2, location: 'corps', damage: 5, woundsLost: 3, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'Touché' });
    banc.getState().jetConfirm('attack');
    expect(banc.getState().pendingAttack).toBeNull();
    expect(banc.getState().pendingCascade).toBeNull(); // aucune conséquence empilée → séquence finalisée
  });

  it('Attaque (jet = étape 0) : un Coup Critique s’empile DANS la même séquence (pas de 2ᵉ fenêtre)', () => {
    mkAttackSeq({ hit: true, attackerRoll: 24, netSL: 4, location: 'corps', critLocation: 'corps', damage: 9, woundsLost: 4, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'Coup Critique' });
    banc.getState().jetConfirm('attack');
    const seq = banc.getState().pendingCascade;
    expect(seq?.purpose).toBe('combat');
    expect(seq?.participants[0]?.jet).toBe('attack');                          // le jet reste l'étape 0
    expect(seq?.participants.some((s) => s.kind === 'critical')).toBe(true);   // conséquence INLINE, même séquence
    expect(banc.getState().pendingAttack).toBeNull();
  });

  // ── Phase C2a — qualité d'outil sur les Tests HORS COMBAT (Pratique/Peu Fiable/Bâclé) ──
  it('Effect.test : outil résolu par trappingId (id catalogue) vers pendingTest.itemUid', () => {
    const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 55, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
    const hero = combattantDeTest(blessuresSurLeProfil({
      id: 'h1', label: 'Lest', kind: 'hero', characteristics: chars, wounds: blessuresDeBase(10),
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      // tool = 'marteau' (id catalogue) ; l'item porte trappingId: 'marteau' → match par id
      items: [{ uid: 't1', label: 'Marteau', trappingId: 'marteau', kind: 'trapping', qualities: [{ id: 'pratique' }], enc: 0, equipped: false }],
    }) as never);
    banc.setState({ party: [hero] });
    runFlow(banc.getState, banc.setState, testFlow({ characteristic: 'dexterite', tool: 'marteau', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = banc.getState().pendingTest!;
    expect(pt.itemUid).toBe('t1');
    expect(pt.isDouble).toBe(false); // amorcé à false (pas encore lancé)
  });

  it('Effect.test : outil résolu par trappingId (2e objet catalogue, id ≠ label)', () => {
    const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 55, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
    const hero = combattantDeTest(blessuresSurLeProfil({
      id: 'h1', label: 'Lest', kind: 'hero', characteristics: chars, wounds: blessuresDeBase(10),
      advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      // tool = 'outils-de-crochetage' (id catalogue) ; l'item porte trappingId → match par id, ≠ label 'Rossignols'
      items: [{ uid: 't2', label: 'Rossignols', trappingId: 'outils-de-crochetage', kind: 'trapping', qualities: [], enc: 0, equipped: false }],
    }) as never);
    banc.setState({ party: [hero] });
    runFlow(banc.getState, banc.setState, testFlow({ characteristic: 'dexterite', tool: 'outils-de-crochetage', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(banc.getState().pendingTest!.itemUid).toBe('t2');
  });

  it('jetRoll@test peuple pendingTest.isDouble (booléen, pour la casse Bâclé)', () => {
    const hero = combattantDeTest({
      id: 'h1', label: 'Lest', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 50, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
    });
    banc.setState({
      party: [hero],
      pendingTest: {
        actorId: 'h1', actorName: 'Lest', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 0, target: 50, roll: null, success: false, sl: 0, isDouble: undefined,
        onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW,
      },
    });
    banc.getState().jetRoll('test');
    expect(typeof banc.getState().pendingTest!.isDouble).toBe('boolean');
  });

  // jetConfirm('test') avec outil : pendingTest injecté à la main (RNG hors combat non seedable → déterministe).
  function mkToolTest(quality: string, over: Partial<import('../noyau/pendings').PendingTest>): Combatant {
    const hero = combattantDeTest({
      id: 'h1', label: 'Lest', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 50, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [{ uid: 't1', label: 'Outil', kind: 'melee', qualities: quality ? [parseQualityInstance(quality)!] : [], enc: 0, equipped: false }],
    });
    banc.setState({
      party: [hero], flags: {}, journal: [],
      pendingTest: {
        actorId: 'h1', actorName: 'Lest', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 1, target: 50, roll: 48, success: false, sl: 0, isDouble: false, itemUid: 't1',
        onSuccess: flowFromEffects([{ type: 'setFlag', flag: 'reussi', value: true }]),
        onFailure: flowFromEffects([{ type: 'setFlag', flag: 'rate', value: true }]),
        ...over,
      },
    });
    return hero;
  }

  it('jetConfirm@test : Pratique (+1 DR) repêche un échec qui n’a manqué que le seuil requireSL', () => {
    mkToolTest('Pratique', {}); // roll 48 ≤ 50, sl 0 < requireSL 1 → +1 DR ⇒ sl 1 ≥ 1
    banc.getState().jetConfirm('test');
    expect(banc.getState().flags['reussi']).toBe(true);
  });

  it('jetConfirm@test : Pratique ne transforme PAS un d100 raté (roll > cible) en réussite', () => {
    mkToolTest('Pratique', { roll: 60, sl: -1, requireSL: 0 }); // roll 60 > 50 → raté au dé
    banc.getState().jetConfirm('test');
    expect(banc.getState().flags['rate']).toBe(true);
  });

  it('jetConfirm@test : Peu Fiable (−1 DR) ne repêche pas (échec aggravé)', () => {
    mkToolTest('Peu Fiable', {}); // sl 0 −1 = −1 < requireSL 1 → reste raté
    banc.getState().jetConfirm('test');
    expect(banc.getState().flags['rate']).toBe(true);
  });

  it('jetConfirm@test : outil Bâclé qui Maladresse (échec + double) se brise', () => {
    mkToolTest('Bâclé', { roll: 55, sl: -1, requireSL: 0, isDouble: true });
    banc.getState().jetConfirm('test');
    const item = banc.getState().party[0].items!.find((i) => i.uid === 't1')!;
    expect(item.destroyed).toBe(true);
    expect(banc.getState().journal.some((l) => l.includes('se brise'))).toBe(true);
  });

  it('jetConfirm@test : sans outil, l’issue est inchangée (branche échec)', () => {
    mkToolTest('', { itemUid: undefined });
    banc.getState().jetConfirm('test');
    expect(banc.getState().flags['rate']).toBe(true);
  });

  it('ré-importe les États persistants du groupe au lancement du combat (carry-in)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    // Le membre du groupe porte un État persistant (Hémorragique) et un transitoire (À Terre).
    banc.setState({ party: [{ ...hero, conditions: [{ id: 'hemorragique', value: 1 }, { id: 'a-terre', value: 1 }] }] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const h = banc.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    expect(h.conditions.find((x) => x.id === 'hemorragique')?.value).toBe(1); // persistant ré-importé
    expect(h.conditions.some((x) => x.id === 'a-terre')).toBe(false);          // transitoire ignoré
  });

  it("n'instancie pas un héros mort/éjecté au combat suivant", () => {
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    banc.setState({ party: [a, { ...b, dead: true }] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const heroes = banc.getState().battle!.combatants.filter((c) => c.kind === 'hero');
    expect(heroes.length).toBe(1);
    expect(heroes[0].label).toBe('A');
  });

  it('Maladresse — la clôture du flux `fumble` applique l’auto-blessure (Oups! 01-20)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const b = banc.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    h.wounds.current = 10;
    banc.setState({ battle: { ...b }, pendingCascade: cascadeDeTest([{ id: `cons-fumble-${h.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: h.id, fumble: { weapon: h.weapons[0], result: { roll: 11, kind: 'selfWound', label: 'x' } } }], { title: '', purpose: 'combat' }) });
    banc.getState().jetConfirm('fumble');
    const after = banc.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(after.wounds.current).toBe(9); // -1, ignore BE+PA
    expect(banc.getState().pendingCascade).toBeNull(); // l'étape Maladresse unique se ferme (donnée portée par l'étape)
  });

  it('Maladresse — trauma (Oups! 81-90) pose une Déchirure de jambe + 1 Blessure critique', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const b = banc.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    banc.setState({ battle: { ...b }, pendingCascade: cascadeDeTest([{ id: `cons-fumble-${h.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: h.id, fumble: { weapon: h.weapons[0], result: { roll: 85, kind: 'trauma', label: 'x' } } }], { title: '', purpose: 'combat' }) });
    banc.getState().jetConfirm('fumble');
    const after = banc.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(after.criticalWounds).toBe(1);
    expect(after.traumas?.[0]?.ops?.some((o) => o.op === 'moveScale')).toBe(true); // jambe → Mouvement ÷2
  });

  it('Maladresse — perte d’Action (Oups! 71-80) consommée au tour suivant', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const b = banc.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    h.loseNextAction = true;
    const enemyIds = b.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    const order = [...enemyIds, h.id]; // héros en dernier
    banc.setState({ battle: { ...b, order, turn: order.length - 2 } }); // tour juste avant le héros
    banc.getState().battleEndTurn(); // → advanceTurn → héros : Action perdue consommée
    const st = banc.getState();
    const after = st.battle!.combatants.find((c) => c.id === h.id)!;
    expect(after.loseNextAction).toBeFalsy();
    expect(st.battle!.acted).toBe(true); // l'Action est consommée d'office
  });

  it('Maladresse — fumble du DÉFENSEUR héros (défense ratée + double) → étape jet:fumble de la cascade', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const b = banc.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    const e = b.combatants.find((c) => c.kind === 'enemy')!;
    // Résultat d'un Test opposé où la DÉFENSE du héros est ratée sur un double (33).
    const result = {
      hit: false, attackerRoll: 50, netSL: 0, critical: false, advantageTo: null, defenderDefeated: false,
      attackerDetail: { label: 'CC', base: 40, modifier: 0, target: 40, roll: 50, success: false, sl: -1 },
      defenderDetail: { label: 'Parade', base: 40, modifier: 0, target: 40, roll: 33, success: false, sl: 0 },
      log: 'x',
     
    } as any;
    banc.setState({
      battle: { ...b },
      pendingDefense: {
        attackerId: e.id, defenderId: h.id, weapon: e.weapons[0], location: null,
        atk: { roll: 50, target: 40, success: false, sl: -1, isDouble: false },
        mode: 'parade',
        def: { roll: 33, target: 40, success: false, sl: 0, isDouble: true },
        result,
        suite: { mode: 'machine', coup: {} },
      },
      // La défense est une étape de cascade combat (Lot 1) → on la pose comme en jeu (maybeOpenDefense).
      pendingCascade: cascadeDeTest([{ id: 'defense-jet', kind: 'defenseJet', jet: 'defense', actorId: h.id }], { title: 'Défense', icon: 'action/defend', purpose: 'combat' }),
    });
    banc.getState().jetConfirm('defense');
    const st = banc.getState();
    // La Maladresse est l'étape COURANTE de la cascade combat ; sa donnée (arme/résultat) vit SUR l'étape.
    const cur = st.pendingCascade?.participants[st.pendingCascade!.cursor];
    expect(cur?.jet).toBe('fumble');
    expect(cur?.actorId).toBe(h.id);
    expect(cur?.fumble?.weapon).toBeTruthy();
    // Identité de l'étape poussée = compteur `seq` de la séquence (#1508) : une fixture sans `seq` donne `…-undefined`.
    expect(cur?.id).toBe(`cons-fumble-${h.id}-1`);
    expect(st.pendingCascade!.seq).toBe(2);
  });

  it('Déviation Critique — défenseur héros crité : le curseur AVANCE sur l’étape deviation (anti soft-lock Auto-combat)', () => {
    // Régression : un héros crité en DÉFENSE → applyAttackResult empile l'étape 'deviation' et suspend ;
    // jetConfirm('defense') doit avancer le curseur HORS de l'étape défense (pendingDefense déjà nulle), sinon le
    // pilote Auto-combat boucle dessus (jetConfirm('defense') no-op) = soft-lock vécu.
    setRule('combat-critical-deflect', true);
    seedBattleRng(424242);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const b = banc.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    const e = b.combatants.find((c) => c.kind === 'enemy')!;
    const result = {
      hit: true, attackerRoll: 12, netSL: 4, location: 'corps', critLocation: 'corps', damage: 8, woundsLost: 3,
      critical: true, advantageTo: null, defenderDefeated: false, log: 'Coup Critique (corps)',
    } as any; // critLocation figée sur la zone armée (LDB 18 l.55, #80) → la Déviation #43.2 y est offerte
    banc.setState({
      battle: { ...b },
      pendingDefense: {
        attackerId: e.id, defenderId: h.id, weapon: e.weapons[0], location: 'corps',
        atk: { roll: 12, target: 40, success: true, sl: 4, isDouble: false }, mode: 'parade',
        def: { roll: 60, target: 40, success: false, sl: 0, isDouble: false }, result,
        suite: { mode: 'machine', coup: {} },
      },
      pendingCascade: cascadeDeTest([{ id: 'defense-jet', kind: 'defenseJet', jet: 'defense', actorId: h.id }], { title: 'Défense', icon: 'action/defend', purpose: 'combat' }),
    });
    banc.getState().jetConfirm('defense');
    const st = banc.getState();
    const cur = st.pendingCascade?.participants[st.pendingCascade!.cursor];
    expect(cur?.kind).toBe('deviation'); // le curseur a QUITTÉ l'étape défense orpheline
    expect(st.pendingDefense).toBeNull();
    resetRule('combat-critical-deflect');
  });

  it('Maladresse — « agir en dernier » (21-40) ne dure qu’UN Round (ordre canonique restauré)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const b = banc.getState().battle!;
    b.combatants.forEach((c) => { c.fortune = 0; }); // neutralise la pré-emption Chance
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    h.actLastNextRound = true;
    const base = [...(b.baseOrder ?? b.order)];
    banc.setState({ battle: { ...b, turn: b.order.length - 1 } }); // au dernier tour → prochain endTurn franchit le Round
    banc.getState().battleEndTurn();
    let st = banc.getState();
    expect(st.battle!.order[st.battle!.order.length - 1]).toBe(h.id); // héros repoussé en dernier ce Round
    expect(st.battle!.combatants.find((c) => c.id === h.id)!.actLastNextRound).toBeFalsy(); // flag purgé
    // Franchir un 2e Round : « Commencer le round 2 » d'abord (pendant la pause PERSONNE n'est
    // actif et advanceTurn est inerte), puis fin du dernier tour → ordre canonique restauré.
    banc.getState().fenetreValider('roundStart');
    const b2 = banc.getState().battle!;
    banc.setState({ battle: { ...b2, turn: b2.order.length - 1 } });
    banc.getState().battleEndTurn();
    st = banc.getState();
    expect(st.battle!.order).toEqual(base);
  });

  it('Maladresse — l’usure d’arme (Oups! 21-40) écrit sur l’ItemInstance et persiste combat→combat', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    let b = banc.getState().battle!;
    const h = b.combatants.find((c) => c.kind === 'hero')!;
    // L'arme tenue = l'ItemInstance source d'un Weapon actif (loadout).
    const witem = h.items!.find((i) => (i.kind === 'melee' || i.kind === 'ranged') && h.weapons.some((w) => w.uid === i.uid))!;
    const weapon = h.weapons.find((w) => w.uid === witem.uid) ?? h.weapons[0];
    // (1) Maladresse 21-40 → 1 Dégât d'arme, écrit sur l'ItemInstance source.
    banc.setState({ battle: { ...b }, pendingCascade: cascadeDeTest([{ id: `cons-fumble-${h.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: h.id, fumble: { weapon, result: { roll: 25, kind: 'weaponDamageActLast', label: 'x' } } }], { title: '', purpose: 'combat' }) });
    banc.getState().jetConfirm('fumble');
    const hMid = banc.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(hMid.items!.find((i) => i.label === witem.label)!.damageTaken).toBe(1);
    // (2) Fin de combat (victoire) → writeback vers le groupe.
    b = banc.getState().battle!;
    const combatants = b.combatants.map((c) => (c.kind === 'hero' ? c : { ...c, dead: true }));
    const order = [...combatants.filter((c) => c.kind === 'enemy').map((c) => c.id), h.id];
    banc.setState({ battle: { ...b, combatants, order, turn: order.length - 2 } });
    banc.getState().battleEndTurn();
    drainCombatEndCascade(); // mutants Corrompus → cascade de fin de combat AVANT victoire
    expect(banc.getState().battle?.over).toBe('victory');
    expect(banc.getState().party[0].items!.find((i) => i.label === witem.label)!.damageTaken).toBe(1);
    // (3) Combat suivant : l'usure est ré-importée (carry-in + recomputeLoadout).
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const h2 = banc.getState().battle!.combatants.find((c) => c.kind === 'hero')!;
    expect(h2.items!.find((i) => i.label === witem.label)!.damageTaken).toBe(1);
  });

  it('incanter un Projectile magique résout l’incantation et consomme l’action', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    hero.characteristics.intelligence = 90; // assurer le lancement (NI 0)
    hero.spells = ['flechette'];
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    banc.setState({ battle: { ...st.battle!, turn, action: 'cast', selectedSpellId: 'flechette', acted: false } });
    // Flux par modale : cliquer la cible OUVRE l'incantation (jet différé), n'applique rien.
    banc.getState().battleClickEntity(enemy.id);
    expect(banc.getState().pendingCast).not.toBeNull();
    expect(banc.getState().battle!.acted).toBe(false); // pas encore lancé
    banc.getState().jetRoll('cast'); // « Lancer » : fige le jet
    // Dé FIXÉ (#939) : 23 réussit (Int 90) et n'est PAS un double — sinon l'état du RNG partagé
    // (isolate:false) peut sortir une Incantation Critique, dont l'effet se CHOISIT (LDB 46 l.28-32)
    // avant toute application : « Appliquer » resterait alors inerte et `acted` faux (classe #1014).
    banc.getState().jetSetForcedRoll('cast', 23);
    expect(banc.getState().pendingCast!.result).not.toBeNull();
    expect(banc.getState().pendingCast!.result!.isCritical, 'jet déterministe non critique').toBe(false);
    banc.getState().jetConfirm('cast'); // « Appliquer » : résout
    st = banc.getState();
    // L'action est consommée, l'incantation journalisée, et la modale fermée.
    expect(st.battle!.acted).toBe(true);
    expect(st.battle!.action).toBeNull();
    expect(st.battle!.log.some((l) => l.text.includes('Fléchette'))).toBe(true);
    expect(st.pendingCast).toBeNull();
  });

  it('une Bénédiction de bonus pose un effet actif temporisé sur la cible', () => {
    const pretre = createHero({ speciesId: 'humains-reiklander', careerId: 'pretre', label: 'Prêtre', seed: 8 });
    pretre.characteristics.sociabilite = 95; // assurer la réussite de la Prière
    pretre.spells = ['benediction-de-bataille'];
    banc.setState({ party: [pretre] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    banc.setState({ battle: { ...st.battle!, turn, action: 'cast', selectedSpellId: 'benediction-de-bataille', acted: false } });
    banc.getState().battleClickEntity(heroC.id); // se cibler soi-même → ouvre la modale
    banc.getState().jetRoll('cast'); // « Lancer »
    banc.getState().jetConfirm('cast'); // « Appliquer »
    st = banc.getState();
    const after = st.battle!.combatants.find((c) => c.id === heroC.id)!;
    const failed = st.battle!.log.some((l) => l.text.includes('échoue'));
    if (!failed) {
      expect(after.activeEffects?.some((e) => e.char === 'capacite-de-combat' && e.bonus === 10)).toBe(true);
    }
    expect(st.battle!.acted).toBe(true);
  });

  it('une attaque de héros adjacent retire des Blessures', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.characteristics['capacite-de-combat'] = 70; // CC élevée + seed fixe → touche déterministe
    banc.setState({ party: [hero] });
    banc.getState().seedRng(2); // RNG de combat contrôlé : seed 2 ⇒ touche avec dégâts (cf. recherche)
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    // Forcer l'adjacence et le tour du héros.
    heroC.pos = { x: enemy.pos!.x - 1, y: enemy.pos!.y };
    const order = st.battle!.order;
    const turn = order.indexOf(heroC.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 99, movedPreAction: false, acted: false } });
    const before = enemy.wounds.current;
    banc.getState().battleClickEntity(enemy.id, { confirm: true }); // ouvre la modale d'attaque
    banc.getState().jetRoll('attack'); // lance le jet
    banc.getState().jetConfirm('attack'); // applique le résultat
    st = banc.getState();
    const enemyAfter = st.battle!.combatants.find((c) => c.id === enemy.id)!;
    expect(enemyAfter.wounds.current).toBeLessThan(before);
  });

  it('un test de compétence hors combat : Lancer, Chance, puis acquittement', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.fortune = 2;
    banc.setState({
      party: [hero],
      flags: {},
      pendingTest: {
        actorId: hero.id,
        actorName: hero.label,
        label: 'Test de Force',
        skillValue: 95,
        difficulty: 'intermediaire',
        requireSL: 0,
        target: 95,
        roll: null, // pas encore lancé
        success: false,
        sl: 0,
        onSuccess: flowFromEffects([{ type: 'setFlag', flag: 'reussi', value: true }]),
        onFailure: EMPTY_FLOW,
      },
    });
    // Acquittement bloqué tant que le jet n'a pas eu lieu.
    banc.getState().jetConfirm('test');
    expect(banc.getState().pendingTest).not.toBeNull();
    // « Lancer » : le jet se fait.
    banc.getState().jetRoll('test');
    expect(banc.getState().pendingTest!.roll).not.toBeNull();
    // Forcer un jet propre RATÉ (cible 95) pour exercer la relance (gate « jet raté », LDB 12 l.13).
    banc.setState({ pendingTest: { ...banc.getState().pendingTest!, roll: 99, success: false } });
    // Chance : relance et consomme un point.
    banc.getState().jetReroll('test');
    expect(banc.getState().party[0].fortune).toBe(1);
    expect(banc.getState().pendingTest!.roll).not.toBeNull();
    // Acquittement : ferme la modale.
    banc.getState().jetConfirm('test');
    expect(banc.getState().pendingTest).toBeNull();
  });

  it('attaquer une cible Sonnée en mêlée donne +1 Avantage à l’attaquant (LDB 16 l.125)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(2);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    enemy.conditions.push({ id: 'sonne', value: 1 });
    heroC.advantage = 0;
    heroC.pos = { x: enemy.pos!.x - 1, y: enemy.pos!.y }; // adjacent
    const turn = st.battle!.order.indexOf(heroC.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 99, movedPreAction: false, acted: false } });
    banc.getState().battleClickEntity(enemy.id, { confirm: true }); // ouvre la modale
    banc.getState().jetRoll('attack'); // le +1 Sonné s'applique AVANT le jet
    st = banc.getState();
    const heroAfter = st.battle!.combatants.find((c) => c.id === heroC.id)!;
    expect(heroAfter.advantage).toBe(1);
  });

  it('défense réactive : Défendre → résultat ; Chance relance la défense (attaque FIGÉE) ; Appliquer ferme', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(4);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    const st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    banc.setState({
      pendingDefense: {
        attackerId: E.id,
        defenderId: H.id,
        weapon: E.weapons[0],
        location: null,
        atk: { roll: 35, target: 50, success: true, sl: 1, isDouble: false },
        mode: 'parade',
        def: null,
        result: null,
        suite: { mode: 'machine', coup: {} },
      },
      pendingCascade: cascadeDeTest([{ id: 'defense-jet', kind: 'defenseJet', jet: 'defense', actorId: H.id }], { title: 'Défense', purpose: 'combat' }),
    });
    banc.getState().jetRoll('defense'); // « Défendre » : roule la défense + résout
    let pd = banc.getState().pendingDefense!;
    expect(pd.result).not.toBeNull();
    expect(pd.def).not.toBeNull();
    // Forcer une défense propre RATÉE pour exercer la relance (gate « jet raté », LDB 12 l.13).
    banc.setState({ pendingDefense: { ...pd, def: { ...pd.def!, success: false } } });
    const atkRoll = pd.atk.roll;
    banc.getState().jetReroll('defense'); // Chance : relance la DÉFENSE
    pd = banc.getState().pendingDefense!;
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1); // 1 point dépensé
    expect(pd.atk.roll).toBe(atkRoll); // l'attaque (pd.atk) n'est JAMAIS relancée
    banc.getState().jetConfirm('defense'); // Appliquer → ferme
    expect(banc.getState().pendingDefense).toBeNull();
  });

  it('un ennemi qui attaque un héros en mêlée OUVRE la modale de défense (tour de l’IA suspendu)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(5);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner(); // purge le timer d'IA armé par startCombat → on pilote nous-mêmes l'ordre du tour
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y }; // adjacent au héros
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.dead = true; // un seul ennemi vivant
    banc.setState({
      battle: { ...st.battle!, order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDefense: null,
      pendingRoundStart: null, // on pilote le combat → la pause d'ouverture est levée (sinon l'IA est gelée)
    });
    banc.getState().battleEndTurn(); // H finit son tour → advanceTurn → E actif → IA
    banc.avancer(2000); // laisse tourner les setTimeout de l'IA (450 + 350)
    st = banc.getState();
    expect(st.pendingDefense).not.toBeNull();
    expect(st.pendingDefense!.defenderId).toBe(H.id);
    expect(st.pendingDefense!.result).toBeNull(); // figé sur le choix, pas encore défendu
    expect(st.battle!.order[st.battle!.turn]).toBe(E.id); // tour SUSPENDU sur l'attaquant (non avancé)
  });

  it('attaque IA MONTÉE : le jet figé de la modale de défense porte le +20 Combat monté (LDB 14 l.180)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(5);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y };
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.dead = true;
    // Monture GRANDE sous l'ennemi (Moyenne) : le cavalier frappe le héros (Moyenne < Grande) à +20.
    const horse = combattantDeTest({
      id: 'horse-test', label: 'Cheval (test)', kind: 'enemy', size: 'grande', movement: 8,
      characteristics: { ...E.characteristics }, talents: [], items: [], weapons: [],
      wounds: blessuresDeBase(10), conditions: [], pos: { ...E.pos! },
    });
    mountUp(E, horse);
    banc.setState({
      battle: { ...st.battle!, combatants: [...st.battle!.combatants, horse], order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      facing: { ...banc.getState().facing, [H.id]: 'E' }, // face à l'attaquant → pas de Flanc/dos parasite
      pendingDefense: null,
      pendingRoundStart: null,
    });
    banc.getState().battleEndTurn(); // H finit → E (cavalier) actif → IA attaque
    banc.avancer(2000);
    st = banc.getState();
    expect(st.pendingDefense).not.toBeNull();
    // +20 Combat monté (cible plus petite que la monture, l.180) + 20 Surnombre (la monture est un
    // combattant ennemi actif au contact → « 2 contre 1 », LDB 14 l.110 — même décompte que resolveAttack).
    expect(st.pendingDefense!.atk.target).toBe(combatValue(E, 'melee', E.weapons[0]) + 40);
  });

  it('Sonné : un héros actif ne peut PAS attaquer/incanter, mais peut se déplacer (LDB 16 l.125)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    const st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    H.conditions.push({ id: 'sonne', value: 1 });
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y }; // adjacent : seul le Sonné bloque l'attaque
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    banc.getState().battleClickEntity(E.id, { confirm: true });
    expect(banc.getState().pendingAttack).toBeNull(); // Action refusée (Sonné)
    expect(computeMoveReach(banc.getState).size).toBeGreaterThan(0); // le déplacement reste permis (à demi-Mouvement)
  });

  it('Sonné : un ennemi renonce à son Action — pas d’attaque, pas de modale de défense', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(5);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner(); // purge le timer d'IA armé par startCombat → on pilote nous-mêmes l'ordre du tour
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y }; // adjacent
    E.conditions.push({ id: 'sonne', value: 1 }); // l'ennemi est Sonné
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.dead = true;
    const woundsBefore = H.wounds.current;
    banc.setState({
      battle: { ...st.battle!, order: [H.id, E.id], turn: 0, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDefense: null,
    });
    banc.getState().battleEndTurn(); // H finit → E actif → IA : Sonné → renonce
    banc.avancer(2000);
    st = banc.getState();
    expect(st.pendingDefense).toBeNull(); // aucune attaque → aucune modale de défense
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(woundsBefore); // héros intact
  });

  // ── Couche tactique : Engagé + Charge + Désengagement (LDB 13-Combat / 15-Déplacement) ──
  const mh = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  it('Engagé : une attaque de mêlée pose le lien des deux côtés (LDB 13 l.169-171)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.characteristics['capacite-de-combat'] = 70;
    banc.setState({ party: [hero] });
    banc.getState().seedRng(2);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    E.wounds = blessuresDeBase(99, 99, E); // survit à la touche → le lien d'engagement reste observable
    H.pos = { x: E.pos!.x - 1, y: E.pos!.y };
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 99, movedPreAction: false, acted: false } });
    banc.getState().battleClickEntity(E.id, { confirm: true });
    banc.getState().jetRoll('attack');
    banc.getState().jetConfirm('attack');
    st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id);
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.engagedWith).toContain(H.id);
  });

  it('Charge : se ruer au contact depuis 2 cases donne +1 Avantage (strict l.77) et impose l’attaque', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(7);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 6, y: 10 };
    H.advantage = 0;
    E.pos = { x: 8, y: 10 }; // 2 cases à l'est, couloir libre
    for (const c of st.battle!.combatants) if (c.kind === 'enemy' && c.id !== E.id) c.dead = true;
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    banc.abandonner();
    // Charge ARMÉE (spec HUD § ARBITRAGE 2026-08-19) : l'approche vers l'ennemi cliqué se DEMANDE.
    banc.getState().battleClickEntity(E.id, { confirm: true, approche: true });
    banc.reprendreLesEnAttente(); // joue le glissé d'approche (charge) → ouvre la frappe
    st = banc.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(1); // chargé de 2 cases (M4, seuil 2) → +1 (strict l.77)
    expect(mh(Ha.pos!, E.pos!)).toBe(1); // arrivé au contact
    expect(st.pendingAttack?.fromCharge).toBe(true); // l'attaque doit suivre (l.75) — modale non annulable
  });

  it('Charge interdite si déjà Engagé (LDB 15 l.35)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 6, y: 10 };
    H.advantage = 0;
    H.engagedWith = [E.id];
    E.pos = { x: 8, y: 10 };
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    banc.getState().battleClickEntity(E.id, { confirm: true }); // Engagé → pas de Charge (plan blocked)
    st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0); // pas de charge
    expect(st.pendingAttack).toBeNull();
  });

  it('jetCancel@attack après le JET d’une Charge est sans effet (charge engagée, LDB 15 l.35)', () => {
    // Avant le jet, une charge s'annule (misclic — cf. charge-undo.hors-store.test.ts) ; une fois le dé lancé
    // (`result` posé), elle est ENGAGÉE : plus d'annulation.
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    const st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    banc.setState({ pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: { hit: false } as never, fromCharge: true } });
    banc.getState().jetCancel('attack');
    expect(banc.getState().pendingAttack).not.toBeNull(); // dé lancé → engagé
  });

  it('Combat monté — cliquer un couple ouvre le choix cavalier/monture puis cible l’id choisi (LDB 14 l.181)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemies = st.battle!.combatants.filter((c) => c.kind === 'enemy');
    const mount = enemies[0];
    const rider = enemies[1];
    H.pos = { x: 6, y: 10 };
    mount.pos = { x: 7, y: 10 };
    mount.riderId = rider.id; // #0 = monture
    rider.pos = { x: 7, y: 10 };
    rider.mountId = mount.id; // #1 = cavalier (sur #0)
    for (const c of enemies.slice(2)) c.dead = true; // neutralise les autres
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    // Clic confirmé sur la monture → la modale de choix s'ouvre (pas d'attaque encore).
    // Charge ARMÉE (spec HUD § ARBITRAGE 2026-08-19) : le couple est hors d'Allonge, l'approche se demande.
    banc.getState().battleClickEntity(mount.id, { confirm: true, approche: true });
    st = banc.getState();
    // Le verdict voyage DANS le pending : le choix `mountTarget.cible` relance le clic, l'intention est déjà dissoute.
    expect(st.pendingMountTarget).toEqual({ riderId: rider.id, mountId: mount.id, approche: true });
    expect(st.pendingAttack).toBeNull();
    // Choisir la monture → modale fermée + attaque ciblée sur la monture.
    banc.getState().fenetreChoisir('mountTarget', 'cible', mount.id);
    st = banc.getState();
    expect(st.pendingMountTarget).toBeNull();
    expect(st.pendingAttack?.targetId).toBe(mount.id);
  });

  it('Désengagement A : Avantage supérieur → partir en le sacrifiant, sans consommer l’Action (LDB 15 l.47)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(3);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 2;
    E.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    banc.getState().battleDisengage(); // ouvre le menu de choix
    expect(banc.getState().pendingDisengage!.phase).toBe('choice');
    expect(banc.getState().pendingDisengage!.canSacrifice).toBe(true); // Avantage supérieur → option dispo
    banc.getState().jetRegler('disengage', 'sacrifier', true); // « Sacrifier l'Avantage »
    st = banc.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(0); // Avantage sacrifié (l.87)
    expect(Ha.engagedWith).toEqual([]); // libéré de tous
    expect(st.battle!.acted).toBe(false); // « Sacrifier » NE consomme PAS l'Action
    expect(st.battle!.action).toBeNull(); expect(st.battle!.reachable.size).toBeGreaterThan(0); // mouvement libre rouvert (budget posé)
    expect(st.pendingDisengage).toBeNull();
  });

  it('Désengagement B échec : l’adversaire gagne +1 Avantage, fuite impossible, Action consommée (LDB 15 l.49)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 30, target: 40, success: true, sl: 1, isDouble: false },
        def: { roll: 80, target: 40, success: false, sl: -4, isDouble: false },
        result: 'failure',
      },
    });
    banc.getState().jetConfirm('disengage');
    st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(1); // adversaire +1 (l.89)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id); // toujours Engagé
    expect(st.battle!.acted).toBe(true); // l'Esquive consomme l'Action
    expect(st.pendingDisengage).toBeNull();
  });

  it('Désengagement B succès : +1 Avantage, libéré, Mouvement rouvert, Action consommée (LDB 15 l.49)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(3);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 70, target: 40, success: false, sl: -3, isDouble: false },
        def: { roll: 10, target: 40, success: true, sl: 3, isDouble: false },
        result: 'success',
      },
    });
    banc.getState().jetConfirm('disengage');
    st = banc.getState();
    const Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ha.advantage).toBe(1); // +1 Avantage (l.89)
    expect(Ha.engagedWith).not.toContain(E.id); // libéré du foe testé
    expect(st.battle!.acted).toBe(true); // Action consommée
    expect(st.battle!.action).toBeNull(); expect(st.battle!.reachable.size).toBeGreaterThan(0); // Mouvement rouvert (budget posé)
  });

  it('Désengagement B : la Chance relance l’Esquive (le jet du foe reste figé)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(4);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    const st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    banc.setState({
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 35, target: 45, success: true, sl: 1, isDouble: false },
        def: { roll: 90, target: 40, success: false, sl: -5, isDouble: false },
        result: 'failure',
      },
    });
    banc.getState().jetReroll('disengage');
    const stx = banc.getState();
    expect(stx.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1); // 1 point dépensé
    expect(stx.pendingDisengage!.atk!.roll).toBe(35); // jet du foe NON relancé
  });

  it('Engagé : sélectionner « Déplacer » entre dans le Désengagement (LDB 15 l.43)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(6);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    H.advantage = 0;
    E.advantage = 1; // force l'option B (Avantage non supérieur)
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    banc.getState().battleClickTile({ x: H.pos!.x - 1, y: H.pos!.y }, { confirm: true });
    st = banc.getState();
    expect(st.pendingDisengage).not.toBeNull(); // routé vers le Désengagement
    expect(st.pendingDisengage!.phase).toBe('choice'); // clic-sol Engagé ouvre le menu de désengagement
  });

  it('Désengagement B égalité parfaite : statu quo — ni fuite, ni Avantage à l’adversaire', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E.id,
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 40, target: 40, success: true, sl: 0, isDouble: false },
        def: { roll: 40, target: 40, success: true, sl: 0, isDouble: false },
        result: 'tie',
      },
    });
    banc.getState().jetConfirm('disengage');
    st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(0); // statu quo : pas de +1 à l'adversaire
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toContain(E.id); // reste Engagé
    expect(st.battle!.acted).toBe(true); // l'Esquive tentée consomme l'Action
  });

  it('Désengagement B succès en multi-engagement : libère TOUS les adversaires (cohérent avec A)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(3);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const enemies = st.battle!.combatants.filter((c) => c.kind === 'enemy');
    const [E1, E2] = enemies;
    H.engagedWith = [E1.id, E2.id];
    E1.engagedWith = [H.id];
    E2.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: {
        moverId: H.id,
        foeId: E1.id, // testé contre E1
        phase: 'esquive',
        canSacrifice: false,
        atk: { roll: 70, target: 40, success: false, sl: -3, isDouble: false },
        def: { roll: 10, target: 40, success: true, sl: 3, isDouble: false },
        result: 'success',
      },
    });
    banc.getState().jetConfirm('disengage');
    st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([]); // libéré de E1 ET E2
  });

  it('Désengagement raté (Action consommée) : re-cliquer « Déplacer » ne relance PAS l’Esquive (anti-boucle)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    const turn = st.battle!.order.indexOf(H.id);
    // État après une tentative d'Esquive RATÉE : Action consommée (acted), héros toujours Engagé.
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: true }, pendingDisengage: null });
    const posBefore = { ...H.pos! };
    banc.getState().battleClickTile({ x: posBefore.x - 1, y: posBefore.y }, { confirm: true }); // re-clic sol
    st = banc.getState();
    // Pas de NOUVELLE Esquive (l'Action est dépensée, LDB 15 l.49) : seule la Fuite, « coup dans le dos », reste
    // (LDB 15 l.49, l.61).
    expect(st.pendingDisengage).toMatchObject({ refusEsquive: t('agate.actionSpent'), canFuir: true, canSacrifice: false });
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(posBefore); // ni déplacement libre
  });

  it('Désengagement — Fuir : adversaire +1 Avantage + coup dans le dos SUBI ; Test de Calme DIFFÉRÉ (flux flee) puis libéré et peut courir (LDB 15 l.59-68)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(5);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    E.characteristics['capacite-de-combat'] = 90; // le coup dans le dos (+20) touche à coup sûr → Test `fuite`
    H.wounds = blessuresDeBase(40, 40, H);
    const eAdvBefore = E.advantage;
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({
      battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    banc.getState().jetRegler('disengage', 'fuir', true);
    st = banc.getState();
    let Ea = st.battle!.combatants.find((c) => c.id === E.id)!;
    let Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(Ea.advantage).toBeGreaterThanOrEqual(eAdvBefore + 1); // +1 immédiat à l'annonce de la Fuite (l.63)
    // Coup dans le dos ROULÉ (frappeur IA = rangée témoin) ; Test `fuite` DIFFÉRÉ → fuite en attente.
    expect(st.pendingDisengage!.phase).toBe('fuir');
    expect(fleeBackstab(st.pendingDisengage!)!.result!.hit).toBe(true);
    expect(fleeTouche(st.pendingDisengage!)!.jet).toBeNull(); // jet du Test `fuite` influençable en attente
    expect(Ha.engagedWith).toEqual([E.id]); // toujours Engagé tant que le Test `fuite` n'est pas confirmé

    // Test `fuite` INFLUENÇABLE (flux `flee`) : Lancer → Appliquer (applique le coup + complète la fuite).
    banc.getState().jetRoll('flee', H.id);
    banc.getState().jetConfirm('flee');
    st = banc.getState();
    Ha = st.battle!.combatants.find((c) => c.id === H.id)!;
    Ea = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(Ea.advantage).toBeGreaterThanOrEqual(eAdvBefore + 2); // +1 immédiat (l.63) + +1 « si vous êtes touché » (l.66)
    expect(st.pendingDisengage).toBeNull();
    expect(Ha.engagedWith).toEqual([]); // libéré de tous les Engagements
    expect(st.battle!.action).toBeNull();
    expect(st.battle!.reachable.size).toBeGreaterThan(0); // peut courir (budget de Course posé)
  });

  it('attaque en DIAGONALE : un ennemi diagonalement adjacent est à portée de mêlée (distance Chebyshev)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.characteristics['capacite-de-combat'] = 70;
    banc.setState({ party: [hero] });
    banc.getState().seedRng(2);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: E.pos!.x - 1, y: E.pos!.y - 1 }; // DIAGONALE : Chebyshev 1, mais manhattan 2
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 99, movedPreAction: false, acted: false } });
    banc.getState().battleClickEntity(E.id, { confirm: true }); // doit ouvrir la modale (Chebyshev, pas Manhattan)
    st = banc.getState();
    expect(st.pendingAttack).not.toBeNull(); // attaque en diagonale autorisée
    expect(st.pendingAttack!.targetId).toBe(E.id);
  });
});

describe('Avancement par PX (store) — câblage moteur', () => {
  beforeEach(() => reset());

  const mkHero = (over: Partial<Combatant> = {}): Combatant =>
    combattantDeTest({
      id: 'h',
      label: 'H',
      kind: 'hero',
      species: 'humains-reiklander',
      career: 'agitateur', // Niveau 1 « Pamphlétaire » : caracs CT/Int/Soc, comp. Charme/Ragot, talent Sociable
      careerLevel: 1,
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: blessuresDeBase(12),
      advantage: 0,
      conditions: [],
      weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [
        { id: 'charme', characteristic: 'sociabilite', advances: 0 }, // in-carrière
        { id: 'esquive', characteristic: 'agilite', advances: 0 }, // hors-carrière
      ],
      talents: [],
      movement: 4,
      xp: 0,
      charAdvances: {},
      ...over,
    });

  const set1 = (h: Combatant) => banc.setState({ party: [h] });
  const h0 = () => banc.getState().party[0];

  it('grantXp : ajoute des PX au héros', () => {
    set1(mkHero({ xp: 0 }));
    banc.getState().grantXp('h', 150);
    expect(h0().xp).toBe(150);
  });

  it('buyCharAdvance in-carrière (CT) : +1 valeur, +1 augmentation, coût 25', () => {
    set1(mkHero({ xp: 1000 }));
    banc.getState().buyCharAdvance('h', 'capacite-de-tir');
    expect(h0().characteristics['capacite-de-tir']).toBe(31);
    expect(h0().charAdvances!['capacite-de-tir']).toBe(1);
    expect(h0().xp).toBe(975);
  });

  it('buyCharAdvance hors-carrière (CC) : coût doublé (50)', () => {
    set1(mkHero({ xp: 1000 }));
    banc.getState().buyCharAdvance('h', 'capacite-de-combat');
    expect(h0().xp).toBe(950);
  });

  it('buyCharAdvance recalcule les Blessures quand le Bonus d’Endurance monte', () => {
    const h = mkHero({
      xp: 1000,
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 39, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    });
    set1(blessuresSurLeProfil({ ...h, wounds: blessuresPosees(h) }));
    expect(h0().wounds.max).toBe(12);
    banc.getState().buyCharAdvance('h', 'endurance'); // 39→40 : BE 3→4, Blessures = BF + 2·BE + BFM = 3 + 8 + 3 = 14
    expect(h0().characteristics.endurance).toBe(40);
    expect(h0().wounds.max).toBe(14);
    expect(h0().wounds.current).toBe(14);
  });

  it('buySkillAdvance : Compétence connue in-carrière (Charme) +1, coût 10', () => {
    set1(mkHero({ xp: 1000 }));
    banc.getState().buySkillAdvance('h', { id: 'charme' });
    expect(h0().skills.find((s) => s.id === 'charme')!.advances).toBe(1);
    expect(h0().xp).toBe(990);
  });

  it('buySkillAdvance : acquiert une Compétence de carrière non connue (Ragot) à advances 1', () => {
    set1(mkHero({ xp: 1000 }));
    banc.getState().buySkillAdvance('h', { id: 'ragot' });
    const ragot = h0().skills.find((s) => s.id === 'ragot');
    expect(ragot).toBeTruthy();
    expect(ragot!.advances).toBe(1);
    expect(h0().xp).toBe(990);
  });

  it('buySkillAdvance : refuse une Compétence hors-carrière non connue', () => {
    set1(mkHero({ xp: 1000 }));
    banc.getState().buySkillAdvance('h', { id: 'natation' }); // ni connue, ni in-carrière
    expect(h0().skills.find((s) => s.id === 'natation')).toBeUndefined();
    expect(h0().xp).toBe(1000);
  });

  it('buyTalent in-carrière (Sociable) : créé à times 1, coût 100', () => {
    set1(mkHero({ xp: 1000 }));
    banc.getState().buyTalent('h', 'sociable');
    expect(h0().talents.find((t) => t.talentId === 'sociable')!.times).toBe(1);
    expect(h0().xp).toBe(900);
  });

  it('buyTalent hors-carrière : refusé (LDB 07 l.93)', () => {
    set1(mkHero({ xp: 1000 }));
    banc.getState().buyTalent('h', 'castagneur'); // hors Niveau Agitateur
    expect(h0().talents.find((t) => t.talentId === 'castagneur')).toBeUndefined();
    expect(h0().xp).toBe(1000);
  });

  it('changeCareer : 200 (non complété) + 100 (autre Classe, LDB 07 l.144) ; niveau 1 imposé', () => {
    // Agitateur (Citadins) → Érudit (Lettrés) : 200 + 100 PX.
    set1(mkHero({ xp: 350 }));
    banc.getState().changeCareer('h', 'erudit', 2); // niveau ≠ 1 → refusé (LDB 07 l.144)
    expect(h0().career).toBe('agitateur');
    banc.getState().changeCareer('h', 'erudit', 1);
    expect(h0().career).toBe('erudit');
    expect(h0().careerLevel).toBe(1);
    expect(h0().xp).toBe(50);
  });

  it('changeCareer : même Classe = pas de surcoût (Agitateur → Artisan, Citadins)', () => {
    set1(mkHero({ xp: 250 }));
    banc.getState().changeCareer('h', 'artisan', 1);
    expect(h0().career).toBe('artisan');
    expect(h0().xp).toBe(50);
  });

  it('changeCareer : monter au niveau suivant refusé tant que le niveau n\'est pas complété (LDB 07 l.137)', () => {
    set1(mkHero({ xp: 1000 }));
    banc.getState().changeCareer('h', 'agitateur', 2);
    expect(h0().careerLevel).toBe(1); // refusé
    expect(h0().xp).toBe(1000);
  });

  it('buyTalent : Maxi 1 respecté (Lire/Écrire ×2 refusé, LDB 10)', () => {
    set1(mkHero({ xp: 1000 })); // Pamphlétaire : Lire/Écrire in-carrière
    banc.getState().buyTalent('h', 'lire-ecrire');
    expect(h0().talents.find((t) => t.talentId === 'lire-ecrire')!.times).toBe(1);
    banc.getState().buyTalent('h', 'lire-ecrire');
    expect(h0().talents.find((t) => t.talentId === 'lire-ecrire')!.times).toBe(1); // Maxi atteint
    expect(h0().xp).toBe(900);
  });

  it('buyTalent : Haine au Maxi (Bonus de Force Mentale) refuse un groupe neuf (LDB 10 l.18, l.548)', () => {
    // Flagellant Niveau 2 : « Haine (Hérétiques) » in-carrière ; FM 30 → Maxi 3.
    set1(mkHero({ xp: 1000, career: 'flagellant', careerLevel: 2, talents: [{ talentId: 'haine', spec: 'peau-verte', times: 3 }] }));
    banc.getState().buyTalent('h', 'haine', 'heretiques');
    expect(h0().talents.some((t) => t.talentId === 'haine' && t.spec === 'heretiques')).toBe(false);
    expect(h0().xp).toBe(1000);
    set1(mkHero({ xp: 1000, career: 'flagellant', careerLevel: 2, talents: [{ talentId: 'haine', spec: 'peau-verte', times: 2 }] }));
    banc.getState().buyTalent('h', 'haine', 'heretiques');
    expect(h0().talents.find((t) => t.talentId === 'haine' && t.spec === 'heretiques')?.times).toBe(1);
  });

  it('buyTalent : « +5 Caractéristique de départ » passif à l\'achat (Guerrier né, LDB 10)', () => {
    set1(mkHero({ xp: 1000, career: 'soldat' })); // Recrue : Guerrier né in-carrière
    banc.getState().buyTalent('h', 'guerrier-ne');
    // La valeur brute reste inchangée (passif non cuit) ; baseWithTalents lit le charMod du talent.
    expect(h0().characteristics['capacite-de-combat']).toBe(30); // base INCHANGÉE
    expect(baseWithTalents(h0(), 'capacite-de-combat')).toBe(35); // base + passif Guerrier né = 35
    expect(h0().charAdvances!['capacite-de-combat'] ?? 0).toBe(0); // « ne compte pas comme des Augmentations »
    expect(h0().xp).toBe(900);
  });

  it('emplacement « (Au choix) » : désignation gratuite d\'un talent d\'espèce, puis montée ×2 à 200 PX', () => {
    // Conseiller (Niveau 1) : « Savoir-vivre (Au choix) ». Le héros possède déjà
    // Savoir-vivre (Criminels) ×1 (espèce) — cas utilisateur « Sens aiguisé (Goût) ».
    set1(mkHero({ xp: 1000, career: 'conseiller', talents: [{ talentId: 'savoir-vivre', spec: 'criminels', times: 1 }] }));
    const view = buildAdvancementView(banc.getState(), h0());
    const slot = view.talents.find((t) => t.entry === 'Savoir-vivre (Au choix)')!;
    // `option.label` est la clé de câblage OPAQUE (refKey) ; `display` porte le texte.
    expect(slot.options!.some((o) => o.display === 'Savoir-vivre (Criminels)' && o.owned)).toBe(true);
    // Avant désignation : l'achat direct passe par le slot libre (auto-désignation) — ici on
    // teste la DÉSIGNATION explicite (0 PX) puis la montée.
    banc.getState().designateCareerSlot('h', slot.slotKey, 'savoir-vivre', 'criminels');
    expect(h0().careerSlotChoices?.['conseiller']?.[slot.slotKey]).toBe('savoir-vivre|criminels');
    expect(h0().xp).toBe(1000); // gratuit
    banc.getState().buyTalent('h', 'savoir-vivre', 'criminels');
    expect(h0().talents.find((t) => talentConcrete(t) === 'Savoir-vivre (Criminels)')!.times).toBe(2);
    expect(h0().xp).toBe(800); // 2ᵉ acquisition = 200 PX (LDB 07 l.105)
    // Le slot étant désigné, une AUTRE spec est hors carrière → refusée (l.97).
    banc.getState().buyTalent('h', 'savoir-vivre', 'nobles');
    expect(h0().talents.find((t) => talentConcrete(t) === 'Savoir-vivre (Nobles)')).toBeUndefined();
  });

  it('emplacement « (Au choix) » : l\'achat via un slot libre le DÉSIGNE automatiquement', () => {
    set1(mkHero({ xp: 1000, career: 'conseiller' }));
    banc.getState().buyTalent('h', 'savoir-vivre', 'nobles');
    expect(h0().talents.find((t) => talentConcrete(t) === 'Savoir-vivre (Nobles)')!.times).toBe(1);
    expect(Object.values(h0().careerSlotChoices?.['conseiller'] ?? {})).toContain('savoir-vivre|nobles');
    // Slot consommé : une autre spec n'est plus achetable dans CETTE carrière.
    banc.getState().buyTalent('h', 'savoir-vivre', 'criminels');
    expect(h0().talents.find((t) => talentConcrete(t) === 'Savoir-vivre (Criminels)')).toBeUndefined();
  });

  it('Effet giveXp : octroie les PX à TOUT le groupe (via trigger)', () => {
    const a = mkHero({ id: 'a', xp: 0 });
    const b = mkHero({ id: 'b', xp: 50 });
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'xp-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.triggers.push({ id: 't-xp', rect: { x: 2, y: 0, w: 1, h: 1 }, once: true, flow: flowFromEffects([{ type: 'giveXp', amount: 100 }]) });
    banc.setState({ party: [a, b] });
    banc.getState().startScene(scene);
    poserLeGroupe(banc.getState, banc.setState, { x: 2, y: 0 }); // entre dans la zone du trigger
    const st = banc.getState();
    expect(st.party.find((h) => h.id === 'a')!.xp).toBe(100);
    expect(st.party.find((h) => h.id === 'b')!.xp).toBe(150);
  });
});

describe('Fouille / butin par objet cherchable (store)', () => {
  beforeEach(() => reset());

  const looter = (): Combatant => combattantDeTest({ id: 'a', label: 'A', xp: 0, wounds: blessuresDeBase(12), conditions: [] });

  it('fouiller un prop interactif applique les Effets, laisse le corps en place, et ne se refait pas', () => {
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'fouille-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'cadavre',
      kind: 'prop',
      pos: { x: 1, y: 0 },
      label: 'Cadavre du cocher',
      usable: {
        actions: [{
          id: 'fouiller',
          unique: true,
          flow: flowFromEffects([
            { type: 'giveMoney', montant: { gold: 2 } },
            { type: 'giveXp', amount: 10 },
          ]),
        }],
      },
    });
    banc.setState({ party: [looter()] });
    banc.getState().startScene(scene);
    banc.setState({ partyPos: { x: 0, y: 0 } });

    banc.getState().interactEntity('cadavre');
    let st = banc.getState();
    expect(partyMoneyTotal(banc.getState).gold).toBe(2);
    expect(st.party[0].xp).toBe(10);
    expect(st.scene!.entities.find((e) => e.id === 'cadavre')).toBeTruthy(); // le corps RESTE

    // Re-fouille : aucun double octroi
    banc.getState().interactEntity('cadavre');
    st = banc.getState();
    expect(partyMoneyTotal(banc.getState).gold).toBe(2);
    expect(st.party[0].xp).toBe(10);
  });

  it('PERTE scriptée : l’enveloppe `montant` transporte le NÉGATIF jusqu’à `drainGroup` — glouton PLAFONNÉ, aucun clamp de l’enveloppe', () => {
    const paye = ensureBourse(combattantDeTest({ id: 'a', label: 'A', xp: 0, wounds: blessuresDeBase(12), conditions: [] }));
    bourseInstanceOf(paye)!.money = { gold: 1, silver: 0, brass: 0 };
    banc.setState({ party: [paye] });

    // Sacrifice d'auteur PLUS GRAND que la bourse (patron « Le Loup et la Saumure », gold: -20) :
    // la perte n'est ni ignorée (tout-ou-rien) ni bornée à zéro par l'enveloppe — elle vide la bourse.
    applyEffects(banc.getState, banc.setState, [{ type: 'giveMoney', montant: { gold: -3 } }]);
    expect(partyMoneyTotal(banc.getState)).toEqual({ gold: 0, silver: 0, brass: 0 });

    // Et une perte COUVERTE ne prend que son dû : le signe traverse l'enveloppe à l'unité près.
    bourseInstanceOf(banc.getState().party[0])!.money = { gold: 2, silver: 0, brass: 0 };
    applyEffects(banc.getState, banc.setState, [{ type: 'giveMoney', montant: { silver: -5 } }]);
    expect(partyMoneyTotal(banc.getState)).toEqual({ gold: 1, silver: 15, brass: 0 });
  });

  it('prop consommable (butin) : fenêtre de loot (attribution + restes au 1er héros) + disparition (consume)', () => {
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'loot-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'coffre', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Coffre', usable: { actions: [{ id: 'fouiller', consume: true, flow: flowFromEffects([{ type: 'giveTrapping', custom: 'Fiole' }, { type: 'giveTrapping', custom: 'Lettre' }]) }] } });
    banc.setState({ party: [looter()] });
    banc.getState().startScene(scene);
    banc.setState({ partyPos: { x: 0, y: 0 } });

    banc.getState().interactEntity('coffre');
    let st = banc.getState();
    // Le butin N'EST PLUS donné en silence au 1er héros : il s'ouvre en fenêtre d'attribution.
    expect(st.party[0].items ?? []).toEqual([]);
    expect(st.pendingLoot?.title).toBe('Coffre');
    expect(st.pendingLoot?.gear.map((g) => g.label)).toEqual(['Fiole', 'Lettre']);
    expect(st.scene!.entities.find((e) => e.id === 'coffre')).toBeUndefined(); // ramassé → disparaît

    banc.getState().assignLootGear(0, 'a'); // attribution explicite par portrait
    st = banc.getState();
    expect((st.party[0].items ?? []).map((i) => i.label)).toEqual(['Fiole']);
    expect(st.pendingLoot?.gear.map((g) => g.label)).toEqual(['Lettre']);

    banc.getState().fenetreFermer('loot'); // « Continuer » : le non-attribué va au 1er héros (contrat victoire)
    st = banc.getState();
    expect((st.party[0].items ?? []).map((i) => i.label)).toEqual(expect.arrayContaining(['Fiole', 'Lettre']));
    expect(st.pendingLoot).toBeNull();
  });

  it('Effet giveTrapping : crée un VRAI objet à stats sur le héros (non équipé, depuis trappings.json)', () => {
    const heroWithBag = (): Combatant =>
      combattantDeTest({
        id: 'a',
        label: 'A',
        kind: 'hero',
        characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
        wounds: blessuresDeBase(12),
        advantage: 0,
        conditions: [],
        weapons: [],
        armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
        items: [],
        skills: [],
        talents: [],
        movement: 4,
      });
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'gt-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'cadavre',
      kind: 'prop',
      pos: { x: 1, y: 0 },
      label: 'Cadavre du cocher',
      usable: { actions: [{ id: 'fouiller', unique: true, flow: flowFromEffects([{ type: 'giveTrapping', trappingId: 'dague' }]) }] },
    });
    banc.setState({ party: [heroWithBag()] });
    banc.getState().startScene(scene);
    banc.setState({ partyPos: { x: 0, y: 0 } });

    banc.getState().interactEntity('cadavre');
    expect(banc.getState().pendingLoot?.gear.map((g) => g.label)).toEqual(['Dague']); // fenêtre d'abord
    banc.getState().fenetreFermer('loot'); // non attribué → 1er héros
    const hero = banc.getState().party[0];
    const dague = (hero.items ?? []).find((i) => i.label === 'Dague');
    expect(dague).toBeTruthy();
    expect(dague!.kind).toBe('melee'); // objet à stats, pas un simple nom
    expect(dague!.equipped).toBe(false); // ramassé, à équiper soi-même
  });

  it('#800 — une entité posée à même (x,y) mais sur un AUTRE étage (z) n’est pas interactible', () => {
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'z-blind-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'cadavre',
      kind: 'prop',
      pos: { x: 0, y: 0 },
      z: 0,
      label: 'Cadavre au rez',
      usable: { actions: [{ id: 'fouiller', unique: true, flow: flowFromEffects([{ type: 'giveMoney', montant: { gold: 5 } }]) }] },
    });
    banc.setState({ party: [looter()] });
    banc.getState().startScene(scene);
    banc.setState({ partyPos: { x: 0, y: 0, z: 1 } }); // groupe à l'étage 1, entité au rez (même x,y)

    banc.getState().interactEntity('cadavre');
    expect(partyMoneyTotal(banc.getState).gold).toBe(0); // pas de fouille à travers le plancher

    banc.setState({ partyPos: { x: 0, y: 0, z: 0 } }); // même étage → interaction permise
    banc.getState().interactEntity('cadavre');
    expect(partyMoneyTotal(banc.getState).gold).toBe(5);
  });
});

/**
 * L'EXÉCUTEUR UNIQUE des gestes d'exploration (#1687) : `actionsDe` DIT ce qui est offert,
 * `jouerAction` le JOUE — et `interactEntity` n'est que « joue l'UNIQUE offre ». Les scènes sont
 * FABRIQUÉES ici : aucune scène de campagne n'est prise pour fixture.
 */
describe('jouerAction — l’exécuteur unique des gestes authorés', () => {
  beforeEach(() => reset());

  const looter = (): Combatant => combattantDeTest({ id: 'a', label: 'A', xp: 0, wounds: blessuresDeBase(12), conditions: [] });

  /** Décor à N actions authorées, posé adjacent au groupe. */
  function poser(actions: ActionAuthoree[]) {
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'gestes-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'coffre', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Coffre', usable: { actions } });
    banc.setState({ party: [looter()] });
    banc.getState().startScene(scene);
    banc.setState({ partyPos: { x: 0, y: 0 } });
  }

  const or = () => partyMoneyTotal(banc.getState).gold;
  const don = (gold: number) => flowFromEffects([{ type: 'giveMoney', montant: { gold } }]);

  it('joue le Flow de l’action NOMMÉE — et elle seule, parmi celles que le décor offre', () => {
    poser([{ id: 'fouiller', flow: don(2) }, { id: 'ouvrir', flow: don(5) }]);
    banc.getState().jouerAction('coffre', 'ouvrir');
    expect(or()).toBe(5);
  });

  it('`unique` : le drapeau est posé et l’action QUITTE l’offre — rejouée, elle ne donne plus rien', () => {
    poser([{ id: 'fouiller', flow: don(2), unique: true }]);
    banc.getState().jouerAction('coffre', 'fouiller');
    expect(or()).toBe(2);
    expect(banc.getState().flags[cleActionJouee('coffre', 'fouiller')]).toBe(true);
    const scene = banc.getState().scene!;
    const coffre = scene.entities.find((e) => e.id === 'coffre')!;
    expect(actionsDe(scene, coffre, banc.getState().flags)).toEqual([]);
    banc.getState().jouerAction('coffre', 'fouiller');
    expect(or(), 'une action épuisée ne se rejoue pas').toBe(2);
  });

  it('SANS `unique`, l’action reste offerte : le geste est REJOUABLE (capacité neuve du lot)', () => {
    poser([{ id: 'tirer-le-levier', flow: don(1) }]);
    banc.getState().jouerAction('coffre', 'tirer-le-levier');
    banc.getState().jouerAction('coffre', 'tirer-le-levier');
    expect(or()).toBe(2);
  });

  it('`consume` : l’entité est RETIRÉE de la scène après le geste', () => {
    poser([{ id: 'ramasser', flow: don(3), consume: true }]);
    banc.getState().jouerAction('coffre', 'ramasser');
    expect(or()).toBe(3);
    expect(banc.getState().scene!.entities.find((e) => e.id === 'coffre')).toBeUndefined();
  });

  it('interactEntity : UNE offre → jouée ; N offres → rien n’est joué (le panneau borné les sert)', () => {
    poser([{ id: 'fouiller', flow: don(2), unique: true }]);
    banc.getState().interactEntity('coffre');
    expect(or(), 'une seule offre : le clic la joue').toBe(2);

    poser([{ id: 'fouiller', flow: don(2) }, { id: 'ouvrir', flow: don(5) }]);
    const avant = banc.getState().journal.length;
    banc.getState().interactEntity('coffre');
    expect(or(), 'plusieurs gestes : le raccourci ne choisit pas à la place du joueur').toBe(0);
    // Et il ne le DIT pas non plus : la pastille de l'entité porte les N gestes, son panneau
    // « Que faire ? » les sert. Un journal ici serait un message que personne ne lit.
    expect(banc.getState().journal.length, 'aucune ligne de journal').toBe(avant);
  });

  it('le coût de temps est une DONNÉE d’auteur : `minutes` avance l’horloge d’autant, absent = TIME_COST.search', () => {
    poser([{ id: 'ouvrir', flow: don(1), minutes: 5 }, { id: 'fouiller', flow: don(1) }]);
    banc.setState({ gameTime: campaignStart() });
    banc.getState().jouerAction('coffre', 'ouvrir');
    expect(banc.getState().gameTime, '`minutes: 5` — pas les 10 de la fouille').toBe(campaignStart() + 5);

    banc.setState({ gameTime: campaignStart() });
    banc.getState().jouerAction('coffre', 'fouiller');
    expect(banc.getState().gameTime, 'sans `minutes` : le défaut').toBe(campaignStart() + TIME_COST.search);
  });

  it('le journal NOMME le geste joué (et non « Vous fouillez » pour toute action)', () => {
    poser([{ id: 'ouvrir', label: 'Ouvrir', flow: don(1) }]);
    banc.getState().jouerAction('coffre', 'ouvrir');
    expect(banc.getState().journal.join(' ')).toContain('Coffre : Ouvrir…');
  });

  /**
   * PORTÉE de l'exécuteur (#1687) : `jouerAction` recalcule l'offre sur l'état courant, il doit aussi
   * recalculer la PORTÉE (`exploreNav.aPorteeDe`, étage compris) — sinon un ordre arrivé de loin (coop,
   * clic en retard, marche interrompue) joue le geste à travers le plancher, alors que la pastille et
   * le clic, eux, l'avaient déjà refusé. La forme 8-adjacente DANS LE PLAN est la seule qu'une portée
   * z-aveugle servirait.
   */
  it('PORTÉE : un ordre venu d’un AUTRE étage ne joue rien — de plain-pied, le même ordre joue', () => {
    poser([{ id: 'fouiller', flow: don(2), unique: true }]);
    const scene = banc.getState().scene!;
    // adjacent dans le plan, un plancher entre les deux
    banc.setState({ scene: { ...scene, entities: scene.entities.map((e) => (e.id === 'coffre' ? { ...e, z: 1 } : e)) }, journal: [] });
    banc.getState().jouerAction('coffre', 'fouiller');
    expect(or(), 'aucun butin : le geste n’a pas été joué').toBe(0);
    expect(banc.getState().journal, 'ni ligne de journal').toEqual([]);
    expect(banc.getState().flags[cleActionJouee('coffre', 'fouiller')], 'ni drapeau d’épuisement').toBeUndefined();

    // TÉMOIN — le MÊME ordre, le décor ramené de plain-pied : rien d'autre n'a changé.
    const plainPied = scene.entities.find((e) => e.id === 'coffre')!;
    const etage = banc.getState().scene!;
    banc.setState({ scene: { ...etage, entities: etage.entities.map((e) => (e.id === 'coffre' ? plainPied : e)) } });
    banc.getState().jouerAction('coffre', 'fouiller');
    expect(or(), 'de plain-pied, la portée est celle de toujours').toBe(2);
  });
});

describe('Déplacement-puis-fouille (move-to-interact, P5)', () => {
  beforeEach(() => reset());
  const looter = (): Combatant => combattantDeTest({ id: 'a', label: 'A', xp: 0, wounds: blessuresDeBase(12), conditions: [] });

  function armedScene() {
    const scene = emptyScene('scene-test', 8, 8);
    scene.id = 'mti-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'cadavre', kind: 'prop', pos: { x: 5, y: 0 }, label: 'Cadavre', usable: { actions: [{ id: 'fouiller', unique: true, flow: flowFromEffects([{ type: 'giveMoney', montant: { gold: 3 } }]) }] } });
    banc.setState({ party: [looter()] });
    banc.getState().startScene(scene);
    banc.setState({ partyPos: { x: 0, y: 0 } });
  }

  it('moveParty arrivant SUR la case d’arrivée armée déclenche la fouille et purge pendingInteract', () => {
    armedScene();
    banc.getState().setPendingInteract({ id: 'cadavre', at: { x: 4, y: 0 } });
    poserLeGroupe(banc.getState, banc.setState, { x: 1, y: 0 }); // encore loin → pas de fouille
    expect(banc.getState().pendingInteract).toMatchObject({ id: 'cadavre' });
    expect(partyMoneyTotal(banc.getState).gold).toBe(0);

    poserLeGroupe(banc.getState, banc.setState, { x: 4, y: 0 }); // case d'arrivée du plan → fouille auto
    expect(banc.getState().pendingInteract).toBeNull();
    expect(partyMoneyTotal(banc.getState).gold).toBe(3);
  });

  it('une adjacence CROISÉE en chemin n’ouvre pas l’interaction : seule la case d’arrivée armée le fait', () => {
    armedScene();
    // Plan : rejoindre (4,1) — (4,0), croisée en route, est adjacente au cadavre SANS être l'arrivée.
    banc.getState().setPendingInteract({ id: 'cadavre', at: { x: 4, y: 1 } });
    poserLeGroupe(banc.getState, banc.setState, { x: 4, y: 0 });
    expect(banc.getState().pendingInteract, 'le pending survit au passage').toMatchObject({ id: 'cadavre' });
    expect(partyMoneyTotal(banc.getState).gold, 'rien n’a été fouillé en passant').toBe(0);

    poserLeGroupe(banc.getState, banc.setState, { x: 4, y: 1 });
    expect(banc.getState().pendingInteract).toBeNull();
    expect(partyMoneyTotal(banc.getState).gold).toBe(3);
  });

  /** RÉSERVE de la revue (#1443, round 3) : un déplacement-puis-interaction armé n'a plus de sens
   *  quand un combat s'ouvre — le pending appartient au cadre `combatStart` (`noyau/stateFields`),
   *  comme ses voisins de recharge, de désengagement ou d'empoignade. */
  it('un pending armé ne survit pas à l’ouverture d’un combat', () => {
    armedScene();
    banc.getState().setPendingInteract({ id: 'cadavre', at: { x: 4, y: 0 } });
    expect(resetFields('combatStart'), 'le cadre PURGE ce champ').toHaveProperty('pendingInteract', null);
    banc.setState({ ...resetFields('combatStart') }); // ce que `startCombat` applique
    expect(banc.getState().pendingInteract).toBeNull();
    poserLeGroupe(banc.getState, banc.setState, { x: 4, y: 0 }); // la case armée : plus rien ne s'y déclenche
    expect(partyMoneyTotal(banc.getState).gold).toBe(0);
  });

  it('annulation : setPendingInteract(null) empêche la fouille à l’arrivée (clic ailleurs)', () => {
    armedScene();
    banc.getState().setPendingInteract({ id: 'cadavre', at: { x: 4, y: 0 } });
    banc.getState().setPendingInteract(null);
    poserLeGroupe(banc.getState, banc.setState, { x: 4, y: 0 });
    expect(partyMoneyTotal(banc.getState).gold).toBe(0);
  });
});

describe('Fenêtre de loot (pendingLoot) — capture, attribution, révélation', () => {
  beforeEach(() => reset());
  const looter = (over: Partial<Combatant> = {}): Combatant =>
    combattantDeTest({ id: 'a', label: 'A', kind: 'hero', xp: 0, wounds: blessuresDeBase(12), conditions: [],
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 40, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
      weapons: [], items: [], skills: [{ id: 'evaluation', characteristic: 'intelligence', advances: 5 }], talents: [], movement: 4, ...over });

  function lootScene() {
    const scene = emptyScene('scene-test', 8, 8);
    scene.id = 'pl-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'coffre', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Coffre de la garnison',
      usable: { actions: [{ id: 'fouiller', unique: true, flow: flowFromEffects([
        { type: 'journal', desc: 'Sous une fausse planche, la solde du mois.' },
        { type: 'giveMoney', montant: { silver: 18 } },
        { type: 'giveTrapping', custom: 'Épée', qualities: ['de-plaies-atroces'], identified: false },
      ]) }] },
    });
    banc.setState({ party: [looter()] });
    banc.getState().startScene(scene);
    banc.setState({ partyPos: { x: 0, y: 0 } });
  }

  it('fouille avec butin : fenêtre titrée (texte + or + équipement), bourse créditée immédiatement', () => {
    lootScene();
    banc.getState().interactEntity('coffre');
    const st = banc.getState();
    expect(st.pendingLoot?.title).toBe('Coffre de la garnison');
    expect(st.pendingLoot?.messages).toEqual(['Sous une fausse planche, la solde du mois.']);
    expect(st.pendingLoot?.gold).toEqual({ gold: 0, silver: 18, brass: 0 }); // affiché…
    expect(partyMoneyTotal(banc.getState).silver).toBe(18); // …ET déjà en bourse (l'argent est commun)
    expect(st.pendingLoot?.gear.map((g) => g.label)).toEqual(['Épée']);
    expect(st.pendingLoot?.gear[0].magic).toBe(true);
    // Aucun ÉQUIPEMENT donné en silence au héros 1 (l'Épée attend la fenêtre) ; seule la Bourse
    // d'argent est matérialisée sur lui, car la monnaie est portée par le héros (SOCLE POSSESSIONS §8).
    expect((st.party[0].items ?? []).filter((i) => i.trappingId !== 'bourse')).toEqual([]);
  });

  it('giveTrapping AVEC heroId (don d’auteur ciblé) : direct sur le héros, pas de fenêtre', () => {
    lootScene();
    applyEffectsLoot(banc.getState, banc.setState, [{ type: 'giveTrapping', trappingId: 'dague', heroId: 'a' }], 'Test');
    const st = banc.getState();
    expect(st.pendingLoot).toBeNull();
    expect((st.party[0].items ?? []).map((i) => i.label)).toEqual(['Dague']);
  });

  it('en combat : applyEffectsLoot passe en direct (pas de fenêtre — Ramasser/victoire ont leurs flux)', () => {
    lootScene();
    banc.setState({ battle: { combatants: [] } as unknown as BattleState });
    applyEffectsLoot(banc.getState, banc.setState, [{ type: 'giveTrapping', trappingId: 'dague' }], 'Test');
    expect(banc.getState().pendingLoot).toBeNull();
    expect((banc.getState().party[0].items ?? []).map((i) => i.label)).toEqual(['Dague']);
  });

  it('appraiseGear (Évaluation) : succès → la ligne est révélée, l’objet attribué arrive identifié', () => {
    lootScene();
    banc.getState().interactEntity('coffre');
    banc.getState().appraiseGear('loot', 0);
    const pa = banc.getState().pendingAppraise!;
    expect(pa.gear).toEqual({ scope: 'loot', index: 0 });
    expect(pa.skillLabel ?? 'Évaluation').toBe('Évaluation');
    banc.setState({ pendingAppraise: { ...pa, roll: 10, success: true, sl: 2 } });
    banc.getState().jetConfirm('appraise');
    const line = banc.getState().pendingLoot!.gear[0];
    expect(line.effect.identified).toBeUndefined(); // révélé = champ absent
    banc.getState().assignLootGear(0, 'a');
    const it2 = banc.getState().party[0].items!.find((i) => i.label === 'Épée')!;
    expect(it2.identified).not.toBe(false);
    expect(it2.qualities.some((q) => q.id === 'de-plaies-atroces')).toBe(true); // id de qualité runtime
  });

  it('Détection d’artefact (LDB 10) : succès DR≥1 → identifié ; échec → tentative unique consommée', () => {
    lootScene();
    // Le looter reçoit le Talent : le bouton/flux ne s'arme que pour un porteur (Intuition).
    banc.setState({ party: [looter({ talents: [{ talentId: 'detection-d-artefact', times: 1 }] } as Partial<Combatant>)] });
    banc.getState().interactEntity('coffre');
    banc.getState().appraiseGear('loot', 0, 'detect');
    let pa = banc.getState().pendingAppraise!;
    expect(pa.mode).toBe('detect');
    expect(pa.skillLabel).toBe('Intuition');
    // Échec : l'artefact ne se laisse plus sonder (detectTried), rien de révélé.
    banc.setState({ pendingAppraise: { ...pa, roll: 95, success: false, sl: -5 } });
    banc.getState().jetConfirm('appraise');
    let line = banc.getState().pendingLoot!.gear[0];
    expect(line.effect.detectTried).toBe(true);
    expect(line.effect.identified).toBe(false);
    // Une 2e tentative est refusée (« une seule fois par artefact »).
    banc.getState().appraiseGear('loot', 0, 'detect');
    expect(banc.getState().pendingAppraise).toBeNull();
    // On force une nouvelle détection (autre ligne de vie du test) : succès DR 2 ≥ 1 règle → identifié.
    line.effect.detectTried = false;
    banc.getState().appraiseGear('loot', 0, 'detect');
    pa = banc.getState().pendingAppraise!;
    banc.setState({ pendingAppraise: { ...pa, roll: 5, success: true, sl: 2 } });
    banc.getState().jetConfirm('appraise');
    line = banc.getState().pendingLoot!.gear[0];
    expect(line.effect.magicKnown).toBe(true);
    expect(line.effect.identified).toBeUndefined(); // tout révélé
  });

  it('Détection sur un objet NON magique : « aucune aura », tentative consommée', () => {
    lootScene();
    banc.setState({ party: [looter({ talents: [{ talentId: 'detection-d-artefact', times: 1 }] } as Partial<Combatant>)] });
    applyEffectsLoot(banc.getState, banc.setState, [{ type: 'giveTrapping', trappingId: 'dague' }], 'Sac');
    banc.getState().appraiseGear('loot', 0, 'detect');
    const pa = banc.getState().pendingAppraise!;
    banc.setState({ pendingAppraise: { ...pa, roll: 5, success: true, sl: 2 } });
    banc.getState().jetConfirm('appraise');
    const line = banc.getState().pendingLoot!.gear[0];
    expect(line.effect.detectTried).toBe(true);
    expect(line.effect.magicKnown).toBeUndefined();
  });

  it('anti-spam Évaluation : un échec verrouille l’objet pour la JOURNÉE (re-tentative demain)', () => {
    lootScene();
    banc.getState().interactEntity('coffre');
    banc.getState().appraiseGear('loot', 0);
    const pa = banc.getState().pendingAppraise!;
    banc.setState({ pendingAppraise: { ...pa, roll: 99, success: false, sl: -6 } });
    banc.getState().jetConfirm('appraise');
    expect(banc.getState().pendingLoot!.gear[0].effect.appraiseTriedDay).toBeDefined();
    // Même jour : la re-tentative est refusée (pas de modale).
    banc.getState().appraiseGear('loot', 0);
    expect(banc.getState().pendingAppraise).toBeNull();
    // Le lendemain : on peut retenter.
    banc.getState().advanceTime(24 * 60);
    banc.getState().appraiseGear('loot', 0);
    expect(banc.getState().pendingAppraise).not.toBeNull();
    banc.setState({ pendingAppraise: null });
  });

  it('fenêtres successives : le butin s’AJOUTE à la fenêtre ouverte (pas d’écrasement)', () => {
    lootScene();
    banc.getState().interactEntity('coffre');
    applyEffectsLoot(banc.getState, banc.setState, [{ type: 'giveTrapping', trappingId: 'dague' }], 'Sac oublié');
    const pl = banc.getState().pendingLoot!;
    expect(pl.title).toBe('Coffre de la garnison'); // la 1re fenêtre garde son titre
    expect(pl.gear.map((g) => g.label)).toEqual(['Épée', 'Dague']);
  });
});

describe('Utiliser un consommable en combat (store) — Action gratuite, LDB 13 l.106', () => {
  beforeEach(() => reset());

  const combatHero = (over: Partial<Combatant> = {}): Combatant =>
    combattantDeTest({
      id: 'h',
      label: 'H',
      kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, // BE = 3
      wounds: blessuresDeBase(12, 5),
      advantage: 0,
      conditions: [],
      weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [],
      skills: [],
      talents: [],
      movement: 4,
      ...over,
    });

  /** Un consommable du catalogue (son Flow se lit par `trappingId`). */
  const potion = (uid: string, trappingId: string): ItemInstance => ({ ...garanti(itemFromTrappingById(trappingId), trappingId, 'consommable'), uid });

  const mkBattle = (h: Combatant, over = {}): BattleState => ({
    combatants: [h],
    order: [h.id],
    turn: 0,
    round: 1,
    action: null,
    selectedSpellId: null,
    reachable: new Map(),
    movementUsed: 0, movedPreAction: false,
    acted: false,
    log: [],
    over: null,
    ...over,
  });

  it('Potion de guérison : soigne du Bonus d’Endurance, consomme l’objet, laisse l’Action', () => {
    const h = combatHero({
      wounds: blessuresDeBase(12, 5),
      items: [potion('p1', 'potion-de-guerison')],
    });
    banc.setState({ mode: 'battle', battle: mkBattle(h) });
    banc.getState().battleUseItem('p1');
    const b = banc.getState().battle!;
    expect(b.combatants[0].wounds.current).toBe(8); // 5 + BE(35) = 8
    expect(b.combatants[0].items!.find((i) => i.uid === 'p1')).toBeUndefined();
    expect(b.acted).toBe(false);
  });

  it('Potion de vitalité : retire l’État Exténué (toutes les piles)', () => {
    const h = combatHero({
      conditions: [{ id: 'extenue', value: 2 }],
      items: [potion('p2', 'potion-de-vitalite')],
    });
    banc.setState({ mode: 'battle', battle: mkBattle(h) });
    banc.getState().battleUseItem('p2');
    const b = banc.getState().battle!;
    expect(b.combatants[0].conditions.find((c) => c.id === 'extenue')).toBeUndefined();
    expect(b.acted).toBe(false);
  });

  it('Potion de vitalité sans Exténué : refusée et dite avant de boire, objet et Action gardés', () => {
    const h = combatHero({
      items: [potion('p4', 'potion-de-vitalite')],
    });
    banc.setState({ mode: 'battle', battle: mkBattle(h), refus: null });
    banc.getState().battleUseItem('p4');
    const b = banc.getState().battle!;
    expect(banc.getState().refus?.texte).toBe(`${h.label} n’a aucun pion Exténué qui puisse être retiré. Potion de vitalité ne lui apporterait rien : l’objet est gardé.`);
    expect(b.combatants[0].items!.find((i) => i.uid === 'p4'), 'pas consommée').toBeTruthy();
    expect(b.acted, 'l’Action reste').toBe(false);
  });

  it('Action déjà dépensée : la potion se boit quand même', () => {
    const h = combatHero({
      wounds: blessuresDeBase(12, 5),
      items: [potion('p3', 'potion-de-guerison')],
    });
    banc.setState({ mode: 'battle', battle: mkBattle(h, { acted: true }) });
    banc.getState().battleUseItem('p3');
    const b = banc.getState().battle!;
    expect(b.combatants[0].wounds.current).toBe(8);
    expect(b.combatants[0].items!.find((i) => i.uid === 'p3')).toBeUndefined();
  });
});

describe('Chance : relance 1×/Test et seulement sur jet propre raté (LDB 12 l.40 ; jet propre raté : LDB 12 l.13)', () => {
  beforeEach(() => {
    banc.abandonner();
    reset();
  });
  afterEach(() => {
    banc.abandonner();
  });

  it('jetReroll@test : refusée si le d100 propre est réussi (roll ≤ cible)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.fortune = 2;
    banc.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 0, target: 50, roll: 20, success: true, sl: 3, rerolled: false, onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW },
    });
    banc.getState().jetReroll('test');
    expect(banc.getState().party[0].fortune).toBe(2); // rien dépensé (jet réussi)
    expect(banc.getState().pendingTest!.roll).toBe(20); // jet inchangé
  });

  it('jetReroll@test : autorisée une seule fois sur un jet raté', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.fortune = 2;
    banc.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 5, difficulty: 'intermediaire',
        requireSL: 0, target: 5, roll: 95, success: false, sl: -9, rerolled: false, onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW },
    });
    banc.getState().jetReroll('test'); // 1re relance OK (jet raté)
    expect(banc.getState().party[0].fortune).toBe(1);
    expect(banc.getState().pendingTest!.rerolled).toBe(true);
    banc.getState().jetReroll('test'); // 2e relance refusée (déjà relancé)
    expect(banc.getState().party[0].fortune).toBe(1); // pas de 2e dépense
  });

  it('jetBonusSL@test : +1 DR fait passer un Test à requireSL, et est cumulable', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.fortune = 3;
    banc.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 2, target: 50, roll: 45, success: false, sl: 0, rerolled: false, onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW },
    });
    banc.getState().jetBonusSL('test'); // DR 0 → 1 (< 2)
    expect(banc.getState().party[0].fortune).toBe(2);
    expect(banc.getState().pendingTest!.success).toBe(false);
    banc.getState().jetBonusSL('test'); // DR 1 → 2 (≥ requireSL 2) → succès
    expect(banc.getState().party[0].fortune).toBe(1);
    expect(banc.getState().pendingTest!.sl).toBe(2);
    expect(banc.getState().pendingTest!.success).toBe(true);
  });

  it('jetBonusSL@test : la Chance (+1 DR) ne fabrique PAS de réussite depuis un d100 RATÉ (sans seuil de DR exigé)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.fortune = 3;
    banc.setState({
      party: [hero],
      // d100 95 > cible 50 : l'issue tient au dé (LDB 12 l.90-94), `requireSL` 0 = aucun seuil de DR exigé.
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 0, target: 50, roll: 95, success: false, sl: -5, rerolled: false, onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW },
    });
    banc.getState().jetBonusSL('test');
    expect(banc.getState().pendingTest!.sl).toBe(-4); // le DR monte
    expect(banc.getState().pendingTest!.success).toBe(false); // l'échec du dé tient
  });
});

describe('Détermination (Resolve) — retirer un État (LDB 17 l.59-61)', () => {
  beforeEach(() => reset());

  const mkBattle = (h: Combatant, over = {}): BattleState => ({
    combatants: [h], order: [h.id], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
  });

  it('retire un État, ne consomme pas l’Action, décrémente la Détermination', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    h.resolve = 2;
    h.conditions = [{ id: 'aveugle', value: 1 }];
    banc.setState({ mode: 'battle', battle: mkBattle(h) });
    banc.getState().battleSpendResolve('aveugle');
    const b = banc.getState().battle!;
    expect(b.combatants[0].conditions.find((c) => c.id === 'aveugle')).toBeUndefined();
    expect(b.combatants[0].resolve).toBe(1);
    expect(b.acted).toBe(false); // ne coûte pas l'Action
  });

  it('retirer À Terre fait regagner 1 PB (l.66)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    h.resolve = 1;
    h.conditions = [{ id: 'a-terre', value: 1 }];
    h.wounds = blessuresDeBase(12, 5, h);
    banc.setState({ mode: 'battle', battle: mkBattle(h) });
    banc.getState().battleSpendResolve('a-terre');
    const c0 = banc.getState().battle!.combatants[0];
    expect(c0.conditions.find((c) => c.id === 'a-terre')).toBeUndefined();
    expect(c0.wounds.current).toBe(6); // +1 PB
  });

  it('retirer À Terre : munition logée plafonne le regagne de PB (LDB 62 l.250)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    h.resolve = 1;
    h.conditions = [{ id: 'a-terre', value: 1 }, { id: 'munition-logee', value: 1 }];
    h.wounds = blessuresDeBase(12, 11, h);
    banc.setState({ mode: 'battle', battle: mkBattle(h) });
    banc.getState().battleSpendResolve('a-terre');
    const c0 = banc.getState().battle!.combatants[0];
    expect(c0.wounds.current).toBe(11); // plafonné à max−1 (munition logée) : aucun PB regagné
  });

  it('sans Détermination : aucun effet', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    h.resolve = 0;
    h.conditions = [{ id: 'aveugle', value: 1 }];
    banc.setState({ mode: 'battle', battle: mkBattle(h) });
    banc.getState().battleSpendResolve('aveugle');
    expect(banc.getState().battle!.combatants[0].conditions.find((c) => c.id === 'aveugle')).toBeTruthy();
  });

  it('spendResolveCondition (par id, hors mode actif) : retirer À Terre fait regagner 1 PB (l.66)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    h.resolve = 1;
    h.conditions = [{ id: 'a-terre', value: 1 }];
    h.wounds = blessuresDeBase(12, 5, h);
    banc.setState({ mode: 'battle', battle: mkBattle(h) });
    banc.getState().spendResolveCondition(h.id, 'a-terre');
    const c0 = banc.getState().battle!.combatants[0];
    expect(c0.conditions.find((c) => c.id === 'a-terre')).toBeUndefined();
    expect(c0.wounds.current).toBe(6); // +1 PB
  });

  it('spendResolveCondition : munition logée plafonne le regagne de PB (LDB 62 l.250)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    h.resolve = 1;
    h.conditions = [{ id: 'a-terre', value: 1 }, { id: 'munition-logee', value: 1 }];
    h.wounds = blessuresDeBase(12, 11, h);
    banc.setState({ mode: 'battle', battle: mkBattle(h) });
    banc.getState().spendResolveCondition(h.id, 'a-terre');
    const c0 = banc.getState().battle!.combatants[0];
    expect(c0.wounds.current).toBe(11); // plafonné à max−1 (munition logée) : aucun PB regagné
  });
});

describe('Ramasser un objet au sol en combat (un à la fois, LDB 13 l.115-116)', () => {
  beforeEach(() => reset());

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.items = hero.items ?? [];
    hero.pos = { x: 0, y: 0 };
    const scene = emptyScene('scene-test', 8, 8);
    scene.id = 'pickup-scene';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({
      id: 'corps', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Cocher',
      usable: {
        actions: [{
          id: 'fouiller',
          unique: true,
          flow: flowFromEffects([
            { type: 'journal', desc: 'Son tromblon repose à côté.' }, // index 0 (non ramassable)
            { type: 'giveTrapping', trappingId: 'dague' }, // index 1
            { type: 'giveTrapping', trappingId: 'tromblon' }, // index 2
          ]),
        }],
      },
    });
    const bh: Combatant = JSON.parse(JSON.stringify(hero));
    const battle: BattleState = {
      combatants: [bh], order: [bh.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ party: [hero], scene, mode: 'battle', battle, flags: {} });
    return bh;
  }

  it('ramasse UN objet : il arrive dans l’inventaire (battle + party), consomme l’Action, retire du pool', () => {
    const bh = setup();
    banc.getState().battlePickup('corps', 'fouiller:eff:2'); // index 2 = Tromblon
    const st = banc.getState();
    const bH = st.battle!.combatants.find((c) => c.id === bh.id)!;
    expect((bH.items ?? []).some((i) => i.label === 'Tromblon')).toBe(true); // utilisable ce combat
    expect((st.party[0].items ?? []).some((i) => i.label === 'Tromblon')).toBe(true); // persiste
    expect((bH.items ?? []).filter((i) => i.label === 'Tromblon').length).toBe(1); // un SEUL objet ramassé
    expect(st.battle!.acted).toBe(true); // coûte l'Action
    // Le DOCUMENT de scène est intact — c'est de la donnée d'auteur ; ce qui a changé, c'est l'ÉTAT de
    // la partie : le drapeau de la feuille prise, que le pool comme la fouille en exploration lisent.
    const corps = st.scene!.entities.find((e) => e.id === 'corps')!;
    const feuilles = flowEffects(corps.usable!.actions![0].flow);
    expect(feuilles.some((e) => e.type === 'giveTrapping' && e.trappingId === 'tromblon')).toBe(true);
    expect(feuilles.some((e) => e.type === 'giveTrapping' && e.trappingId === 'dague')).toBe(true);
    expect(entityPickables(corps, st.flags, objetDuNarratif(st.campaignNarratif)).map((p) => p.key)).toEqual(['fouiller:eff:1']);
  });

  it('refusé si l’Action est déjà consommée', () => {
    const bh = setup();
    banc.setState({ battle: { ...banc.getState().battle!, acted: true } });
    banc.getState().battlePickup('corps', 'fouiller:eff:2');
    const bH = banc.getState().battle!.combatants.find((c) => c.id === bh.id)!;
    expect((bH.items ?? []).some((i) => i.label === 'Tromblon')).toBe(false);
  });

  it('#800 — un corps posé à même (x,y) mais sur un AUTRE étage (z) n’est pas ramassable', () => {
    const bh = setup();
    const scene = banc.getState().scene!;
    // corps à l'étage 1
    banc.setState({ scene: { ...scene, entities: scene.entities.map((e) => (e.id === 'corps' ? { ...e, z: 1 } : e)) }, battle: { ...banc.getState().battle!, combatants: [{ ...bh, pos: { x: 0, y: 0, z: 0 } }] } }); // actif au rez
    banc.getState().battlePickup('corps', 'fouiller:eff:2');
    expect((banc.getState().battle!.combatants[0].items ?? []).some((i) => i.label === 'Tromblon')).toBe(false); // pas de ramassage à travers l'étage
  });
});

describe('Chance — 3e usage : pré-emption d’initiative en début de Round (LDB 17 l.25)', () => {
  beforeEach(() => {
    banc.abandonner();
    reset();
  });
  afterEach(() => {
    banc.abandonner();
  });

  function endOfRoundBattle(heroFortune: number) {
    const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 3 });
    H.fortune = heroFortune;
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0';
    E.label = 'Gobelin';
    E.kind = 'enemy';
    E.fortune = 0;
    E.pos = { x: 5, y: 5 };
    const battle: BattleState = {
      combatants: [H, E], order: [E.id, H.id], turn: 1, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ party: [H], mode: 'battle', battle, scene: emptyScene('scene-test', 8, 8) });
    return { H, E };
  }

  it('fin du dernier tour du Round : on suspend (fenêtre d’initiative, pendingRoundStart)', () => {
    endOfRoundBattle(1);
    banc.getState().battleEndTurn(); // H (dernier de l'ordre) finit → bascule au Round 2
    const st = banc.getState();
    expect(st.pendingRoundStart).not.toBeNull();
    expect(st.pendingRoundStart!.round).toBe(2);
    expect(st.battle!.round).toBe(2);
  });

  it('même sans Chance : on suspend quand même en début de Round (la fenêtre d’initiative est systématique)', () => {
    endOfRoundBattle(0);
    banc.getState().battleEndTurn();
    const st = banc.getState();
    expect(st.pendingRoundStart).not.toBeNull();
    expect(st.pendingRoundStart!.round).toBe(2);
  });

  it('la pause de début de Round GÈLE l’IA ennemie jusqu’à « Commencer le round »', () => {
    endOfRoundBattle(0); // ordre [E, H] : l'ennemi est en tête du Round 2
    banc.getState().battleEndTurn();
    banc.reprendreLesEnAttente(); // aucun timer d'IA ne doit être en attente pendant la pause
    expect(banc.getState().pendingRoundStart).not.toBeNull(); // l'ennemi n'a pas joué : on attend la confirmation
    banc.getState().fenetreValider('roundStart');
    expect(banc.getState().pendingRoundStart).toBeNull();
  });

  it('roundStartPromote place le héros en tête et dépense 1 Chance', () => {
    const { H } = endOfRoundBattle(2);
    banc.getState().battleEndTurn();
    banc.getState().roundStartPromote(H.id);
    const st = banc.getState();
    expect(st.battle!.order[0]).toBe(H.id);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1);
  });

  it('la validation de la pause (`fenetreValider(\'roundStart\')`) ferme la modale et active le héros promu en premier', () => {
    const { H } = endOfRoundBattle(1);
    banc.getState().battleEndTurn();
    banc.getState().roundStartPromote(H.id);
    banc.getState().fenetreValider('roundStart');
    const st = banc.getState();
    expect(st.pendingRoundStart).toBeNull();
    expect(st.battle!.order[st.battle!.turn]).toBe(H.id); // H agit en premier ce Round
  });

  it('Tir rapide (interruption, LDB 10) : tir hors-tour SANS réordonner ; son tour normal a lieu mais épuisé', () => {
    const { H, E } = endOfRoundBattle(0);
    H.talents = [{ talentId: 'tir-rapide', times: 1 }];
    H.weapons = [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 30, qualities: [] }] as never;
    rangedOf(H).loaded = true; H.movement = 4; H.pos = { x: 0, y: 0 };
    E.pos = { x: 2, y: 0 }; // à portée, ligne de vue dégagée (scène vide)
    banc.getState().battleEndTurn(); // → Round 2, pendingRoundStart
    const orderBefore = [...banc.getState().battle!.order];
    seedBattleRng(1);
    banc.getState().preemptRangedShot(H.id, E.id);
    expect(banc.getState().pendingAttack?.interrupt).toBe(true); // modale de tir ouverte, tireur non-actif
    banc.getState().jetRoll('attack');
    banc.getState().jetConfirm('attack');
    let st = banc.getState();
    expect(st.pendingAttack).toBeNull();                 // tir résolu
    expect(st.pendingRoundStart).not.toBeNull();          // TOUJOURS à la pause de début de Round (aucun tour avancé)
    expect(st.battle!.order).toEqual(orderBefore);        // AUCUN réordonnancement (≠ Chance / arme Rapide)
    const h1 = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(h1.loseNextAction).toBe(true);                 // tour normal : Action dépensée (= le tir)
    expect(h1.loseNextMovement).toBe(true);               // ... et Mouvement épuisé
    // Son tour NORMAL : on le place en tête et on démarre le Round → le tour a lieu (effets début/fin) mais épuisé.
    banc.setState({ battle: { ...st.battle!, order: [H.id, ...st.battle!.order.filter((id) => id !== H.id)] } });
    banc.getState().fenetreValider('roundStart');
    st = banc.getState();
    expect(st.battle!.order[st.battle!.turn]).toBe(H.id); // c'est bien son tour
    expect(st.battle!.acted).toBe(true);                  // Action déjà dépensée
    expect(st.battle!.movementUsed).toBeGreaterThan(0);   // Mouvement épuisé
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.loseNextAction).toBeFalsy(); // consommé
  });

  it('Tir rapide (LDB 10) — chemin IA : un ennemi tireur interrompt à l’ouverture du Round (`lancerLeRound`) et épuise son tour', () => {
    const { H, E } = endOfRoundBattle(0);
    E.talents = [{ talentId: 'tir-rapide', times: 1 }];
    E.weapons = [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 30, qualities: [] }] as never;
    rangedOf(E).loaded = true; E.pos = { x: 2, y: 0 };
    H.pos = { x: 0, y: 0 };
    banc.getState().battleEndTurn(); // → Round 2, pendingRoundStart
    // H en tête de l'ordre : le tour NORMAL de l'ennemi n'ouvre pas immédiatement → sa dette de tour
    // (posée par le Tir rapide) PERSISTE et reste observable (sinon `lancerLeRound` la consommerait aussitôt).
    banc.setState({ battle: { ...banc.getState().battle!, order: [H.id, E.id] } });
    seedBattleRng(1);
    banc.getState().fenetreValider('roundStart'); // au sommet : runPreemptShots fait tirer l'IA hors de l'ordre
    const st = banc.getState();
    expect(st.pendingAttack).toBeNull();       // l'IA résout son tir INLINE (aucune modale ouverte)
    expect(st.pendingRoundStart).toBeNull();   // le Round a démarré derrière l'interruption
    const e1 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(e1.loseNextAction).toBe(true);      // a tiré → tour normal épuisé (Action + Mouvement)
    expect(e1.loseNextMovement).toBe(true);
    expect(st.battle!.log.some((l) => /Tir rapide/.test(l.text))).toBe(true); // interruption journalisée
  });
});

describe('cancelMove — annuler un déplacement décomposé tant qu’aucune Action (R6/LOT 6)', () => {
  beforeEach(() => { banc.abandonner(); reset(); });
  afterEach(() => { banc.abandonner(); });

  function moveSetup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    const st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(H.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false } });
    return H;
  }

  function firstMoveTarget(fromX: number, fromY: number) {
    const reach = [...computeMoveReach(banc.getState).keys()].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
    return reach.find((p) => p.x !== fromX || p.y !== fromY)!;
  }

  it('restaure la position et remet le Mouvement à zéro après un segment', () => {
    const H = moveSetup();
    const from = { ...H.pos! };
    const target = firstMoveTarget(from.x, from.y);
    banc.getState().battleClickTile(target, { confirm: true });
    let st = banc.getState();
    expect(st.battle!.movementUsed).toBeGreaterThan(0);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(target);
    banc.getState().cancelMove();
    st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(from);
    expect(st.battle!.movementUsed).toBe(0);
    expect(st.battle!.moveSnapshot ?? null).toBeNull();
  });

  it('ne fait RIEN une fois l’Action prise (l’annulation est une aide PRÉ-Action)', () => {
    const H = moveSetup();
    const from = { ...H.pos! };
    const target = firstMoveTarget(from.x, from.y);
    banc.getState().battleClickTile(target, { confirm: true });
    banc.setState({ battle: { ...banc.getState().battle!, acted: true } }); // une Action a été prise
    banc.getState().cancelMove();
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(target);
  });
});

describe('Blessures critiques & mort en combat (LDB 18-Traumatisme)', () => {
  beforeEach(() => { banc.abandonner(); reset(); });
  afterEach(() => { banc.abandonner(); });

  function combat(heroOver: Partial<Combatant> = {}, enemyOver: Partial<Combatant> = {}) {
    const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 3 });
    H.fortune = 0; // pas de pré-emption d'initiative dans ces tests
    Object.assign(H, blessuresSurLeProfil({ ...H, ...heroOver }));
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0'; E.label = 'Brigand'; E.kind = 'enemy'; E.fortune = 0; Object.assign(E, blessuresSurLeProfil({ ...E, ...enemyOver }));
    const battle: BattleState = {
      combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ party: [H], mode: 'battle', battle, scene: emptyScene('scene-test', 8, 8) });
    return { H, E };
  }

  it('overkill sur un HÉROS → Blessure critique (compteur++), tombe à 0 PB', () => {
    const { H, E } = combat({ wounds: blessuresDeBase(12, 2), armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } });
    H.items = (H.items ?? []).filter((i) => i.kind !== 'armor'); // sans armure portée : aucune Déviation (LDB 63 l.30)
    banc.getState().seedRng(2);
    // L'IA (E) frappe H en mêlée SANS défense opposable (cible sans réaction, cas imposé RAW) :
    // résolution non opposée, DR d'attaque plein → overkill car 2 PB < dégâts.
    const atk = { roll: 5, target: 80, success: true, sl: 7, isDouble: false };
    const res = resolveMeleePassive(E, H, E.weapons[0], atk, { rng: makeRNG(1595) });
    applyAttackResult(banc.getState, banc.setState, E, H, E.weapons[0], res);
    draineCascade(banc.getState); // la sévérité du Critique se tire DANS la fenêtre (#1426)
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.criticalWounds).toBe(1); // une Blessure critique encaissée
    expect(h.wounds.current).toBe(0); // tombé à 0 (ne passe jamais négatif)
  });

  it('héros SANS Destin Inconscient + 0 PB + critiques > BE → meurt en fin de Round (LDB 18 l.48-49)', () => {
    const { H, E } = combat({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], criticalWounds: 4, fate: 0 }); // BE=3, pas de Destin → mort directe
    banc.setState({ battle: { ...banc.getState().battle!, order: [E.id, H.id], turn: 1 } }); // H dernier → battleEndTurn franchit le Round
    banc.getState().seedRng(1);
    banc.getState().battleEndTurn();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.dead).toBe(true);
    expect(isOutOfAction(h)).toBe(true);
  });
});

describe('Destin sacrifié (LDB 17 l.29-32)', () => {
  beforeEach(() => { banc.abandonner(); reset(); });
  afterEach(() => { banc.abandonner(); });

  function combat(heroOver: Partial<Combatant> = {}) {
    const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 3 });
    H.fortune = 0; H.fate = 1; Object.assign(H, blessuresSurLeProfil({ ...H, ...heroOver }));
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0'; E.label = 'Brigand'; E.kind = 'enemy'; E.fortune = 0; E.fate = 0;
    const battle: BattleState = {
      combatants: [H, E], order: [E.id, H.id], turn: 1, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ party: [H], mode: 'battle', battle, scene: emptyScene('scene-test', 8, 8) });
    return { H, E };
  }

  it('mort lente d’un héros à Destin → suspend (pendingFateSave source=slow), pas mort', () => {
    combat({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], criticalWounds: 4 }); // fate=1, BE=3
    banc.getState().seedRng(1);
    banc.getState().battleEndTurn(); // H dernier → franchit le Round
    const st = banc.getState();
    expect(st.pendingFateSave).not.toBeNull();
    expect(st.pendingFateSave!.source).toBe('slow');
    expect(st.battle!.combatants[0].dead ?? false).toBe(false);
  });

  it('« Meurs un autre jour » : éjecté vivant, Destin −1, le Round reprend', () => {
    const { H } = combat({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], criticalWounds: 4, fate: 2 });
    banc.getState().seedRng(1);
    banc.getState().battleEndTurn();
    banc.getState().fenetreChoisir('fateSave', 'issue', 'survive');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.dead ?? false).toBe(false);
    expect(h.outOfRencontre).toBe(true);
    expect(h.fate).toBe(1);
    expect(banc.getState().pendingFateSave).toBeNull();
  });

  it('« Accepter le sort » : mort', () => {
    const { H } = combat({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], criticalWounds: 4 });
    banc.getState().seedRng(1);
    banc.getState().battleEndTurn();
    banc.getState().fenetreChoisir('fateSave', 'issue', 'accept');
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.dead).toBe(true);
  });

  it('héros SANS Destin : mort lente directe, pas de pause', () => {
    const { H } = combat({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], criticalWounds: 4, fate: 0 });
    banc.getState().seedRng(1);
    banc.getState().battleEndTurn();
    expect(banc.getState().pendingFateSave).toBeNull();
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.dead).toBe(true);
  });
});

describe('Résilience — « Je ne faillirai pas ! » (LDB 17 l.68)', () => {
  beforeEach(() => { banc.abandonner(); reset(); });
  afterEach(() => { banc.abandonner(); });

  it('force un Test hors combat raté en succès, Résilience −1', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    hero.resilience = 1;
    banc.setState({
      party: [hero],
      pendingTest: { actorId: hero.id, actorName: 'A', label: 'Test', skillValue: 30, difficulty: 'intermediaire',
        requireSL: 0, target: 30, roll: 95, success: false, sl: -6, rerolled: false, onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW },
    });
    banc.getState().jetForceSuccess('test');
    expect(banc.getState().pendingTest!.success).toBe(true);
    expect(banc.getState().party[0].resilience).toBe(0);
  });
});

describe('Munitions & rechargement (héros, LDB Armes/Tests)', () => {
  beforeEach(() => {
    banc.abandonner();
    reset();
  });
  afterEach(() => {
    banc.abandonner();
  });

  function archer() {
    const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    H.weapons = [{ uid: 'w-arb', label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [{ id: 'recharge', value: 1 }], subType: 'Arbalète', reload: 1 }];
    H.items = [{ uid: 'am1', label: 'Carreau', kind: 'ammo', qualities: [{ id: 'empaleuse' }], enc: 0, equipped: false, subType: 'Arbalète', qty: 2 } as ItemInstance];
    rangedOf(H).loaded = true;
    H.pos = { x: 0, y: 0 };
    const E: Combatant = JSON.parse(JSON.stringify(H));
    E.id = 'enemy-0';
    E.label = 'Cible';
    E.kind = 'enemy';
    E.pos = { x: 4, y: 0 };
    E.items = [];
    E.weapons = [{ label: 'Mains nues', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }];
    const battle: BattleState = {
      combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 99, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ party: [H], mode: 'battle', battle, scene: emptyScene('scene-test', 8, 8), pendingReload: null, pendingAttack: null });
    return { H, E };
  }

  it('tirer consomme 1 munition et décharge une arme à Recharge', () => {
    const { H, E } = archer();
    banc.getState().seedRng(2);
    banc.getState().battleClickEntity(E.id, { confirm: true }); // ouvre la modale d'attaque (chargé + munition OK)
    expect(banc.getState().pendingAttack).not.toBeNull();
    banc.getState().jetRoll('attack');
    banc.getState().jetConfirm('attack');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.items ?? []).find((i) => i.uid === 'am1')!.qty).toBe(1); // 2 → 1
    expect(rangedOf(h).loaded).toBe(false); // Recharge 1 → déchargé
  });

  it('arme déchargée : tir refusé (modale non ouverte)', () => {
    const { H, E } = archer();
    rangedOf(H).loaded = false;
    banc.getState().battleClickEntity(E.id, { confirm: true });
    expect(banc.getState().pendingAttack).toBeNull();
  });

  it('battleReload OUVRE la modale (Test de Projectiles, Action pas encore consommée)', () => {
    const { H } = archer();
    rangedOf(H).loaded = false;
    rangedOf(H).reloadProgress = 0;
    banc.getState().battleReload();
    const pr = banc.getState().pendingReload;
    expect(pr).not.toBeNull();
    expect(pr!.reload).toBe(1); // Indice DR
    expect(pr!.roll).toBeNull(); // pas encore lancé
    expect(banc.getState().battle!.acted).toBe(false); // l'Action n'est consommée qu'à Appliquer
  });

  it('jetRoll@reload + jetConfirm@reload : cumule le DR (Test étendu), recharge à ≥ Indice, consomme l’Action', () => {
    const { H } = archer();
    rangedOf(H).loaded = false;
    rangedOf(H).reloadProgress = 0;
    banc.getState().seedRng(2);
    banc.getState().battleReload();
    banc.getState().jetRoll('reload');
    const pr = banc.getState().pendingReload!;
    expect(pr.roll).not.toBeNull();
    const expected = Math.max(0, 0 + pr.sl); // formule du Test étendu (clamp à 0)
    banc.getState().jetConfirm('reload');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    if (expected >= 1) {
      expect(rangedOf(h).loaded).toBe(true);
      expect(rangedOf(h).reloadProgress).toBe(0);
    } else {
      expect(rangedOf(h).loaded).toBe(false);
      expect(rangedOf(h).reloadProgress).toBe(expected);
    }
    expect(banc.getState().battle!.acted).toBe(true);
    expect(banc.getState().pendingReload).toBeNull();
  });

  /**
   * #1262 V3 Lj — l'ISSUE du rechargement est DÉRIVÉE au goulot (`FLOWS.reload.apply`, `spec.issue`) :
   * le site n'écrit plus la phrase. Canal COMBAT : la ligne entre dans `battle.log` (événement `reload`)
   * et JAMAIS dans le journal narratif. PARITÉ : la voie IA (aucune fenêtre, pending FOURNI) passe par
   * le MÊME goulot avec la MÊME donnée — donc la MÊME ligne, au caractère près.
   */
  it('l’issue du rechargement vient du GOULOT (canal combat), et la voie IA rend la MÊME ligne', () => {
    const { H } = archer();
    rangedOf(H).loaded = false;
    rangedOf(H).reloadProgress = 0;
    banc.getState().seedRng(2);
    banc.getState().battleReload();
    banc.getState().jetRoll('reload');
    const pr = { ...banc.getState().pendingReload! };
    const journalAvant = banc.getState().journal.length;
    banc.getState().jetConfirm('reload');
    const evs = banc.getState().battle!.log.filter((e) => e.kind === 'reload');
    expect(evs, 'UNE ligne d’issue, dans le journal de COMBAT').toHaveLength(1);
    expect(banc.getState().journal.length, 'canal COMBAT : rien dans le journal narratif').toBe(journalAvant);
    // Voie IA : même pending, même DR réalisé, même nom d'arme → ligne IDENTIQUE (aucun 2ᵉ rédacteur).
    const progress = Math.max(0, pr.progressBefore + pr.sl);
    const ia = FLOWS.reload.apply(banc.getState, { p: pr, ctx: { after: progress, weapon: 'Arbalète' } });
    expect(ia, 'parité joueur ⇄ IA : une seule déclaration d’issue').toEqual([evs[0].text]);
  });

  it('jetConfirm@reload : un DR insuffisant (Recharge 2) laisse l’arme déchargée et garde le progrès', () => {
    const { H } = archer();
    H.weapons = [{ label: 'Arbalète lourde', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 100, qualities: [{ id: 'recharge', value: 2 }], subType: 'Arbalète', reload: 2 }];
    rangedOf(H).loaded = false;
    rangedOf(H).reloadProgress = 0;
    banc.getState().seedRng(2);
    banc.getState().battleReload();
    banc.getState().jetRoll('reload');
    const pr = banc.getState().pendingReload!;
    const expected = Math.max(0, 0 + pr.sl);
    banc.getState().jetConfirm('reload');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(rangedOf(h).loaded).toBe(expected >= 2);
    expect(rangedOf(h).reloadProgress).toBe(expected >= 2 ? 0 : expected);
  });

  it('battleReload refusé si l’Action est déjà consommée', () => {
    const { H } = archer();
    rangedOf(H).loaded = false;
    banc.setState({ battle: { ...banc.getState().battle!, acted: true } });
    banc.getState().battleReload();
    expect(banc.getState().pendingReload).toBeNull();
  });

  it('plus de munitions : tir refusé', () => {
    const { H, E } = archer();
    (H.items![0] as ItemInstance).qty = 0;
    banc.getState().battleClickEntity(E.id, { confirm: true });
    expect(banc.getState().pendingAttack).toBeNull();
  });

  // La munition se fixe au CHARGEMENT et l'état de charge vit sur CHAQUE ARME : charger sélectionne une
  // munition, et deux armes à distance gèrent chacune leur rechargement et leur munition. Test étendu de
  // rechargement : LDB 62 l.335.
  const am2 = () => ({ uid: 'am2', label: 'Carreau perçant', kind: 'ammo', qualities: [{ id: 'perforante' }], enc: 0, equipped: false, subType: 'Arbalète', qty: 3 } as ItemInstance);

  // CONTRAT CENTRAL du modèle par-arme : deux armes à distance dans deux SETS, chacune son cycle. Changer
  // de set ne téléporte ni n'efface un coup chargé — l'arme retrouvée est dans l'état où on l'a laissée.
  it('changement de set : chaque arme garde SON état de charge (arbalète en cours de recharge ⇄ pistolet chargé)', () => {
    const { H, E } = archer();
    H.items = [
      { uid: 'w-arb', label: 'Arbalète', kind: 'ranged', subType: 'Arbalète', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [{ id: 'recharge', value: 1 }], enc: 1, equipped: true },
      { uid: 'w-pist', label: 'Pistolet', kind: 'ranged', subType: 'Poudre noire', damage: { plusBF: false, flat: 8 }, range: 20, qualities: [{ id: 'recharge', value: 1 }], enc: 1, equipped: true },
      { uid: 'am1', label: 'Carreau', kind: 'ammo', subType: 'Arbalète', qty: 5, qualities: [], enc: 0, equipped: false },
      { uid: 'am-balles', label: 'Balles et poudre', kind: 'ammo', subType: 'Poudre noire', qty: 5, qualities: [], enc: 0, equipped: false },
    ] as ItemInstance[];
    H.loadouts = [{ id: 'arb', main: 'w-arb' }, { id: 'pist', main: 'w-pist' }] as never;
    H.activeLoadoutId = 'arb';
    const swap = (id: string) => {
      banc.setState({ battle: { ...banc.getState().battle!, loadoutSwapped: false } }); // le plafond 1×/tour n'est pas l'objet du test
      banc.getState().battleSwitchLoadout(id);
      return banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    };

    // (1) Set PISTOLET : on le charge (Test étendu abouti) — il porte SA munition.
    let h = swap('pist');
    loadWeapon(h, h.weapons.find((w) => w.uid === 'w-pist')!);
    expect(loadRegister(h, h.weapons.find((w) => w.uid === 'w-pist')!).loadedAmmoUid).toBe('am-balles');
    // (2) Set ARBALÈTE : elle a tiré, son Test étendu est à 1 DR.
    h = swap('arb');
    const arb = h.weapons.find((w) => w.uid === 'w-arb')!;
    unloadWeapon(h, arb); // elle a tiré : couture UNIQUE (l'état va sur SON registre)
    loadRegister(h, arb).reloadProgress = 1; // 1 DR déjà cumulé au Test étendu
    // (3) Retour au PISTOLET : toujours chargé → le tir part (le gate ne réclame pas de rechargement).
    h = swap('pist');
    expect(weaponLoaded(h, h.weapons.find((w) => w.uid === 'w-pist')!)).toBe(true);
    banc.getState().seedRng(2);
    banc.getState().battleClickEntity(E.id, { confirm: true });
    expect(banc.getState().pendingAttack, 'le pistolet chargé TIRE').not.toBeNull();
    banc.getState().jetCancel('attack');
    // (4) Retour à l'ARBALÈTE : elle est restée déchargée, avec SA progression intacte.
    h = swap('arb');
    const arb2 = h.weapons.find((w) => w.uid === 'w-arb')!;
    expect(weaponLoaded(h, arb2)).toBe(false);
    expect(reloadProgressOf(h, arb2)).toBe(1);
  });

  // CAS NOMMÉ « deux pistolets » : deux armes à distance TENUES en même temps (main + main gauche). Le
  // chemin JOUEUR les distingue — `battleReload(uid)` recharge celle qu'on désigne, `battleSelectAmmo(uid,
  // armeUid)` choisit la munition de celle-là, et l'autre ne bouge pas.
  it('deux armes à distance tenues : recharger/choisir vise l’arme DÉSIGNÉE, l’autre garde son état', () => {
    const { H } = archer();
    H.items = [
      { uid: 'p1', label: 'Pistolet droit', kind: 'ranged', subType: 'Poudre noire', damage: { plusBF: false, flat: 8 }, range: 20, qualities: [{ id: 'recharge', value: 1 }], enc: 1, equipped: true },
      { uid: 'p2', label: 'Pistolet gauche', kind: 'ranged', subType: 'Poudre noire', damage: { plusBF: false, flat: 8 }, range: 20, qualities: [{ id: 'recharge', value: 1 }], enc: 1, equipped: true },
      { uid: 'balles', label: 'Balles et poudre', kind: 'ammo', subType: 'Poudre noire', qty: 9, qualities: [], enc: 0, equipped: false },
      { uid: 'balles-fines', label: 'Balles fines', kind: 'ammo', subType: 'Poudre noire', qty: 4, qualities: [], enc: 0, equipped: false },
    ] as ItemInstance[];
    H.loadouts = [{ id: 'duo', main: 'p1', off: 'p2' }] as never;
    H.activeLoadoutId = 'duo';
    recomputeLoadout(H);
    const of = (uid: string) => banc.getState().battle!.combatants.find((c) => c.id === H.id)!.weapons.find((w) => w.uid === uid)!;
    const hero = () => banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    loadWeapon(H, H.weapons.find((w) => w.uid === 'p1')!);
    loadWeapon(H, H.weapons.find((w) => w.uid === 'p2')!);

    // (1) La munition se choisit ARME PAR ARME : le gauche passe aux balles fines, le droit n'y touche pas.
    banc.getState().battleSelectAmmo('balles-fines', 'p2');
    expect(loadRegister(hero(), of('p2')).ammoUid).toBe('balles-fines');
    expect(loadRegister(hero(), of('p1')).ammoUid).not.toBe('balles-fines');
    expect(weaponLoaded(hero(), of('p2'))).toBe(false); // il était chargé : la bascule l'a déchargé
    expect(weaponLoaded(hero(), of('p1'))).toBe(true);  // le droit reste prêt

    // (2) Le rechargement vise l'arme DÉSIGNÉE : la modale s'ouvre sur le gauche, pas sur le droit.
    banc.getState().battleReload('p2');
    expect(banc.getState().pendingReload?.weaponUid).toBe('p2');
    banc.getState().jetCancel('reload');
    // (3) Sans uid : la 1re arme DÉCHARGÉE (ici le gauche) — jamais une arme déjà prête.
    banc.getState().battleReload();
    expect(banc.getState().pendingReload?.weaponUid).toBe('p2');
  });

  it('battleSelectAmmo sur arme NON chargée : libre, et le Test étendu en cours garde son progrès', () => {
    const { H } = archer();
    H.items!.push(am2());
    rangedOf(H).loaded = false;
    rangedOf(H).reloadProgress = 1;
    banc.getState().battleSelectAmmo('am2');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(rangedOf(h).ammoUid).toBe('am2');
    expect(rangedOf(h).loaded).toBe(false);
    expect(rangedOf(h).reloadProgress).toBe(1);
  });

  it('battleSelectAmmo sur arme CHARGÉE : décharge (rechargement complet exigé), aucune munition détruite', () => {
    const { H } = archer();
    H.items!.push(am2());
    rangedOf(H).loaded = true;
    rangedOf(H).loadedAmmoUid = 'am1';
    banc.getState().battleSelectAmmo('am2');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(rangedOf(h).ammoUid).toBe('am2');
    expect(rangedOf(h).loaded).toBe(false);
    expect(rangedOf(h).reloadProgress).toBe(0);
    expect(rangedOf(h).loadedAmmoUid).toBeUndefined();
    expect(h.items!.find((i) => i.uid === 'am1')!.qty).toBe(2); // stock intact : le décompte n'a lieu qu'au TIR
    expect(h.items!.find((i) => i.uid === 'am2')!.qty).toBe(3);
  });

  it('battleSelectAmmo sur la munition DÉJÀ chargée : sans effet (aucun rechargement imposé)', () => {
    const { H } = archer();
    rangedOf(H).loaded = true;
    rangedOf(H).ammoUid = 'am1';
    rangedOf(H).loadedAmmoUid = 'am1';
    banc.getState().battleSelectAmmo('am1');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(rangedOf(h).loaded).toBe(true);
    expect(rangedOf(h).loadedAmmoUid).toBe('am1');
  });

  it('jetConfirm@reload CAPTURE la munition choisie sur le coup chargé', () => {
    const { H } = archer();
    H.items!.push(am2());
    rangedOf(H).loaded = false;
    rangedOf(H).reloadProgress = 0;
    rangedOf(H).ammoUid = 'am2';
    banc.setState({
      pendingReload: {
        actorId: H.id, actorName: H.label, weaponUid: 'w-arb', reload: 1, progressBefore: 0,
        skillValue: 40, difficulty: 'intermediaire', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' }, roll: 10, target: 40, sl: 3, success: true,
      },
    });
    banc.getState().jetConfirm('reload');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(rangedOf(h).loaded).toBe(true);
    expect(rangedOf(h).loadedAmmoUid).toBe('am2');
  });

  // Chaîne COMPLÈTE mesurée au COMPORTEMENT (le stock, pas le câblage) : on recharge en ayant choisi la 2ᵉ
  // munition, on tire, et c'est CETTE pile qui baisse.
  it('recharger avec la 2ᵉ munition puis tirer : c’est SA pile qui baisse (qty)', () => {
    const { H, E } = archer();
    H.items!.push(am2());
    rangedOf(H).loaded = false;
    rangedOf(H).reloadProgress = 0;
    rangedOf(H).ammoUid = 'am2';
    banc.setState({
      pendingReload: {
        actorId: H.id, actorName: H.label, weaponUid: 'w-arb', reload: 1, progressBefore: 0,
        skillValue: 40, difficulty: 'intermediaire', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' }, roll: 10, target: 40, sl: 3, success: true,
      },
    });
    banc.getState().jetConfirm('reload');
    banc.setState({ battle: { ...banc.getState().battle!, acted: false } });
    // La sélection change APRÈS le chargement : le coup déjà chargé, lui, ne change pas.
    rangedOf(banc.getState().battle!.combatants.find((c) => c.id === H.id)!).ammoUid = 'am1';
    banc.getState().seedRng(2);
    banc.getState().battleClickEntity(E.id, { confirm: true });
    banc.getState().jetRoll('attack');
    banc.getState().jetConfirm('attack');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.items!.find((i) => i.uid === 'am2')!.qty).toBe(2); // 3 → 2 : le coup chargé est parti
    expect(h.items!.find((i) => i.uid === 'am1')!.qty).toBe(2); // l'autre pile n'a pas bougé
  });

  it('le tir consomme la munition CAPTURÉE, jamais la sélection courante', () => {
    const { H, E } = archer();
    H.items!.push(am2());
    rangedOf(H).loaded = true;
    rangedOf(H).loadedAmmoUid = 'am1';
    rangedOf(H).ammoUid = 'am2';
    banc.getState().seedRng(2);
    banc.getState().battleClickEntity(E.id, { confirm: true });
    banc.getState().jetRoll('attack');
    banc.getState().jetConfirm('attack');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.items!.find((i) => i.uid === 'am1')!.qty).toBe(1); // capturée : 2 → 1
    expect(h.items!.find((i) => i.uid === 'am2')!.qty).toBe(3); // sélection courante : intacte
    expect(rangedOf(h).loadedAmmoUid).toBeUndefined(); // le coup est parti
  });

  it('arme SANS cycle de chargement (Arc, Recharge 0) : la bascule reste libre et le tir suit la sélection', () => {
    const { H, E } = archer();
    H.weapons = [{ uid: 'w-arc', label: 'Arc', type: 'ranged', damage: { plusBF: true, flat: 3 }, range: 60, qualities: [], subType: 'Arc', reload: 0 }];
    H.items = [
      { uid: 'fl1', label: 'Flèche', kind: 'ammo', qualities: [{ id: 'empaleuse' }], enc: 0, equipped: false, subType: 'Arc', qty: 5 } as ItemInstance,
      { uid: 'fl2', label: 'Flèche barbelée', kind: 'ammo', qualities: [], enc: 0, equipped: false, subType: 'Arc', qty: 5 } as ItemInstance,
    ];
    rangedOf(H).loaded = true;
    banc.getState().battleSelectAmmo('fl2');
    expect(rangedOf(banc.getState().battle!.combatants.find((c) => c.id === H.id)!).loaded).toBe(true);
    banc.getState().seedRng(2);
    banc.getState().battleClickEntity(E.id, { confirm: true });
    banc.getState().jetRoll('attack');
    banc.getState().jetConfirm('attack');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.items!.find((i) => i.uid === 'fl2')!.qty).toBe(4);
    expect(h.items!.find((i) => i.uid === 'fl1')!.qty).toBe(5);
  });

  it('héros mixte (mêlée en weapons[0] + arc) peut tirer une cible éloignée (gate via attackWeapon)', () => {
    const { H, E } = archer();
    H.weapons = [
      { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] },
      { label: 'Arc', type: 'ranged', damage: { plusBF: true, flat: 3 }, range: 60, qualities: [], subType: 'Arc', reload: 0 },
    ];
    H.items = [{ uid: 'fl1', label: 'Flèche', kind: 'ammo', qualities: [{ id: 'empaleuse' }], enc: 0, equipped: false, subType: 'Arc', qty: 5 } as ItemInstance];
    rangedOf(H).loaded = true;
    rangedOf(H).ammoUid = 'fl1';
    banc.getState().battleClickEntity(E.id, { confirm: true }); // E à (4,0) → l'Arc (weapons[1]) doit s'employer, pas « hors de portée de mêlée »
    expect(banc.getState().pendingAttack).not.toBeNull();
  });

  it('jetConfirm@reload : cumul sous 0 → reloadProgress revient à 0 (Test étendu « recommence », LDB 12 l.174)', () => {
    const { H } = archer();
    rangedOf(H).loaded = false;
    rangedOf(H).reloadProgress = 1;
    banc.setState({
      pendingReload: {
        actorId: H.id, actorName: H.label, weaponUid: 'w-arb', reload: 2, progressBefore: 1,
        skillValue: 40, difficulty: 'intermediaire', ligne: { base: 40, mods: [], target: 40, difficulty: 'intermediaire' }, roll: 95, target: 40, sl: -2, success: false,
      },
    });
    banc.getState().jetConfirm('reload');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(rangedOf(h).reloadProgress).toBe(0); // 1 + (-2) = -1 → plancher 0
    expect(rangedOf(h).loaded).toBe(false);
  });

  it('action Viser : pose aiming SANS jet, +20 au tir, puis consommée', () => {
    const { H, E } = archer();
    banc.getState().battleAim();
    const h1 = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h1.aiming).toBe(true);
    expect(banc.getState().battle!.acted).toBe(true);
    expect(banc.getState().pendingReload).toBeNull(); // « pas de Test exigé pour viser »
    // Tirer : la ligne NOMME « Viser +20 », puis aiming est consommée. « Tirer alors que vous avez
    // passé votre dernière action à viser » est une entrée de la table (`LDB 14`) : elle COMPOSE la
    // Difficulté du jet (#1153) au lieu de flotter en chip — on lit donc TOUT ce que la ligne nomme.
    banc.setState({ battle: { ...banc.getState().battle!, acted: false, action: null } });
    banc.getState().seedRng(2);
    banc.getState().battleClickEntity(E.id, { confirm: true });
    banc.getState().jetRoll('attack');
    const pa = banc.getState().pendingAttack!;
    const d = pa.result!.attackerDetail!;
    const nomme = [...(d.mods ?? []), ...(d.difficultyParts ?? [])];
    expect(ligneDe(nomme, refDeRegle('viser'))?.value).toBe(20);
    // …et il PÈSE sur la cible : tout l'écart base→cible est nommé (un +20 annoncé mais non appliqué
    // — ou l'inverse — casse cette égalité).
    const dv = d.difficultyCombined ?? (d.difficulty ? DIFFICULTY_MODIFIERS[d.difficulty] : 0);
    expect(d.target - d.base).toBe(dv + (d.mods ?? []).reduce((s, m) => s + m.value, 0));
    banc.getState().jetConfirm('attack');
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.aiming).toBe(false);
  });

  it('Viser refusé sans arme à distance', () => {
    const { H } = archer();
    H.weapons = [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }];
    banc.getState().battleAim();
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.aiming).toBeFalsy();
  });

  // L'arme DÉRIVE d'un objet possédé : son registre de charge est l'ITEM, pas l'instance re-fabriquée à
  // chaque re-dérivage du set. Le contrat se mesure donc par `reloadProgressOf` — une remise à zéro écrite
  // sur la copie laisserait ce test rouge.
  it('interruption : un héros touché en plein rechargement repart de zéro, DANS le registre de son arme (LDB 62 l.335)', () => {
    const { H, E } = archer();
    H.items = [
      { uid: 'w-arb', label: 'Arbalète', kind: 'ranged', subType: 'Arbalète', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [{ id: 'recharge', value: 1 }], enc: 1, equipped: true },
      { uid: 'am1', label: 'Carreau', kind: 'ammo', subType: 'Arbalète', qty: 5, qualities: [], enc: 0, equipped: false },
    ] as ItemInstance[];
    H.loadouts = [{ id: 'arb', main: 'w-arb' }] as never;
    H.activeLoadoutId = 'arb';
    recomputeLoadout(H);
    const arb = rangedOf(H);
    unloadWeapon(H, arb);
    setReloadProgress(H, arb, 1);
    expect(H.items!.find((i) => i.uid === 'w-arb')!.reloadProgress, 'le registre EST l’objet possédé').toBe(1);
    H.pos = { x: 1, y: 0 };
    // PB larges : la touche BLESSE sans DÉPASSER les PB courants → pas d'offre de Déviation Critique
    // (un dépassement EST une Blessure Critique déviable, LDB 63 l.30) qui suspendrait l'application.
    H.wounds = blessuresDeBase(25, 25, H);
    E.pos = { x: 0, y: 0 }; // adjacents
    E.characteristics.force = 60; // gros frappeur → la touche inflige des Blessures
    const atk = { roll: 5, target: 80, success: true, sl: 7, isDouble: false };
    const weapon: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as Weapon;
    // Touche subie SANS défense opposable (cas imposé RAW) → doit interrompre le rechargement.
    const res = resolveMeleePassive(E, H, weapon, atk, { rng: makeRNG(1595) }, 'corps');
    applyAttackResult(banc.getState, banc.setState, E, H, weapon, res);
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.wounds.current).toBeLessThan(h.wounds.max); // a bien encaissé une touche
    expect(reloadProgressOf(h, rangedOf(h))).toBe(0); // rechargement interrompu, DANS le registre
    expect(h.items!.find((i) => i.uid === 'w-arb')!.reloadProgress).toBe(0);
  });
});

describe("Orientation du GROUPE à l'entrée de scène (spawnFacing / heroStart authoré)", () => {
  beforeEach(() => reset());

  const lead = combattantDeTest({ id: 'lead', label: 'L', xp: 0 });

  it('startScene : heroStart au bord sud SANS facing → le groupe regarde le contenu (N, pas le vide POV)', () => {
    const sc = emptyScene('scene-test', 21, 20);
    sc.id = 'sud';
    sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 10, y: 19 } });
    banc.getState().setParty([lead]);
    banc.getState().startScene(sc);
    expect(banc.getState().facing).toEqual({ [CAP_GROUPE]: 'N' });
  });

  it('startScene : heroStart AVEC facing authoré → respecté tel quel', () => {
    const sc = emptyScene('scene-test', 21, 20);
    sc.id = 'authore';
    sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 10, y: 19 }, facing: 'O' });
    banc.getState().setParty([lead]);
    banc.getState().startScene(sc);
    expect(capDuGroupe(banc.getState())).toBe('O');
  });

  it("transitionTo : par point d'entrée nommé → cap recalculé vers le contenu de la NOUVELLE carte (l'authoré du heroStart ne s'applique pas : on ne spawne pas dessus)", () => {
    const a = emptyScene('scene-test', 5, 5);
    a.id = 'a';
    const b = emptyScene('scene-test', 7, 7);
    b.id = 'b';
    b.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 3, y: 3 }, facing: 'O' });
    b.entryPoints = { porte: { x: 3, y: 6 } }; // bord sud de b
    banc.getState().setParty([lead]);
    banc.getState().loadProject({ scenes: [a, b], entryId: 'a', projet: null });
    banc.getState().transitionTo('b', 'porte');
    expect(banc.getState().partyPos).toEqual({ x: 3, y: 6 });
    expect(capDuGroupe(banc.getState())).toBe('N'); // vers le centroïde (3,3), PAS 'O'
  });

  it('transitionTo : sans entrée nommée → spawn au heroStart, facing authoré respecté', () => {
    const a = emptyScene('scene-test', 5, 5);
    a.id = 'a2';
    const b = emptyScene('scene-test', 7, 7);
    b.id = 'b2';
    b.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 3, y: 6 }, facing: 'NE' });
    banc.getState().setParty([lead]);
    banc.getState().loadProject({ scenes: [a, b], entryId: 'a2', projet: null });
    banc.getState().transitionTo('b2');
    expect(capDuGroupe(banc.getState())).toBe('NE');
  });
});

describe('Horloge in-game — gameTime + advanceTime (Phase T1)', () => {
  it('advanceTime fait avancer gameTime (depuis le départ de campagne)', () => {
    banc.setState({ gameTime: campaignStart() });
    banc.getState().advanceTime(90); // +1h30
    expect(banc.getState().gameTime).toBe(campaignStart() + 90);
    banc.getState().advanceTime(MINUTES_PER_DAY); // +1 jour
    expect(banc.getState().gameTime).toBe(campaignStart() + 90 + MINUTES_PER_DAY);
  });

  it('advanceTime est un no-op si minutes ≤ 0', () => {
    banc.setState({ gameTime: campaignStart() });
    banc.getState().advanceTime(0);
    banc.getState().advanceTime(-30);
    expect(banc.getState().gameTime).toBe(campaignStart());
  });
});

describe('« Tout est horodaté » — branchements TIME_COST (Phase T1)', () => {
  beforeEach(() => { banc.abandonner(); reset(); });
  afterEach(() => { banc.abandonner(); });

  it('fouiller (exploration) avance le temps de TIME_COST.search, une seule fois', () => {
    const scene = emptyScene('scene-test', 6, 6);
    scene.id = 'fouille-temps';
    scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    scene.entities.push({ id: 'cadavre', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Cadavre', usable: { actions: [{ id: 'fouiller', unique: true, flow: flowFromEffects([{ type: 'giveMoney', montant: { gold: 1 } }]) }] } });
    banc.setState({ party: [combattantDeTest({ id: 'a', label: 'A', xp: 0, wounds: blessuresDeBase(12), conditions: [] })] });
    banc.getState().startScene(scene);
    banc.setState({ partyPos: { x: 0, y: 0 }, gameTime: campaignStart() });

    banc.getState().interactEntity('cadavre');
    expect(banc.getState().gameTime).toBe(campaignStart() + TIME_COST.search);
    // Re-fouille : retour anticipé (déjà fouillé) → aucun nouvel avancement.
    banc.getState().interactEntity('cadavre');
    expect(banc.getState().gameTime).toBe(campaignStart() + TIME_COST.search);
  });

  it('clôturer un dialogue par une réponse sans suite avance le temps de TIME_COST.dialogue (idempotent)', () => {
    banc.setState({
      gameTime: campaignStart(), screen: 'campaign',
      dialogue: { dialogue: { id: 'd', start: 'n', nodes: [{ id: 'n', desc: '…', choices: [{ id: 'adieu', label: 'Adieu' }] }] }, nodeId: 'n' } as any,
    });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'adieu');
    expect(banc.getState().dialogue).toBeNull();
    expect(banc.getState().gameTime).toBe(campaignStart() + TIME_COST.dialogue);
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'adieu');
    expect(banc.getState().gameTime).toBe(campaignStart() + TIME_COST.dialogue);
  });

  it('franchir un Round de combat avance le temps de TIME_COST.combatRound', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().fenetreValider('roundStart');
    banc.abandonner();
    const b = banc.getState().battle!;
    b.combatants.forEach((c) => { c.fortune = 0; }); // neutralise la pré-emption Chance
    banc.setState({ battle: { ...b, turn: b.order.length - 1 }, gameTime: campaignStart() });
    banc.getState().battleEndTurn(); // dernier tour → advanceTurn franchit le Round
    expect(banc.getState().gameTime).toBe(campaignStart() + TIME_COST.combatRound);
  });

  it('sceneTransition reste à 0 (intérieur) — le point d’appel existe (seam #T2), sans avancer le temps', () => {
    expect(TIME_COST.sceneTransition).toBe(0); // advanceTime(0) = no-op ; paramétrable pour l'extérieur/voyage
  });
});

describe('Effet setTime — forcer l’heure du jour (jour/nuit via trigger, #T1c)', () => {
  beforeEach(() => reset());
  const dayAt = (h: number) => campaignStart() - (campaignStart() % MINUTES_PER_DAY) + h * 60; // un jour donné, à h:00

  it('setTime phase nuit depuis 14:00 → avance à la prochaine 22:00 (8 h)', () => {
    banc.setState({ gameTime: dayAt(14) });
    applyEffects(banc.getState, banc.setState, [{ type: 'setTime', phase: 'nuit' }]);
    expect(banc.getState().gameTime).toBe(dayAt(14) + 8 * 60);
  });
  it('setTime heure précise 02:00 depuis 23:00 → saute en avant (3 h, lendemain)', () => {
    banc.setState({ gameTime: dayAt(23) });
    applyEffects(banc.getState, banc.setState, [{ type: 'setTime', hour: 2 }]);
    expect(banc.getState().gameTime).toBe(dayAt(23) + 3 * 60);
  });
  it('setTime sur la phase déjà courante → no-op (temps ne recule jamais)', () => {
    banc.setState({ gameTime: dayAt(22) }); // déjà au début de 'nuit'
    applyEffects(banc.getState, banc.setState, [{ type: 'setTime', phase: 'nuit' }]);
    expect(banc.getState().gameTime).toBe(dayAt(22));
  });
});

describe('Marchand — openMerchant / achat et vente au panier (#2)', () => {
  beforeEach(() => reset());
  const hero = (): Combatant => combattantDeTest({ id: 'h', label: 'H', items: [], characteristics: {}, wounds: blessuresDeBase(10), conditions: [], weapons: [] });
  const merchantScene = () => {
    const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
    sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } });
    return sc;
  };

  it('openMerchant : crée un stock (Commune toujours présente) + état merchant', () => {
    banc.setState({ party: [hero()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    const m = banc.getState().merchant!;
    expect(m.entityId).toBe('pnj');
    expect(m.stock.length).toBeGreaterThan(0); // au moins les Communes de la catégorie
    expect(m.resaleRate).toBe(0.5); // base ½ du prix listé (LDB 59 l.54)
  });

  it('achat au panier : débite la Bourse, donne l’objet à stats au héros, décrémente la qty', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 5, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const line = banc.getState().merchant!.stock[0];
    const before = toBrass(partyMoneyTotal(banc.getState));
    acheterAuPanier(banc.getState, line.id);
    const st = banc.getState();
    expect(st.party[0].items!.some((i) => i.trappingId === line.id)).toBe(true);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(before);
    expect(st.merchant!.stock.find((l) => l.id === line.id)?.qty ?? 0).toBe(line.qty - 1);
  });

  it('achat au panier refusé si Bourse insuffisante (objet inchangé)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    const line = banc.getState().merchant!.stock[0];
    acheterAuPanier(banc.getState, line.id);
    expect(banc.getState().party[0].items!.length).toBe(0);
  });

  it('panier : addToCart → payCart débite le total + met en attente de répartition → confirm distribue', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    banc.getState().addToCart(id);
    banc.getState().addToCart(id);
    expect(banc.getState().merchant!.cart).toEqual([{ id, qty: 2 }]);
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().payCart();
    const st = banc.getState();
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(before); // total débité
    expect(st.merchant!.cart).toEqual([]); // panier vidé
    expect(st.merchant!.pendingDistribution).toHaveLength(2); // 2 objets en attente de répartition
    st.assignDistribution(0, 'h');
    st.assignDistribution(1, 'h');
    st.fenetreValider('marchand');
    const st2 = banc.getState();
    expect(st2.merchant!.pendingDistribution).toBeNull();
    expect(st2.party[0].items!.filter((i) => i.trappingId === id)).toHaveLength(2);
  });

  it('panier : après Marchandage, AJOUT bloqué mais RETRAIT permis (« j’en prends un de moins »)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty >= 2)!.id;
    banc.getState().addToCart(id);
    banc.getState().addToCart(id); // qty 2
    banc.setState((s) => ({ merchant: { ...s.merchant!, bargainBuy: { won: true, drNet: 2, negotiator: false } } })); // négocié
    banc.getState().addToCart(id); // bloqué
    expect(banc.getState().merchant!.cart.find((c) => c.id === id)!.qty).toBe(2);
    banc.getState().decFromCart(id); // retrait OK
    expect(banc.getState().merchant!.cart.find((c) => c.id === id)!.qty).toBe(1);
  });

  it('Marchandage NON conclu : quitter sans payer → bloqué jusqu’au réassort, PERSISTE à la réouverture', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    banc.getState().addToCart(id);
    banc.setState((s) => ({ merchant: { ...s.merchant!, bargainBuy: { won: true, drNet: 2, negotiator: false } } })); // négocié
    banc.getState().fenetreFermer('marchand'); // quitte SANS payer
    banc.getState().openMerchant('pnj'); // réouverture (même réassort)
    expect(banc.getState().merchant!.bargainLocked).toBe(true); // l'info est gardée
    banc.getState().startBargain('buy');
    expect(banc.getState().pendingBargain).toBeNull(); // le marchand refuse de marchander
  });

  it('refuseBargain(\'buy\') : vide le panier, annule la remise, VERROU PARTAGÉ (bloque achat ET vente), persiste', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    banc.getState().addToCart(id);
    banc.setState((s) => ({ merchant: { ...s.merchant!, bargainBuy: { won: true, drNet: 2, negotiator: false } } })); // négocié
    banc.getState().refuseBargain('buy');
    const st = banc.getState();
    expect(st.merchant!.cart).toEqual([]);
    expect(st.merchant!.bargainBuy ?? null).toBeNull(); // remise annulée
    expect(st.merchant!.bargainLocked).toBe(true);
    // verrou PARTAGÉ : la VENTE est aussi bloquée
    banc.getState().startBargain('sell');
    expect(banc.getState().pendingBargain).toBeNull();
    banc.getState().fenetreFermer('marchand');
    banc.getState().openMerchant('pnj');
    expect(banc.getState().merchant!.bargainLocked).toBe(true); // persiste
  });

  it('refuseBargain(\'sell\') : annule l’offre + VERROU PARTAGÉ (bloque l’ACHAT aussi)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    banc.setState((s) => ({ merchant: { ...s.merchant!, bargainSell: { won: true, drNet: 2, negotiator: false } } })); // vente négociée
    banc.getState().refuseBargain('sell');
    const st = banc.getState();
    expect(st.merchant!.bargainSell ?? null).toBeNull();
    expect(st.merchant!.bargainLocked).toBe(true);
    banc.getState().startBargain('buy'); // achat aussi bloqué
    expect(banc.getState().pendingBargain).toBeNull();
  });

  it('vente négociée puis quittée SANS rien vendre → bloqué (vente non honorée)', () => {
    banc.setState({ party: [{ ...hero(), items: [{ uid: 'd', label: 'Dague', kind: 'melee', qualities: [], enc: 0, equipped: false }] } as any], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.setState((s) => ({ merchant: { ...s.merchant!, bargainSell: { won: true, drNet: 2, negotiator: false } } }));
    banc.getState().fenetreFermer('marchand'); // quitte sans vendre
    banc.getState().openMerchant('pnj');
    expect(banc.getState().merchant!.bargainLocked).toBe(true);
  });

  it('Marchandage CONCLU (payé) : pas de blocage à la réouverture', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    banc.getState().addToCart(id);
    banc.setState((s) => ({ merchant: { ...s.merchant!, bargainBuy: { won: true, drNet: 2, negotiator: false } } }));
    banc.getState().payCart(); // scelle le deal (paie)
    banc.getState().fenetreFermer('marchand');
    banc.getState().openMerchant('pnj');
    expect(banc.getState().merchant!.bargainLocked).toBe(false); // pas de pénalité
  });

  it('panier : addToCart plafonne à la quantité en stock', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const line = banc.getState().merchant!.stock.find((l) => l.qty > 0)!;
    for (let i = 0; i < line.qty + 5; i++) banc.getState().addToCart(line.id);
    expect(banc.getState().merchant!.cart.find((c) => c.id === line.id)!.qty).toBe(line.qty);
  });

  it('addToCart : refuse une unité que la Bourse ne couvre pas (panier vide)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 0, silver: 0, brass: 1 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    banc.getState().addToCart(id);
    expect(banc.getState().merchant!.cart).toHaveLength(0);
  });

  it('payCart : refuse si Bourse insuffisante (panier intact, rien en répartition)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    banc.getState().addToCart(id);
    banc.setState({ party: [withBourseMoney(banc.getState().party[0], { gold: 0, silver: 0, brass: 1 })] }); // la bourse fond entre le panier et le paiement
    banc.getState().payCart();
    const st = banc.getState();
    expect(st.merchant!.pendingDistribution ?? null).toBeNull();
    expect(st.merchant!.cart).toHaveLength(1);
  });

  it('la sortie du marchand valide une répartition en attente (objets non perdus, par défaut au 1er héros)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    banc.getState().addToCart(id);
    banc.getState().payCart();
    banc.getState().fenetreFermer('marchand'); // ferme sans confirmer → flush au sac du 1er héros
    expect(banc.getState().party[0].items!.some((i) => i.trappingId === id)).toBe(true);
  });

  it('vente (panier) : crédite resaleRate × prix et retire l’objet du héros', () => {
    const h = hero(); h.items = [{ uid: 'x', trappingId: 'hallebarde', label: 'Hallebarde', kind: 'melee', qualities: [], enc: 3, equipped: false }] as any;
    banc.setState({ party: [h], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().addToSellCart('x', 'h');
    banc.getState().confirmSell();
    const st = banc.getState();
    expect(st.party[0].items!.find((i) => i.uid === 'x')).toBeUndefined();
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeGreaterThan(0); // Hallebarde 2 CO × 10 %
  });

  it('repairItem : reset damageTaken contre 10 %/PA, débite la Bourse (#2d)', () => {
    const h = hero(); h.items = [{ uid: 'a', trappingId: 'chemise-de-mailles', label: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 2, qualities: [], enc: 1, equipped: true } as any];
    banc.setState({ party: [h], scene: merchantScene() }); seedBourse({ gold: 5, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().repairItem('a', 'h');
    const st = banc.getState();
    expect(st.party[0].items!.find((i) => i.uid === 'a')!.damageTaken).toBe(0); // réparé
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(before); // débité
  });

  it('repairItem : ignore une armure intacte (damageTaken 0) — pas de débit', () => {
    const h = hero(); h.items = [{ uid: 'b', label: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 0, qualities: [], enc: 1, equipped: true } as any];
    banc.setState({ party: [h], scene: merchantScene() }); seedBourse({ gold: 5, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().repairItem('b', 'h');
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(before); // rien à réparer
  });

  it('repairItem : répare une ARME endommagée à 10 %/point (LDB 62 l.135)', () => {
    const h = hero(); h.items = [{ uid: 'w', trappingId: 'dague', label: 'Dague', kind: 'melee', damage: { plusBF: true, flat: 2 }, damageTaken: 1, qualities: [], enc: 0, equipped: true } as any];
    banc.setState({ party: [h], scene: merchantScene() }); seedBourse({ gold: 5, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().repairItem('w', 'h');
    const st = banc.getState();
    expect(st.party[0].items!.find((i) => i.uid === 'w')!.damageTaken).toBe(0); // réparée
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(before); // débité
  });

  const negotiator = (): Combatant => combattantDeTest({ id: 'h', label: 'H', items: [], characteristics: { sociabilite: 40 }, skills: [], talents: [], wounds: blessuresDeBase(10), conditions: [], weapons: [] });

  it('startBargain : crée un pendingBargain (marchand = bargainSkill de l’archétype) (#2c)', () => {
    banc.setState({ party: [negotiator()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().startBargain('buy');
    const pb = banc.getState().pendingBargain!;
    expect(pb).toBeTruthy();
    expect(pb.playerId).toBe('h');
    expect(pb.opposant.valeur).toBe(45); // armurier.bargainSkill
  });

  it('jetConfirm@bargain : verrouille le MODE achat ; 2ᵉ achat no-op mais la vente reste possible (B, #2c)', () => {
    banc.setState({ party: [negotiator()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().startBargain('buy');
    // force un résultat gagné, sans RNG
    const pb = banc.getState().pendingBargain!;
    const win = { roll: 10, target: 40, success: true, sl: 3, isDouble: false };
    const lose = { roll: 80, target: 45, success: false, sl: -3, isDouble: false };
    banc.setState({ pendingBargain: { ...pb, roll: win, merchantRoll: lose, result: { attacker: win, defender: lose, winner: 'attacker', attackerWins: true, netSL: 6, decidedBy: 'dr' } } });
    banc.getState().jetConfirm('bargain');
    expect(banc.getState().pendingBargain).toBeNull();
    expect(banc.getState().merchant!.bargainBuy).toEqual({ won: true, drNet: 6, negotiator: false });
    expect(banc.getState().merchant!.soured).toBeFalsy(); // gagné → pas de méfiance
    banc.getState().startBargain('buy'); // achat déjà négocié → no-op
    expect(banc.getState().pendingBargain).toBeNull();
    banc.getState().startBargain('sell'); // la vente est une négociation DISTINCTE → s'ouvre
    expect(banc.getState().pendingBargain?.contrepartie).toEqual({ kind: 'marchand', mode: 'sell', titre: t('out.bargainTitreVente') });
  });

  it('jetConfirm@bargain : un échec « de beaucoup » (net DR ≥ 6) rend le marchand méfiant → plus de marchandage (C, #2c)', () => {
    banc.setState({ party: [negotiator()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().startBargain('buy');
    const pb = banc.getState().pendingBargain!;
    const lose = { roll: 90, target: 40, success: false, sl: -5, isDouble: false };
    const win = { roll: 10, target: 45, success: true, sl: 3, isDouble: false };
    banc.setState({ pendingBargain: { ...pb, roll: lose, merchantRoll: win, result: { attacker: lose, defender: win, winner: 'defender', attackerWins: false, netSL: 8, decidedBy: 'dr' } } });
    banc.getState().jetConfirm('bargain');
    expect(banc.getState().merchant!.soured).toBe(true);
    banc.getState().startBargain('sell'); // marchand méfiant → toute négociation bloquée
    expect(banc.getState().pendingBargain).toBeNull();
  });

  it('achat au panier : applique le facteur de Marchandage verrouillé (−20 % < plein) (#2c)', () => {
    const buyWith = (bargain: { won: boolean; drNet: number; negotiator: boolean } | null): number => {
      reset();
      banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
      banc.getState().openMerchant('pnj');
      const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
      banc.getState().addToCart(id); // le Marchandage porte sur le panier déjà composé (LDB 59 l.43)
      banc.setState({ merchant: { ...banc.getState().merchant!, bargainBuy: bargain } });
      const before = toBrass(partyMoneyTotal(banc.getState));
      banc.getState().payCart();
      return before - toBrass(partyMoneyTotal(banc.getState));
    };
    const full = buyWith(null);
    const discounted = buyWith({ won: true, drNet: 6, negotiator: false }); // ×0.8
    expect(full).toBeGreaterThan(0);
    expect(discounted).toBeLessThan(full);
  });

  it('vente (panier), LDB 59 l.54 + arbitrage #2547 : défaut/perdu = ¼, GAGNÉ = ½, gagné + Négociateur = ½ × 1,1', () => {
    const sellWith = (bargainSell: { won: boolean; drNet: number; negotiator: boolean } | null): number => {
      const h = hero(); h.items = [{ uid: 'x', trappingId: 'hallebarde', label: 'Hallebarde', kind: 'melee', qualities: [], enc: 3, equipped: false }] as any;
      reset();
      banc.setState({ party: [h], scene: merchantScene() });
      banc.getState().openMerchant('pnj');
      const m = banc.getState().merchant!;
      banc.setState({ merchant: { ...m, bargainSell } });
      banc.getState().addToSellCart('x', 'h');
      banc.getState().confirmSell();
      return toBrass(partyMoneyTotal(banc.getState));
    };
    const lowball = sellWith(null); // ¼ par défaut (le marchand lowballe)
    const won = sellWith({ won: true, drNet: 2, negotiator: false }); // ½ (on a tenu notre prix)
    const lost = sellWith({ won: false, drNet: 0, negotiator: false }); // ¼ (rabaissé)
    const wonNegotiator = sellWith({ won: true, drNet: 2, negotiator: true });
    const lostNegotiator = sellWith({ won: false, drNet: 1, negotiator: true });
    expect(won).toBe(2 * lowball); // gagner le marchandage double le gain
    expect(wonNegotiator).toBe(Math.round(won * 1.1)); // Négociateur : +10 % (LDB 10 l.818)
    expect(lost).toBe(lowball); // perdre = ne pas négocier = ¼
    expect(lostNegotiator).toBe(lowball);
  });

  it('achat au panier : applique la majoration d’achat paramétrable (buyMarkup) — marchand plus cher (#2)', () => {
    const buyAt = (markup: number): number => {
      reset();
      banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 50, silver: 0, brass: 0 });
      banc.getState().openMerchant('pnj');
      const m = banc.getState().merchant!;
      banc.setState({ merchant: { ...m, buyMarkup: markup } });
      const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
      const before = toBrass(partyMoneyTotal(banc.getState));
      acheterAuPanier(banc.getState, id);
      return before - toBrass(partyMoneyTotal(banc.getState));
    };
    expect(buyAt(1.5)).toBeGreaterThan(buyAt(1)); // +50 % → coûte plus cher
  });

  const appraiser = (): Combatant => combattantDeTest({ id: 'h', label: 'H', kind: 'hero', characteristics: { intelligence: 30 }, skills: [{ id: 'evaluation', characteristic: 'intelligence', advances: 10 }], talents: [], items: [{ uid: 'm', label: 'Épée', kind: 'melee', qualities: [{ id: 'de-plaies-atroces' }], enc: 1, equipped: false, identified: false }], wounds: blessuresDeBase(10), conditions: [], weapons: [] });

  it('appraiseItem : crée un pendingAppraise sur l’objet non identifié (#2e)', () => {
    banc.setState({ party: [appraiser()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().appraiseItem('m', 'h');
    const pa = banc.getState().pendingAppraise!;
    expect(pa).toBeTruthy();
    expect(pa.itemUid).toBe('m');
    expect(pa.target).toBe(40); // Int 30 + Évaluation 10, Intermédiaire +0
  });

  it('appraiseItem : personne qui puisse tenter l’Évaluation (LDB 09 l.30) → refus NOMMÉ, aucune fenêtre', () => {
    const profane = { ...appraiser(), skills: [] } as Combatant;
    banc.setState({ party: [profane], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().appraiseItem('m', 'h');
    expect(banc.getState().pendingAppraise).toBeNull();
    expect(banc.getState().journal.slice(-1)[0]).toBe('Personne dans le groupe ne peut tenter le Test d’Évaluation.');
  });

  it('jetConfirm@appraise : succès → identified=true (révèle l’objet) (#2e)', () => {
    banc.setState({ party: [appraiser()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().appraiseItem('m', 'h');
    const pa = banc.getState().pendingAppraise!;
    banc.setState({ pendingAppraise: { ...pa, roll: 10, success: true, sl: 2 } });
    banc.getState().jetConfirm('appraise');
    expect(banc.getState().party[0].items!.find((i) => i.uid === 'm')!.identified).toBe(true);
    expect(banc.getState().pendingAppraise).toBeNull();
  });

  it('jetConfirm@appraise : échec → l’objet reste non identifié (#2e)', () => {
    banc.setState({ party: [appraiser()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().appraiseItem('m', 'h');
    const pa = banc.getState().pendingAppraise!;
    banc.setState({ pendingAppraise: { ...pa, roll: 90, success: false, sl: -3 } });
    banc.getState().jetConfirm('appraise');
    expect(banc.getState().party[0].items!.find((i) => i.uid === 'm')!.identified).toBe(false);
  });

  it('Effet openMerchant : ouvre la boutique d’une entité depuis un dialogue (#2)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() });
    applyEffects(banc.getState, banc.setState, [{ type: 'openMerchant', entityId: 'pnj' }]);
    expect(banc.getState().merchant?.entityId).toBe('pnj');
  });

  it('re-stock : la déplétion PERSISTE entre visites sans temps écoulé (#T3)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 5, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    const q0 = banc.getState().merchant!.stock.find((l) => l.id === id)!.qty;
    acheterAuPanier(banc.getState, id);
    banc.getState().fenetreFermer('marchand');
    banc.getState().openMerchant('pnj'); // ré-ouverture immédiate → stock déplété conservé
    expect(banc.getState().merchant!.stock.find((l) => l.id === id)!.qty).toBe(q0 - 1);
  });

  it('re-stock : après ≥ restockDays (1 j), le stock est re-tiré frais (#T3)', () => {
    const t0 = banc.getState().gameTime;
    banc.setState({ party: [hero()], scene: merchantScene() }); seedBourse({ gold: 5, silver: 0, brass: 0 });
    banc.getState().openMerchant('pnj');
    const rolled0 = banc.getState().merchantStocks['pnj'].rolledAt;
    const id = banc.getState().merchant!.stock.find((l) => l.qty > 0)!.id;
    acheterAuPanier(banc.getState, id);
    banc.getState().fenetreFermer('marchand');
    banc.setState({ gameTime: t0 + 2 * 24 * 60 }); // +2 jours (≥ restockDays défaut 1)
    banc.getState().openMerchant('pnj');
    const rolled1 = banc.getState().merchantStocks['pnj'].rolledAt;
    expect(rolled1).toBeGreaterThan(rolled0); // re-tiré au nouveau temps (stock frais)
    expect(rolled1).toBe(t0 + 2 * 24 * 60);
  });
});

describe('transferItem — donner un objet à un autre héros', () => {
  const h = (id: string, items: unknown[] = []): Combatant =>
    combattantDeTest({ id, label: id.toUpperCase(), items: items as ItemInstance[], characteristics: {}, wounds: blessuresDeBase(10), conditions: [], weapons: [] });

  it('déplace l’objet (retiré de la source, ajouté NON équipé chez la cible)', () => {
    const a = h('a', [{ uid: 'x', label: 'Épée bâtarde', kind: 'melee', qualities: [], enc: 2, equipped: true }]);
    banc.setState({ party: [a, h('b')] });
    banc.getState().transferItem('x', 'a', 'b');
    const st = banc.getState();
    expect(st.party.find((c) => c.id === 'a')!.items!.find((i) => i.uid === 'x')).toBeUndefined();
    const moved = st.party.find((c) => c.id === 'b')!.items!.find((i) => i.uid === 'x');
    expect(moved).toBeTruthy();
    expect(moved!.equipped).toBe(false); // arrive non équipé chez le destinataire
  });
  it('no-op si même héros ou objet absent', () => {
    const a = h('a', [{ uid: 'x', label: 'Dague', kind: 'melee', qualities: [], enc: 0, equipped: false }]);
    banc.setState({ party: [a, h('b')] });
    banc.getState().transferItem('x', 'a', 'a'); // même héros
    banc.getState().transferItem('zzz', 'a', 'b'); // objet inexistant
    expect(banc.getState().party.find((c) => c.id === 'a')!.items!.length).toBe(1);
    expect(banc.getState().party.find((c) => c.id === 'b')!.items!.length).toBe(0);
  });
});

describe('Marché — règles optionnelles (market-mode / market-guild)', () => {
  beforeEach(() => reset());
  afterEach(() => { resetRule('market-mode'); resetRule('market-guild'); });
  const hero = (): Combatant => combattantDeTest({ id: 'h', label: 'H', items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: blessuresDeBase(10), conditions: [], weapons: [] });
  const merchantScene = () => {
    const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
    sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } });
    return sc;
  };

  it("market-mode 'sans-disponibilite' : le stock est un superset du mode complet (tout le catalogue, pas de Test)", () => {
    banc.setState({ party: [hero()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    const complet = banc.getState().merchant!.stock.length;
    banc.setState({ merchant: null, merchantStocks: {} });
    setRule('market-mode', 'sans-disponibilite');
    banc.getState().openMerchant('pnj');
    const sansDispo = banc.getState().merchant!.stock.length;
    expect(sansDispo).toBeGreaterThan(0);
    expect(sansDispo).toBeGreaterThanOrEqual(complet);
  });

  it("market-mode 'sans-marchandage' : startBargain ne propose plus de Marchandage", () => {
    banc.setState({ party: [hero()], scene: merchantScene() });
    banc.getState().openMerchant('pnj');
    banc.getState().startBargain('buy');
    expect(banc.getState().pendingBargain).not.toBeNull(); // complet : Marchandage proposé
    banc.setState({ pendingBargain: null });
    setRule('market-mode', 'sans-marchandage');
    banc.getState().startBargain('buy');
    expect(banc.getState().pendingBargain).toBeNull(); // désactivé
  });

  it('market-guild : openMerchant produit un stock valide (Guildes câblées sans casse)', () => {
    banc.setState({ party: [hero()], scene: merchantScene() });
    setRule('market-guild', true);
    banc.getState().openMerchant('pnj');
    expect(banc.getState().merchant!.stock.length).toBeGreaterThan(0);
  });
});
