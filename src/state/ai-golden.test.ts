/**
 * GOLDEN de parité (Lot 2 — Socle Utility). Filet anti-régression du refactor « énumérer → scorer →
 * argmax » de `chooseEnemyAction` : pour un jeu d'états figés couvrant CHAQUE branche (gardes RAW ET
 * cœur discrétionnaire), l'action retournée doit être STRICTEMENT identique au comportement d'avant
 * le refactor. Les valeurs de référence sont celles établies par la cascade historique (et déjà
 * vérifiées par `ai*.test.ts`). Tout écart détecté = bug du refactor à corriger (pas le golden).
 *
 * Pur : aucun dé, aucun mock — `chooseEnemyAction` est déterministe.
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyAction, type EnemyTurnInput, type CastableSpell } from './ai';
import { emptyScene, type Scene } from './scene';
import { chebyshev } from './path';
import type { Combatant, Weapon } from '../engine/types';
import type { SpellData } from '../data';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const RANGED: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };
const CROSSBOW: Weapon = { label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, reload: 1, qualities: [] };

/** Sort RÉSOLU minimal (`CastableSpell`) pour les fixtures golden — défaut = Projectile mono-cible. */
function spellData(over: Partial<SpellData> = {}): SpellData {
  return { id: 'sp', label: 'Sort', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 }, ...over } as SpellData;
}
function castable(over: Partial<CastableSpell> & { id?: string } = {}): CastableSpell {
  const data = over.data ?? spellData({ id: over.id ?? 'sp', missile: true, damage: 8 });
  return { id: over.id ?? data.id, data, cn: over.cn ?? data.cn ?? 0, range: over.range ?? null, shape: over.shape ?? 'single', landProb: over.landProb ?? 1, focusState: over.focusState ?? 'none', active: over.active ?? false };
}

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 10, max: 10 }, weapons: [MELEE], characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never, skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}

const scene = emptyScene(16, 16);
// Scène 1D avec un mur posé, pour les cas de Ligne de Vue (réutilise le motif d'ai-los.test.ts).
function walledScene(w: number, walls: Record<string, string> = {}): Scene {
  const grid = new Array(w).fill('herbe');
  for (const [k, v] of Object.entries(walls)) grid[Number(k.split(',')[0])] = v;
  return { id: 's', name: 's', dimensions: { w, h: 1 }, ambiance: 'jour', layers: [{ z: 0, tiles: grid }], entities: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
}

function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

/** Helper : id de cible quel que soit le kind d'action. */
const tidOf = (a: EnemyAction): string | undefined =>
  (a as { targetId?: string }).targetId ?? (a as { thenTargetId?: string }).thenTargetId;

describe('GOLDEN parité Lot 2 — gardes RAW/psychologie (forcées, hors scoring)', () => {
  it('vivier perçu vide mais adversaires existants → anti-immobilisme (move vers le plus proche)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 3 });
    const h = mk('h', 'hero', { x: 5, y: 12 });
    const a = chooseEnemyAction(input(e, [h], { perceived: new Set() }));
    expect(a.kind).toBe('move');
    expect(tidOf(a)).toBe('h');
  });

  it('plus aucun adversaire (combat fini) → end', () => {
    expect(chooseEnemyAction(input(mk('e', 'enemy', { x: 5, y: 5 }), [])).kind).toBe('end');
  });

  it('ni Action ni Mouvement (Surpris, M=0) → end', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'surpris', value: 1 }], movement: 0 });
    const h = mk('h', 'hero', { x: 5, y: 6 });
    expect(chooseEnemyAction(input(e, [h], { movement: 0 })).kind).toBe('end');
  });

  it('En flammes non frénétique → recover en-flammes (priorité survie)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'en-flammes', value: 1 }] });
    const h = mk('h', 'hero', { x: 5, y: 6 });
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'recover', state: 'en-flammes' });
  });

  it('En flammes frénétique → ignore le feu et attaque', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'en-flammes', value: 1 }], psychState: [{ type: 'frenesie' }] });
    const h = mk('h', 'hero', { x: 5, y: 6 });
    expect(chooseEnemyAction(input(e, [h])).kind).toBe('melee');
  });

  it('Brisé non Engagé → fuit (move)', () => {
    const e = mk('e', 'enemy', { x: 8, y: 8 }, { conditions: [{ id: 'brise', value: 1 }], movement: 3 });
    const h = mk('h', 'hero', { x: 8, y: 5 });
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('move');
  });

  it('Bestial blessé <50% (non Territorial/Frénétique/Engagé) → fuit (move)', () => {
    const e = mk('e', 'enemy', { x: 8, y: 8 }, {
      traits: [{ id: 'bestial' } as never], wounds: { current: 3, max: 10 }, movement: 3,
    });
    const h = mk('h', 'hero', { x: 8, y: 5 });
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('move');
  });

  it('Frénésie → vise le plus PROCHE (LDB 21 l.33), pas le plus faible', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: 'frenesie' }], movement: 4 });
    const near = mk('near', 'hero', { x: 5, y: 6 }, { wounds: { current: 10, max: 10 } }); // proche, costaud
    const weakFar = mk('weakFar', 'hero', { x: 5, y: 11 }, { wounds: { current: 1, max: 10 } }); // faible, loin
    const a = chooseEnemyAction(input(e, [near, weakFar]));
    expect(tidOf(a)).toBe('near');
  });

  it('Animosité/Haine active → filtre le vivier sur le groupe haï', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: 'haine', cible: 'elfe', active: true }] });
    const hated = mk('hated', 'hero', { x: 5, y: 6 }, { wounds: { current: 10, max: 10 }, groups: ['elfe'] });
    const weak = mk('weak', 'hero', { x: 5, y: 4 }, { wounds: { current: 1, max: 10 }, groups: ['humain'] });
    expect(tidOf(chooseEnemyAction(input(e, [hated, weak])))).toBe('hated');
  });

  it('Empêtré (M=0) sans option → recover empetre', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'empetre', value: 1, sourceId: 'h' }] });
    const h = mk('h', 'hero', { x: 11, y: 11 });
    expect(chooseEnemyAction(input(e, [h], { movement: 0 }))).toEqual({ kind: 'recover', state: 'empetre' });
  });

  it('Empêtré mais cible au contact → attaque (Empêtré ne bloque pas l’Action)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'empetre', value: 1, sourceId: 'h' }] });
    const h = mk('h', 'hero', { x: 5, y: 6 });
    expect(chooseEnemyAction(input(e, [h], { movement: 0 })).kind).toBe('melee');
  });
});

