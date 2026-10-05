/**
 * #1050 — chemin COMPLET des gestes remis en surface : allowlist (`GUEST_INTENTS`) → possession
 * (`intentAllowedFor`) → action jouée AU NOM du siège (`withActingSeat`) → EFFET dans l'état. Le
 * défaut mesuré n'était PAS un refus : hors allowlist, `netFlow` n'enrobe pas l'action, l'invité la
 * joue sur SON store, et le snapshot suivant de l'hôte l'efface — sans message ni journal.
 *
 * Quatre familles, une par cause :
 *  - opposition de cible (`oppositionResist`/`oppositionConfirm`) : la cible d'un Sort opposé pouvait
 *    jeter mais pas appliquer ;
 *  - hotbar (`battleSelectAttack`) : rendue dès `controlsCombatant`, clic invité = no-op silencieux ;
 *  - Tir rapide (`armPreempt`/`preemptRangedShot`, Talent « Tir rapide ») : pendant la pause de début
 *    de Round il n'y a AUCUN combattant actif, donc le repli universel rendait l'hôte ;
 *  - Résistance (Menace) d'une étape de cascade (`cascadeResist`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { initialFields } from './stateFields';
import { intentAllowedFor, withActingSeat, seatInfluences } from './netOwnership';
import { GUEST_INTENTS } from '../net/intents';
import { seedBattleRng } from './battleRng';
import { bonus } from '../engine/characteristics';
import type { Combatant, Weapon } from '../engine/types';
import { cascadeDeTest } from './cascadeTestKit';
import { fixtureText } from '../i18n/fixtureText';

const NET0 = useGame.getState().net;
const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 55, force: 35, endurance: 43, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 };
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
const BOW = (uid: string): Weapon =>
  ({ uid, name: 'Arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 30, qualities: [] } as unknown as Weapon);

const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...CHARS }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [BOW(`w-${id}`)], loaded: true, advantage: 0, size: 'moyenne', pos, wounds: { base: 14, max: 14, current: 14 },
     resolve: 2, fortune: 2, resilience: 1, armour: ARM(), movement: 4, ...over } as unknown as Combatant);

/** Scène plate 10×8 (sol) : Ligne de Vue dégagée pour le Tir rapide. */
const SCENE = () =>
  ({ ambiance: 'exterieur', weather: 'clair', dimensions: { w: 10, h: 8 }, layers: [{ z: 0, tiles: Array(80).fill('sol') }], entities: [] }) as never;

/**
 * Arène coop : `h2` (siège 1) est le TIREUR / la cible du Sort ; `h3` (siège 2) est un tiers ; `e1` est
 * l'ennemi (aucun siège MJ : le camp ennemi est à l'IA). `turn = -1` = pause de début de Round.
 */
function setup(net: Record<string, unknown> = {}, turn = 0) {
  seedBattleRng(7);
  const h2 = mk('h2', 'hero', { x: 0, y: 0 }, { talents: [{ talentId: 'tir-rapide', times: 1 }, { talentId: 'resistance', spec: 'magie', times: 1 }] as never });
  const h3 = mk('h3', 'hero', { x: 0, y: 4 });
  const e1 = mk('e1', 'enemy', { x: 3, y: 0 });
  const battle: BattleState = {
    combatants: [h2, h3, e1], order: ['h2', 'h3', 'e1'], baseOrder: ['h2', 'h3', 'e1'],
    turn, round: 2, action: null, selectedSpellId: null, selectedAttack: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    ...initialFields(), battle, mode: 'battle', scene: SCENE(), party: [h2, h3], gameTime: 0,
    net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { h2: 1, h3: 2 },
           slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité A', 2: 'Invité B' }, ...net },
  });
  return { h2, h3, e1 };
}

