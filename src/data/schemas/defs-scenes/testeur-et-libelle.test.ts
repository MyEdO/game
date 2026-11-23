/**
 * La cible « le testeur » et le libellé d'action, prouvés à la porte du document de scène (#4834) : la feuille
 * `on:'testeur'` ne vit que dans la branche d'un Test à testeur unique, sans `heroId` ; une action authorée sans
 * libellé n'existe que si le catalogue nomme son identifiant.
 */
import { describe, it, expect } from 'vitest';
import { sceneFlowSchema } from './effets';
import { actionAuthoreeSchema } from './scene';
import { routePerilSchema } from './worldmap';

const blesse = (on: string, heroId?: string) =>
  ({ kind: 'effet', effet: { type: 'ops', on, ...(heroId ? { heroId } : {}), ops: [{ op: 'wounds', amount: 1 }] } });
const test = (echec: unknown, crewTestType?: string) =>
  ({ kind: 'test', test: { ...(crewTestType ? { crewTestType, stake: { authored: 'Le navire tient.' } } : { skill: { id: 'perception' } }), difficulty: 'difficile' }, reussite: { kind: 'sequence', etapes: [] }, echec });
const chemins = (flow: unknown): string[] => {
  const r = sceneFlowSchema.safeParse(flow);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('cible « testeur » : la branche d’un Test à testeur unique', () => {
  it('admise sous la réussite ou l’échec d’un Test, à travers sequence et si', () => {
    expect(chemins(test(blesse('testeur')))).toEqual([]);
    expect(chemins(test({ kind: 'sequence', etapes: [{ kind: 'si', condition: { kind: 'always' }, alors: blesse('testeur') }] }))).toEqual([]);
  });

  it('refusée hors de tout Test, nommée par son chemin', () => {
    expect(chemins({ kind: 'sequence', etapes: [blesse('groupe'), blesse('testeur')] })).toEqual(['etapes.1.effet.on']);
  });

  it('refusée sous un Test d’équipage, même imbriqué dans la branche d’un Test à testeur unique', () => {
    expect(chemins(test(blesse('testeur'), 'affaler'))).toEqual(['echec.effet.on']);
    expect(chemins(test(test(blesse('testeur'), 'affaler')))).toEqual(['echec.echec.effet.on']);
  });

  it('refusée dans le flux d’un effet programmé, même posé sous la branche d’un Test : ce flux se joue ailleurs', () => {
    const programme = { kind: 'effet', effet: { type: 'delayedEffect', afterMinutes: 10, flow: blesse('testeur') } };
    expect(chemins(test(programme))).toEqual(['echec.effet.flow.effet.on']);
  });

  it('refusée dans les effets d’une péripétie de route, joués hors de tout Test', () => {
    const r = routePerilSchema.safeParse({ label: 'Chute', chancePct: 100, effects: [blesse('testeur').effet] });
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.'))).toEqual(['effects.0.on']);
  });

  it('refusée avec un `heroId`, qu’elle ignorerait', () => {
    expect(chemins(test(blesse('testeur', 'h1')))).toEqual(['echec.effet.heroId']);
  });
});

describe('action authorée : un libellé, de l’auteur ou du catalogue', () => {
  const action = (id: string, label?: string) => actionAuthoreeSchema.safeParse({ id, ...(label ? { label } : {}), flow: { kind: 'sequence', etapes: [] } });

  it('sans libellé, admise sous un identifiant que le catalogue nomme', () => {
    expect(action('fouiller').success).toBe(true);
  });

  it('sans libellé, refusée sous un identifiant hors catalogue ; admise dès qu’elle en porte un', () => {
    const r = action('chute');
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join('.'))).toEqual(['label']);
    expect(action('chute', 'Dalle suspecte').success).toBe(true);
  });
});
