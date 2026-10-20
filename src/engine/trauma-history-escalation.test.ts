/**
 * #194 — Escalades conditionnées à l'HISTORIQUE du personnage (LDB 18) :
 *  (1) occurrence-count PAR ID D'ENTRÉE (`critEntriesSuffered`) → effet ALTERNATIF `escalation.onRepeat`
 *      (« Si vous tombez une seconde fois sur cette blessure… », Blessure majeure à l'oreille, l.71) ;
 *  (2) déclencheur « critique subséquent à Localisation L pendant État C » (`escalation.onNextCritWhileCondition`
 *      → `Trauma.critTrigger`, fait feu par `fireCritTriggers`) — Commotion cérébrale (l.74).
 * Jumelles Aux Armes (AA 07) : l'oreille PORTE les mêmes clauses ; la Commotion AA (aa-tete-76) NE porte PAS
 * la clause de critique subséquent (écart RAW documenté → aucun `critTrigger` armé).
 */
import { describe, it, expect } from 'vitest';
import { resolveCritique } from './critical';
import { fireCritTriggers, stampCriticalEscalation } from './trauma';
import { spellOps } from './flowCore';
import type { Combatant, Trauma, HitLocation } from './types';
import type { RNG } from './dice';
import { critiqueDoc } from '../data/criticals';
import { desEnSuite } from './dice.testkit';

const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'c', label: 'C', kind: 'hero', conditions: [], skills: [], traumas: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as Combatant);

/** RNG qui débite une séquence fixe (int() ignore min/max — tests ciblés). */
const seq = (vals: number[]): RNG => desEnSuite(vals, { boucle: true });

const hasCondOp = (ops: { op: string; id?: string }[], id: string) =>
  ops.some((o) => o.op === 'condition' && o.id === id);

describe('#194 (1) — 2e occurrence d\'une entrée : escalation.onRepeat (Blessure majeure à l\'oreille, LDB 18 l.71)', () => {
  it('1re occurrence → séquelle de base « perte auditive partielle » ; entryId posé', () => {
    const c = C({}); // aucun historique
    const crit = resolveCritique('ldb', c, 'tete', seq([63])); // 61-65 → Blessure majeure à l'oreille
    expect(crit.entryId).toBe('blessure-majeure-a-l-oreille');
    expect(crit.traumas.map((t) => t.traumaId)).toContain('perte-auditive-partielle');
    expect(crit.traumas.some((t) => t.traumaId === 'surdite')).toBe(false);
  });

  it('2e occurrence (même entrée déjà subie) → Surdité TOTALE remplace la séquelle partielle ; l\'effet immédiat de base tient', () => {
    const c = C({ critEntriesSuffered: ['blessure-majeure-a-l-oreille'] });
    const crit = resolveCritique('ldb', c, 'tete', seq([63]));
    expect(crit.traumas.map((t) => t.traumaId)).toContain('surdite');
    expect(crit.traumas.some((t) => t.traumaId === 'perte-auditive-partielle')).toBe(false);
    expect(hasCondOp(crit.ops as never, 'assourdi')).toBe(false); // pas d'op d'État sur cette entrée
    expect((crit.ops as { op: string; amount?: number }[]).some((o) => o.op === 'wounds' && o.amount === 3)).toBe(true); // le coup blesse toujours
  });

  it('AA (aa-tete-46) porte les MÊMES clauses : 1re → partielle, 2e → surdité', () => {
    const first = resolveCritique('aa', C({}), 'tete', seq([48])); // 46-50 → Blessure majeure à l'oreille AA
    expect(first.entryId).toBe('aa-tete-46');
    expect(first.traumas.map((t) => t.traumaId)).toContain('perte-auditive-partielle');
    const repeat = resolveCritique('aa', C({ critEntriesSuffered: ['aa-tete-46'] }), 'tete', seq([48]));
    expect(repeat.traumas.map((t) => t.traumaId)).toContain('surdite');
  });
});

