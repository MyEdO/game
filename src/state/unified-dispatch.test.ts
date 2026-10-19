import { describe, it, expect } from 'vitest';
import { fireTriggers, freeAttackSourcesOf, effectSourcesOf } from '../noyau/triggeredEffects';
import { flowHasFreeAttack } from '../noyau/monde/flow';
import { addCondition, hasCondition, stacks, COND } from '../engine/conditions';
import type { Combatant } from '../engine/types';

/**
 * DISPATCHER UNIQUE des effets déclenchés (principe : « peu importe le KIND — Trait, Talent, Atout, État,
 * Mutation/Maladie par composition — un Trigger fonctionne sans code spécifique »). `fireTriggers` réunit
 * TOUTES les sources : ici un TRAIT (Bestial) et un ÉTAT (Empoisonné) réagissent au MÊME `onRoundEnd`,
 * via le MÊME appel — preuve qu'on n'a plus deux chemins (traits vs États).
 */
// Caractéristiques COMPLÈTES (un vrai Combatant en a 10) : sans FM, le Test de Calme de récupération du
// Brisé — joué au même `onRoundEnd` — calculait sur une carac absente (NaN) et corrompait l'État.
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'x', name: 'X', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: { corps: 0 },
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
  ...over,
}) as unknown as Combatant;

const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
const fire = (c: Combatant, rng?: { int: (min: number, max: number) => number }) =>
  fireTriggers((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', rng ? { rng: rng as never } : {});
// rng DÉTERMINISTE : d10 bas (dégâts d'En Flammes contrôlés) MAIS d100 = 100 → le Test de Calme de
// récupération du Brisé (joué au MÊME onRoundEnd dès qu'un Brisé est présent) ÉCHOUE — on n'observe ainsi
// QUE l'effet testé (Bestial), sans le bruit de la récupération du Brisé.
const noRecover = (d10 = 1) => ({ int: (_min: number, max: number) => (max <= 10 ? d10 : max) });

describe('Dispatcher unique — Traits ET États réagissent au même Trigger, sans chemin par-kind', () => {
  it('TRAIT Bestial (LDB 85) : En Flammes en fin de Round → gagne Brisé (effet de DONNÉE, plus de hook)', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never });
    addCondition(c, COND.enFlammes);
    fire(c, noRecover());
    expect(hasCondition(c, COND.brise)).toBe(true);
  });

  it('Bestial sans En Flammes → aucun Brisé (la Condition Flow `if` filtre)', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never });
    fire(c);
    expect(hasCondition(c, COND.brise)).toBe(false);
  });

  it('Bestial déjà Brisé → ne re-stacke pas (LDB 85 : un seul Brisé de peur du feu)', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never });
    addCondition(c, COND.enFlammes);
    addCondition(c, COND.brise); // déjà Brisé d'une autre source
    fire(c, noRecover()); // récupération du Brisé neutralisée → on n'observe QUE le non-restack de Bestial
    expect(stacks(c, COND.brise)).toBe(1); // la Condition `brise == 0` empêche le re-stack
  });

  it('UN SEUL appel `fireTriggers(onRoundEnd)` joue à la fois l’effet de TRAIT et l’effet d’ÉTAT', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never }); // BE=4, PAmin=0
    addCondition(c, COND.enFlammes); // déclenche le TRAIT Bestial (→ Brisé) ET l'ÉTAT En Flammes (→ dégâts)
    const before = c.wounds.current;
    fire(c, noRecover(8)); // d10=8 → En Flammes : max(1, 8 − 4 − 0) = 4 PB ; d100=100 → pas de récupération du Brisé
    expect(hasCondition(c, COND.brise)).toBe(true); // effet de TRAIT (donnée)
    expect(before - c.wounds.current).toBe(4);      // effet d'ÉTAT (donnée) — MÊME appel
  });
});

describe('Horloge — un TRAIT et une MUTATION passent par le MÊME dispatcher, sans chemin par kind', () => {
  // Porteur unique de DEUX kinds : le Trait Désespoir (VDM 09 — Exténué `onWake`) et la Mutation
  // Haine sporadique (EDOC 8 — re-ciblage `onDayStart`). Aucun des deux n'a de code dédié.
  const doubleporteur = (): Combatant => mk({ traits: [{ id: 'desespoir' }], mutations: [{ id: 'haine-sporadique' }] } as never);

  it('effectSourcesOf énumère `trait:desespoir` et `mutation:haine-sporadique` côte à côte', () => {
    const keys = effectSourcesOf(doubleporteur()).map((s) => s.key);
    expect(keys).toContain('trait:desespoir');
    expect(keys).toContain('mutation:haine-sporadique');
  });

  it('le MÊME appel `fireTriggers` sert les deux kinds — `onDayStart` la Mutation, `onWake` le Trait', () => {
    const c = doubleporteur();
    fireTriggers((get as (c: Combatant) => unknown)(c) as never, c, 'onDayStart', {});
    expect((c.traits ?? []).filter((t) => t.id === 'haine')).toHaveLength(1); // effet de MUTATION (donnée)
    expect(hasCondition(c, COND.extenue)).toBe(false);                       // le Trait ne réagit pas à ce trigger

    fireTriggers((get as (c: Combatant) => unknown)(c) as never, c, 'onWake', {});
    expect(hasCondition(c, COND.extenue)).toBe(true);                        // effet de TRAIT (donnée), MÊME fonction
  });
});

