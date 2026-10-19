/**
 * ORACLE PARTIEL du bloc « Réussite / Échec » (#1117) — `branchCertainOps` ne tranche un `if` que
 * lorsqu'il le PEUT, et se tait sinon. Mesuré sur des Flows RÉELS de la donnée (aucun flow forgé) :
 *
 *  · récupération du Sonné (`etats.json`) — la branche de réussite retire des États PUIS teste, par
 *    `compare`, ce qu'il en reste : le sujet est muté par une op AMONT du même `seq`, l'instantané
 *    d'affichage ne peut pas le lire. Un oracle TOTAL y répondrait « faux » et annoncerait le seul
 *    retrait, en OMETTANT l'octroi d'Exténué que le RAW impose (« Une fois débarrassé de tout État
 *    Sonné, gagnez 1 État Exténué », LDB 16 l.129) — une règle enseignée AMPUTÉE.
 *  · Cautériser (`spells.json`) — l'Inconscient dépend du DR du jet (`slThreshold ≤ −6`, LDB 48 l.219),
 *    qui n'existe pas avant qu'on lance.
 *  · Vigilance (`has talent`) — appartenance figée : elle, se tranche, et le site pilote en vit.
 */
import { describe, it, expect } from 'vitest';
import { branchCertainOps, branchBlockingEntity, stableCondVerdict, combatConditionCtx } from '../../noyau/combat/flowEval';
import { etats, spells } from '../../data';
import type { Flow } from '../../noyau/monde/flow';
import type { Combatant, TalentInstance } from '../../engine/types';

const C = (over: Partial<Combatant> = {}): Combatant =>
  ({ id: 'h', kind: 'hero', name: 'H', label: 'H', conditions: [], skills: [], talents: [], traits: [],
     characteristics: { force: 30, endurance: 30, agilite: 30, perception: 30 } as never,
     wounds: { current: 10, max: 10 }, items: [], weapons: [], movement: 4, advantage: 0,
     ...over } as unknown as Combatant);

/** Branche de RÉUSSITE du Test de récupération d'un État (donnée réelle : le nœud `test` de l'État). */
function recoverySuccess(id: string): Flow {
  const eff = (etats.find((e) => e.id === id)?.effects ?? []).find((x) => x.flow?.kind === 'test');
  const flow = eff!.flow as Extract<Flow, { kind: 'test' }>;
  return flow.success;
}

describe('#1117 — l’oracle d’affichage tranche ce qu’il SAIT, et se tait sur le reste', () => {
  it('Sonné (LDB 16 l.129) : la réussite reste INCERTAINE — son `compare` porte sur un sujet muté en amont', () => {
    const branch = recoverySuccess('sonne');
    // Le flow contient bien les DEUX moitiés : le retrait, puis l'octroi conditionnel.
    expect(JSON.stringify(branch)).toContain('extenue');
    // Silence : annoncer le seul retrait enseignerait la règle sans son Exténué.
    expect(branchCertainOps(branch, C({ conditions: [{ id: 'sonne', value: 2 }] as never }))).toBeUndefined();
  });

  it('Empoisonné / Brisé : même forme, même silence (aucune promesse amputée)', () => {
    expect(branchCertainOps(recoverySuccess('empoisonne'), C())).toBeUndefined();
    expect(branchCertainOps(recoverySuccess('brise'), C())).toBeUndefined();
  });

  it('Cautériser (LDB 48 l.219) : l’échec est INCERTAIN — l’Inconscient dépend du DR, connu à la seule résolution', () => {
    const eff = spells.find((s) => s.id === 'cauteriser')!.effects as Flow;
    const test = (eff as Extract<Flow, { kind: 'seq' }>).steps.find((s) => s.kind === 'test') as Extract<Flow, { kind: 'test' }>;
    expect(JSON.stringify(test.fail)).toContain('slThreshold');
    expect(branchCertainOps(test.fail, C())).toBeUndefined();
  });

  it('Vigilance (`has talent`) RESTE décidable : porteur → sa branche, non-porteur → l’autre', () => {
    const then: Flow = { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'extenue' }] } };
    const branch: Flow = {
      kind: 'if', cond: { kind: 'has', who: 'target', what: 'talent', value: 'vigilance' },
      then, else: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'surpris', value: 1 }] } },
    };
    const vigilant = C({ talents: [{ talentId: 'vigilance', times: 1 }] as TalentInstance[] });
    expect(branchCertainOps(branch, vigilant)).toEqual([{ op: 'condition', id: 'extenue' }]);
    expect(branchCertainOps(branch, C())).toEqual([{ op: 'condition', id: 'surpris', value: 1 }]);
  });

  it('le verdict d’une Condition COMPOSÉE suit son membre le plus faible (un inconnu ⇒ inconnu)', () => {
    const cc = combatConditionCtx(C(), {});
    const stable = { kind: 'has', who: 'target', what: 'talent', value: 'vigilance' } as const;
    const inconnu = { kind: 'slThreshold', op: '<=', value: -6 } as const;
    expect(stableCondVerdict(stable, cc)).toBe(false);
    expect(stableCondVerdict(inconnu, cc)).toBeUndefined();
    expect(stableCondVerdict({ kind: 'all', of: [stable, inconnu] }, cc)).toBeUndefined();
    expect(stableCondVerdict({ kind: 'any', of: [stable, inconnu] }, cc)).toBeUndefined();
    expect(stableCondVerdict({ kind: 'not', of: inconnu }, cc)).toBeUndefined();
    expect(stableCondVerdict({ kind: 'not', of: stable }, cc)).toBe(true);
  });
});

