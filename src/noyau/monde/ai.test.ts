import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput, type CastableSpell } from './ai';
import { emptyScene } from './scene';
import { manhattan } from './path';
import type { Combatant, Weapon } from '../../engine/types';
import type { SpellData } from '../../data';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const RANGED: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };

/** Sort RÉSOLU minimal (`CastableSpell`) — porte un `data: SpellData` réduit aux champs lus par
 *  l'évaluateur (effects/missile/damage/opposed). Défaut = Projectile magique mono-cible jouable. */
function spellData(over: Partial<SpellData> = {}): SpellData {
  return { id: 'sp', label: 'Sort', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 }, ...over } as SpellData;
}
function castable(over: Partial<CastableSpell> & { id?: string } = {}): CastableSpell {
  const data = over.data ?? spellData({ id: over.id ?? 'sp', missile: true, damage: 8 });
  return { id: over.id ?? data.id, data, cn: over.cn ?? data.cn ?? 0, range: over.range ?? null, shape: over.shape ?? 'single', landProb: over.landProb ?? 1, focusState: over.focusState ?? 'none', active: over.active ?? false };
}

function mk(
  id: string,
  kind: 'hero' | 'enemy',
  pos: { x: number; y: number },
  opts: Partial<Combatant> = {},
): Combatant {
  return {
    id,
    label: id,
    kind,
    pos,
    wounds: { current: 10, max: 10 },
    weapons: [MELEE],
    characteristics: {} as never,
    advantage: 0,
    conditions: [],
    armour: {} as never,
    skills: [],
    talents: [],
    movement: 4,
    ...opts,
  } as Combatant;
}

const scene = emptyScene(12, 12);

function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return {
    enemy,
    heroes,
    scene,
    blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)),
    movement: enemy.movement,
    spells: [],
    ...extra,
  };
}

describe("IA d'ennemi (chooseEnemyAction, pure)", () => {
  it('sans héros vivant → passe la main', () => {
    expect(chooseEnemyAction(input(mk('e', 'enemy', { x: 5, y: 5 }), [])).kind).toBe('end');
  });

  it('Engagé : arme à distance EN PREMIER mais arme de mêlée + adversaire au contact → frappe en mêlée, ne tire pas (LDB Armes l.297-298)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED, MELEE] }); // arbalète d'abord, puis épée
    const adj = mk('adj', 'hero', { x: 5, y: 6 }, { wounds: { current: 8, max: 10 } }); // au contact
    const far = mk('far', 'hero', { x: 1, y: 1 }, { wounds: { current: 2, max: 10 } }); // plus faible MAIS distant
    const action = chooseEnemyAction(input(e, [adj, far]));
    expect(action.kind).toBe('melee');
    expect((action as { targetId: string }).targetId).toBe('adj'); // l'adversaire au contact, pas le faible distant
  });

  it('arme à distance, AUCUN adversaire au contact → tir sur le plus faible (comportement préservé)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED] });
    const far = mk('far', 'hero', { x: 1, y: 1 }, { wounds: { current: 2, max: 10 } });
    expect(chooseEnemyAction(input(e, [far])).kind).toBe('shoot');
  });

  it('cible adjacente en mêlée → attaque', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const h = mk('h', 'hero', { x: 5, y: 6 });
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('Allonge « Très longue » : frappe une cible à 2 cases sans se déplacer (RAW-3, LDB 62 l.163)', () => {
    const PIKE: Weapon = { label: 'Pique', type: 'melee', damage: { plusBF: true, flat: 2 }, reach: 'Très longue', qualities: [] };
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [PIKE] });
    const h = mk('h', 'hero', { x: 5, y: 7 }); // 2 cases
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('arme de contact : une cible à 2 cases impose de se rapprocher (move, pas d’Allonge)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [MELEE] });
    const h = mk('h', 'hero', { x: 5, y: 7 });
    expect(chooseEnemyAction(input(e, [h])).kind).toBe('move');
  });

  it('cible éloignée en mêlée → se rapproche (move) vers elle', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 3 });
    const h = mk('h', 'hero', { x: 5, y: 10 });
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      expect(a.thenTargetId).toBe('h');
      // a effectivement réduit la distance à la cible
      expect(manhattan(a.to, h.pos!)).toBeLessThan(manhattan(e.pos!, h.pos!));
    }
  });

  it('arme à distance → tient la position et tire (pas de charge en mêlée)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED] });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'shoot', targetId: 'h' });
  });

  it('sort offensif jouable (missile en portée) → incante sur la cible', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    expect(chooseEnemyAction(input(e, [h], { spells: [castable({ id: 'flechette', range: 20 })] }))).toEqual({
      kind: 'cast',
      targetId: 'h',
      spell: 'flechette',
    });
  });

  it('vise le héros le plus FAIBLE quand plusieurs sont frappables (sécurise l’élimination)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 4 });
    const strong = mk('strong', 'hero', { x: 6, y: 5 }, { wounds: { current: 10, max: 10 } }); // adjacent
    const weak = mk('weak', 'hero', { x: 5, y: 2 }, { wounds: { current: 2, max: 10 } }); // à 3 cases mais atteignable
    const a = chooseEnemyAction(input(e, [strong, weak]));
    expect(a.kind).toBe('move'); // délaisse le costaud adjacent pour fondre sur le blessé
    if (a.kind === 'move') {
      expect(a.thenTargetId).toBe('weak');
      expect(manhattan(a.to, weak.pos!)).toBe(1); // se met au contact du blessé
    }
  });

  it('ne court PAS après un blessé hors d’atteinte : frappe la cible accessible', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 1 });
    const strong = mk('strong', 'hero', { x: 5, y: 6 }, { wounds: { current: 10, max: 10 } }); // adjacent
    const weak = mk('weak', 'hero', { x: 5, y: 9 }, { wounds: { current: 1, max: 10 } }); // hors d’atteinte ce tour
    expect(chooseEnemyAction(input(e, [strong, weak]))).toEqual({ kind: 'melee', targetId: 'strong' });
  });

  it('anti-acharnement : une cible À TERRE est délaissée pour une cible valide debout (mêlée)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 4 });
    const downed = mk('downed', 'hero', { x: 5, y: 6 }, { wounds: { current: 1, max: 10 }, conditions: [{ id: 'a-terre', value: 1 }] }); // adjacent + très bas mais À TERRE
    const standing = mk('standing', 'hero', { x: 6, y: 5 }, { wounds: { current: 9, max: 10 } }); // adjacent, debout
    const a = chooseEnemyAction(input(e, [downed, standing]));
    expect(a.kind).toBe('melee');
    expect((a as { targetId: string }).targetId).toBe('standing'); // ignore le « par terre »
  });

  it('anti-acharnement : une cible à 0 PB encore présente n’est pas préférée à une cible debout (tir)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED] });
    const dying = mk('dying', 'hero', { x: 5, y: 7 }, { wounds: { current: 0, max: 10 } }); // 0 PB encore là
    const standing = mk('standing', 'hero', { x: 5, y: 8 }, { wounds: { current: 4, max: 10 } });
    expect(chooseEnemyAction(input(e, [dying, standing]))).toEqual({ kind: 'shoot', targetId: 'standing' });
  });

  it('anti-acharnement : si la SEULE cible est neutralisée, on l’achève (dernier recours)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const downed = mk('downed', 'hero', { x: 5, y: 6 }, { wounds: { current: 1, max: 10 }, conditions: [{ id: 'inconscient', value: 1 }] });
    expect(chooseEnemyAction(input(e, [downed]))).toEqual({ kind: 'melee', targetId: 'downed' });
  });

  it('encerclé et cible non adjacente → passe la main (pas de mouvement possible)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 4 });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    const blocked = new Set(['4,5', '6,5', '5,4', '5,6', '4,4', '6,4', '4,6', '6,6']); // 8 voisins bloqués (encerclement complet, grille 8-connexe)
    expect(chooseEnemyAction(input(e, [h], { blocked })).kind).toBe('end');
  });
});

