/**
 * `effectOpSchema` INFÈRE le type `EffectOp` du moteur (#1466, sonde du juge promue en garde).
 *
 * `FERMEE.effectOp` n'est pas annoté `z.ZodType<EffectOp>` : son infer peut dériver du type manuscrit
 * sans qu'aucune annotation ne le refuse, d'où l'assignabilité MUTUELLE tenue ici. Les schémas annotés
 * (`conditionSchema`, `flowSchema`, `gameOpSchema`) ne s'y comparent pas : leur infer EST leur annotation (#4056).
 */
import { describe, it, expectTypeOf } from 'vitest';
import type { z } from 'zod';
import type { effectOpSchema } from './mecanique';
import type { EffectOp } from '../../../engine/flowCore';

type InfEffectOp = z.infer<typeof effectOpSchema>;

describe('grammaire — l\'infer de `effectOpSchema` EST le type du moteur', () => {
  it('`effectOpSchema` reste MUTUELLEMENT assignable à `EffectOp`', () => {
    expectTypeOf<InfEffectOp>().toExtend<EffectOp>();
    expectTypeOf<EffectOp>().toExtend<InfEffectOp>();
  });
});