/**
 * RESPONSABLE de l'incertitude (#1117, arbitrage user 2026-08-07 « Chip du talent ») — quand la branche
 * se tait parce qu'un `if` d'APPARTENANCE rend la main à un second jet, l'objet qui prend le relais est
 * identifiable : on le NOMME (sa chip). Toute autre forme d'incertitude reste au silence fail-closed —
 * il n'y a alors personne à désigner, et une chip inventée enseignerait un faux.
 */
describe('#1117 — l’objet mécanique responsable d’une branche incertaine se NOMME, ou rien', () => {
  const vigilance = { kind: 'has', who: 'target', what: 'talent', value: 'vigilance' } as const;
  const secondJet = {
    kind: 'test', test: { skill: 'perception', difficulty: 'intermediaire', label: 'Vigilance' },
    success: { kind: 'seq', steps: [] }, fail: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'surpris', value: 1 }] } },
  } as unknown as Flow;
  const surpris: Flow = { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'surpris', value: 1 }] } };
  const porteur = () => C({ talents: [{ talentId: 'vigilance', times: 1 }] as TalentInstance[] });

  it('un `if has talent` qui rend la main à un second jet DÉSIGNE le talent, pour son porteur seul', () => {
    const branch: Flow = { kind: 'if', cond: vigilance, then: secondJet, else: surpris };
    // Porteur : branche indécidable (le second Test décide) → le Talent est nommé.
    expect(branchCertainOps(branch, porteur())).toBeUndefined();
    expect(branchBlockingEntity(branch, porteur())).toEqual({ category: 'talents', id: 'vigilance' });
    // NON-porteur : la branche est décidable (il subit l'État) → rien à désigner, les ops parlent.
    expect(branchCertainOps(branch, C())).toEqual([{ op: 'condition', id: 'surpris', value: 1 }]);
    expect(branchBlockingEntity(branch, C())).toBeUndefined();
  });

  it('un TRAIT est désigné de la même façon (dérivé de `cond.what`, aucune entité nommée en code)', () => {
    const branch: Flow = {
      kind: 'if', cond: { kind: 'has', who: 'target', what: 'trait', value: 'vision-nocturne' } as never,
      then: secondJet, else: surpris,
    };
    const c = C({ traits: [{ id: 'vision-nocturne' }] as never });
    expect(branchBlockingEntity(branch, c)).toEqual({ category: 'traits', id: 'vision-nocturne' });
  });

  it('SILENCE maintenu : seuil de DR, `compare` muté en amont, appartenance NON-fiche (`group`)', () => {
    // slThreshold : le DR n'existe pas avant le jet — personne à désigner.
    const parDR: Flow = { kind: 'if', cond: { kind: 'slThreshold', op: '<=', value: -6 } as never, then: secondJet, else: surpris };
    expect(branchBlockingEntity(parDR, C())).toBeUndefined();
    // `compare` sur un sujet que les ops AMONT mutent (récupération du Sonné, donnée réelle).
    expect(branchBlockingEntity(recoverySuccess('sonne'), C({ conditions: [{ id: 'sonne', value: 2 }] as never }))).toBeUndefined();
    // `has group` : appartenance stable, mais pas un objet mécanique à fiche — hors table, donc silence.
    const parGroupe: Flow = { kind: 'if', cond: { kind: 'has', who: 'target', what: 'group', value: 'humain' } as never, then: secondJet, else: surpris };
    expect(branchBlockingEntity(parGroupe, C())).toBeUndefined();
  });

  it('une branche DÉCIDABLE ne désigne personne (ses ops parlent déjà)', () => {
    const branch: Flow = {
      kind: 'if', cond: vigilance,
      then: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'extenue' }] } },
      else: surpris,
    };
    expect(branchBlockingEntity(branch, porteur())).toBeUndefined();
  });
});