describe('GOLDEN parité Lot 2 — cœur discrétionnaire (enumerate → score → argmax)', () => {
  it('mêlée cible AU CONTACT → melee', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const h = mk('h', 'hero', { x: 5, y: 6 });
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('mêlée cible LOIN (atteignable) → move qui réduit la distance', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 3 });
    const h = mk('h', 'hero', { x: 5, y: 10 });
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('move');
    expect(tidOf(a)).toBe('h');
  });

  it('tireur EN PORTÉE, aucun contact → shoot', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED] });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'shoot', targetId: 'h' });
  });

  it('#537 tireur EN PORTÉE sous banRanged (duel judiciaire) → JAMAIS shoot (bascule approche)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED], movement: 3 });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    const a = chooseEnemyAction(input(e, [h], { banRanged: true }));
    expect(a.kind).not.toBe('shoot');
  });

  it('tireur HORS PORTÉE (au-delà de la bande Extrême ×3) → move (approche)', () => {
    // Arc 1 m → Extrême ≤ 3 m = 1,5 case ⇒ une cible à 5 cases est hors de toute bande → on s'approche.
    const e = mk('e', 'enemy', { x: 0, y: 0 }, { weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 1, qualities: [] }] });
    const h = mk('h', 'hero', { x: 0, y: 5 });
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('move');
  });

  it('tireur retenu au contact (arme distance + mêlée) → frappe l’adversaire au contact', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED, MELEE] });
    const adj = mk('adj', 'hero', { x: 5, y: 6 }, { wounds: { current: 8, max: 10 } });
    const far = mk('far', 'hero', { x: 1, y: 1 }, { wounds: { current: 2, max: 10 } });
    const a = chooseEnemyAction(input(e, [adj, far]));
    expect(a).toEqual({ kind: 'melee', targetId: 'adj' });
  });

  it('arme à Recharge déchargée + cible en portée → reload', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [{ ...CROSSBOW, loaded: false }] });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    expect(chooseEnemyAction(input(e, [h])).kind).toBe('reload');
  });

  it('lanceur missile FAISABLE en portée → cast mono-cible', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'Carreau', range: 20 })] }))).toEqual({ kind: 'cast', targetId: 'h', spell: 'Carreau' });
  });

  it('sort déjà FOCALISÉ et prêt (focusState ready) → cast à NI 0', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 20, focusState: 'ready' })] }))).toEqual({ kind: 'cast', targetId: 'h', spell: 'carreau' });
  });

  it('sort FOCALISABLE (peu fiable d’un jet) et rien de faisable → focus', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'vortex-d-ames', focusState: 'focusable' })] }))).toEqual({ kind: 'focus', spell: 'vortex-d-ames' });
  });

  it('focalisable MAIS adversaire au contact + arme de mêlée → se replie en mêlée (pas focus)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [MELEE] });
    const adj = mk('adj', 'hero', { x: 5, y: 6 });
    expect(chooseEnemyAction(input(e, [adj], { spells: [castable({ id: 'vortex-d-ames', focusState: 'focusable' })] }))).toEqual({ kind: 'melee', targetId: 'adj' });
  });

  it('ZdE : ≥2 héros groupés → castArea couvrant le paquet', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h1 = mk('h1', 'hero', { x: 5, y: 9 });
    const h2 = mk('h2', 'hero', { x: 6, y: 9 });
    const areaSp = castable({ id: 'vortex-d-ames', shape: { area: { radius: 1 } }, range: 20, data: spellData({ id: 'vortex-d-ames', effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount: 8 }] } } }) });
    const a = chooseEnemyAction(input(e, [h1, h2], { spells: [areaSp] }));
    expect(a.kind).toBe('castArea');
  });

  it('ZdE : héros DISPERSÉS → pas de castArea, repli sur le missile mono-cible', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h1 = mk('h1', 'hero', { x: 1, y: 1 });
    const h2 = mk('h2', 'hero', { x: 14, y: 14 });
    const areaSp = castable({ id: 'vortex-d-ames', shape: { area: { radius: 1 } }, range: 30, data: spellData({ id: 'vortex-d-ames', effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount: 8 }] } } }) });
    const a = chooseEnemyAction(input(e, [h1, h2], { spells: [areaSp, castable({ id: 'carreau', range: 40 })] }));
    expect(a.kind).toBe('cast');
  });

  it('anti-acharnement : cible au sol (À Terre) délaissée pour une cible debout (mêlée)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 4 });
    const downed = mk('downed', 'hero', { x: 5, y: 6 }, { wounds: { current: 1, max: 10 }, conditions: [{ id: 'a-terre', value: 1 }] });
    const standing = mk('standing', 'hero', { x: 6, y: 5 }, { wounds: { current: 9, max: 10 } });
    expect(tidOf(chooseEnemyAction(input(e, [downed, standing])))).toBe('standing');
  });

  it('anti-acharnement : seule cible neutralisée → on l’achève (dernier recours)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const downed = mk('downed', 'hero', { x: 5, y: 6 }, { wounds: { current: 1, max: 10 }, conditions: [{ id: 'inconscient', value: 1 }] });
    expect(chooseEnemyAction(input(e, [downed]))).toEqual({ kind: 'melee', targetId: 'downed' });
  });

  it('LdV : cible derrière un mur → ne tire pas (move)', () => {
    const e = { id: 'E', name: 'T', kind: 'enemy', characteristics: {} as never, wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], weapons: [RANGED], armour: {} as never, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 } } as unknown as Combatant;
    const h = { id: 'H', name: 'H', kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [], pos: { x: 6, y: 0 } } as unknown as Combatant;
    const a = chooseEnemyAction({ enemy: e, heroes: [h], scene: walledScene(8, { '3,0': 'mur' }), blocked: new Set(), movement: 4, spells: [] });
    expect(a.kind).not.toBe('shoot');
  });

  it('encerclé, cible non adjacente → end (aucun mouvement)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 4 });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    const blocked = new Set(['4,5', '6,5', '5,4', '5,6', '4,4', '6,4', '4,6', '6,6']); // encerclement complet (8 voisins, grille 8-connexe)
    expect(chooseEnemyAction(input(e, [h], { blocked })).kind).toBe('end');
  });
});

