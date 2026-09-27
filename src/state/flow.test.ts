/**
 * FLOW — modèle + évaluation pure des Conditions (source unique, remplace condMet/temporalConditionMet)
 * + aplatissage des branches `if`/`seq`/`do`. L'exécution interactive (`test`) est testée via le store.
 */
import { describe, it, expect } from 'vitest';
import type { Effect } from './scene';
import {
  evalCondition, flattenFlow, flowFromEffects, flowHasTest, sanitizeFlow, EMPTY_FLOW, conditionCtx, type Condition, type Flow,
} from './flow';
import { createHero } from '../engine/character';

const REIK = 'humains-reiklander';

// 14h00 = 14*60 minutes depuis minuit ; toDate utilise des minutes depuis l'époque, mais l'heure-du-jour
// est ce qui compte pour `time`. On prend un gameTime dont l'heure-du-jour est connue.
const at = (hour: number, minute = 0) => hour * 60 + minute; // minutes depuis minuit (jour 0)

describe('evalCondition — algèbre close (flags/time/all/any/not)', () => {
  const ctx = { flags: { a: true, b: false }, gameTime: at(14) };
  it('always', () => expect(evalCondition({ kind: 'always' }, ctx)).toBe(true));
  it('flag : ET avec négation (sémantique condMet)', () => {
    expect(evalCondition({ kind: 'flag', expr: 'a' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'flag', expr: '!b' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'flag', expr: 'a,!b' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'flag', expr: 'a,b' }, ctx)).toBe(false);
  });
  it('time : fenêtre horaire (before exclusif)', () => {
    expect(evalCondition({ kind: 'time', window: { afterHour: 12 } }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'time', window: { afterHour: 18 } }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'time', window: { beforeHour: 14 } }, ctx)).toBe(false); // 14h exclu
    expect(evalCondition({ kind: 'time', window: { afterHour: 8, beforeHour: 18 } }, ctx)).toBe(true);
  });
  it('all/any/not composent', () => {
    const day: Condition = { kind: 'time', window: { afterHour: 6, beforeHour: 20 } };
    expect(evalCondition({ kind: 'all', of: [{ kind: 'flag', expr: 'a' }, day] }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'all', of: [{ kind: 'flag', expr: 'b' }, day] }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'any', of: [{ kind: 'flag', expr: 'b' }, day] }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'not', of: { kind: 'flag', expr: 'b' } }, ctx)).toBe(true);
  });
});

describe('evalCondition — état VIVANT du groupe (hasItem / money / partyDead)', () => {
  const base = { flags: {}, gameTime: 0 };
  it('hasItem : compte les exemplaires de l’objet dans le groupe (id catalogue + repli nom custom)', () => {
    // Objet catalogué → match par trappingId stable ; objet CUSTOM (sans trappingId) → repli sur le nom.
    const party = [{ items: [{ label: 'Corde', trappingId: 'corde' }, { label: 'Clé en fer' }] }, { items: [{ label: 'Clé en fer' }] }];
    expect(evalCondition({ kind: 'hasItem', trappingId: 'corde' }, { ...base, party })).toBe(true); // par id de catalogue
    expect(evalCondition({ kind: 'hasItem', trappingId: 'Clé en fer' }, { ...base, party })).toBe(true); // custom → repli nom
    expect(evalCondition({ kind: 'hasItem', trappingId: 'Clé en fer', count: 2 }, { ...base, party })).toBe(true);
    expect(evalCondition({ kind: 'hasItem', trappingId: 'Clé en fer', count: 3 }, { ...base, party })).toBe(false);
    expect(evalCondition({ kind: 'hasItem', trappingId: 'Amulette' }, { ...base, party })).toBe(false);
    expect(evalCondition({ kind: 'hasItem', trappingId: 'Clé en fer' }, base)).toBe(false); // pas de groupe → false
  });
  it('money : bourse comparée en sous de cuivre (1 CO = 240 sc, 1 pistole = 12 sc)', () => {
    const ctx = { ...base, money: { gold: 1, silver: 2, brass: 0 } }; // 264 sb
    expect(evalCondition({ kind: 'money', atLeast: { gold: 1 } }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'money', atLeast: { silver: 22 } }, ctx)).toBe(true); // 264 sb
    expect(evalCondition({ kind: 'money', atLeast: { silver: 23 } }, ctx)).toBe(false); // 276 sb
    expect(evalCondition({ kind: 'money', atLeast: { gold: 1 } }, base)).toBe(false); // pas de bourse → false
  });
  it('partyDead : any (un mort) vs all (tous morts)', () => {
    const oneDead = [{ dead: true }, { dead: false }];
    const allDead = [{ dead: true }, { dead: true }];
    expect(evalCondition({ kind: 'partyDead', who: 'any' }, { ...base, party: oneDead })).toBe(true);
    expect(evalCondition({ kind: 'partyDead', who: 'all' }, { ...base, party: oneDead })).toBe(false);
    expect(evalCondition({ kind: 'partyDead', who: 'all' }, { ...base, party: allDead })).toBe(true);
    expect(evalCondition({ kind: 'partyDead', who: 'any' }, base)).toBe(false); // pas de groupe → false
  });
});