/** REJOUE `netFlow.applyIntent` : allowlist côté transport, puis possession, puis appel AU NOM du siège. */
function applyIntent(seat: number, action: string, args: unknown[] = []): 'hors-allowlist' | 'refusé' | 'appliqué' {
  if (!GUEST_INTENTS.has(action)) return 'hors-allowlist';
  if (!intentAllowedFor(useGame.getState(), seat, action, args)) return 'refusé';
  const fn = (useGame.getState() as unknown as Record<string, unknown>)[action];
  if (typeof fn === 'function') withActingSeat(seat, () => (fn as (...a: unknown[]) => void)(...args));
  return 'appliqué';
}

const reset = () => useGame.setState({ ...initialFields(), battle: null, net: NET0, party: [] });

/** Sort ENNEMI opposé, figé, dont `h2` (siège 1) est la cible : la fenêtre d'incantation est PARTAGÉE
 *  (étape `groupOwner` → owner de modale '*'), la rangée d'opposition appartient à `h2`. */
function ouvreOpposition() {
  useGame.setState({
    pendingCascade: cascadeDeTest([{ id: 's0', kind: 'castJet', jet: 'cast', groupOwner: true }]),
    pendingCast: {
      casterId: 'e1', targetId: 'h2', spellId: 'fauche-demon', missile: false, focused: false,
      result: { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'x' },
    } as never,
    pendingCastOpposition: { participants: [{ id: 'h2', interactive: true, result: null }], kind: 'resist', char: 'force-mentale', menace: 'magie' } as never,
  });
}

describe('#1050 — opposition de cible : la cible invitée RÉSISTE et APPLIQUE (Sort ennemi)', () => {
  beforeEach(reset);

  it('oppositionResist : seul le siège de la CIBLE l’obtient, et son auto-succès est écrit', () => {
    setup();
    ouvreOpposition();
    expect(applyIntent(2, 'oppositionResist', ['h2']), 'un tiers brûlait le Talent de la cible').toBe('refusé');
    expect(applyIntent(0, 'oppositionResist', ['h2']), 'l’hôte n’est pas le porteur de la rangée').toBe('refusé');
    expect(useGame.getState().pendingCastOpposition!.participants[0].result).toBeNull();
    expect(applyIntent(1, 'oppositionResist', ['h2'])).toBe('appliqué');
    const part = useGame.getState().pendingCastOpposition!.participants[0];
    expect(part.result!.resisted, 'la cible résiste (LDB : le Test réussit d’office)').toBe(true);
    expect(part.result!.oppose.sl, 'DR imposé = Bonus d’Endurance').toBe(bonus(43));
  });

  it('oppositionConfirm : la cible invitée APPLIQUE — la fenêtre d’opposition se referme', () => {
    setup();
    ouvreOpposition();
    expect(applyIntent(1, 'oppositionResist', ['h2'])).toBe('appliqué');
    expect(applyIntent(1, 'oppositionConfirm', []), 'la cible pouvait jeter mais pas appliquer').toBe('appliqué');
    expect(useGame.getState().pendingCastOpposition, 'l’opposition reste ouverte : le Sort ne se résout jamais').toBeNull();
  });

  it('« Appliquer » d’une fenêtre PARTAGÉE reste une décision de GROUPE (mesure de la route écartée)', () => {
    setup();
    ouvreOpposition();
    const s = useGame.getState();
    // Router `oppositionConfirm` sur le LANCEUR (patron mono `jetOwner`) rendrait le Sort inapplicable :
    // le lanceur est un ENNEMI et aucun siège ne porte le rôle MJ → personne ne peut le clore.
    for (const seat of [0, 1, 2]) expect(seatInfluences(s, seat, 'e1'), `siège ${seat} sur le lanceur ennemi`).toBe(false);
    // La règle retenue (repli sur le owner de la fenêtre, '*') laisse la fenêtre applicable par ses
    // participants — l'agrégation elle-même REFUSE tant qu'une rangée interactive n'a pas jeté.
    for (const seat of [0, 1, 2]) expect(intentAllowedFor(s, seat, 'oppositionConfirm', []), `siège ${seat}`).toBe(true);
    applyIntent(0, 'oppositionConfirm', []);
    expect(useGame.getState().pendingCastOpposition, 'agrégation d’une rangée DUE : refusée par l’action').not.toBeNull();
  });

  it('NON-RÉGRESSION SOLO : hors coop, la cible résiste et applique comme avant', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    ouvreOpposition();
    useGame.getState().oppositionResist('h2');
    useGame.getState().oppositionConfirm();
    expect(useGame.getState().pendingCastOpposition).toBeNull();
  });

  /**
   * `oppositionRollAll` (verbe NULLAIRE du drive d'auto-cadence, #1030) roule les rangées que le siège
   * ÉMETTEUR influence. Deux mesures dans un même geste : la ROUTE (posséder une rangée due suffit —
   * le repli aurait rendu la fenêtre au owner de la modale) et l'EFFET (l'hôte exécute au nom du siège
   * émetteur : sans siège AGISSANT dans `influencesLocally`, il roulait SES rangées à lui).
   */
  it('oppositionRollAll : le siège émetteur roule SA rangée, jamais celle d’un autre siège', () => {
    setup();
    ouvreOpposition();
    const pco = useGame.getState().pendingCastOpposition!;
    useGame.setState({ pendingCastOpposition: { ...pco, participants: [
      { id: 'h2', interactive: true, result: null }, { id: 'h3', interactive: true, result: null },
    ] } as never });
    expect(applyIntent(1, 'oppositionRollAll', [])).toBe('appliqué');
    const parts = useGame.getState().pendingCastOpposition!.participants;
    expect(parts.find((p) => p.id === 'h2')!.result, 'la rangée du siège émetteur').not.toBeNull();
    expect(parts.find((p) => p.id === 'h3')!.result, 'l’hôte roulait la rangée d’un AUTRE siège').toBeNull();
  });
});

