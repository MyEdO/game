import { describe, it, expect } from 'vitest';
import { servablePostes, serveAtPoste, leaveChef, isPosteManned, applyShipPostes, servingCrewPresent, serveTargetPoste, posteCrewSplit, isCrewQualified } from './shipPostes';
import { firedWeapon, resolveAttack, buildAiInput, availableAttacks } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { crewedPenalty } from '../engine/crewedWeapon';
import { seedBattleRng } from './battleRng';
import { useGame } from './store';
import { emptyScene } from './scene';
import type { Combatant, ShipPoste } from '../engine/types';
import type { FireArc } from './fireArc';
import type { Scene } from './scene';
import type { GameState } from './store';
import { initialNet } from './netFlow'; // `resolveAttack` lit `net` (surfaçage de la défense, #989) — l'état forgé le porte

/**
 * « SERVIR CETTE PIÈCE » (manning runtime, MDG 12-13) — l'action de combat KIND-AGNOSTIQUE par laquelle
 * tout combattant (héros / PNJ / ennemi) ADJACENT à un emplacement portant un poste NON servi en devient le
 * chef : il prend la tête de l'équipage (`crewIds[0]`), pose le lien `mannedPoste`, et l'arme de siège dérivée
 * apparaît dans ses `weapons` (taguée `mountSide`). RÉUTILISE la logique de service d'`applyShipPostes`
 * (factorisée en `serveChef`). « Quitter la pièce » (`leaveChef`) libère le poste pour un autre.
 *
 * « Tout le monde peut servir une arme de siège » (user) → la disponibilité (`servablePostes`) et la mutation
 * (`serveAtPoste`/`leaveChef`) ne regardent JAMAIS le `kind` ; l'affordance JOUEUR (`battleManPoste`/
 * `battleLeavePoste`) et l'énumération IA (`buildAiInput.servablePostes` → `chooseEnemyAction` candidat
 * `manPoste`) consomment la MÊME source.
 */

const CHARS = (CT = 75) =>
  ({ 'capacite-de-combat': 30, 'capacite-de-tir': CT, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });

