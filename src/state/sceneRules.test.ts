import { describe, it, expect } from 'vitest';
import { sceneCombatModifiers, entityBlockedAt } from './sceneRules';
import { Scene, SceneEntity, isWalkable } from './scene';
import { attackModifiers, defenseModifiers, combineMods } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';

const sc = (over: Partial<Scene>): Scene => ({ ambiance: 'exterieur', ...over } as Scene);
const DAY = 12 * 60;   // midi (clair)
const NIGHT = 23 * 60; // nuit (obscurité)

describe('sceneCombatModifiers — obscurité (horloge) / météo (LDB 14 l.75/76/82, #T1c)', () => {
  it('clair de jour → aucun mod', () => {
    expect(sceneCombatModifiers(sc({ weather: 'clair' }), DAY)).toMatchObject({ concealed: false, attackMod: 0, dodgeMod: 0 });
  });
  it('pluie → aucun mod (le modèle ne connaît pas de palier de pluie battante)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'pluie' }), DAY)).toMatchObject({ concealed: false, attackMod: 0, dodgeMod: 0 });
  });
  it('brouillard → cible dissimulée (concealed), -20 au tir (Difficile, LDB 14 l.75)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'brouillard' }), DAY)).toMatchObject({ concealed: true, attackMod: 0, dodgeMod: 0 });
  });
  it('extérieur de nuit (horloge) → concealed (obscurité, l.75)', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'exterieur' }), NIGHT).concealed).toBe(true);
  });
  it('extérieur de jour (horloge) → pas d’obscurité', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'exterieur' }), DAY).concealed).toBe(false);
  });
  it('intérieur, même de nuit → jamais obscur (éclairé)', () => {
    expect(sceneCombatModifiers(sc({ ambiance: 'interieur' }), NIGHT).concealed).toBe(false);
  });
  it('tempête → -20 attaque, esquive 0 (mousson / ouragan / blizzard, LDB 14 l.76)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'tempete' }), DAY)).toMatchObject({ attackMod: -20, dodgeMod: 0 });
  });
  it('neige → -30 attaque ET -30 esquive (« Attaquer ou esquiver dans une haute épaisseur de neige », LDB 14 l.82)', () => {
    expect(sceneCombatModifiers(sc({ weather: 'neige' }), DAY)).toMatchObject({ attackMod: -30, dodgeMod: -30 });
  });
});

describe('Exemple RAW LDB 14 l.96 — « -30 plus +20 font -10 » (chaîne réelle scène → attaque)', () => {
  const mkc = (over: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'x', name: 'X', kind: 'enemy',
      characteristics: { 'capacite-de-combat': 50, force: 30, endurance: 30, agilite: 40 },
      wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [], talents: [], movement: 4, ...over,
    }) as unknown as Combatant;
  const sword = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;

  it('attaquer une cible À Terre depuis une haute épaisseur de neige → -10 net', () => {
    const sc = sceneCombatModifiers({ ambiance: 'exterieur', weather: 'neige' } as Scene, DAY);
    const env = [{ label: sc.label, value: sc.attackMod, famille: 'circonstance' as const }];
    const mods = attackModifiers(mkc(), mkc({ id: 'b', conditions: [{ id: 'a-terre', value: 1 }] as never }), sword, { kind: 'melee', env });
    expect(mods).toContainEqual(expect.objectContaining({ label: 'Neige épaisse', value: -30 }));
    expect(mods).toContainEqual(expect.objectContaining({ label: 'À Terre', value: 20 }));
    expect(combineMods(mods)).toBe(-10);
  });
  it('l’esquive de la cible prise dans la même neige subit le -30 (« Attaquer ou esquiver »)', () => {
    const sc = sceneCombatModifiers({ ambiance: 'exterieur', weather: 'neige' } as Scene, DAY);
    expect(combineMods(defenseModifiers(mkc(), 'esquive', sc.dodgeMod))).toBe(-30);
    expect(combineMods(defenseModifiers(mkc(), 'parade', sc.dodgeMod))).toBe(0);
  });
});