describe('#194 (2) — Commotion cérébrale : déclencheur « autre critique tête pendant Exténué » (LDB 18 l.74)', () => {
  it('résoudre la Commotion arme un critTrigger (tête / Exténué / Test Accessible → Inconscient)', () => {
    const crit = resolveCritique('ldb', C({}), 'tete', seq([78])); // 76-80 → Commotion cérébrale
    expect(crit.entryId).toBe('commotion-cerebrale');
    const trig = crit.traumas.find((t) => t.critTrigger)?.critTrigger;
    expect(trig).toBeTruthy();
    expect(trig!.whileCondition).toBe('extenue');
    expect(trig!.location).toBe('tete');
    expect(trig!.test.test.difficulty).toBe('accessible');
    expect(hasCondOp(spellOps(trig!.test.fail, 'target') as never, 'inconscient')).toBe(true);
  });

  it('AA (aa-tete-76) NE porte PAS la clause (écart RAW AA 07) → aucun critTrigger armé', () => {
    const crit = resolveCritique('aa', C({}), 'tete', seq([78]));
    expect(crit.entryId).toBe('aa-tete-76');
    expect(crit.traumas.some((t) => t.critTrigger)).toBe(false);
  });

  const armed = (): Trauma => ({
    label: 'Commotion cérébrale', location: 'tete',
    critTrigger: {
      location: 'tete', whileCondition: 'extenue',
      test: {
        kind: 'test', test: { difficulty: 'accessible' },
        success: { kind: 'seq', steps: [] },
        fail: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'condition', id: 'inconscient', value: 1 }], on: 'target' } },
      },
    },
  });

  it('fireCritTriggers : Exténué + critique tête → le nœud de sauvegarde est RENDU (Accessible, échec → Inconscient)', () => {
    const c = C({ traumas: [armed()], conditions: [{ id: 'extenue', value: 1 }] });
    const noeuds = fireCritTriggers(c, 'tete');
    expect(noeuds).toHaveLength(1);
    expect(noeuds[0].test.difficulty).toBe('accessible');
    expect(hasCondOp(spellOps(noeuds[0].fail, 'target') as never, 'inconscient')).toBe(true);
    expect(spellOps(noeuds[0].success, 'target')).toEqual([]); // le Test réussi n'octroie rien (LDB 18 l.74)
  });

  it('fireCritTriggers : pas d\'Exténué → aucun nœud', () => {
    const c = C({ traumas: [armed()], conditions: [] });
    expect(fireCritTriggers(c, 'tete')).toEqual([]);
  });

  it('fireCritTriggers : critique à une AUTRE Localisation (corps) → aucun nœud', () => {
    const c = C({ traumas: [armed()], conditions: [{ id: 'extenue', value: 1 }] });
    expect(fireCritTriggers(c, 'corps')).toEqual([]);
  });

  it('fireCritTriggers : plusieurs déclencheurs identiques → UN seul nœud (dédup par signature)', () => {
    const c = C({ traumas: [armed(), armed()], conditions: [{ id: 'extenue', value: 1 }] });
    expect(fireCritTriggers(c, 'tete')).toHaveLength(1);
  });

  it('bout-en-bout : critique tête SUBSÉQUENT pendant Exténué → le nœud armé part en `testFlow` (jamais roulé au moteur)', () => {
    const c = C({ traumas: [armed()], conditions: [{ id: 'extenue', value: 1 }] });
    const crit = resolveCritique('ldb', c, 'tete', seq([28])); // 26-30 Frappe à l'oreille (rangée sans nœud propre)
    expect(crit.testFlow?.kind).toBe('test');
    const noeud = crit.testFlow as Extract<typeof crit.testFlow, { kind: 'test' }>;
    expect(noeud.test.difficulty).toBe('accessible');
    expect(hasCondOp(spellOps(noeud.fail, 'target') as never, 'inconscient')).toBe(true);
    expect(hasCondOp(crit.ops as never, 'inconscient')).toBe(false); // l'issue n'est plus tranchée dans le moteur
  });
});

describe('#194 — stampCriticalEscalation : dédup du critTrigger (une commotion déjà armée ne ré-arme pas)', () => {
  const commotionEsc = (critiqueDoc('ldb', 'tete').entries.find((e) => e.id === 'commotion-cerebrale') as { escalation: import('../data/criticals').CritEscalation }).escalation;
  it('onNextCritWhileCondition présent mais un critTrigger équivalent existe déjà → aucun nouveau stamp', () => {
    const existing: Trauma[] = [{
      label: 'x', location: 'tete' as HitLocation,
      critTrigger: {
        location: 'tete', whileCondition: 'extenue',
        test: { kind: 'test', test: { difficulty: 'accessible' }, success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] } },
      },
    }];
    const traumas: Trauma[] = [];
    stampCriticalEscalation(traumas, commotionEsc, 'tete', C({}), seq([1]), existing);
    expect(traumas.some((t) => t.critTrigger)).toBe(false);
  });
  it('aucun critTrigger préexistant → stamp effectué', () => {
    const traumas: Trauma[] = [];
    stampCriticalEscalation(traumas, commotionEsc, 'tete', C({}), seq([1]), []);
    expect(traumas.some((t) => t.critTrigger?.whileCondition === 'extenue')).toBe(true);
  });
});
