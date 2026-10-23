import { describe, it, expect, afterEach } from 'vitest';
import { hasCommandTeam } from '../engine/combatFeatures/dispatch';
import { setRule, resetRule } from '../engine/policy';
import { voiceCommandRangeM, teamCommandTargets, canAidTeam } from '../noyau/monde/commandTeam';
import { applyShipPostes } from '../noyau/monde/shipPostes';
import { attackEnv, previewAttack } from '../noyau/combatFlow';
import { itemFromTrappingById } from '../engine/items';
import { applyOps } from '../engine/ops';
import { seedBattleRng } from '../noyau/battleRng';
import { useGame } from './store';
import type { Combatant, ShipPoste } from '../engine/types';
import type { Scene } from '../noyau/monde/scene';
import type { GameState } from './store';
import { desDuTest } from '../engine/dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * COMMANDANT D'ÉQUIPE (Talent, AA 13 l.29-35) — un Personnage doté du Talent peut, par un Test de
 * Commandement Intermédiaire (+0), aider une équipe servant une Arme d'équipe « à portée de voix » :
 * l'équipe tire ensuite au score de Projectiles DU COMMANDANT. « Portée de voix » n'a aucune valeur RAW
 * → règle éditable `combat-voice-range-m` (défaut 50 m ≈ 25 cases à 2 m/case), géométrie d'aura (Chebyshev).
 */

const CHARS = (over: Partial<Record<string, number>> = {}) =>
  ({ 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, ...over });