describe('entityBlockedAt — empreinte multi-cases des décors', () => {
  const cart: SceneEntity = { id: 'c', kind: 'prop', pos: { x: 3, y: 2 }, ref: 'charrette' } as SceneEntity; // 2×1 dérivé de sa recette volumique, cap par défaut ; `solid`
  const puddle: SceneEntity = { id: 'b', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'mare-sang' } as SceneEntity; // 1×1, type passable (au sol)
  const scene = { entities: [cart, puddle] } as unknown as Scene;
  it('bloque toutes les cases de l’empreinte (charrette 2×1)', () => {
    expect(entityBlockedAt(scene, 3, 2, 0)).toBe(true);
    expect(entityBlockedAt(scene, 4, 2, 0)).toBe(true);
  });
  it('ne bloque pas hors empreinte', () => {
    expect(entityBlockedAt(scene, 5, 2, 0)).toBe(false);
    expect(entityBlockedAt(scene, 3, 3, 0)).toBe(false);
  });
  it('décor sans empreinte déclarée, ni solide ni interactif, ne bloque pas', () => {
    expect(entityBlockedAt(scene, 0, 0, 0)).toBe(false);
  });
  it('un changement de ref déplace l’empreinte IMMÉDIATEMENT — elle vient du catalogue, pas de l’instance', () => {
    const sc2 = { entities: [{ ...cart, ref: 'tente' }] } as unknown as Scene; // tente 2×2
    expect(entityBlockedAt(sc2, 4, 3, 0)).toBe(true);
    expect(entityBlockedAt(scene, 4, 3, 0)).toBe(false); // la charrette 2×1 ne couvrait pas cette case
  });
  it('décor INTERACTIF 1×1 (coffre fouillable) bloque sa case — on l’aborde, on ne marche pas dessus', () => {
    const chest = { id: 'k', kind: 'prop', pos: { x: 6, y: 6 }, ref: 'coffre', usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] } }] } } as unknown as SceneEntity;
    const sc2 = { entities: [chest] } as unknown as Scene;
    expect(entityBlockedAt(sc2, 6, 6, 0)).toBe(true);
    expect(entityBlockedAt(sc2, 7, 6, 0)).toBe(false); // adjacent libre (fouille P5 / Ramasser en combat)
  });
  it('décor SOLIDE 1×1 par type (feu de camp / barrière) bloque sa case — B5', () => {
    const fire = { id: 'f', kind: 'prop', pos: { x: 2, y: 13 }, ref: 'feu-camp' } as unknown as SceneEntity;
    const fence = { id: 'g', kind: 'prop', pos: { x: 6, y: 6 }, ref: 'barriere' } as unknown as SceneEntity;
    const sc2 = { entities: [fire, fence] } as unknown as Scene;
    expect(entityBlockedAt(sc2, 2, 13, 0)).toBe(true);  // on ne se tient pas dans le feu de camp
    expect(entityBlockedAt(sc2, 6, 6, 0)).toBe(true);   // ni sur la barrière
    expect(entityBlockedAt(sc2, 3, 13, 0)).toBe(false); // case adjacente libre
  });
  it('#791 — un prop solide d’une couche z ne bloque QUE sa couche', () => {
    const fireZ0 = { id: 'fz0', kind: 'prop', pos: { x: 5, y: 5 }, z: 0, ref: 'feu-camp' } as unknown as SceneEntity;
    const fireZ1 = { id: 'fz1', kind: 'prop', pos: { x: 5, y: 5 }, z: 1, ref: 'feu-camp' } as unknown as SceneEntity;
    const sc2 = { entities: [fireZ0] } as unknown as Scene;
    expect(entityBlockedAt(sc2, 5, 5, 0)).toBe(true);
    expect(entityBlockedAt(sc2, 5, 5, 1)).toBe(false); // aucun prop sur z1, la même case n'y est pas bloquée
    const sc3 = { entities: [fireZ1] } as unknown as Scene;
    expect(entityBlockedAt(sc3, 5, 5, 1)).toBe(true);
    expect(entityBlockedAt(sc3, 5, 5, 0)).toBe(false); // z absent (défaut 0) ≠ z1, le prop de l'étage ne descend pas
    const sc4 = { entities: [fireZ0, fireZ1] } as unknown as Scene;
    expect(entityBlockedAt(sc4, 5, 5, 0)).toBe(true);
    expect(entityBlockedAt(sc4, 5, 5, 1)).toBe(true);
  });
  it('perf — l’index d’empreintes (mémoïsé) s’invalide même si `scene.entities` est réassigné SUR LA MÊME réf `scene`', () => {
    const fire = { id: 'f', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'feu-camp' } as unknown as SceneEntity;
    const scene = { entities: [fire] } as unknown as Scene;
    expect(entityBlockedAt(scene, 2, 2, 0)).toBe(true);
    scene.entities = []; // même réf `scene`, nouveau tableau `entities` — jamais `.push`/`.splice` en place
    expect(entityBlockedAt(scene, 2, 2, 0)).toBe(false);
  });
  it('perf — ajouter un décor (nouveau tableau `entities`) est immédiatement pris en compte', () => {
    const scene = { entities: [] } as unknown as Scene;
    expect(entityBlockedAt(scene, 5, 5, 0)).toBe(false);
    const fire = { id: 'g', kind: 'prop', pos: { x: 5, y: 5 }, ref: 'feu-camp' } as unknown as SceneEntity;
    const scene2 = { ...scene, entities: [...scene.entities, fire] } as unknown as Scene;
    expect(entityBlockedAt(scene2, 5, 5, 0)).toBe(true);
  });
});