describe('evalCondition — géométrie d’arène + capacités (récupération du Brisé, LDB 16)', () => {
  const base = { flags: {}, gameTime: 0 };
  it('hiddenFromFoes / engaged : lus du contexte précalculé', () => {
    expect(evalCondition({ kind: 'hiddenFromFoes' }, { ...base, hiddenFromFoes: true })).toBe(true);
    expect(evalCondition({ kind: 'hiddenFromFoes' }, base)).toBe(false); // absent → false (hors combat)
    expect(evalCondition({ kind: 'engaged' }, { ...base, engaged: true })).toBe(true);
    expect(evalCondition({ kind: 'engaged' }, base)).toBe(false);
  });
  it('nearestFoe : +∞ si aucun adversaire', () => {
    expect(evalCondition({ kind: 'nearestFoe', op: '<=', value: 3 }, { ...base, nearestFoeDist: 2 })).toBe(true);
    expect(evalCondition({ kind: 'nearestFoe', op: '<=', value: 3 }, { ...base, nearestFoeDist: 5 })).toBe(false);
    expect(evalCondition({ kind: 'nearestFoe', op: '<=', value: 3 }, base)).toBe(false); // +∞ → jamais ≤
  });
  it('capability : niveau d’une CombatFeature de l’acteur (Cœur vaillant)', () => {
    const av = { id: 'c', woundsCurrent: 10, woundsMax: 10, size: 3, advantage: 0, camp: 'party' as const, groups: [], talents: [], traits: [], conditions: {}, chars: {} as Record<string, number>, capabilities: { braveheart: 1 } };
    expect(evalCondition({ kind: 'capability', who: 'target', id: 'braveheart' }, { ...base, target: av })).toBe(true); // défaut >= 1
    expect(evalCondition({ kind: 'capability', who: 'target', id: 'braveheart', op: '>=', value: 2 }, { ...base, target: av })).toBe(false);
    expect(evalCondition({ kind: 'capability', who: 'target', id: 'slayer' }, { ...base, target: av })).toBe(false); // capacité absente → 0
    expect(evalCondition({ kind: 'capability', who: 'target', id: 'braveheart' }, base)).toBe(false); // acteur absent → false
  });
});