describe('GOLDEN — extensions op-driven (attaquer prime / pas de move parasite)', () => {
  // « UN COUP JOUABLE PRIME » (plan §6, confirmé par le playtest 2026-06-27 : l'arbalétrière qui « fonce au
  // centre au lieu de tirer » et la sorcière qui « spamme et rate » = MÊME bug). La REPOSITION/repli a une
  // utilité d'ÉCHELLE DE POSITION (couvert/danger), incommensurable avec l'échelle Blessures d'une attaque ;
  // le seul biais `TIER` ne départage qu'à utilité ÉGALE → un gain de couvert pouvait battre un tir/cast.
  // CORRECTION : un tireur/lanceur qui a une cible JOUABLE à portée FAIT FEU — il ne se replie JAMAIS au prix
  // de son attaque (même peu fiable : un Carreau à 30 % vaut mieux qu'un cran de couvert). La reposition sert seulement l'absence d'attaque jouable.
  it('tireur (arc) + héros à portée + LdV → TIRE (ne fonce pas, ne se repositionne pas)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED], movement: 4 });
    const h = mk('h', 'hero', { x: 5, y: 9 }); // d=4, à portée (60) + LdV dégagée
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'shoot', targetId: 'h' });
  });

  it('lanceur AU CONTACT + sort jouable à portée → LANCE (n’abandonne pas son tour pour un repli)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [], movement: 4 });
    const h = mk('h', 'hero', { x: 5, y: 6 }); // au contact (d=1)
    const a = chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 4, landProb: 0.3 })] }));
    expect(a.kind).toBe('cast');
    expect(tidOf(a)).toBe('h');
  });

  it('tireur SANS LdV (cible derrière un mur) → se REPOSITIONNE (move), seule attaque indisponible déclenche le repli', () => {
    const e = { id: 'e', name: 'e', kind: 'enemy', characteristics: {} as never, wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], weapons: [RANGED], armour: {} as never, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 } } as unknown as Combatant;
    const h = { id: 'h', name: 'h', kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [], pos: { x: 6, y: 0 } } as unknown as Combatant;
    const a = chooseEnemyAction({ enemy: e, heroes: [h], scene: walledScene(8, { '3,0': 'mur' }), blocked: new Set(), movement: 4, spells: [] });
    expect(a.kind).not.toBe('shoot'); // pas de LdV → ne tire pas
    expect(a.kind).toBe('move'); // il bouge pour dégager la ligne / approcher
  });

  // (a-bis) HYBRIDE tir+mêlée (retour playtest 2026-06-27 : « le chasseur charge à l'arme simple alors qu'il
  // a une fronde »). Un porteur d'arme à distance qui garde une arme de mêlée de secours reste un TIREUR : hors
  // de portée de tir mais à portée de CHARGE, il s'approche à sa DISTANCE DE TIR (standoff) — il ne fonce PAS au
  // contact. (Bug : `isShooterOrCaster` excluait les hybrides via `&& !hasMeleeWeapon` → mêlée au contact.)
  it('hybride (fronde + épée) hors de portée de tir mais mêlée atteignable → STANDOFF (ne charge pas au contact)', () => {
    const SLING: Weapon = { label: 'Fronde', type: 'ranged', damage: { plusBF: false, flat: 5 }, range: 2, qualities: [] };
    const e = mk('e', 'enemy', { x: 8, y: 8 }, { weapons: [SLING, MELEE], movement: 4 });
    const h = mk('h', 'hero', { x: 8, y: 12 }); // d=4 : hors bande de la fronde (portée 2) mais atteignable en mêlée (mvt 4)
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('move'); // s'approche (hors de portée de tir)
    expect(tidOf(a)).toBe('h');
    if (a.kind === 'move') expect(chebyshev(a.to, { x: 8, y: 12 })).toBeGreaterThan(1); // STANDOFF, pas le contact
  });

  // (b) PAS de MOVE PARASITE : en scène NEUTRE (déjà à bonne distance, rien à gagner en position), le
  // lanceur LANCE son sort — aucune reposition (gain de position ≤ 0 partout → aucun candidat `move`).
  it('scène neutre : le lanceur cast (pas de reposition parasite)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [], movement: 4 });
    const h = mk('h', 'hero', { x: 5, y: 9 }); // déjà à distance de tir (d=4 > mr), LdV dégagée
    const a = chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'carreau', range: 20 })] }));
    expect(a).toEqual({ kind: 'cast', targetId: 'h', spell: 'carreau' });
  });
});