describe('isWalkable — intègre l’empreinte des décors', () => {
  const cart: SceneEntity = { id: 'c', kind: 'prop', pos: { x: 1, y: 0 }, ref: 'charrette' } as SceneEntity; // 2×1 dérivé de sa recette volumique, cap par défaut ; `solid`
  const scene = { dimensions: { w: 4, h: 1 }, layers: [{ z: 0, tiles: ['herbe', 'herbe', 'herbe', 'herbe'] }], entities: [cart] } as unknown as Scene;
  it('une case d’empreinte (charrette 2×1) est non-walkable', () => {
    expect(isWalkable(scene, 1, 0)).toBe(false);
    expect(isWalkable(scene, 2, 0)).toBe(false);
  });
  it('une case libre reste walkable', () => {
    expect(isWalkable(scene, 0, 0)).toBe(true);
  });
});

describe('isWalkable — #791 le blocage d’un prop ne s’applique qu’à SA couche z', () => {
  const propZ0: SceneEntity = { id: 'p0', kind: 'prop', pos: { x: 2, y: 2 }, z: 0, ref: 'feu-camp' } as unknown as SceneEntity;
  const propZ1: SceneEntity = { id: 'p1', kind: 'prop', pos: { x: 2, y: 2 }, z: 1, ref: 'feu-camp' } as unknown as SceneEntity;
  const scene = {
    dimensions: { w: 4, h: 4 },
    layers: [
      { z: 0, tiles: new Array(16).fill('herbe') },
      { z: 1, tiles: new Array(16).fill('pierre') },
    ],
    entities: [propZ0, propZ1],
  } as unknown as Scene;
  it('la case (2,2,0) est bloquée par le prop de z0', () => {
    expect(isWalkable(scene, 2, 2, 0)).toBe(false);
  });
  it('la case (2,2,1) est bloquée par le prop de z1 (indépendamment)', () => {
    expect(isWalkable(scene, 2, 2, 1)).toBe(false);
  });
  it('sans prop sur l’autre étage, la même case reste marchable', () => {
    const sceneOnlyZ0 = { ...scene, entities: [propZ0] } as unknown as Scene;
    expect(isWalkable(sceneOnlyZ0, 2, 2, 0)).toBe(false);
    expect(isWalkable(sceneOnlyZ0, 2, 2, 1)).toBe(true);
    const sceneOnlyZ1 = { ...scene, entities: [propZ1] } as unknown as Scene;
    expect(isWalkable(sceneOnlyZ1, 2, 2, 1)).toBe(false);
    expect(isWalkable(sceneOnlyZ1, 2, 2, 0)).toBe(true);
  });
});