describe('#1050 — hotbar : le geste de l’invité sur SON héros actif atteint l’hôte', () => {
  beforeEach(reset);

  it('battleSelectAttack : le siège du combattant ACTIF arme son attaque ; un tiers est refusé', () => {
    setup(); // tour de `h2` (siège 1)
    expect(applyIntent(2, 'battleSelectAttack', ['arme-2']), 'un tiers pilotait le tour d’autrui').toBe('refusé');
    expect(applyIntent(0, 'battleSelectAttack', ['arme-2']), 'l’hôte ne possède pas le combattant actif').toBe('refusé');
    expect(useGame.getState().battle!.selectedAttack).toBeNull();
    expect(applyIntent(1, 'battleSelectAttack', ['arme-2'])).toBe('appliqué');
    expect(useGame.getState().battle!.selectedAttack, 'le geste s’exécutait chez l’invité puis mourait au snapshot').toBe('arme-2');
  });

  it('NON-RÉGRESSION SOLO : le joueur arme son attaque hors coop', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    useGame.getState().battleSelectAttack('arme-2');
    expect(useGame.getState().battle!.selectedAttack).toBe('arme-2');
  });
});

describe('#1050 — Tir rapide (Talent) : l’invité arme sa visée et tire pendant la pause de Round', () => {
  beforeEach(reset);

  const pause = () => {
    setup({}, -1);
    useGame.setState({ pendingRoundStart: { round: 2 } as never });
  };

  it('armPreempt : le siège du TIREUR arme ; l’hôte (que le repli désignait) est refusé', () => {
    pause();
    expect(applyIntent(2, 'armPreempt', ['h2']), 'un tiers armait la visée d’autrui').toBe('refusé');
    expect(applyIntent(0, 'armPreempt', ['h2']), 'sans route, le repli rendait l’hôte (aucun actif en pause)').toBe('refusé');
    expect(useGame.getState().preemptAiming).toBeNull();
    expect(applyIntent(1, 'armPreempt', ['h2'])).toBe('appliqué');
    expect(useGame.getState().preemptAiming).toBe('h2');
  });

  it('clic-token sous visée armée : le tir d’interruption s’ouvre pour le TIREUR, pas pour un tiers', () => {
    pause();
    expect(applyIntent(1, 'armPreempt', ['h2'])).toBe('appliqué');
    expect(applyIntent(2, 'battleClickEntity', ['e1']), 'un tiers déclenchait le Tir rapide d’autrui').toBe('refusé');
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(applyIntent(1, 'battleClickEntity', ['e1'])).toBe('appliqué');
    const pa = useGame.getState().pendingAttack;
    expect(pa?.attackerId).toBe('h2');
    expect(pa?.targetId).toBe('e1');
    expect(pa?.interrupt, 'le tir hors de l’ordre d’Initiative').toBe(true);
  });

  it('preemptRangedShot (défense en profondeur) : routé sur le tireur, avec effet', () => {
    pause();
    expect(applyIntent(2, 'preemptRangedShot', ['h2', 'e1'])).toBe('refusé');
    expect(applyIntent(0, 'preemptRangedShot', ['h2', 'e1'])).toBe('refusé');
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(applyIntent(1, 'preemptRangedShot', ['h2', 'e1'])).toBe('appliqué');
    expect(useGame.getState().pendingAttack?.interrupt).toBe(true);
  });

  it('hors pause de Round, le geste n’appartient à personne (la fenêtre n’existe pas)', () => {
    setup(); // aucun `pendingRoundStart`
    for (const seat of [0, 1, 2]) expect(applyIntent(seat, 'armPreempt', ['h2']), `siège ${seat}`).toBe('refusé');
  });

  it('NON-RÉGRESSION SOLO : le joueur arme et tire son Tir rapide hors coop', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] }, -1);
    useGame.setState({ pendingRoundStart: { round: 2 } as never });
    useGame.getState().armPreempt('h2');
    expect(useGame.getState().preemptAiming).toBe('h2');
    useGame.getState().battleClickEntity('e1');
    expect(useGame.getState().pendingAttack?.interrupt).toBe(true);
  });
});

