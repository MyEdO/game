/**
 * Garde-fou de l'ÉVALUATEUR de sort op-driven (`src/state/aiSpellValue.ts`) — la valeur d'un `GameOp`
 * pour le camp du lanceur, échelle « Blessures-équivalent ». EXHAUSTIF par classification (dégâts /
 * soin / buff marginal / contrôle / invocation / défaut signé) + escompte d'opposition. PUR, déterministe.
 */
import { describe, it, expect } from 'vitest';
import { opValue, oppositionDiscount, hitProbability, type OpEvalCtx } from './aiSpellValue';
import type { SpellData } from '../data';
import type { Combatant, Weapon } from '../engine/types';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function combatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', label: 'c', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 }, ...over,
  } as Combatant;
}
const ctxOf = (refEnemy: Combatant | null = null): OpEvalCtx => ({ refEnemy, horizon: 3 });
const op = (o: object): never => o as never;

describe('opValue — DÉGÂTS (wounds), espérance mitigée correcte', () => {
  const caster = () => combatant();
  it('wounds par DÉFAUT ignore BE+PA → vaut le montant plein', () => {
    const target = combatant({ characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } });
    expect(opValue(op({ op: 'wounds', amount: 6 }), caster(), target, ctxOf())).toBe(6);
  });
  it('wounds ignoreTB:false & ignoreAP:false → DÉDUIT le Bonus d’Endurance et les PA Corps', () => {
    const target = combatant({ characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    // 8 − BE(4) − PA(3) = 1
    expect(opValue(op({ op: 'wounds', amount: 8, ignoreTB: false, ignoreAP: false }), caster(), target, ctxOf())).toBe(1);
  });
});

describe('opValue — SOIN plafonné aux PB manquants', () => {
  it('heal 6 sur un allié qui n’a perdu que 3 PB → 3 (jamais du soin gâché)', () => {
    const ally = combatant({ wounds: { current: 9, max: 12, base: 12 } });
    expect(opValue(op({ op: 'heal', amount: 6 }), combatant(), ally, ctxOf())).toBe(3);
  });
  it('heal 6 sur un allié à 2/12 → 6 (le soin entier est récupérable)', () => {
    const ally = combatant({ wounds: { current: 2, max: 12, base: 12 } });
    expect(opValue(op({ op: 'heal', amount: 6 }), combatant(), ally, ctxOf())).toBe(6);
  });
});

describe('opValue — BUFF de combat = bénéfice marginal (armé > 0, désarmé = 0)', () => {
  const buff = op({ op: 'charMod', char: 'capacite-de-combat', mod: 10 });
  const ref = combatant({ id: 'h', kind: 'hero', pos: { x: 2, y: 0 } });
  it('subject ARMÉ → +10 CC améliore l’EV d’attaque → > 0', () => {
    expect(opValue(buff, combatant(), combatant({ id: 's', weapons: [MELEE] }), ctxOf(ref))).toBeGreaterThan(0);
  });
  it('subject SANS arme → aucune attaque à améliorer → 0', () => {
    expect(opValue(buff, combatant(), combatant({ id: 's', weapons: [] }), ctxOf(ref))).toBe(0);
  });
  it('charMod NÉGATIF (débuff) sur un ennemi → valeur de contrôle > 0 (magnitude)', () => {
    expect(opValue(op({ op: 'charMod', char: 'capacite-de-combat', mod: -20 }), combatant(), combatant({ id: 'h' }), ctxOf())).toBeGreaterThan(0);
  });
});

describe('opValue — CONTRÔLE (condition) = aiThreat de etats.json', () => {
  it('Sonné (op:condition) → aiThreat lu en donnée sur etats.json (6)', () => {
    expect(opValue(op({ op: 'condition', id: 'sonne' }), combatant(), combatant({ id: 'h' }), ctxOf())).toBe(6);
  });
  it('État inconnu → 1 (contrôle mineur, jamais 0)', () => {
    expect(opValue(op({ op: 'condition', id: 'inexistant' }), combatant(), combatant({ id: 'h' }), ctxOf())).toBe(1);
  });
});

describe('opValue — INVOCATION', () => {
  it('summon ALLIÉ → > 0 (vaut la créature invoquée)', () => {
    expect(opValue(op({ op: 'summon', ref: 'loup', count: 1, allyOfCaster: true }), combatant(), combatant(), ctxOf())).toBeGreaterThan(0);
  });
  it('summon HORS DE CONTRÔLE (allyOfCaster:false, démon non lié) → 0 pour le lanceur', () => {
    expect(opValue(op({ op: 'summon', ref: 'sanguinaire-de-khorne', count: 1, allyOfCaster: false }), combatant(), combatant(), ctxOf())).toBe(0);
  });
});

describe('opValue — DÉFAUT signé (longue traîne) : jamais de faux 0 silencieux', () => {
  it('op BÉNÉFIQUE non explicitement câblée (grantTalent) → petit +', () => {
    expect(opValue(op({ op: 'grantTalent', ref: 'x', times: 1 }), combatant(), combatant(), ctxOf())).toBeGreaterThan(0);
  });
  it('op HOSTILE non explicitement câblée (contractDisease) → petit + (contrôle)', () => {
    expect(opValue(op({ op: 'contractDisease', ref: 'x' }), combatant(), combatant({ id: 'h' }), ctxOf())).toBeGreaterThan(0);
  });
  it('op NEUTRE / inconnue → 0 (pas de gain inventé)', () => {
    expect(opValue(op({ op: '__inconnue__' }), combatant(), combatant(), ctxOf())).toBe(0);
  });
});

describe('oppositionDiscount — Sorts de Contact / résistés (LDB 46 l.123-124)', () => {
  const caster = () => combatant({ characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 } });
  const target = () => combatant({ id: 'h', characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 } });
  const spell = (opposed?: SpellData['opposed']): SpellData => ({ id: 'sp', label: 'Sort', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', opposed, source: { book: 'LDB', page: 0 } } as SpellData);

  it('Sort de Contact (opposé) → escompte < 1', () => {
    expect(oppositionDiscount(spell({ kind: 'contact' }), caster(), target())).toBeLessThan(1);
  });
  it('Sort résisté → 0.5', () => {
    expect(oppositionDiscount(spell({ kind: 'resist', char: 'force-mentale' }), caster(), target())).toBe(0.5);
  });
  it('Sort NON opposé → ×1 (passe à coup sûr)', () => {
    expect(oppositionDiscount(spell(undefined), caster(), target())).toBe(1);
  });
});

/**
 * MONOTONIE DU SCORING — `hitProbability` est la grandeur par où l'IA ÉVALUE le vrai jet
 * (`combatValue + combineMods`). Aucune garde ne l'observait : un changement de règle de combinaison
 * déplaçait ses probabilités en silence (mesuré : 0,20 → 0,10 à 4 pions Exténué, l'espérance de
 * dégâts divisée par deux). Ici la marche est EXIGÉE, pion par pion : chaque État coûte ses 10 points
 * de cible (`LDB 16 l.11`), jamais absorbés par le plafond des Difficultés (`LDB 14 l.48/95`).
 */
describe('hitProbability — chaque pion d’État coûte sa marche à l’IA (CC 40, monotone)', () => {
  const cible = () => combatant({ id: 'B', kind: 'hero', pos: { x: 1, y: 0 } });
  const use = (pions: number) => combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [MELEE], ...(pions ? { conditions: [{ id: 'extenue', value: pions }] } : {}) } as Partial<Combatant>);

  it('0 à 5 pions Exténué : 0,40 → 0,05 par marches de 0,10 (plancher 5 %)', () => {
    const p = [0, 1, 2, 3, 4, 5].map((n) => hitProbability(use(n), cible(), MELEE, 'melee'));
    expect(p).toEqual([0.4, 0.3, 0.2, 0.1, 0.05, 0.05]);
    // Non-vacuité : la série doit VRAIMENT décroître (une grandeur constante passerait toute
    // comparaison « ≤ » sans rien prouver), et le 4ᵉ pion doit peser (le plafond l'aurait mangé).
    expect(p[0]).toBeGreaterThan(p[5]);
    for (let i = 1; i < 4; i++) expect(p[i - 1]! - p[i]!).toBeCloseTo(0.1, 10);
  });
});
