import { describe, it, expect } from 'vitest';
import { applyShipPostes } from './shipPostes';
import { availableAttacks } from './combatFlow';
import { resolveWeaponArea, areaTargets, type AreaHit } from './combatArea';
import { mannedPosteWeapon, itemFromTrappingById, weaponWithAmmo } from '../engine/items';
import { seedBattleRng } from './battleRng';
import { useGame } from './store';
import type { Combatant, ShipPoste, Weapon } from '../engine/types';
import type { Scene } from './scene';
import type { BattleState } from './store';

/**
 * PILONNAGE INDIRECT (« Viser une CASE ») — AA 10 l.169-171 / ADE II : une pièce à TIR INDIRECT (mortier,
 * catapulte — « arc élevé », `desc` AA : « projeter des explosifs par-dessus les murs ») vise un POINT au
 * sol (pas forcément un combattant) ; son Atout Explosion/Tir de zone frappe alors qui se trouve dans le
 * rayon AUTOUR de cette case. RÉUTILISE le résolveur d'aire UNIQUE `resolveWeaponArea` (partagé avec le tir
 * direct ET la bordée navale) via un CENTRE optionnel (`AreaHit.center`) — strictement additif : le tir
 * direct (centre absent → position de la primaire) reste byte-identique (cf. siege-emplacement.test cas E).
 *
 * Le tir INDIRECT est marqué par un FLAG DONNÉE (`trappings.json` → `indirect:true`, propagé Trapping →
 * ItemInstance → Weapon), PAS par une liste en dur. Les canons restent du tir DIRECT (inchangés).
 */

const CHARS = (CT = 75) =>
  ({ 'capacite-de-combat': 30, 'capacite-de-tir': CT, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });

const mkGunner = (id: string, pos: { x: number; y: number }, CT = 75): Combatant =>
  ({
    id, name: id, kind: 'hero', characteristics: CHARS(CT),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

const mkCrewman = (id: string): Combatant =>
  ({ id, name: id, kind: 'npc', conditions: [], weapons: [], skills: [], talents: [], characteristics: CHARS(30) as never,
    wounds: { current: 5, max: 5 } }) as unknown as Combatant;

const mkEnemy = (id: string, x: number, y: number, E = 0, wounds = 50): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: { ...CHARS(0), endurance: E }, wounds: { current: wounds, max: wounds }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;

const mkEmplacement = (poste: ShipPoste, pos = { x: 0, y: 0 }): Combatant =>
  ({ id: 'emplacement', name: 'Affût', kind: 'enemy', pos, conditions: [], weapons: [],
    wounds: { current: 30, max: 30 }, advantage: 0, postes: [poste] }) as unknown as Combatant;

const mkPoste = (engineId: string, crewIds: string[]): ShipPoste =>
  ({ item: itemFromTrappingById(engineId)!, crewIds });

/** Scène terrestre minimale (40×40 d'herbe, 2 m/case). */
const groundScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', metresPerTile: 2,
    layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

/** Mortier + bombe Explosion 5 (Dégâts 12) = arme EFFECTIVE (qualité a-explosion fusionnée). */
function mortarWithBomb(chef: Combatant): Weapon {
  const mortier = mannedPosteWeapon(chef, { item: itemFromTrappingById('mortier')!, crewIds: ['chef'] })!;
  const bomb = itemFromTrappingById('bombe-de-mortier')!;
  return weaponWithAmmo(mortier, bomb);
}

// (a) CASE VIDE entourée d'un groupe : Explosion centrée sur la CASE (pas un combattant), tout le rayon
//     subit DR+Dégâts, hors rayon indemne. AUCUNE cible primaire (le centre n'est pas un combattant).
describe('(a) Viser une CASE VIDE entourée — toutes les cibles du rayon subissent DR+Dégâts', () => {
  it('Explosion centrée sur la case : rayon touché, hors rayon épargné, sans primaire', () => {
    seedBattleRng(7);
    const chef = mkGunner('chef', { x: 0, y: 0 });
    const w = mortarWithBomb(chef);
    expect(w.qualities.some((q) => q.id === 'a-explosion')).toBe(true);

    const center = { x: 10, y: 0 }; // CASE VIDE — aucun combattant dessus
    const e1 = mkEnemy('e1', 9, 0); // 1 case du centre (≤ ceil(5/2)=3)
    const e2 = mkEnemy('e2', 11, 0); // 1 case
    const e3 = mkEnemy('e3', 12, 0); // 2 cases
    const far = mkEnemy('far', 14, 0); // 4 cases > rayon → indemne
    const combatants = [chef, e1, e2, e3, far];
    useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never, scene: groundScene() as never, party: [], facing: {}, pendingShipBattery: null });
    const get = () => useGame.getState();
    const set = ((p: never) => useGame.setState(p)) as never;

    const w1 = e1.wounds.current, w2 = e2.wounds.current, w3 = e3.wounds.current, wf = far.wounds.current;
    const hit: AreaHit = { attacker: chef, weapon: w, damage: 12, location: 'corps', distanceTiles: 10, center };
    const { lines } = resolveWeaponArea(get, set, hit, areaTargets(combatants, 2));
    expect(lines.length).toBeGreaterThan(0);
    expect(e1.wounds.current).toBeLessThan(w1);
    expect(e2.wounds.current).toBeLessThan(w2);
    expect(e3.wounds.current).toBeLessThan(w3);
    expect(far.wounds.current).toBe(wf); // hors rayon → indemne
  });
});

