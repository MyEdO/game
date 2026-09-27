import { describe, it, expect } from 'vitest';
import { applyShipPostes } from './shipPostes';
import { firedWeapon, firedAttackBlock, resolveAttack } from './combatFlow';
import { resolveWeaponArea, areaTargets, type AreaHit } from './combatArea';
import { crewedFireWeapon } from '../engine/crewedWeapon';
import { mannedPosteWeapon, itemFromTrappingById, weaponWithAmmo } from '../engine/items';
import { spawnEnemy } from './spawn';
import { seedBattleRng } from './battleRng';
import { useGame } from './store';
import type { Combatant, ShipPoste, Weapon } from '../engine/types';
import type { FireArc } from './fireArc';
import type { Scene } from './scene';
import type { GameState } from './store';
import { initialNet } from './netFlow'; // `resolveAttack` lit `net` (surfaçage de la défense, #989) — l'état forgé le porte

/**
 * EMPLACEMENT DE SIÈGE AU SOL (AA / MDG 12) — une pièce d'artillerie d'équipe (`armes-de-siege`, qualité
 * `arme-d-equipe`) PORTÉE par une SceneEntity NON-navire et SERVIE par son équipage tire/recharge/fait de l'AoE
 * à l'échelle tactique au sol, en RÉUTILISANT la machinerie d'« arme d'équipe » navale SANS couplage navire
 * (pas de merScale, pas de footprint, pas de bordée). Kind-agnostique : héros / PNJ / ennemi peuvent servir.
 *
 * Différence vs le poste NAVAL : aucune coque (`shipOfCrew` → undefined) → l'arc, si la pièce en a un, pivote
 * avec l'orientation-monde et la position DU CHEF de pièce (pas d'un cap de navire).
 */

const CHARS = (CT = 75) =>
  ({ 'capacite-de-combat': 30, 'capacite-de-tir': CT, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });

const mkGunner = (id: string, kind: 'hero' | 'npc' | 'enemy', pos: { x: number; y: number }, CT = 75): Combatant =>
  ({
    id, name: id, kind, characteristics: CHARS(CT),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

const mkCrewman = (id: string, alive = true): Combatant =>
  ({ id, name: id, kind: 'npc', conditions: [], weapons: [], skills: [], talents: [], characteristics: CHARS(30) as never,
    dead: !alive, wounds: { current: alive ? 5 : 0, max: 5 } }) as unknown as Combatant;

const mkEnemy = (id: string, x: number, y: number, E = 30, wounds = 40): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: { ...CHARS(0), endurance: E }, wounds: { current: wounds, max: wounds }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;

/** Emplacement AU SOL : une SceneEntity NON-navire qui PORTE la pièce (`postes`) — SANS `crewIds` au niveau
 *  porteur (≠ coque) pour que `shipOfCrew(chef)` rate et que l'arc retombe sur l'orientation du chef. */
const mkEmplacement = (poste: ShipPoste, pos = { x: 5, y: 7 }): Combatant =>
  ({ id: 'emplacement', name: 'Affût de baliste', kind: 'enemy', pos, conditions: [], weapons: [],
    inert: true, wounds: { current: 0, max: 0 }, advantage: 0, postes: [poste] }) as unknown as Combatant; // affût RAW-pur (AA 10 l.175-193) : 0 Blessure, immune

const mkPoste = (engineId: string, crewIds: string[], side?: FireArc): ShipPoste =>
  ({ item: itemFromTrappingById(engineId)!, crewIds, ...(side ? { side } : {}) });

/** Scène terrestre minimale (40×40 d'herbe, 2 m/case) — PAS de merScale/metresPerTile « Mer ». */
const groundScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', metresPerTile: 2,
    layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const mkGet = (sc: Scene, combatants: Combatant[], facing: Record<string, string> = {}, movementUsed = 0): (() => GameState) =>
  (() => ({ scene: sc, battle: { combatants, movementUsed }, facing, gameTime: 0, net: initialNet(), log: () => {} })) as unknown as () => GameState;

// (A) SERVICE — la SceneEntity au sol qui PORTE des postes se spawn avec `Combatant.postes` ; au combat,
//     `applyShipPostes` (kind-agnostique) sert la pièce au chef d'équipage. SANS `side` (tir omni).
describe('(A) Service — emplacement au sol : spawn lit les postes, le chef est servi (mannedPoste)', () => {
  it('SceneEntity NON-navire portant `postes` → `Combatant.postes` au spawn (comme la voie navale)', () => {
    const poste = mkPoste('baliste', ['gunner', 's1']); // PAS de `side` → exige `ShipPoste.side` optionnel
    const emplacement = spawnEnemy({ statblock: { name: 'Affût de baliste', char: { B: 20 } } as never }, 'emplacement', { x: 5, y: 5 }, { postes: [poste] });
    expect(emplacement.postes).toBeTruthy();
    expect(emplacement.bodyShape).not.toBe('vehicule'); // AUCUN couplage navire (pas une coque)
  });

  it('`applyShipPostes` pose `mannedPoste` sur le chef (crewIds[0]) et octroie la baliste dérivée (omni)', () => {
    const poste = mkPoste('baliste', ['gunner', 's1']);
    const emplacement = mkEmplacement(poste);
    const gunner = mkGunner('gunner', 'npc', { x: 5, y: 6 });
    const s1 = mkCrewman('s1');
    const all = [emplacement, gunner, s1, mkEnemy('cible', 9, 5)];
    applyShipPostes(all);
    expect(gunner.mannedPoste).toBeTruthy();
    expect(gunner.mannedPoste!.item.uid).toBe(poste.item.uid);
    const w = gunner.weapons.find((x) => x.uid === poste.item.uid);
    expect(w?.type).toBe('ranged');
    expect(w?.subType).toBe('armes-de-siege');
    expect(w?.mountSide).toBeUndefined(); // pas de `side` → arc omni
  });
});

// (B) TIR — le chef tire la baliste sur la cible via le chemin `firedWeapon` → `resolveAttack` ; une touche se
//     résout (Blessures appliquées), seed fixe.
describe('(B) Tir — le chef sert la pièce et touche la cible (resolveAttack, seed fixe)', () => {
  it('une touche se résout via la pièce servie → Blessures infligées', () => {
    seedBattleRng(1);
    const poste = mkPoste('baliste', ['gunner', 's1']);
    const gunner = mkGunner('gunner', 'hero', { x: 5, y: 5 }, 80);
    gunner.skills = [{ id: 'projectiles', spec: 'arbalete', characteristic: 'capacite-de-tir', advances: 0 }] as never;
    const s1 = mkCrewman('s1');
    s1.skills = [{ id: 'projectiles', spec: 'arbalete', characteristic: 'capacite-de-tir', advances: 0 }] as never; // équipe COMPLÈTE et qualifiée (2/2)
    const cible = mkEnemy('cible', 8, 5, 30, 60);
    const all = [mkEmplacement(poste), gunner, s1, cible];
    applyShipPostes(all);
    const get = mkGet(groundScene(), all, { gunner: 'N' });
    const r = resolveAttack(get, gunner, cible, undefined, false, false, false, poste.item.uid);
    expect(r).not.toBeNull();
    expect(r!.weapon.uid).toBe(poste.item.uid); // c'est bien la baliste du poste qui a tiré
    expect(r!.res.hit).toBe(true);
    expect(r!.res.woundsLost ?? 0).toBeGreaterThan(0);
  });
});

// (C) SOUS-EFFECTIF — équipage < Indice de `arme-d-equipe` → pénalité (recharge ×2 + Imprécise) via
//     `crewedFireWeapon` (réutilisé par `firedWeapon`), PAS de réimplémentation.
describe('(C) Sous-effectif — la pénalité d’Arme d’équipe s’applique au sol (crewedFireWeapon)', () => {
  // Équipage CONFORME au RAW (AA 10 l.230) : les servants comptés possèdent la Projectiles du Groupe (baliste =
  // Arbalète) — la seule variable testée ici est leur PRÉSENCE physique (vivant/à terre), pas la compétence.
  const arb = () => [{ id: 'projectiles', spec: 'arbalete', characteristic: 'capacite-de-tir', advances: 0 }] as never;

  it('baliste (Indice 2) servie en sous-effectif → recharge ×2 + Arme d’équipe retirée (firedWeapon ⊃ crewedFireWeapon)', () => {
    const poste = mkPoste('baliste', ['chef', 's1']); // baliste : arme-d-equipe Indice 2, Recharge 3, Dégâts 12
    const chef = mkGunner('chef', 'hero', { x: 5, y: 5 });
    chef.skills = arb();
    const all = [mkEmplacement(poste), chef, mkCrewman('s1', false), mkEnemy('cible', 12, 5)]; // s1 à terre → présent 1, déficit 1
    applyShipPostes(all);
    const w = firedWeapon(chef, all[3], poste.item.uid, all);
    expect(w.reload).toBe(6); // Recharge 3 ×2 (sous-effectif)
    expect(w.qualities.some((q) => q.id === 'arme-d-equipe')).toBe(false); // équipage RÉEL résolu → retirée
  });

  it('effectif COMPLET (2/2) → arme nette : recharge normale, Arme d’équipe retirée (pas de double)', () => {
    const poste = mkPoste('baliste', ['chef', 's1']);
    const chef = mkGunner('chef', 'hero', { x: 5, y: 5 });
    chef.skills = arb();
    const s1 = mkCrewman('s1');
    s1.skills = arb();
    const all = [mkEmplacement(poste), chef, s1, mkEnemy('cible', 12, 5)];
    applyShipPostes(all);
    const w = firedWeapon(chef, all[3], poste.item.uid, all);
    expect(w.reload).toBe(3); // effectif complet (présent 2 ≥ Indice 2) → pas de ×2
  });

  it('Indice 3 (mortier) servi par le chef SEUL → Imprécise ajoutée (escalade de crewedFireWeapon, déficit ≥ 2)', () => {
    // crewedFireWeapon est la SOURCE UNIQUE de la dégradation (réutilisée par firedWeapon) — éprouvée sur
    // l'arme dérivée du poste (le mortier n'a PAS le Défaut Imprécise de base → la pénalité l'AJOUTE).
    const chef = mkGunner('chef', 'hero', { x: 5, y: 5 });
    const w0 = mannedPosteWeapon(chef, { item: itemFromTrappingById('mortier')!, crewIds: ['chef'] } as ShipPoste)!;
    const w = crewedFireWeapon(w0, 1); // présent 1, Indice 3 → déficit 2
    expect(w.reload).toBe(8); // Recharge 4 ×2
    expect(w.qualities.some((q) => q.id === 'imprecise')).toBe(true); // Défaut AJOUTÉ par le sous-effectif
  });
});

// (D) RECHARGE — Test étendu (`battleShipReload` → `reloadConfirm`) recharge la pièce AU SOL, kind-agnostique,
//     sans coque ni merScale.
describe('(D) Recharge — Test étendu rechargeant l’emplacement au sol (battleShipReload/reloadConfirm)', () => {
  const setup = () => {
    const item = itemFromTrappingById('baliste')!; // Recharge 3, Indice 2
    const poste: ShipPoste = { item, crewIds: ['chef', 's1'], loaded: false, reloadProgress: 2 };
    const chef = mkGunner('chef', 'hero', { x: 5, y: 5 }, 80);
    chef.skills = [{ id: 'projectiles', spec: 'arbalete', characteristic: 'capacite-de-tir', advances: 20 }] as never;
    const s1 = mkCrewman('s1');
    const emplacement = mkEmplacement(poste);
    useGame.setState({
      battle: { combatants: [emplacement, chef, s1], order: ['emplacement', 'chef', 's1'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never,
      party: [chef], facing: {}, pendingReload: null, scene: null as never,
    });
    return { item };
  };

  it('ouvre la modale de recharge sur le CHEF, cible = Recharge (effectif complet → pas de ×2)', () => {
    const { item } = setup();
    useGame.getState().battleShipReload('emplacement', item.uid);
    const pr = useGame.getState().pendingReload!;
    expect(pr).toBeTruthy();
    expect(pr.actorId).toBe('chef');
    expect(pr.reload).toBe(3); // Recharge 3, équipage complet (chef + s1 ≥ Indice 2) → pas doublée
    expect(pr.progressBefore).toBe(2);
  });

  it('réussite suffisante → la PIÈCE est rechargée (poste.loaded), tour du porteur NON consommé', () => {
    seedBattleRng(1); // CT 80 → réussite, DR ≥ 1 → 2 + DR ≥ 3 → rechargée
    const { item } = setup();
    useGame.getState().battleShipReload('emplacement', item.uid);
    useGame.getState().reloadRoll();
    useGame.getState().reloadConfirm();
    const st = useGame.getState();
    const poste = st.battle!.combatants.find((c) => c.id === 'emplacement')!.postes![0];
    expect(poste.loaded).toBe(true);
    expect(poste.reloadProgress).toBe(0);
    expect(st.battle!.acted).toBe(false); // tâche d'équipage parallèle (ne consomme pas le tour)
  });
});

// (E) AoE — un engin à munition Explosion (mortier + bombe) touche un GROUPE d'ennemis serrés : branche TERRE de
//     `resolveWeaponArea` (rayon métrique à l'échelle 2 m/case), réutilisée sans chemin naval.
describe('(E) AoE — mortier + bombe explosion frappe un groupe au sol (branche terre de resolveWeaponArea)', () => {
  it('toutes les cibles dans le rayon Indice subissent DR+Dégâts ; hors rayon = épargné', () => {
    seedBattleRng(7);
    const chef = mkGunner('chef', 'hero', { x: 0, y: 0 });
    const mortier = mannedPosteWeapon(chef, { item: itemFromTrappingById('mortier')!, crewIds: ['chef'] })!;
    const bomb = itemFromTrappingById('bombe-de-mortier')!; // Explosion Indice 5, Dégâts 12
    const w: Weapon = weaponWithAmmo(mortier, bomb); // arme effective : la qualité a-explosion est fusionnée
    expect(w.qualities.some((q) => q.id === 'a-explosion')).toBe(true);

    const cible = mkEnemy('cible', 10, 0, 0, 50);
    const a = mkEnemy('a', 11, 0, 0, 50); // 1 case ≤ rayon (ceil(5/2)=3 cases)
    const b = mkEnemy('b', 12, 0, 0, 50); // 2 cases ≤ rayon
    const far = mkEnemy('far', 14, 0, 0, 50); // 4 cases > rayon
    const combatants = [chef, cible, a, b, far];
    useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never, scene: groundScene() as never, party: [], facing: {}, pendingShipBattery: null });
    const get = () => useGame.getState();
    const set = ((p: never) => useGame.setState(p)) as never;
    const hit: AreaHit = { attacker: chef, primaryTarget: cible, weapon: w, damage: 12, location: 'corps', distanceTiles: 10 };

    const wa = a.wounds.current, wb = b.wounds.current, wf = far.wounds.current;
    const { lines } = resolveWeaponArea(get, set, hit, areaTargets(combatants, 2));
    expect(lines.length).toBeGreaterThan(0);
    expect(a.wounds.current).toBeLessThan(wa); // touché par le souffle
    expect(b.wounds.current).toBeLessThan(wb); // touché par le souffle
    expect(far.wounds.current).toBe(wf); // hors rayon → indemne
  });
});

// (F) ARC — la garde d'arc de `firedAttackBlock` au sol : SANS `side` → omni ; AVEC `side` → relative à
//     l'orientation-monde DU CHEF (pas d'une coque). C'est le test du fallback orienté-monde.
describe('(F) Arc — emplacement au sol : omni sans side, sinon arc relatif au facing du CHEF', () => {
  /** Chef-héros au sol servant une pièce, SANS coque dans le combat (→ `shipOfCrew` rate → fallback chef). */
  const groundGunner = (side?: FireArc): { gunner: Combatant; uid: string } => {
    const item = itemFromTrappingById('pierrier')!;
    const w = mannedPosteWeapon(mkGunner('g', 'hero', { x: 5, y: 5 }), { item, crewIds: ['g'], ...(side ? { side } : {}) } as ShipPoste)!;
    delete (w as { reload?: number }).reload; // isole la garde d'ARC (pas le gate Recharge/munition)
    delete (w as { subType?: string }).subType; // pas de famille de munition → pas de gate 'noammo'
    const gunner = mkGunner('g', 'hero', { x: 5, y: 5 });
    gunner.weapons = [w];
    gunner.mannedPoste = { item, crewIds: ['g'], ...(side ? { side } : {}) } as ShipPoste;
    return { gunner, uid: w.uid! };
  };

  it('SANS `side` → tir omni : la cible est valide dans N’IMPORTE quelle direction', () => {
    const { gunner, uid } = groundGunner();
    const east = mkEnemy('east', 9, 5);
    const west = mkEnemy('west', 1, 5);
    const get = mkGet(groundScene(), [gunner, east, west], { g: 'N' });
    expect(firedAttackBlock(get, gunner, east, uid)).toBeNull();
    expect(firedAttackBlock(get, gunner, west, uid)).toBeNull();
  });

  it('AVEC `side` (tribord) → l’arc suit le facing du CHEF : cible hors arc bloquée (raison `arc`)', () => {
    const { gunner, uid } = groundGunner('tribord');
    const east = mkEnemy('east', 9, 5); // tribord d’un cap Nord
    const west = mkEnemy('west', 1, 5); // bâbord → hors arc tribord
    const get = mkGet(groundScene(), [gunner, east, west], { g: 'N' });
    expect(firedAttackBlock(get, gunner, east, uid)).toBeNull();
    expect(firedAttackBlock(get, gunner, west, uid)).toMatchObject({ reason: 'arc' });
  });

  it('pivoter le CHEF au Sud inverse l’arc (preuve qu’il suit le chef, pas une coque)', () => {
    const { gunner, uid } = groundGunner('tribord');
    const east = mkEnemy('east', 9, 5);
    const west = mkEnemy('west', 1, 5);
    const get = mkGet(groundScene(), [gunner, east, west], { g: 'S' });
    expect(firedAttackBlock(get, gunner, east, uid)).toMatchObject({ reason: 'arc' });
    expect(firedAttackBlock(get, gunner, west, uid)).toBeNull();
  });
});