const mkActor = (id: string, kind: 'hero' | 'npc' | 'enemy', pos: { x: number; y: number }, CT = 75): Combatant =>
  ({
    id, name: id, kind, characteristics: CHARS(CT),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

const mkCrewman = (id: string, alive = true): Combatant =>
  ({ id, name: id, kind: 'npc', conditions: [], weapons: [], skills: [], talents: [], characteristics: CHARS(30) as never,
    dead: !alive, wounds: { current: alive ? 5 : 0, max: 5 } }) as unknown as Combatant;

const mkEnemyTarget = (id: string, x: number, y: number, E = 30, wounds = 60): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: { ...CHARS(0), endurance: E }, wounds: { current: wounds, max: wounds }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;

/** Emplacement AU SOL : une SceneEntity NON-navire qui PORTE la pièce (`postes`). */
const mkEmplacement = (poste: ShipPoste, pos = { x: 5, y: 5 }): Combatant =>
  ({ id: 'emplacement', name: 'Affût de baliste', kind: 'enemy', pos, conditions: [], weapons: [],
    inert: true, wounds: { current: 0, max: 0 }, advantage: 0, postes: [poste] }) as unknown as Combatant; // affût RAW-pur (AA 10 l.136-193) : 0 Blessure, immune

const mkPoste = (engineId: string, crewIds: string[] = [], side?: FireArc): ShipPoste =>
  ({ item: itemFromTrappingById(engineId)!, crewIds, ...(side ? { side } : {}) });

const groundScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', metresPerTile: 2,
    layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const mkGet = (sc: Scene, combatants: Combatant[], facing: Record<string, string> = {}): (() => GameState) =>
  (() => ({ scene: sc, battle: { combatants, movementUsed: 0 }, facing, gameTime: 0, net: initialNet(), log: () => {} })) as unknown as () => GameState;

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (A) DISPONIBILITÉ kind-agnostique — `servablePostes` voit un poste NON servi pour un combattant adjacent.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(A) Disponibilité — « Servir cette pièce » est offerte à TOUT combattant adjacent (kind-agnostique)', () => {
  it.each(['hero', 'npc', 'enemy'] as const)('un %s adjacent à un emplacement non servi → action disponible', (kind) => {
    const poste = mkPoste('baliste');
    const actor = mkActor('actor', kind, { x: 5, y: 6 });
    const list = servablePostes(actor, [mkEmplacement(poste), actor]);
    expect(list).toHaveLength(1);
    expect(list[0].poste.item.uid).toBe(poste.item.uid);
  });

  it('ADJACENCE — un combattant NON adjacent à l’emplacement → action indisponible', () => {
    const poste = mkPoste('baliste');
    const far = mkActor('far', 'hero', { x: 5, y: 10 }); // 5 cases au sud de l'emplacement (5,5)
    expect(servablePostes(far, [mkEmplacement(poste), far])).toHaveLength(0);
  });

  it('POSTE SERVI — reste REJOIGNABLE en renfort (Arme d’équipe) ; pas re-offert à un membre déjà de l’équipage', () => {
    const poste = mkPoste('baliste', ['chef']);
    const emplacement = mkEmplacement(poste);
    const chef = mkActor('chef', 'npc', { x: 5, y: 6 });
    const other = mkActor('other', 'hero', { x: 6, y: 5 });
    const all = [emplacement, chef, other];
    applyShipPostes(all); // chef devient le servant (mannedPoste posé)
    expect(isPosteManned(poste, all)).toBe(true);
    expect(servablePostes(other, all)).toHaveLength(1); // servi, mais on peut le REJOINDRE en renfort (« on peut être plusieurs à servir »)
    expect(servablePostes(chef, all)).toHaveLength(0); // le chef est déjà dans l’équipage → pas re-offert
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (B) SERVICE — `serveAtPoste` : devient chef (crewIds[0]) + `mannedPoste` + arme de siège octroyée. PUR.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(B) Service — `serveAtPoste` rend chef tout combattant (mannedPoste, crewIds[0], arme dérivée)', () => {
  it.each(['hero', 'npc', 'enemy'] as const)('un %s sert : mannedPoste + tête d’équipage + baliste dans weapons', (kind) => {
    const poste = mkPoste('baliste', ['s1']); // s1 présent mais ne sert pas → poste non servi
    const actor = mkActor('gunner', kind, { x: 5, y: 6 });
    serveAtPoste(actor, poste, [actor]); // s1 absent de la liste → non servi → devient CHEF
    expect(actor.mannedPoste!.item.uid).toBe(poste.item.uid);
    expect(poste.crewIds![0]).toBe('gunner'); // inséré EN TÊTE
    const w = actor.weapons.find((x) => x.uid === poste.item.uid);
    expect(w?.type).toBe('ranged');
    expect(w?.subType).toBe('armes-de-siege');
  });

  it('le chef servant peut TIRER la pièce (firedWeapon → resolveAttack, seed fixe)', () => {
    seedBattleRng(1);
    const poste = mkPoste('baliste', ['s1']);
    const gunner = mkActor('gunner', 'hero', { x: 5, y: 5 }, 80);
    gunner.skills = [{ id: 'projectiles', spec: 'arbalete', characteristic: 'capacite-de-tir', advances: 0 }] as never;
    const s1 = mkCrewman('s1');
    s1.skills = [{ id: 'projectiles', spec: 'arbalete', characteristic: 'capacite-de-tir', advances: 0 }] as never; // équipe COMPLÈTE et qualifiée
    const cible = mkEnemyTarget('cible', 8, 5, 30, 60);
    const all = [mkEmplacement(poste), gunner, s1, cible];
    serveAtPoste(gunner, poste, all);
    const w = firedWeapon(gunner, cible, poste.item.uid, all);
    expect(w.uid).toBe(poste.item.uid); // c'est bien la baliste servie qui tire
    const get = mkGet(groundScene(), all, { gunner: 'N' });
    const r = resolveAttack(get, gunner, cible, undefined, false, false, false, poste.item.uid);
    expect(r).not.toBeNull();
    expect(r!.res.hit).toBe(true);
    expect(r!.res.woundsLost ?? 0).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (C) RELEASE — `leaveChef` : retire le lien, sort de l'équipage, retire l'arme ; la pièce redevient servable.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(C) Release — « Quitter la pièce » libère le poste pour un autre', () => {
  it('Quitter → mannedPoste retiré, id hors crewIds, arme retirée, re-servable par un autre', () => {
    const poste = mkPoste('baliste');
    const emplacement = mkEmplacement(poste);
    const chef = mkActor('chef', 'hero', { x: 5, y: 6 });
    const other = mkActor('other', 'enemy', { x: 6, y: 5 });
    const all = [emplacement, chef, other];

    serveAtPoste(chef, poste, all);
    expect(isPosteManned(poste, all)).toBe(true);
    expect(servablePostes(other, all)).toHaveLength(1); // servi mais rejoignable en renfort

    leaveChef(chef, poste, all);
    expect(chef.mannedPoste).toBeUndefined();
    expect(poste.crewIds).not.toContain('chef');
    expect(chef.weapons.some((w) => w.uid === poste.item.uid)).toBe(false);
    expect(isPosteManned(poste, all)).toBe(false);
    expect(servablePostes(other, all)).toHaveLength(1); // libérée → un autre peut servir
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (D) AFFORDANCE JOUEUR — `battleManPoste` / `battleLeavePoste` (store) sur le héros actif.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(D) Affordance joueur — store `battleManPoste` / `battleLeavePoste`', () => {
  const setup = (mannedByActive = false) => {
    const poste = mkPoste('baliste', mannedByActive ? [] : ['s1']);
    const hero = mkActor('hero', 'hero', { x: 5, y: 6 }, 80);
    const s1 = mkCrewman('s1');
    const emplacement = mkEmplacement(poste);
    if (mannedByActive) serveAtPoste(hero, poste, [emplacement, hero, s1]);
    useGame.setState({
      battle: { combatants: [emplacement, hero, s1], order: ['hero', 'emplacement', 's1'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never,
      party: [hero], facing: {}, scene: groundScene() as never,
      pendingCleave: null, pendingDualStrike: null, pendingCast: null,
    });
    return { poste, hero };
  };

  it('le héros ACTIF prend la pièce adjacente : mannedPoste, crewIds[0], baliste, SANS coûter l’Action', () => {
    const { poste } = setup();
    useGame.getState().battleManPoste();
    const st = useGame.getState();
    const hero = st.battle!.combatants.find((c) => c.id === 'hero')!;
    expect(hero.mannedPoste!.item.uid).toBe(poste.item.uid);
    expect(poste.crewIds![0]).toBe('hero');
    expect(hero.weapons.some((w) => w.uid === poste.item.uid)).toBe(true);
    expect(st.battle!.acted).toBe(false); // servir est GRATUIT : on s'installe puis on tire/pousse le même Round
  });

  it('Quitter libère la pièce : mannedPoste retiré, arme retirée, SANS coûter l’Action', () => {
    const { poste } = setup(true);
    useGame.getState().battleLeavePoste();
    const st = useGame.getState();
    const hero = st.battle!.combatants.find((c) => c.id === 'hero')!;
    expect(hero.mannedPoste).toBeUndefined();
    expect(hero.weapons.some((w) => w.uid === poste.item.uid)).toBe(false);
    expect(st.battle!.acted).toBe(false); // quitter est GRATUIT (LDB 13 l.106 : aucun Test → action gratuite)
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (E) AFFORDANCE IA — l'énumération d'actions d'un combattant IA adjacent inclut « Servir cette pièce ».
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(E) Affordance IA — un combattant IA adjacent PEUT servir', () => {
  const input = (enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput => ({
    enemy, heroes, scene: emptyScene(12, 12),
    blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)),
    movement: enemy.movement, spells: [], ...extra,
  });

  it('`servablePostes` voit le poste pour un ENNEMI adjacent (énumération kind-agnostique)', () => {
    const poste = mkPoste('baliste');
    const enemy = mkActor('e', 'enemy', { x: 5, y: 6 });
    expect(servablePostes(enemy, [mkEmplacement(poste), enemy])).toHaveLength(1);
  });

  it('`buildAiInput` surface les postes servables dans l’entrée de décision IA', () => {
    const poste = mkPoste('baliste');
    const enemy = mkActor('e', 'enemy', { x: 5, y: 6 });
    const all = [mkEmplacement(poste), enemy, mkEnemyTarget('hero', 1, 1)];
    // (le « hero » ici est juste un combattant adverse pour peupler la scène — kind enemy ne gêne pas buildAiInput)
    useGame.setState({
      battle: { combatants: all, order: all.map((c) => c.id), turn: 1, round: 1, acted: false, log: [] } as never,
      party: [], partyPos: { x: 0, y: 0 }, facing: {}, scene: groundScene() as never, gameTime: 0, lightLevel: 1,
    });
    const aiInput = buildAiInput(enemy, useGame.getState);
    expect(aiInput.servablePostes).toEqual([{ hullId: 'emplacement', posteUid: poste.item.uid }]);
  });

  it('`chooseEnemyAction` PEUT retourner `manPoste` (faute d’attaque/approche jouable)', () => {
    const enemy = mkActor('e', 'enemy', { x: 5, y: 6 });
    enemy.movement = 0; // immobile → aucune approche ; sans arme → aucune attaque
    const far = mkEnemyTarget('hero', 1, 1);
    far.kind = 'hero' as never;
    const action = chooseEnemyAction(input(enemy, [far], { servablePostes: [{ hullId: 'emplacement', posteUid: 'baliste-x' }] }));
    expect(action.kind).toBe('manPoste');
    expect(action).toMatchObject({ hullId: 'emplacement', posteUid: 'baliste-x' });
  });

  it('sans poste servable, le même ennemi immobile/désarmé passe la main (pas de candidat fantôme)', () => {
    const enemy = mkActor('e', 'enemy', { x: 5, y: 6 });
    enemy.movement = 0;
    const far = mkEnemyTarget('hero', 1, 1);
    far.kind = 'hero' as never;
    expect(chooseEnemyAction(input(enemy, [far])).kind).toBe('end');
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (F) ÉQUIPE — « Arme d'équipe (Indice) » (AA 10 l.230-232) : on REJOINT une pièce en SUPPORT (pas un
//     remplacement-takeover). RAW : « ils peuvent nommer l'un d'entre eux pour effectuer le Test » (le CHEF =
//     `crewIds[0]`, seul à tirer) ; « les membres supplémentaires n'ont aucun impact sur l'efficacité… mais
//     peuvent aider à la déplacer ou compenser les pertes » (support = `crewIds[1..]`, compte dans l'Indice).
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(F) Équipe — REJOINDRE une pièce servie en renfort (chef = seul tireur ; support = effectif d’Indice)', () => {
  const arb = () => [{ id: 'projectiles', spec: 'arbalete', characteristic: 'capacite-de-tir', advances: 0 }] as never;

  it('(a) un 2e adjacent REJOINT en SUPPORT : appendu APRÈS le chef, mannedPoste posé, mais SANS arme de tir', () => {
    const poste = mkPoste('baliste');
    const chef = mkActor('chef', 'hero', { x: 5, y: 6 });
    const renfort = mkActor('renfort', 'hero', { x: 6, y: 5 });
    const all = [mkEmplacement(poste), chef, renfort];
    serveAtPoste(chef, poste, all); // pièce NON servie → CHEF
    expect(poste.crewIds).toEqual(['chef']);
    serveAtPoste(renfort, poste, all); // pièce SERVIE → SUPPORT
    expect(poste.crewIds).toEqual(['chef', 'renfort']); // appendu APRÈS le chef
    expect(renfort.mannedPoste!.item.uid).toBe(poste.item.uid); // occupe bien la pièce
    // recomputeLoadout chef-gated (items.ts) : SEUL le chef dérive l'arme de tir.
    recomputeLoadout(chef);
    recomputeLoadout(renfort);
    expect(chef.weapons.some((w) => w.uid === poste.item.uid)).toBe(true);
    expect(renfort.weapons.some((w) => w.uid === poste.item.uid)).toBe(false); // le support ne TIRE pas
  });

  it('(b) effectif ≥ Indice → le chef tire NET (recharge normale) ; en sous-nombre → pénalité (recharge ×2)', () => {
    const poste = mkPoste('baliste'); // Arme d'équipe 2, Recharge 3
    const chef = mkActor('chef', 'hero', { x: 5, y: 6 }); chef.skills = arb();
    const renfort = mkActor('renfort', 'hero', { x: 6, y: 5 }); renfort.skills = arb();
    const cible = mkEnemyTarget('cible', 9, 6);
    const all = [mkEmplacement(poste), chef, renfort, cible];
    serveAtPoste(chef, poste, all); // chef
    serveAtPoste(renfort, poste, all); // support → présents 2 = Indice 2
    expect(servingCrewPresent(chef, all)).toBe(2);
    const wFull = firedWeapon(chef, cible, poste.item.uid, all);
    expect(wFull.reload).toBe(3); // effectif complet → recharge normale (pas de ×2)
    expect(wFull.qualities.some((q) => q.id === 'arme-d-equipe')).toBe(false); // équipage RÉEL résolu → retirée
    // le support s'en va → présents 1 < Indice 2 : sous-effectif
    leaveChef(renfort, poste, all);
    expect(servingCrewPresent(chef, all)).toBe(1);
    expect(crewedPenalty(1, 2).reloadFactor).toBe(2);
    expect(firedWeapon(chef, cible, poste.item.uid, all).reload).toBe(6); // Recharge 3 ×2 (sous-effectif)
  });

  it('(c) SEUL le chef (crewIds[0]) se voit offrir l’option de tir « Servir … » ; le support, non', () => {
    const poste = mkPoste('baliste');
    const chef = mkActor('chef', 'hero', { x: 5, y: 6 });
    const renfort = mkActor('renfort', 'hero', { x: 6, y: 5 });
    const all = [mkEmplacement(poste), chef, renfort];
    serveAtPoste(chef, poste, all);
    serveAtPoste(renfort, poste, all);
    recomputeLoadout(chef);
    recomputeLoadout(renfort);
    const battle = { combatants: all, acted: false } as never;
    expect(availableAttacks(chef, battle).map((o) => o.id)).toContain('poste'); // le chef peut TIRER la pièce
    expect(availableAttacks(renfort, battle).map((o) => o.id)).not.toContain('poste'); // le support ne tire pas
  });

  it('(d) SUCCESSION — si le chef quitte alors qu’un support reste, ce dernier devient chef (arme + crewIds[0])', () => {
    const poste = mkPoste('baliste');
    const chef = mkActor('chef', 'hero', { x: 5, y: 6 });
    const renfort = mkActor('renfort', 'hero', { x: 6, y: 5 });
    const all = [mkEmplacement(poste), chef, renfort];
    serveAtPoste(chef, poste, all);
    serveAtPoste(renfort, poste, all);
    leaveChef(chef, poste, all); // le chef part → succession
    expect(poste.crewIds).toEqual(['renfort']); // promu en TÊTE, le chef sortant retiré
    expect(renfort.mannedPoste!.item.uid).toBe(poste.item.uid);
    expect(renfort.weapons.some((w) => w.uid === poste.item.uid)).toBe(true); // le nouveau chef hérite de l'arme (peut tirer)
    expect(isPosteManned(poste, all)).toBe(true); // la pièce reste servie (pas « occupée mais muette »)
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (G) HOVER + CLIC sur la pièce — REJOINDRE par le token (parité « clic = attaque » des adversaires).
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(G) Token — `serveTargetPoste` + clic-pièce rejoignent l’équipe (mêmes chemins que la hotbar)', () => {
  it('serveTargetPoste : pièce adjacente servable → son poste ; déjà servant ou non adjacent → undefined', () => {
    const poste = mkPoste('baliste');
    const hull = mkEmplacement(poste, { x: 5, y: 5 });
    const hero = mkActor('hero', 'hero', { x: 5, y: 6 });
    const far = mkActor('far', 'hero', { x: 5, y: 12 });
    const all = [hull, hero, far];
    expect(serveTargetPoste(hero, hull, all)?.item.uid).toBe(poste.item.uid);
    expect(serveTargetPoste(far, hull, all)).toBeUndefined(); // non adjacent
    serveAtPoste(hero, poste, all); // hero sert désormais
    expect(serveTargetPoste(hero, hull, all)).toBeUndefined(); // sert déjà une pièce
  });

  it('battleManPoste({hullId,posteUid}) sert la pièce CIBLÉE précise (clic), pas juste la première', () => {
    const posteA = mkPoste('baliste');
    const posteB = mkPoste('baliste');
    const hullA = mkEmplacement(posteA, { x: 5, y: 5 });
    hullA.id = 'hullA';
    const hullB = mkEmplacement(posteB, { x: 7, y: 6 });
    hullB.id = 'hullB';
    const hero = mkActor('hero', 'hero', { x: 6, y: 6 }, 80); // adjacent aux DEUX
    useGame.setState({
      battle: { combatants: [hullA, hullB, hero], order: ['hero', 'hullA', 'hullB'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never,
      party: [hero], facing: {}, scene: groundScene() as never,
      pendingCleave: null, pendingDualStrike: null, pendingCast: null,
    });
    useGame.getState().battleManPoste({ hullId: 'hullB', posteUid: posteB.item.uid });
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'hero')!;
    expect(h.mannedPoste!.item.uid).toBe(posteB.item.uid); // c'est bien la pièce B (ciblée) qui est servie
    expect(posteB.crewIds![0]).toBe('hero');
    expect(posteA.crewIds ?? []).not.toContain('hero');
  });

  it('battleClickEntity sur la pièce sert le héros actif (clic-token = action « Servir », via ATTACK_MODE)', () => {
    const poste = mkPoste('baliste');
    const hull = mkEmplacement(poste, { x: 5, y: 5 });
    const hero = mkActor('hero', 'hero', { x: 5, y: 6 }, 80);
    useGame.setState({
      battle: { combatants: [hull, hero], order: ['hero', 'emplacement'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never,
      party: [hero], facing: {}, scene: groundScene() as never,
      pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null,
    });
    useGame.getState().battleClickEntity('emplacement');
    const h = useGame.getState().battle!.combatants.find((c) => c.id === 'hero')!;
    expect(h.mannedPoste!.item.uid).toBe(poste.item.uid); // le clic-token a servi la pièce
    expect(poste.crewIds![0]).toBe('hero');
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (H) QUALIFICATION D'ÉQUIPE — « Compétence Projectiles APPROPRIÉE » (AA 10 l.230/253) : seul un servant
//     possédant la Projectiles du GROUPE de la pièce compte dans l'effectif ; un servant à Arc sur une baliste
//     (Groupe Arbalète) « n'est pas considéré comme un membre de l'équipe » (Exemple 1, AA 10 l.253). Les corps
//     supplémentaires non qualifiés AIDENT (déplacent/compensent) mais NE comptent PAS (AA 10 l.232).
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(H) Qualification — seul l’équipage avec la Projectiles du Groupe de la pièce compte (AA 10 l.228-247)', () => {
  const proj = (spec: string) => [{ id: 'projectiles', spec, characteristic: 'capacite-de-tir', advances: 10 }] as never;

  it('chef QUALIFIÉ (Arbalète) compte (=1) ; +1 renfort qualifié → effectif 2 (=Indice, plus de sous-effectif)', () => {
    const poste = mkPoste('baliste'); // baliste = Groupe Arbalète, Arme d'équipe 2
    const chef = mkActor('chef', 'npc', { x: 5, y: 6 }); chef.skills = proj('arbalete');
    const renfort = mkActor('renfort', 'npc', { x: 6, y: 5 }); renfort.skills = proj('arbalete');
    const all = [mkEmplacement(poste), chef, renfort];
    serveAtPoste(chef, poste, all);
    expect(servingCrewPresent(chef, all)).toBe(1); // chef seul, qualifié → effectif 1/2
    serveAtPoste(renfort, poste, all);
    expect(servingCrewPresent(chef, all)).toBe(2); // 2 qualifiés = Indice → effectif complet 2/2
  });

  it('renfort NON qualifié (Arc sur une baliste-Arbalète) → occupe la pièce mais N’augmente PAS l’effectif (Exemple 1, AA 10 l.253)', () => {
    const poste = mkPoste('baliste');
    const chef = mkActor('chef', 'npc', { x: 5, y: 6 }); chef.skills = proj('arbalete');
    const archer = mkActor('archer', 'npc', { x: 6, y: 5 }); archer.skills = proj('arc'); // mauvais Groupe
    const all = [mkEmplacement(poste), chef, archer];
    serveAtPoste(chef, poste, all);
    serveAtPoste(archer, poste, all); // rejoint en support…
    expect(poste.crewIds).toEqual(['chef', 'archer']); // … occupe bien la pièce
    expect(servingCrewPresent(chef, all)).toBe(1); // … mais ne compte PAS (Arc ≠ Arbalète)
    const { qualified, aides } = posteCrewSplit(poste, all);
    expect(qualified.map((c) => c.id)).toEqual(['chef']);
    expect(aides.map((c) => c.id)).toEqual(['archer']); // corps présent qui « aide » (AA 10 l.232), greyé dans le tooltip
  });

  it('chef NON qualifié (Arc seul) → effectif 0 malgré un chef présent (le cas « Chef + 0 effectif » à expliquer)', () => {
    const poste = mkPoste('baliste');
    const chef = mkActor('chef', 'npc', { x: 5, y: 6 }); chef.skills = proj('arc');
    const all = [mkEmplacement(poste), chef];
    serveAtPoste(chef, poste, all);
    expect(isPosteManned(poste, all)).toBe(true); // pièce « occupée »…
    expect(servingCrewPresent(chef, all)).toBe(0); // … mais effectif 0 (chef non qualifié) → tooltip cohérent
  });

  it('isCrewQualified — feedback « Servir » du héros actif : vrai avec la Projectiles du Groupe, faux sinon', () => {
    const poste = mkPoste('baliste');
    const qualifie = mkActor('q', 'hero', { x: 5, y: 6 }); qualifie.skills = proj('arbalete');
    const profane = mkActor('p', 'hero', { x: 5, y: 6 }); profane.skills = proj('arc');
    expect(isCrewQualified(qualifie, poste)).toBe(true);
    expect(isCrewQualified(profane, poste)).toBe(false);
  });
});