describe('evalCondition — Conditions PARTY-level (#711 : skill/career/species/status)', () => {
  const base = { flags: {}, gameTime: 0 };
  it('skill : any (un héros possède) vs all (tous), seuil d’avances', () => {
    const party = [
      { skills: [{ id: 'dresser', advances: 2 }] },
      { skills: [{ id: 'baratin', advances: 1 }] },
    ];
    expect(evalCondition({ kind: 'skill', id: 'dresser' }, { ...base, party })).toBe(true); // any, sans seuil = possession
    expect(evalCondition({ kind: 'skill', id: 'dresser', who: 'all' }, { ...base, party })).toBe(false); // le 2e héros ne l’a pas
    expect(evalCondition({ kind: 'skill', id: 'dresser', advances: 2 }, { ...base, party })).toBe(true); // seuil atteint
    expect(evalCondition({ kind: 'skill', id: 'dresser', advances: 3 }, { ...base, party })).toBe(false); // seuil non atteint
    expect(evalCondition({ kind: 'skill', id: 'inconnue' }, { ...base, party })).toBe(false); // personne ne l’a
    expect(evalCondition({ kind: 'skill', id: 'dresser' }, base)).toBe(false); // pas de groupe → false
  });
  it('skill : spec distingue les instances (Métier (Serrurier) ≠ Métier (Brasseur))', () => {
    const party = [{ skills: [{ id: 'metier', spec: 'Serrurier', advances: 1 }] }];
    expect(evalCondition({ kind: 'skill', id: 'metier', spec: 'Serrurier' }, { ...base, party })).toBe(true);
    expect(evalCondition({ kind: 'skill', id: 'metier', spec: 'Brasseur' }, { ...base, party })).toBe(false);
  });
  it('career : match par id, any/all', () => {
    const party = [{ career: 'soldat' }, { career: 'artisan' }];
    expect(evalCondition({ kind: 'career', id: 'soldat' }, { ...base, party })).toBe(true);
    expect(evalCondition({ kind: 'career', id: 'soldat', who: 'all' }, { ...base, party })).toBe(false);
    expect(evalCondition({ kind: 'career', id: 'soldat', who: 'all' }, { ...base, party: [{ career: 'soldat' }, { career: 'soldat' }] })).toBe(true);
    expect(evalCondition({ kind: 'career', id: 'inconnue' }, { ...base, party })).toBe(false);
  });
  it('species : match par id, any/all', () => {
    const party = [{ species: REIK }, { species: 'nains' }];
    expect(evalCondition({ kind: 'species', id: REIK }, { ...base, party })).toBe(true);
    expect(evalCondition({ kind: 'species', id: REIK, who: 'all' }, { ...base, party })).toBe(false);
    expect(evalCondition({ kind: 'species', id: 'nains', who: 'all' }, { ...base, party: [{ species: 'nains' }, { species: 'nains' }] })).toBe(true);
  });
  it('status : dérivé d’un VRAI Combatant (createHero) — carrière/niveau réels', () => {
    const hero = createHero({ speciesId: REIK, careerId: 'soldat', label: 'T', seed: 3 }); // niveau 1 → « Argent 1 »
    const party = [hero];
    expect(evalCondition({ kind: 'status', atLeast: 'Bronze 1' }, { ...base, party })).toBe(true); // Échelon supérieur
    expect(evalCondition({ kind: 'status', atLeast: 'Argent 1' }, { ...base, party })).toBe(true); // seuil atteint pile
    expect(evalCondition({ kind: 'status', atLeast: 'Argent 5' }, { ...base, party })).toBe(false); // même Échelon, Standing insuffisant
    expect(evalCondition({ kind: 'status', atLeast: 'Or 1' }, { ...base, party })).toBe(false); // Échelon insuffisant
  });
  it('un `when` de dialogue simulé (`conditionCtx`) lit le chemin PARTY-level hors combat', () => {
    const party = [{ skills: [{ id: 'dresser', advances: 1 }], career: 'soldat', species: REIK }];
    const ctx = conditionCtx({ flags: {}, gameTime: 0, party, money: { gold: 0 } });
    expect(evalCondition({ kind: 'all', of: [{ kind: 'skill', id: 'dresser' }, { kind: 'career', id: 'soldat' }] }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'skill', id: 'dresser', advances: 5 }, ctx)).toBe(false);
  });
  it('matchParty : `all` sur groupe VIDE → false ; un membre TOMBÉ (dead) est exclu du gating', () => {
    // `all` sur aucun membre vivant : jamais vacuously-true (un choix « tout le groupe » ne s'affiche pas sans personne).
    expect(evalCondition({ kind: 'career', id: 'soldat', who: 'all' }, { ...base, party: [] })).toBe(false);
    // Le seul héros qui a la compétence est TOMBÉ → `any` faux (un mort ne prête pas sa compétence).
    const avecMort = [{ dead: true, skills: [{ id: 'dresser', advances: 2 }] }, { skills: [{ id: 'baratin', advances: 1 }] }];
    expect(evalCondition({ kind: 'skill', id: 'dresser' }, { ...base, party: avecMort })).toBe(false);
    // `all` ignore le mort : si TOUS les VIVANTS matchent → vrai (le mort ne bloque pas).
    const unMortUnVivantSoldat = [{ dead: true, career: 'artisan' }, { career: 'soldat' }];
    expect(evalCondition({ kind: 'career', id: 'soldat', who: 'all' }, { ...base, party: unMortUnVivantSoldat })).toBe(true);
  });
});