// (b) CASE SANS PERSONNE (et personne dans le rayon) : aucune victime, pas de crash.
describe('(b) Viser une case déserte — aucune victime, pas de crash', () => {
  it('rayon vide → resolveWeaponArea ne mute rien et ne lève rien', () => {
    seedBattleRng(7);
    const chef = mkGunner('chef', { x: 0, y: 0 });
    const w = mortarWithBomb(chef);
    const far = mkEnemy('far', 14, 0);
    const combatants = [chef, far];
    useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never, scene: groundScene() as never, party: [], facing: {}, pendingShipBattery: null });
    const get = () => useGame.getState();
    const set = ((p: never) => useGame.setState(p)) as never;

    const wf = far.wounds.current;
    const hit: AreaHit = { attacker: chef, weapon: w, damage: 12, location: 'corps', distanceTiles: 30, center: { x: 30, y: 30 } };
    expect(() => resolveWeaponArea(get, set, hit, areaTargets(combatants, 2))).not.toThrow();
    expect(far.wounds.current).toBe(wf); // hors rayon → intact
  });
});

// (c) NON-RÉGRESSION du tir DIRECT : centre ABSENT → l'aire se centre sur la position de la PRIMAIRE
//     (parité avec siege-emplacement cas E). La primaire est EXCLUE de l'aire, le voisinage est touché.
describe('(c) Non-régression tir direct — centre absent ⇒ aire centrée sur la primaire', () => {
  it('primaire présente, center absent : voisins touchés, hors rayon épargné', () => {
    seedBattleRng(7);
    const chef = mkGunner('chef', { x: 0, y: 0 });
    const w = mortarWithBomb(chef);
    const cible = mkEnemy('cible', 10, 0);
    const a = mkEnemy('a', 11, 0); // 1 case ≤ rayon
    const b = mkEnemy('b', 12, 0); // 2 cases ≤ rayon
    const far = mkEnemy('far', 14, 0); // 4 cases > rayon
    const combatants = [chef, cible, a, b, far];
    useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never, scene: groundScene() as never, party: [], facing: {}, pendingShipBattery: null });
    const get = () => useGame.getState();
    const set = ((p: never) => useGame.setState(p)) as never;

    const wa = a.wounds.current, wb = b.wounds.current, wf = far.wounds.current;
    const hit: AreaHit = { attacker: chef, primaryTarget: cible, weapon: w, damage: 12, location: 'corps', distanceTiles: 10 };
    const { lines } = resolveWeaponArea(get, set, hit, areaTargets(combatants, 2));
    expect(lines.length).toBeGreaterThan(0);
    expect(a.wounds.current).toBeLessThan(wa);
    expect(b.wounds.current).toBeLessThan(wb);
    expect(far.wounds.current).toBe(wf);
  });
});

// (d) Un engin DIRECT (canon) NE propose PAS le placeur de case ; un engin INDIRECT (mortier) OUI. Le
//     flag est DONNÉE (Weapon.indirect, dérivé du trapping), surfacé par l'option de tir « Servir … ».
describe('(d) Routage data-driven — seul un engin indirect expose le ciblage de CASE', () => {
  const mkBattle = (combatants: Combatant[]): BattleState =>
    ({ combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [] }) as unknown as BattleState;

  const posteOption = (engineId: string) => {
    const poste = mkPoste(engineId, ['gunner', 's1']);
    const gunner = mkGunner('gunner', { x: 5, y: 5 });
    const s1 = mkCrewman('s1');
    const all = [mkEmplacement(poste), gunner, s1, mkEnemy('cible', 9, 5)];
    applyShipPostes(all);
    return availableAttacks(gunner, mkBattle(all)).find((o) => o.id === 'poste');
  };

  it('mortier (tir indirect) → l’option « Servir » porte indirect:true', () => {
    const opt = posteOption('mortier');
    expect(opt).toBeTruthy();
    expect(opt!.indirect).toBe(true);
  });

  it('canon (tir direct) → l’option « Servir » NE porte PAS indirect', () => {
    const opt = posteOption('canon-petit');
    expect(opt).toBeTruthy();
    expect(opt!.indirect).toBeFalsy();
  });

  it('baliste (tir direct) → l’option « Servir » NE porte PAS indirect', () => {
    const opt = posteOption('baliste');
    expect(opt).toBeTruthy();
    expect(opt!.indirect).toBeFalsy();
  });
});