describe('IA — vision réciproque (perceived)', () => {
  it('ne cible PAS un héros hors de sa perception, même proche et faible (mêlée)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const seen = mk('seen', 'hero', { x: 7, y: 5 });
    const unseen = mk('unseen', 'hero', { x: 6, y: 5 }, { wounds: { current: 1, max: 10 } }); // adjacent + faible
    const action = chooseEnemyAction(input(e, [seen, unseen], { perceived: new Set(['7,5,0']) }));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('seen'); // l'invisible (pourtant adjacent/faible) est ignoré
  });
  it('aucun héros perçu mais des adversaires EXISTENT → avance vers le plus proche non perçu (anti-immobilisme), sans tirer/lancer dessus', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 3 });
    const h = mk('h', 'hero', { x: 5, y: 10 });
    const a = chooseEnemyAction(input(e, [h], { perceived: new Set() }));
    expect(a.kind).toBe('move'); // se rapproche au lieu de planter
    if (a.kind === 'move') {
      expect(a.thenTargetId).toBe('h');
      expect(manhattan(a.to, h.pos!)).toBeLessThan(manhattan(e.pos!, h.pos!)); // a réduit la distance
    }
  });
  it('plus AUCUN adversaire (combat fini) → passe la main', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    expect(chooseEnemyAction(input(e, [])).kind).toBe('end');
  });
  it('aucun héros perçu ET encerclé (aucun mouvement) → passe la main', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { movement: 4 });
    const h = mk('h', 'hero', { x: 1, y: 1 });
    const blocked = new Set(['4,5', '6,5', '5,4', '5,6', '4,4', '6,4', '4,6', '6,6']); // 8 voisins bloqués (encerclement complet, grille 8-connexe)
    expect(chooseEnemyAction(input(e, [h], { perceived: new Set(), blocked })).kind).toBe('end');
  });
  it('perçoit une cible au tir → la vise', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [RANGED] });
    const seen = mk('seen', 'hero', { x: 5, y: 9 });
    expect(chooseEnemyAction(input(e, [seen], { perceived: new Set(['5,9,0']) })).kind).toBe('shoot');
  });
});