describe('#1050 — Résistance (Menace) d’une étape de cascade : routée sur l’acteur de l’étape', () => {
  beforeEach(reset);

  /** Étape de GROUPE (`groupOwner` → owner de modale '*') portant l'acteur `h2` et un tag `menace`. */
  const cascadeMenace = () => {
    setup();
    useGame.setState({
      pendingCascade: cascadeDeTest([
        { id: 'st0', kind: 'combatEndDisease', actorId: 'h2', groupOwner: true, menace: 'magie', label: fixtureText('Menace'), target: 40, rollLabel: 'Résistance' },
      ]),
    });
  };

  it('cascadeResist : le siège de l’acteur de l’étape agit ; la fenêtre partagée n’ouvre PAS le geste à tous', () => {
    cascadeMenace();
    expect(applyIntent(2, 'cascadeResist', ['st0']), 'étape partagée : un tiers brûlait la Résistance d’autrui').toBe('refusé');
    expect(applyIntent(0, 'cascadeResist', ['st0'])).toBe('refusé');
    expect(useGame.getState().pendingCascade!.participants[0].result).toBeUndefined();
    expect(applyIntent(1, 'cascadeResist', ['st0'])).toBe('appliqué');
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.result!.success).toBe(true);
    expect(step.result!.sl, 'DR imposé = Bonus d’Endurance').toBe(bonus(43));
  });

  it('étape INCONNUE (fermée) : personne ne joue le verbe', () => {
    cascadeMenace();
    for (const seat of [0, 1, 2]) expect(applyIntent(seat, 'cascadeResist', ['inexistante']), `siège ${seat}`).toBe('refusé');
  });
});