// (e) ROUTAGE LIVE — armer « Servir le mortier » OUVRE le placeur de case ; viser une CASE ouvre la modale de
//     tir (pendingAttack siège, centre = case), dont la résolution DÉTONE sur le rayon (réutilise resolveWeaponArea).
describe('(e) Routage live — placeur de case + pilonnage via la modale de tir existante', () => {
  it('battleSelectAttack(poste) ouvre le placeur ; siegeAimCommit pilonne la case → rayon blessé', () => {
    seedBattleRng(7);
    const poste = mkPoste('mortier', ['gunner']);
    const gunner = mkGunner('gunner', { x: 0, y: 0 }, 90);
    gunner.skills = [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 30 }] as never;
    gunner.items = [itemFromTrappingById('bombe-de-mortier')!]; // munition Explosion 5 en inventaire (selectedAmmo)
    const e1 = mkEnemy('e1', 9, 0);
    const e2 = mkEnemy('e2', 11, 0);
    const far = mkEnemy('far', 20, 0); // hors rayon (10 cases du point d'impact)
    const all = [mkEmplacement(poste, { x: 0, y: 1 }), gunner, e1, e2, far];
    applyShipPostes(all);
    useGame.setState({
      battle: { combatants: all, order: all.map((c) => c.id), turn: all.findIndex((c) => c.id === 'gunner'), round: 1, acted: false, log: [], crewActed: {}, zones: [] } as never,
      party: [gunner], facing: {}, scene: groundScene() as never, pendingSiegeAim: null, pendingAttack: null, pendingCascade: null,
    });

    // 1) ARMER « Servir le mortier » → placeur de CASE ouvert (rayon de l'Explosion).
    useGame.getState().battleSelectAttack('poste');
    const sa = useGame.getState().pendingSiegeAim;
    expect(sa).toBeTruthy();
    expect(sa!.radius).toBeGreaterThan(0);

    // 2) VISER une case VIDE entre les ennemis → modale de tir (pendingAttack siège, cible-repère = plus proche).
    useGame.getState().siegeAimCommit({ x: 10, y: 0 });
    const pa = useGame.getState().pendingAttack;
    expect(pa).toBeTruthy();
    expect(pa!.siege).toBe(true);
    expect(pa!.center).toEqual({ x: 10, y: 0 });
    expect(useGame.getState().pendingSiegeAim).toBeNull(); // placeur refermé

    // 3) RÉSOLUTION : le jet de tir (normal) puis l'Appliquer DÉTONENT sur la case → rayon blessé, hors rayon indemne.
    const w1 = e1.wounds.current, w2 = e2.wounds.current, wf = far.wounds.current;
    useGame.getState().attackRoll();
    useGame.getState().attackConfirm();
    expect(e1.wounds.current).toBeLessThan(w1);
    expect(e2.wounds.current).toBeLessThan(w2);
    expect(far.wounds.current).toBe(wf);
    expect(useGame.getState().battle!.acted).toBe(true); // Action consommée
  });

  it('viser une case déserte (aucun ennemi dans le rayon) → pas de modale, pas de crash', () => {
    seedBattleRng(7);
    const poste = mkPoste('mortier', ['gunner']);
    const gunner = mkGunner('gunner', { x: 0, y: 0 }, 90);
    gunner.items = [itemFromTrappingById('bombe-de-mortier')!];
    const far = mkEnemy('far', 30, 30);
    const all = [mkEmplacement(poste, { x: 0, y: 1 }), gunner, far];
    applyShipPostes(all);
    useGame.setState({
      battle: { combatants: all, order: all.map((c) => c.id), turn: all.findIndex((c) => c.id === 'gunner'), round: 1, acted: false, log: [], crewActed: {}, zones: [] } as never,
      party: [gunner], facing: {}, scene: groundScene() as never, pendingSiegeAim: { gunnerId: 'gunner', weaponUid: gunner.weapons.find((w) => w.uid === poste.item.uid)!.uid!, radius: 3, rangeTiles: null }, pendingAttack: null, pendingCascade: null,
    });
    expect(() => useGame.getState().siegeAimCommit({ x: 10, y: 0 })).not.toThrow();
    expect(useGame.getState().pendingAttack).toBeNull(); // tir à vide → aucune modale ouverte
    expect(far.wounds.current).toBe(far.wounds.max);
  });
});
