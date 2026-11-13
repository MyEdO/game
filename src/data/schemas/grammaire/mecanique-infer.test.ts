/**
 * Les schémas de `mecanique.ts` INFÈRENT le type du moteur (#1466, sonde du juge promue en garde).
 *
 * Un schéma récursif se déclare `z.ZodType<T>` (obligé par `z.lazy`) : cette annotation EST le
 * contrat, et rien ne l'empêche de retomber à `unknown` — auquel cas les 9 datasets qui composent
 * la grammaire ne typent plus rien tout en restant verts. Ce test tient donc l'ÉGALITÉ entre
 * l'infer de chaque schéma et le type manuscrit du moteur : `Condition`, `Flow<EffectOp>`,
 * `EffectOp`, `FlowTest`, `GameOp` ; `TriggeredEffect` est, lui, la sortie de son schéma.
 */
import { describe, it, expectTypeOf } from 'vitest';
import type { z } from 'zod';
import type { conditionSchema, flowSchema, gameOpSchema, effectOpSchema, flowTestSchema, triggeredEffectSchema } from './mecanique';
import type { Condition, EffectOp, EffectTargeting, EffectTrigger, Flow, FlowTest } from '../../../engine/flowCore';
import type { GameOp } from '../../../engine/ops';

type InfCondition = z.infer<typeof conditionSchema>;
type InfFlow = z.infer<typeof flowSchema>;
type InfGameOp = z.infer<typeof gameOpSchema>;
type InfEffectOp = z.infer<typeof effectOpSchema>;
type InfFlowTest = z.infer<typeof flowTestSchema>;
type InfTriggeredEffect = z.infer<typeof triggeredEffectSchema>;

describe('grammaire — l\'infer de chaque schéma EST le type du moteur (jamais `unknown`)', () => {
  it('`conditionSchema` infère `Condition`', () => {
    expectTypeOf<InfCondition>().toEqualTypeOf<Condition>();
  });

  it('`flowSchema` infère `Flow<EffectOp>` — la feuille `do` est celle du MOTEUR', () => {
    expectTypeOf<InfFlow>().toEqualTypeOf<Flow<EffectOp>>();
  });

  it('`gameOpSchema` infère `GameOp`, donc `effectOpSchema.ops` aussi', () => {
    expectTypeOf<InfGameOp>().toEqualTypeOf<GameOp>();
    expectTypeOf<InfEffectOp['ops']>().toEqualTypeOf<GameOp[]>();
  });

  // L'énumération des Triggers est DUPLIQUÉE ici (le schéma ne peut pas dériver d'un type) : sans ce
  // verrou, un Trigger ajouté au moteur et oublié au schéma (ou l'inverse) passerait vert.
  it('l\'énumération de `triggeredEffectSchema` EST `EffectTrigger`, et sa cible EST `EffectTargeting`', () => {
    expectTypeOf<InfTriggeredEffect['trigger']>().toEqualTypeOf<EffectTrigger>();
    expectTypeOf<InfTriggeredEffect['on']>().toEqualTypeOf<EffectTargeting>();
  });

  it('`effectOpSchema` reste MUTUELLEMENT assignable à `EffectOp` ; l\'infer de `flowTestSchema` ÉTEND `FlowTest` (sens unique)', () => {
    expectTypeOf<InfEffectOp>().toExtend<EffectOp>();
    expectTypeOf<EffectOp>().toExtend<InfEffectOp>();
    expectTypeOf<InfFlowTest>().toExtend<FlowTest>();
  });
});