describe('Attaques gratuites — résolveur kind-agnostique (plus de chemin talent-only)', () => {
  it('freeAttackSourcesOf énumère TOUTES les sources (Trait, Talent, État), chacune taguée `key`', () => {
    const c = mk({
      traits: [{ id: 'bestial' }] as never, // a des effects
      talents: [{ talentId: 'assaut-feroce', times: 2 }] as never, // free-attack onHit
      conditions: [{ id: 'empoisonne', value: 1 }] as never, // a des effects
    });
    const keys = freeAttackSourcesOf(c).map((s) => s.key);
    expect(keys).toContain('trait:bestial');
    expect(keys).toContain('assaut-feroce'); // talent : clé brute = imputation /Round inchangée
    expect(keys).toContain('cond:empoisonne');
    // Le plafond du talent suit ses niveaux (times) ; le défaut des autres = 1.
    expect(freeAttackSourcesOf(c).find((s) => s.key === 'assaut-feroce')!.cap).toBe(2);
    expect(freeAttackSourcesOf(c).find((s) => s.key === 'trait:bestial')!.cap).toBe(1);
  });

  it('flowHasFreeAttack ne retient QUE les Flows à grantFreeAttack (Assaut féroce oui ; Bestial non)', () => {
    const af = freeAttackSourcesOf(mk({ talents: [{ talentId: 'assaut-feroce', times: 1 }] as never }))[0];
    expect(af.effects.some((e) => flowHasFreeAttack(e.flow))).toBe(true);
    const bestial = freeAttackSourcesOf(mk({ traits: [{ id: 'bestial' }] as never }))[0];
    expect(bestial.effects.some((e) => flowHasFreeAttack(e.flow))).toBe(false); // Bestial = onRoundEnd → Brisé, pas une frappe
  });
});

describe('Exposition aux Maladies — op générique exposeDisease (onHit, plus de flags ad hoc)', () => {
  const get = (() => ({ battle: { combatants: [] } })) as never;
  const onHit = (attacker: Combatant, victim: Combatant, woundsDealt: number) =>
    fireTriggers(get, attacker, 'onHit', { victim, woundsDealt } as never);

  it('attaquant Infecté blesse la victime → exposition à blessure-purulente', () => {
    const atk = mk({ traits: [{ id: 'infecte' }] as never });
    const vic = mk();
    onHit(atk, vic, 3);
    expect(vic.diseaseExposure).toEqual([{ disease: 'blessure-purulente' }]);
  });

  it('Infecté + Maladie (Fièvre du rongeur) → blessure-purulente ET fievre-du-rongeur (deux sources, un dispatch)', () => {
    // Modélisation canon d'un rat/skaven (LDB 78) : trait Infecté + trait Maladie(arg) — deux sources
    // de maladie résolues par le MÊME dispatcher (fireTriggers), cumulées sans doublon.
    const atk = mk({ traits: [{ id: 'infecte' }, { id: 'maladie', arg: 'fievre-du-rongeur' }] as never });
    const vic = mk();
    onHit(atk, vic, 3);
    expect(vic.diseaseExposure?.map((e) => e.disease).sort()).toEqual(['blessure-purulente', 'fievre-du-rongeur']);
  });

  it('trait Maladie (Type) : l’`arg` d’instance est injecté dans l’op (`$arg` → withArg)', () => {
    const atk = mk({ traits: [{ id: 'maladie', arg: 'peste-noire' }] as never });
    const vic = mk();
    onHit(atk, vic, 3);
    expect(vic.diseaseExposure).toEqual([{ disease: 'peste-noire' }]);
  });

  it('touche SANS Blessure (woundsDealt=0) → aucune exposition (gate woundsDealt>0)', () => {
    const atk = mk({ traits: [{ id: 'infecte' }] as never });
    const vic = mk();
    onHit(atk, vic, 0);
    expect(vic.diseaseExposure ?? []).toEqual([]);
  });
});