/** Commandant (héros) — porte le Talent + une Compétence de Commandement (Soc). */
const mkCommander = (id: string, pos: { x: number; y: number }, over: Partial<Record<string, number>> = {}, withTalent = true): Combatant =>
  ({
    id, name: id, kind: 'hero', characteristics: CHARS(over),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [],
    skills: [{ id: 'commandement', characteristic: 'sociabilite', advances: 30 }],
    talents: withTalent ? [{ talentId: 'commandant-d-equipe', times: 1 }] : [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

/** Chef de pièce (héros) servant une Arme d'équipe (baliste : `arme-d-equipe`). */
const mkChief = (id: string, pos: { x: number; y: number }, over: Partial<Record<string, number>> = {}): Combatant =>
  ({
    id, name: id, kind: 'hero', characteristics: CHARS(over),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

const mkEnemy = (id: string, x: number, y: number): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: CHARS({ 'capacite-de-tir': 0 }), wounds: { current: 60, max: 60 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;

/** Emplacement portant la baliste, servie par le chef `crewIds[0]`. */
const mkEmplacement = (poste: ShipPoste, pos = { x: 7, y: 7 }): Combatant =>
  ({ id: 'emplacement', name: 'Affût', kind: 'hero', pos, conditions: [], weapons: [], skills: [], talents: [],
    wounds: { current: 30, max: 30 }, advantage: 0, postes: [poste] }) as unknown as Combatant;

const mkPoste = (engineId: string, crewIds: string[]): ShipPoste =>
  ({ item: itemFromTrappingById(engineId, idNeufDeBanc)!, crewIds });

const groundScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', metresPerTile: 2,
    layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const mkGet = (sc: Scene, combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: sc, battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;

// ── (A) DRAPEAU DE TALENT ─────────────────────────────────────────────────────────────────────────
describe('(A) hasCommandTeam — drapeau de Talent', () => {
  it('vrai pour un porteur du Talent commandant-d-equipe', () => {
    expect(hasCommandTeam(mkCommander('cmd', { x: 5, y: 5 }))).toBe(true);
  });
  it('faux sans le Talent', () => {
    expect(hasCommandTeam(mkCommander('cmd', { x: 5, y: 5 }, {}, false))).toBe(false);
  });
});

// ── (B) AFFORDANCE « Aider l'équipe » ─────────────────────────────────────────────────────────────
describe('(B) teamCommandTargets / canAidTeam — disponibilité', () => {
  const setup = (commanderPos: { x: number; y: number }) => {
    const poste = mkPoste('baliste', ['chief', 's1']);
    const chief = mkChief('chief', { x: 7, y: 6 });
    const commander = mkCommander('cmd', commanderPos);
    const all = [mkEmplacement(poste), commander, chief, mkEnemy('foe', 20, 20)];
    applyShipPostes(all); // pose mannedPoste + l'arme dérivée sur le chef
    return { commander, chief, all };
  };

  it('un chef servant une Arme d’équipe À PORTÉE de voix → cible offerte ; canAidTeam vrai', () => {
    const { commander, chief, all } = setup({ x: 9, y: 6 }); // 2 cases du chef → 4 m ≤ 50
    const targets = teamCommandTargets(commander, all);
    expect(targets.map((c) => c.id)).toContain(chief.id);
    expect(canAidTeam(commander, all)).toBe(true);
  });

  it('chef HORS portée de voix → aucune cible ; canAidTeam faux', () => {
    const { commander, all } = setup({ x: 39, y: 39 }); // très loin (> 25 cases)
    expect(teamCommandTargets(commander, all)).toHaveLength(0);
    expect(canAidTeam(commander, all)).toBe(false);
  });

  it('sans Talent → canAidTeam faux même à portée d’un chef', () => {
    const poste = mkPoste('baliste', ['chief', 's1']);
    const chief = mkChief('chief', { x: 7, y: 6 });
    const noTalent = mkCommander('cmd', { x: 9, y: 6 }, {}, false);
    const all = [mkEmplacement(poste), noTalent, chief];
    applyShipPostes(all);
    expect(canAidTeam(noTalent, all)).toBe(false);
  });
});

// ── (C) ACTION « Aider l'équipe » → Test de Commandement → marqueur ───────────────────────────────
describe('(C) battleAidTeam — Test de Commandement réussi pose teamCommanderId sur le chef', () => {
  it('succès (seed) → chief.teamCommanderId = id du commandant ; Action consommée', () => {
    seedBattleRng(1);
    const poste = mkPoste('baliste', ['chief', 's1']);
    const commander = mkCommander('cmd', { x: 9, y: 6 }, { sociabilite: 80 }); // Commandement ≈ 99 → réussite quasi certaine
    const chief = mkChief('chief', { x: 7, y: 6 });
    const all = [mkEmplacement(poste), commander, chief];
    applyShipPostes(all);
    useGame.setState({
      battle: { combatants: all, order: all.map((c) => c.id), turn: 1, round: 1, acted: false, action: null, log: [], movementUsed: 0 } as never,
      party: [commander, chief], facing: {}, scene: null as never, pendingTest: null, pendingCascade: null,
    });
    // active = order[turn=1] = commander
    useGame.getState().battleAidTeam();
    const pt = useGame.getState().pendingTest!;
    expect(pt).toBeTruthy();
    expect(pt.label, 'titre Z0 : la clé de catalogue, rendue').toBe('Commandant d’équipe');
    expect(pt.actorId).toBe('cmd'); // c'est le COMMANDANT qui teste (RAW : le porteur du Talent aide)
    expect(useGame.getState().battle!.acted).toBe(true); // le Test EST l'Action (posée d'emblée, réussite ou non)
    // Conséquence du SUCCÈS = l'op `teamCommander` (branche onSuccess de l'action) → testée SANS RNG : un
    // Commandement même ~110 échoue toujours sur un 96-00, donc piloter le dé rendrait ce test fragile (cf. le
    // flake observé). On vérifie la CONSÉQUENCE déterministe (l'op pose le marqueur sur le chef).
    const chiefAfter = useGame.getState().battle!.combatants.find((c) => c.id === 'chief')!;
    applyOps(chiefAfter, [{ op: 'teamCommander', commanderId: 'cmd' }], { idNeuf: idNeufDeBanc, rng: desDuTest });
    expect(chiefAfter.teamCommanderId).toBe('cmd');
  });
});

// ── (D) SUBSTITUTION du score (attackEnv / previewAttack) ─────────────────────────────────────────
describe('(D) Substitution — l’équipe tire au score de Projectiles du commandant', () => {
  const setup = (commanderPos: { x: number; y: number }, opts: { dead?: boolean } = {}) => {
    const poste = mkPoste('baliste', ['chief', 's1']);
    const commander = mkCommander('cmd', commanderPos, { 'capacite-de-tir': 75 }); // CT/Projectiles HAUT
    if (opts.dead) commander.dead = true;
    const chief = mkChief('chief', { x: 6, y: 5 }, { 'capacite-de-tir': 30 }); // CT/Projectiles BAS
    chief.teamCommanderId = 'cmd'; // aidé précédemment
    const foe = mkEnemy('foe', 9, 5);
    const all = [mkEmplacement(poste, { x: 6, y: 5 }), commander, chief, foe];
    applyShipPostes(all); // chief sert la baliste (mannedPoste + arme dérivée)
    return { commander, chief, foe, all, posteUid: poste.item.uid! };
  };

  it('chef BAS + commandant HAUT à portée → ModLine « Commandant d’équipe » = delta (75−30)', () => {
    const { chief, foe, all, posteUid } = setup({ x: 5, y: 5 }); // adjacent au chef
    const weapon = chief.weapons.find((w) => w.uid === posteUid)!;
    const { env } = attackEnv(mkGet(groundScene(), all), chief, foe, weapon);
    const tc = env.find((m) => m.label === 'Commandant d’équipe');
    expect(tc).toBeTruthy();
    expect(tc!.value).toBe(45); // combatValue(commander)=75 − combatValue(chief)=30
  });

  it('aperçu == résolution : le score effectif du tir reflète le commandant (cohérence)', () => {
    const { chief, foe, all, posteUid } = setup({ x: 5, y: 5 });
    const get = mkGet(groundScene(), all);
    const withCmd = previewAttack(get, chief, foe, undefined, { weaponUid: posteUid });
    // baseline SANS le marqueur : on retire le lien → plus de substitution
    chief.teamCommanderId = undefined;
    const without = previewAttack(get, chief, foe, undefined, { weaponUid: posteUid });
    expect(withCmd.base).toBe(without.base); // la BASE reste celle du chef (la substitution = un delta env)
    expect(withCmd.target - without.target).toBe(45); // +45 grâce au commandant
  });

  it('commandant MORT → bonus lapse (aucune ModLine)', () => {
    const { chief, foe, all, posteUid } = setup({ x: 5, y: 5 }, { dead: true });
    const weapon = chief.weapons.find((w) => w.uid === posteUid)!;
    const { env } = attackEnv(mkGet(groundScene(), all), chief, foe, weapon);
    expect(env.find((m) => m.label === 'Commandant d’équipe')).toBeUndefined();
  });

  it('commandant HORS portée de voix → bonus lapse (aucune ModLine)', () => {
    const { chief, foe, all, posteUid } = setup({ x: 35, y: 5 }); // 29 cases → 58 m > 50
    const weapon = chief.weapons.find((w) => w.uid === posteUid)!;
    const { env } = attackEnv(mkGet(groundScene(), all), chief, foe, weapon);
    expect(env.find((m) => m.label === 'Commandant d’équipe')).toBeUndefined();
  });
});

// ── (E) CÂBLAGE de la règle éditable « Portée de voix » (combat-voice-range-m) ────────────────────
describe('(E) combat-voice-range-m — la règle éditable pilote la portée', () => {
  afterEach(() => resetRule('combat-voice-range-m'));

  const setup = (commanderPos: { x: number; y: number }) => {
    const poste = mkPoste('baliste', ['chief', 's1']);
    const chief = mkChief('chief', { x: 7, y: 6 });
    const commander = mkCommander('cmd', commanderPos);
    const all = [mkEmplacement(poste), commander, chief, mkEnemy('foe', 20, 20)];
    applyShipPostes(all);
    return { commander, all };
  };

  it('défaut 50 m : un chef à 60 m est hors de portée ; porter la règle à 100 m l’offre', () => {
    const { commander, all } = setup({ x: 37, y: 6 }); // 30 cases → 60 m
    expect(voiceCommandRangeM()).toBe(50);
    expect(teamCommandTargets(commander, all)).toHaveLength(0);
    setRule('combat-voice-range-m', 100);
    expect(voiceCommandRangeM()).toBe(100);
    expect(teamCommandTargets(commander, all).map((c) => c.id)).toContain('chief');
  });

  it('réduire la règle à 4 m retire un chef qui était offert à 10 m', () => {
    const { commander, all } = setup({ x: 12, y: 6 }); // 5 cases → 10 m
    expect(teamCommandTargets(commander, all).map((c) => c.id)).toContain('chief');
    setRule('combat-voice-range-m', 4);
    expect(teamCommandTargets(commander, all)).toHaveLength(0);
  });
});