describe('flowFromEffects / flattenFlow — séquence + branches if résolues', () => {
  const fx = (flag: string): Effect => ({ type: 'setFlag', flag });
  it('flowFromEffects enveloppe une liste en seq de do', () => {
    const f = flowFromEffects([fx('x'), fx('y')]);
    expect(f).toEqual({ kind: 'seq', steps: [{ kind: 'do', effect: fx('x') }, { kind: 'do', effect: fx('y') }] });
  });
  it('flattenFlow aplatit seq/do', () => {
    expect(flattenFlow(flowFromEffects([fx('x'), fx('y')]), { flags: {}, gameTime: 0 })).toEqual([fx('x'), fx('y')]);
  });
  it('flattenFlow résout les branches if contre le contexte', () => {
    const flow: Flow = {
      kind: 'seq',
      steps: [
        { kind: 'do', effect: fx('start') },
        { kind: 'if', cond: { kind: 'flag', expr: 'béni' }, then: { kind: 'do', effect: fx('heal') }, else: { kind: 'do', effect: fx('curse') } },
      ],
    };
    expect(flattenFlow(flow, { flags: { 'béni': true }, gameTime: 0 })).toEqual([fx('start'), fx('heal')]);
    expect(flattenFlow(flow, { flags: {}, gameTime: 0 })).toEqual([fx('start'), fx('curse')]);
  });
  it('if sans else et condition fausse → rien', () => {
    const flow: Flow = { kind: 'if', cond: { kind: 'flag', expr: 'never' }, then: { kind: 'do', effect: fx('x') } };
    expect(flattenFlow(flow, { flags: {}, gameTime: 0 })).toEqual([]);
  });
  it('EMPTY_FLOW est neutre', () => {
    expect(flattenFlow(EMPTY_FLOW, { flags: {}, gameTime: 0 })).toEqual([]);
  });
});

describe('flowHasTest / flattenFlow refuse les nœuds interactifs', () => {
  const test: Flow = { kind: 'test', test: { skill: { id: 'crochetage' }}, success: { kind: 'do', effect: { type: 'setFlag', flag: 'ouvert' } }, fail: EMPTY_FLOW };
  it('flowHasTest détecte un test imbriqué', () => {
    expect(flowHasTest({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'setFlag', flag: 'x' } }, test] })).toBe(true);
    expect(flowHasTest(flowFromEffects([{ type: 'setFlag', flag: 'x' }]))).toBe(false);
  });
  it('flattenFlow lève sur un nœud test (interactif → store)', () => {
    expect(() => flattenFlow(test, { flags: {}, gameTime: 0 })).toThrow(/interactif/);
  });
});

describe('sanitizeFlow — purge des nœuds `null` inexprimables (document ANCIEN, crash n°2 éditeur)', () => {
  it('purge les entrées `null` d’un `seq.steps` (JSON sérialise `undefined` en `null`)', () => {
    const corrupted = { kind: 'seq', steps: [null, { kind: 'do', effect: { type: 'setFlag', flag: 'x' } }, null] } as unknown as Flow;
    expect(sanitizeFlow(corrupted)).toEqual({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'setFlag', flag: 'x' } }] });
  });
  it('recurse dans les branches if/test/choice sans inventer de branche manquante', () => {
    const withNullStep: Flow = { kind: 'if', cond: { kind: 'always' }, then: { kind: 'seq', steps: [null as unknown as Flow, { kind: 'do', effect: { type: 'setFlag', flag: 'y' } }] } };
    expect(sanitizeFlow(withNullStep)).toEqual({ kind: 'if', cond: { kind: 'always' }, then: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'setFlag', flag: 'y' } }] } });
  });
  it('laisse `undefined`/`null` de premier niveau tel quel (à la charge de la validation)', () => {
    expect(sanitizeFlow(undefined)).toBeUndefined();
    expect(sanitizeFlow(null as unknown as Flow)).toBeNull();
  });
  it('un nœud `test` sans branche `success` (réf pendante) traverse sans throw ni invention', () => {
    const dangling = { kind: 'test', test: { skill: 'perception' }, fail: EMPTY_FLOW } as unknown as Flow;
    expect(() => sanitizeFlow(dangling)).not.toThrow();
    expect((sanitizeFlow(dangling) as { success?: unknown }).success).toBeUndefined();
  });
});
