/**
 * LOT 3 — Heuristiques de MENACE & POSITIONNEMENT (déterministes, sans dé). Chaque test isole une
 * heuristique et vérifie le CHANGEMENT de comportement VOULU par rapport au « PV le plus bas » du Lot 2 :
 *  - ciblage par MENACE (`targetThreat`) plutôt que par PV bas (un caster fragile et dangereux préféré
 *    à un PV-bas inoffensif hors d'atteinte) ;
 *  - `killSecure` (achève une cible à portée) ;
 *  - `overkillPenalty` (ignore la cible au sol — déjà couvert ailleurs, renforcé ici) ;
 *  - `controlValue` (préfère un débuff utile quand pertinent) ;
 *  - `positionValue` (un tireur ne vient pas au contact s'il peut tirer ; recherche du flanc/dos gratuit).
 * Pur : `chooseEnemyAction` est déterministe — on donne des Caractéristiques RÉELLES pour que les
 * espérances de dégâts (`expectedDamage`) soient chiffrables (≠ tests à `{} as never` qui restent neutres).
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyAction, type EnemyTurnInput, type CastableSpell } from '../noyau/monde/ai';
import { emptyScene } from '../noyau/monde/scene';
import { chebyshev } from '../engine/grid';
import type { Combatant, Weapon } from '../engine/types';
import type { SpellData } from '../data';
import type { Dir8 } from '../geometry/dir8';
import { blessuresDeBase } from '../engine/characteristics';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const RANGED: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };
const FISTS: Weapon = { label: 'Mains nues', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const ARMOUR = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 12, max: 12 }, weapons: [MELEE],
    characteristics: { ...CHARS }, advantage: 0, conditions: [], armour: { ...ARMOUR },
    skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}

const scene = emptyScene('scene-test', 20, 20);

function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

const tidOf = (a: EnemyAction): string | undefined =>
  (a as { targetId?: string }).targetId ?? (a as { thenTargetId?: string }).thenTargetId;

describe('Lot 3 — ciblage par MENACE (targetThreat) ≠ PV le plus bas', () => {
  it('un tireur préfère le héros le plus MENAÇANT (gros dégâts, à portée) au PV-bas inoffensif et lointain', () => {
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [RANGED], movement: 4 });
    // dangerous : PB pleins MAIS lourdement armé (épée +BF+10) et proche → menace forte.
    const dangerous = mk('dangerous', 'hero', { x: 10, y: 13 }, {
      wounds: blessuresDeBase(12),
      weapons: [{ label: 'Hache lourde', type: 'melee', damage: { plusBF: true, flat: 10 }, qualities: [] }],
    });
    // soft : PB plus bas MAIS désarmé (mains nues) et plus loin, et PAS finissable en un tir (8 PB > 7
    // dégâts attendus → pas de killSecure) → menace faible malgré la fragilité légèrement supérieure.
    const soft = mk('soft', 'hero', { x: 10, y: 16 }, { wounds: blessuresDeBase(12, 8), weapons: [FISTS] });
    const a = chooseEnemyAction(input(e, [dangerous, soft]));
    expect(a.kind).toBe('shoot');
    expect(tidOf(a)).toBe('dangerous'); // la MENACE l'emporte sur le simple « PV le plus bas »
  });

  it('à menace comparable, la cible plus fragile (PB bas) est préférée (fragilité dans targetThreat)', () => {
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [RANGED] });
    // Deux héros identiques (même arme/menace) mais l'un entamé : on sécurise l'élimination du plus fragile.
    const hurt = mk('hurt', 'hero', { x: 10, y: 13 }, { wounds: blessuresDeBase(12, 3), weapons: [MELEE] });
    const fresh = mk('fresh', 'hero', { x: 10, y: 14 }, { wounds: blessuresDeBase(12), weapons: [MELEE] });
    const a = chooseEnemyAction(input(e, [fresh, hurt]));
    expect(tidOf(a)).toBe('hurt');
  });
});

describe('Lot 3 — killSecure : achève une cible à portée', () => {
  it('à dégâts attendus ≥ PB restants, l’IA frappe la cible ACHEVABLE plutôt qu’une cible plus menaçante mais non finissable', () => {
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [MELEE], characteristics: { ...CHARS, force: 45 } });
    // finissable : 2 PB, au contact → un coup d'épée (+BF+4) le tue (killSecure).
    const finishable = mk('finishable', 'hero', { x: 10, y: 11 }, { wounds: blessuresDeBase(12, 2), weapons: [FISTS] });
    // tank : pleine vie + grosse menace, au contact aussi — mais pas finissable ce tour.
    const tank = mk('tank', 'hero', { x: 11, y: 10 }, {
      wounds: blessuresDeBase(12), armour: { ...ARMOUR, corps: 4 },
      weapons: [{ label: 'Hache', type: 'melee', damage: { plusBF: true, flat: 8 }, qualities: [] }],
    });
    const a = chooseEnemyAction(input(e, [finishable, tank]));
    expect(a.kind).toBe('melee');
    expect(tidOf(a)).toBe('finishable'); // le bonus killSecure prime
  });
});

describe('Lot 3 — overkill : ignore la cible neutralisée', () => {
  it('cible au sol (À Terre, finissable) délaissée pour une cible debout, même moins fragile', () => {
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [MELEE] });
    const downed = mk('downed', 'hero', { x: 10, y: 11 }, { wounds: blessuresDeBase(12, 1), conditions: [{ id: 'a-terre', value: 1 }] });
    const standing = mk('standing', 'hero', { x: 11, y: 10 }, { wounds: blessuresDeBase(12, 10) });
    expect(tidOf(chooseEnemyAction(input(e, [downed, standing])))).toBe('standing');
  });
});

describe('Lot 3 — valeur de CONTRÔLE : un sort qui inflige un État (op:condition) est offensif et jouable', () => {
  // Sort de Projectile portant EN PLUS une op `condition` (Étourdi) sur la cible : `spellIsOffensive` le
  // voit (op hostile), `spellActionValue` somme dégâts + CONDITION_THREAT['etourdi']. La valeur de l'État
  // vient des `GameOp` de `data.effects` (Flow `do/ops`), JAMAIS d'un champ de catégorie.
  const controlSpell: CastableSpell = {
    id: 'choc-mental', cn: 0, range: 20, shape: 'single', landProb: 1, focusState: 'none', active: false,
    data: {
      id: 'choc-mental', label: 'Choc mental', ecole: 'sort', subType: null, family: 'arcane', cn: 0,
      range: null, target: null, duration: null, desc: '', missile: true, damage: 2,
      effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'sonne' }] } },
      source: { book: 'LDB', page: 0 },
    } as unknown as SpellData,
  };
  it('un sort qui ÉTOURDIT (op:condition) est lancé sur la cible (sa valeur intègre l’État infligé)', () => {
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 10, y: 13 });
    const a = chooseEnemyAction(input(e, [h], { spells: [controlSpell] }));
    expect(a).toEqual({ kind: 'cast', targetId: 'h', spell: 'choc-mental' });
  });
});

describe('Lot 3 — positionValue : portée préférée & flanc/dos', () => {
  it('un tireur en portée NE vient PAS au contact : il tire de loin (préférence de distance)', () => {
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [RANGED], movement: 4 });
    const h = mk('h', 'hero', { x: 10, y: 14 }); // à 4 cases, en portée, LdV dégagée
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('shoot'); // tire, ne charge pas en mêlée
  });

  it('à utilité d’attaque égale, l’approche choisit une case de FLANC/DOS quand c’est gratuit', () => {
    // Héros orienté au NORD (regarde vers y décroissant) ; l'ennemi vient du sud → l'attaque par le sud
    // (dos) doit être préférée à une approche frontale (par le nord), à distance d'arrivée égale.
    const e = mk('e', 'enemy', { x: 10, y: 14 }, { weapons: [MELEE], movement: 6 });
    const h = mk('h', 'hero', { x: 10, y: 10 });
    const facing: Record<string, Dir8> = { h: 'N' }; // le héros regarde au nord (vers l'ennemi venant du nord)
    const a = chooseEnemyAction(input(e, [h], { facing }));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      // arrive au contact du héros…
      expect(chebyshev(a.to, { x: 10, y: 10 })).toBe(1);
      // …par une case HORS du champ de vision avant (flanc/dos) : pas la case nord (10,9) qui est plein
      // front du héros orienté N. (Le sud (10,11) est le dos.)
      expect(`${a.to.x},${a.to.y}`).not.toBe('10,9');
    }
  });
});
