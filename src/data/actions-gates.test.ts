/** #2968 */
import { describe, expect, it } from 'vitest';
import actions from './actions.json';
import { z } from 'zod';
import { validateDataset, noeudObjet } from './schemas/validate';
import { schema } from './schemas/defs/actions';
import { ACTION_GATES } from '../noyau/actionRegistry';
import { inferFields } from '../ui/compendium/editFields';

describe('gates des actions', () => {
  it('valide toutes les actions du corpus réel', () => {
    expect(validateDataset('actions.json', actions)).toBeNull();
  });

  it.each([{ gate: 'gate-inconnue' }, { gate: ['toujours', 'gate-inconnue'] }])('refuse une gate inconnue : %j', ({ gate }) => {
    expect(validateDataset('actions.json', [{ ...actions[0], gate }])).not.toBeNull();
  });

  it('expose des choix nommés pour la gate simple et chaque gate composée', () => {
    const objet = noeudObjet(schema) as z.ZodObject;
    const gate = objet.shape.gate;
    expect(gate).toBeInstanceOf(z.ZodUnion);
    const [simple, composee] = (gate as z.ZodUnion).options;
    expect(simple).toBeInstanceOf(z.ZodEnum);
    expect((composee as z.ZodArray).element).toBe(simple);
    const attendus = Object.fromEntries(Object.entries(ACTION_GATES).map(([id, gate]) => [id, gate.label]));
    expect((simple as z.ZodEnum).meta()?.valeurs).toEqual(attendus);
    expect(new Set((simple as z.ZodEnum).options)).toEqual(new Set(Object.keys(attendus)));
    const champ = inferFields([{ gate: 'toujours' }], { noeud: z.object({ gate: simple as z.ZodEnum }) }).find((f) => f.key === 'gate');
    expect(champ?.kind).toBe('select');
    expect(champ?.valeurs).toEqual(attendus);
    expect(validateDataset('actions.json', [{ ...actions[0], gate: ['toujours'] }])).not.toBeNull();
  });
});
