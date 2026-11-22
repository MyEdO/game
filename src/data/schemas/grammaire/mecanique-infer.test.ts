import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { conditionSchema, effectOpSchema, flowSchema, gameOpSchema, mecaniqueDe, passifsDe, type Condition } from './mecanique';
import type { EffectOp, FlowTest } from '../../../engine/flowCore';
import type { GameOp } from '../../../engine/ops';

type EffectOpAuteur = z.output<typeof effectOpSchema>;
type OpAuteur = z.output<typeof gameOpSchema>;

describe('grammaire — opérations et effets d’auteur', () => {
  it('les sorties des schémas sont assignables aux lecteurs du moteur', () => {
    expectTypeOf<OpAuteur>().toExtend<GameOp>();
    expectTypeOf<EffectOpAuteur>().toExtend<EffectOp>();
  });

  it('la pose psychologique d’auteur exclut les champs calculés par le moteur', () => {
    type PoseAuteur = Extract<OpAuteur, { op: 'beginPsych' }>;
    type PoseMoteur = Extract<GameOp, { op: 'beginPsych' }>;
    expectTypeOf<PoseMoteur>().toHaveProperty('sourceId');
    expectTypeOf<'sourceId'>().not.toExtend<keyof PoseAuteur>();
  });

  it('une Condition réservée ne sort, même imbriquée, que dans la famille qui l’admet', () => {
    const famille = mecaniqueDe({ 'condition.cibleEnVue': 'admis' });
    const sujet = { kind: 'cibleEnVue', hostiles: true } as const satisfies Condition;
    const condition = { kind: 'not', of: sujet } as const;
    const flow = { kind: 'sequence', etapes: [{ kind: 'si', condition, alors: { kind: 'sequence', etapes: [] } }] };
    type SiFerme = Extract<z.output<typeof flowSchema>, { kind: 'si' }>;
    type SiAdmis = Extract<z.output<typeof famille.flow>, { kind: 'si' }>;

    expectTypeOf<typeof sujet>().not.toExtend<z.output<typeof conditionSchema>>();
    expectTypeOf<typeof condition>().not.toExtend<z.output<typeof conditionSchema>>();
    expectTypeOf<typeof condition>().not.toExtend<SiFerme['condition']>();
    expectTypeOf<typeof condition>().toExtend<z.output<typeof famille.condition>>();
    expectTypeOf<typeof condition>().toExtend<SiAdmis['condition']>();

    expect(conditionSchema.safeParse(condition).error?.issues).toMatchObject([
      { path: ['of'], message: expect.stringContaining('Condition « cibleEnVue » : réservée') },
    ]);
    expect(flowSchema.safeParse(flow).error?.issues).toMatchObject([
      { path: ['etapes', 0, 'condition', 'of'], message: expect.stringContaining('Condition « cibleEnVue » : réservée') },
    ]);
    expect(famille.condition.parse(condition)).toEqual(condition);
    expect(famille.flow.parse(flow)).toEqual(flow);
  });

  it('un Flow saisi ne porte pas un enjeu dérivé du moteur', () => {
    const branche = { kind: 'sequence', etapes: [] };
    const essai = { kind: 'test', reussite: branche, echec: branche };
    const stake = { from: { kind: 'sort', id: 'sonde' } } as const;
    type TestAuteur = Extract<z.output<typeof flowSchema>, { kind: 'test' }>['test'];
    expectTypeOf<typeof stake>().toExtend<FlowTest['stake']>();
    expectTypeOf<typeof stake>().not.toExtend<TestAuteur['stake']>();
    expect(flowSchema.safeParse({ ...essai, test: { characteristic: 'force', stake } }).success).toBe(false);
    expect(flowSchema.safeParse({ ...essai, test: { characteristic: 'force', stake: { authored: 'Sonde' } } }).success).toBe(true);
  });

  it('un modificateur passif de Blessures n’a pas de champ auTotal dans sa sortie', () => {
    const passifs = passifsDe();
    const passifsDuneFamille = passifsDe(gameOpSchema);
    type ModDeBlessures<S extends z.ZodType<unknown[]>> = Extract<z.output<S>[number], { op: 'attrMod'; attr: 'wounds' }>;
    expectTypeOf<'auTotal'>().not.toExtend<keyof ModDeBlessures<typeof passifs>>();
    expectTypeOf<'auTotal'>().not.toExtend<keyof ModDeBlessures<typeof passifsDuneFamille>>();
  });
});
